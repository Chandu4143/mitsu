import io
import json
import uuid
import zipfile

from PIL import Image

from app.core.config import LIBRARY_ROOT
from app.db.session import SessionLocal
from app.models.models import Gallery, GalleryPage


def make_gallery(
    title: str = "Test Gallery",
    pages: int = 3,
    content_hash: str | None = None,
    file_size: int = 2048,
) -> str:
    """Seed a gallery with real image files so content and cover routes work."""
    gid = str(uuid.uuid4())
    relative = f"galleries/{gid}"
    folder = LIBRARY_ROOT / relative
    folder.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    try:
        gallery = Gallery(
            id=gid,
            relative_path=relative,
            title=title,
            page_count=pages,
            file_size=file_size,
            content_hash=content_hash,
        )
        db.add(gallery)
        for index in range(pages):
            image = Image.new("RGB", (60, 90), (120 + index, 80, 140))
            path = folder / f"page-{index:03d}.png"
            image.save(path)
            db.add(
                GalleryPage(
                    gallery_id=gid,
                    page_index=index,
                    relative_path=f"{relative}/{path.name}",
                    mime_type="image/png",
                    width=60,
                    height=90,
                )
            )
        db.commit()
    finally:
        db.close()
    return gid


def test_bookmarks_lifecycle(client):
    gid = make_gallery(pages=4)

    created = client.post(
        f"/api/v1/galleries/{gid}/bookmarks",
        json={"page_index": 1, "note": "Nice panel"},
    )
    assert created.status_code == 201
    bookmark = created.json()
    assert bookmark["page_index"] == 1
    assert bookmark["note"] == "Nice panel"

    # The same page updates in place instead of creating a second bookmark.
    updated = client.post(
        f"/api/v1/galleries/{gid}/bookmarks",
        json={"page_index": 1, "note": "Even better"},
    )
    assert updated.status_code == 201
    assert updated.json()["id"] == bookmark["id"]
    assert updated.json()["note"] == "Even better"

    listed = client.get(f"/api/v1/galleries/{gid}/bookmarks")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    out_of_range = client.post(
        f"/api/v1/galleries/{gid}/bookmarks", json={"page_index": 99}
    )
    assert out_of_range.status_code == 422

    deleted = client.delete(f"/api/v1/galleries/{gid}/bookmarks/{bookmark['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/galleries/{gid}/bookmarks").json() == []

    missing = client.delete(f"/api/v1/galleries/{gid}/bookmarks/{bookmark['id']}")
    assert missing.status_code == 404


def test_cover_from_page(client):
    gid = make_gallery(pages=3)

    response = client.put(
        f"/api/v1/galleries/{gid}/cover", json={"page_index": 2}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["cover_page_index"] == 2
    assert body["cover_url"].endswith(f"/galleries/{gid}/cover")

    cover = client.get(f"/api/v1/galleries/{gid}/cover")
    assert cover.status_code == 200
    assert cover.headers["content-type"].startswith("image/jpeg")

    invalid = client.put(f"/api/v1/galleries/{gid}/cover", json={"page_index": 10})
    assert invalid.status_code == 422


def test_progress_history_and_stats(client):
    gid = make_gallery(pages=5)

    progress = client.put(
        f"/api/v1/galleries/{gid}/progress",
        json={"current_page": 2, "status": "reading"},
    )
    assert progress.status_code == 200
    assert progress.json()["current_page"] == 2

    client.post(
        f"/api/v1/galleries/{gid}/bookmarks", json={"page_index": 2, "note": "Pause"}
    )
    client.put(f"/api/v1/galleries/{gid}/favorite", json={"favorite": True})

    history = client.get("/api/v1/history")
    assert history.status_code == 200
    assert [item["id"] for item in history.json()] == [gid]

    stats = client.get("/api/v1/stats").json()
    assert stats["reading"] == 1
    assert stats["completed"] == 0
    assert stats["favorites"] == 1
    assert stats["bookmarks"] == 1

    client.put(
        f"/api/v1/galleries/{gid}/progress",
        json={"current_page": 4, "status": "completed"},
    )
    stats = client.get("/api/v1/stats").json()
    assert stats["reading"] == 0
    assert stats["completed"] == 1


def test_metadata_lookup_and_apply(client):
    gid = make_gallery(title="[Group] My Title (Digital) English", pages=2)

    lookup = client.post(
        f"/api/v1/galleries/{gid}/metadata/lookup", json={"source_id": "local"}
    )
    assert lookup.status_code == 200
    candidate = lookup.json()
    assert candidate["candidate"]["title"] == "My Title"
    assert candidate["candidate"]["language"] == "en"

    applied = client.post(
        f"/api/v1/galleries/{gid}/metadata/apply",
        json={"record_id": candidate["id"]},
    )
    assert applied.status_code == 200
    assert applied.json()["applied"] is True

    gallery = client.get(f"/api/v1/galleries/{gid}").json()
    assert gallery["title"] == "My Title"
    assert gallery["language"] == "en"


def test_duplicate_detection(client):
    make_gallery(title="Copy one", pages=1, content_hash="same-fingerprint")
    make_gallery(title="Copy two", pages=2, content_hash="same-fingerprint")

    response = client.get("/api/v1/maintenance/duplicates")
    assert response.status_code == 200
    body = response.json()
    assert body["total_groups"] == 1
    assert body["groups"][0]["count"] == 2
    titles = {item["title"] for item in body["groups"][0]["items"]}
    assert titles == {"Copy one", "Copy two"}


def test_backup_export_and_restore(client):
    gid = make_gallery(title="Backup me", pages=2)

    info = client.get("/api/v1/backup/info")
    assert info.status_code == 200
    assert info.json()["stats"]["galleries"] == 1
    assert info.json()["database_bytes"] > 0

    exported = client.get("/api/v1/backup/export?include_library=false")
    assert exported.status_code == 200
    assert exported.headers["content-type"] == "application/zip"

    with zipfile.ZipFile(io.BytesIO(exported.content)) as archive:
        names = archive.namelist()
        assert "database/mitsu.db" in names
        assert "manifest.json" in names
        assert "stats.json" in names
        manifest = json.loads(archive.read("manifest.json"))
        assert manifest["app"] == "mitsu"
        assert manifest["includes_library"] is False

    restored = client.post(
        "/api/v1/backup/restore?include_library=false",
        files={"file": ("backup.zip", exported.content, "application/zip")},
    )
    assert restored.status_code == 200
    result = restored.json()
    assert result["restored"] is True
    assert result["stats"]["galleries"] == 1
    assert result["safety_database"]

    gallery = client.get(f"/api/v1/galleries/{gid}")
    assert gallery.status_code == 200
    assert gallery.json()["title"] == "Backup me"


def test_backup_restore_rejects_invalid_archive(client):
    response = client.post(
        "/api/v1/backup/restore?include_library=false",
        files={"file": ("notes.zip", b"not a zip", "application/zip")},
    )
    assert response.status_code == 422


def test_cover_rebuild_job(client):
    gid = make_gallery(pages=2)

    started = client.post("/api/v1/maintenance/thumbnails")
    assert started.status_code == 202
    job_id = started.json()["id"]

    fetched = client.get(f"/api/v1/maintenance/thumbnails/{job_id}")
    assert fetched.status_code == 200
    assert fetched.json()["status"] == "completed"

    cover = client.get(f"/api/v1/galleries/{gid}/cover")
    assert cover.status_code == 200
