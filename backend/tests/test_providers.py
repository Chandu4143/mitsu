import pytest

from app.db.session import SessionLocal
from app.models.models import Gallery
from app.services import providers as providersvc


def gallery_item(gallery_id: int, **overrides):
    data = {
        "id": gallery_id,
        "english_title": f"Gallery {gallery_id}",
        "thumbnail": f"galleries/{gallery_id}/thumb.webp",
        "num_pages": 10,
        "num_favorites": 1234,
        "blacklisted": False,
    }
    data.update(overrides)
    return data


@pytest.fixture(autouse=True)
def provider_state(monkeypatch):
    providersvc.clear_cache()
    monkeypatch.setattr(providersvc, "is_available", lambda: True)
    yield
    providersvc.clear_cache()


def test_search_returns_meta_and_filters_blacklisted(monkeypatch):
    calls = []

    def fake_api(path):
        calls.append(path)
        return {
            "result": [gallery_item(111), gallery_item(222), gallery_item(333, blacklisted=True)],
            "total": 90,
            "num_pages": 4,
            "per_page": 25,
        }

    monkeypatch.setattr(providersvc, "_api_get", fake_api)

    result = providersvc.search_nhentai("blue archive", page=2, sort="popular", language="en")

    assert result["items"][0]["id"] == "111"
    assert len(result["items"]) == 2
    assert result["total"] == 90
    assert result["num_pages"] == 4
    assert result["page"] == 2
    assert result["sort"] == "popular"
    assert "page=2" in calls[0]
    assert "sort=popular" in calls[0]
    assert "language%3Aenglish" in calls[0]
    assert result["items"][0]["num_favorites"] == 1234


def test_search_caches_repeated_requests(monkeypatch):
    calls = []

    def fake_api(path):
        calls.append(path)
        return {"result": [gallery_item(1)], "total": 1, "num_pages": 1, "per_page": 25}

    monkeypatch.setattr(providersvc, "_api_get", fake_api)

    first = providersvc.search_nhentai("same query")
    first["items"].clear()
    second = providersvc.search_nhentai("same query")

    assert len(calls) == 1
    assert second["items"], "cached results must not be mutated by callers"


def test_search_falls_back_to_valid_sort_and_language(monkeypatch):
    paths = []

    def fake_api(path):
        paths.append(path)
        return {"result": [gallery_item(1)], "total": 1, "num_pages": 1, "per_page": 25}

    monkeypatch.setattr(providersvc, "_api_get", fake_api)

    result = providersvc.search_nhentai("query", sort="nope", language="klingon")

    assert result["sort"] == "date"
    assert result["language"] == ""
    assert "sort=date" in paths[0]
    assert "language" not in paths[0]


def test_empty_query_browses_recent(monkeypatch):
    paths = []

    def fake_api(path):
        paths.append(path)
        return {
            "result": [gallery_item(500)],
            "total": 655000,
            "num_pages": 26200,
            "per_page": 25,
        }

    monkeypatch.setattr(providersvc, "_api_get", fake_api)

    result = providersvc.search_nhentai("")

    assert paths[0] == "/galleries?page=1"
    assert result["items"][0]["id"] == "500"
    assert result["num_pages"] == 26200


def test_numeric_query_resolves_gallery_code(monkeypatch):
    paths = []

    def fake_api(path):
        paths.append(path)
        return gallery_item(12345, num_pages=42)

    monkeypatch.setattr(providersvc, "_api_get", fake_api)

    result = providersvc.search_nhentai("12345")

    assert paths == ["/galleries/12345"]
    assert result["total"] == 1
    assert result["items"][0]["id"] == "12345"
    assert result["items"][0]["page_count"] == 42


def test_route_marks_items_already_in_library(client, monkeypatch):
    db = SessionLocal()
    try:
        db.add(
            Gallery(
                id="local-1",
                relative_path="local-1",
                title="Local copy",
                source_id="nhentai",
                external_id="111",
            )
        )
        db.commit()
    finally:
        db.close()

    def fake_api(path):
        return {
            "result": [gallery_item(111), gallery_item(222)],
            "total": 2,
            "num_pages": 1,
            "per_page": 25,
        }

    monkeypatch.setattr(providersvc, "_api_get", fake_api)

    response = client.get("/api/v1/providers/nhentai/search?q=test")

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["in_library"] is True
    assert body["items"][0]["library_id"] == "local-1"
    assert body["items"][1]["in_library"] is False
    assert body["items"][1]["library_id"] is None


def test_route_reports_rate_limits(client, monkeypatch):
    def limited(path):
        raise providersvc.ProviderRateLimited("nhentai is rate limiting requests.")

    monkeypatch.setattr(providersvc, "_api_get", limited)

    response = client.get("/api/v1/providers/nhentai/search?q=test")

    assert response.status_code == 429
    assert "rate limiting" in response.json()["error"]["message"]


def test_import_metadata_is_persisted():
    db = SessionLocal()
    try:
        gallery = Gallery(id="meta-1", relative_path="meta-1", title="Test gallery")
        db.add(gallery)
        db.flush()

        providersvc._apply_nhentai_metadata(
            db,
            gallery,
            {
                "title": {"english": "Test gallery", "japanese": "テスト"},
                "tags": [
                    {"type": "language", "name": "english"},
                    {
                        "type": "language",
                        "name": "japanese | definition revised please read the wiki",
                    },
                    {"type": "tag", "name": "sole female"},
                    {"type": "tag", "name": "Sole Female"},
                    {"type": "artist", "name": "Artist One"},
                    {"type": "parody", "name": "Blue Archive"},
                    {"type": "character", "name": "Yuuka"},
                ],
            },
        )
        db.commit()
        db.refresh(gallery)

        assert gallery.language == "en"
        assert gallery.alternate_title == "テスト"
        names = {link.tag.name for link in gallery.tags}
        assert {"sole female", "Blue Archive", "Yuuka"} <= names
        assert sum(1 for link in gallery.tags if link.tag.normalized_name == "sole female") == 1
        assert {link.artist.name for link in gallery.artists} == {"Artist One"}
    finally:
        db.rollback()
        db.close()


def test_service_blocks_missing_provider(monkeypatch):
    monkeypatch.setattr(providersvc, "cloudscraper", None)

    with pytest.raises(providersvc.ProviderUnavailable):
        providersvc._scraper()
