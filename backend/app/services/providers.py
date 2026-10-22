import json
import shutil
import uuid
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.parse import quote

from PIL import Image

from app.core.config import LIBRARY_ROOT, MAX_IMAGE_PIXELS
from app.db.session import SessionLocal
from app.models.models import Gallery, GalleryPage, Job, ReadingProgress
from app.services.utils import folder_fingerprint, mime_for

try:  # cloudscraper is only needed for the optional nhentai provider.
    import cloudscraper
except ImportError:  # pragma: no cover - exercised when the extra is not installed
    cloudscraper = None

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class ProviderCancelled(Exception):
    pass


class ProviderUnavailable(Exception):
    """Raised when the optional provider dependency is not installed."""


API_BASE = "https://nhentai.net/api/v2"
CDN_BASE = "https://i.nhentai.net"
THUMB_BASE = "https://t1.nhentai.net"

PROVIDER_MISSING_MESSAGE = (
    "The nhentai provider requires the 'cloudscraper' package. "
    "Install it with: python -m pip install -r backend/requirements.txt"
)


def is_available() -> bool:
    """Return True when the nhentai provider can be used."""
    return cloudscraper is not None


def _scraper():
    if cloudscraper is None:
        raise ProviderUnavailable(PROVIDER_MISSING_MESSAGE)
    scraper = cloudscraper.create_scraper()
    scraper.headers.update({"User-Agent": "Mitsu/1.0 (https://github.com/mitsu)"})
    return scraper


def _api_get(path: str):
    scraper = _scraper()
    response = scraper.get(API_BASE + path, timeout=30)
    if response.status_code != 200:
        raise ValueError(f"nhentai API request failed with status {response.status_code}")
    return response.json()


def _normalize_gallery(data: dict) -> dict:
    """Normalize a gallery payload from either the search or the gallery endpoint."""
    gallery_id = str(data.get("id"))
    title_obj = data.get("title")
    if isinstance(title_obj, dict):
        title = title_obj.get("english") or title_obj.get("pretty") or title_obj.get("japanese")
    else:
        title = data.get("english_title") or data.get("japanese_title") or data.get("title")
    if not title:
        title = f"nhentai {gallery_id}"

    thumb = data.get("thumbnail")
    thumb_path = thumb.get("path") if isinstance(thumb, dict) else thumb
    cover = data.get("cover")
    cover_path = cover.get("path") if isinstance(cover, dict) else cover

    # The API sometimes reports a doubled ".webp.webp" extension for the cover,
    # so derive the cover path from the thumbnail instead: it is always served.
    if thumb_path:
        folder, _, filename = thumb_path.rpartition("/")
        stem, _, extension = filename.partition(".")
        derived_cover = f"{folder}/cover.{extension}" if stem else ""
    else:
        derived_cover = ""

    return {
        "id": gallery_id,
        "title": unescape(title),
        # The cover is a much larger asset than the thumbnail (700x990 vs 250x353).
        "cover_url": f"{THUMB_BASE}/{derived_cover or cover_path}" if (derived_cover or cover_path) else None,
        "thumbnail_url": f"{THUMB_BASE}/{thumb_path}" if thumb_path else None,
        "media_id": str(data.get("media_id") or ""),
        "page_count": data.get("num_pages"),
        "source": "nhentai",
        "source_url": f"https://nhentai.net/g/{gallery_id}/",
    }


def search_nhentai(query: str, page: int = 1) -> list[dict]:
    query = (query or "").strip()
    if not query:
        return []

    # A bare gallery code (e.g. "689735") is not matched by the text search
    # endpoint, so resolve it straight from the gallery endpoint instead.
    if query.isdigit():
        try:
            data = _api_get(f"/galleries/{query}")
        except Exception:
            data = None
        if data and data.get("id"):
            return [_normalize_gallery(data)]

    data = _api_get(f"/search?query={quote(query)}&page={max(1, page)}")
    results = []
    seen = set()
    for item in data.get("result", []):
        gallery_id = str(item.get("id"))
        if gallery_id in seen:
            continue
        seen.add(gallery_id)
        results.append(_normalize_gallery(item))
    return results


def _gallery_info(gallery_id: str) -> tuple[str, str, int, list[dict]]:
    data = _api_get(f"/galleries/{gallery_id}")
    title_obj = data.get("title") or {}
    title = title_obj.get("english") or title_obj.get("pretty") or title_obj.get("japanese") or f"nhentai {gallery_id}"
    media_id = str(data.get("media_id") or "")
    if not media_id:
        raise ValueError("Gallery media id could not be determined")
    pages = data.get("pages") or []
    if not pages:
        raise ValueError("Gallery has no readable pages")
    return unescape(title), media_id, len(pages), pages


def _job_update(job_id: str, **fields):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for key, value in fields.items():
                setattr(job, key, value)
            job.updated_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


def _job_cancelled(job_id: str) -> bool:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        return bool(job and (job.cancel_requested or job.status == "cancelled"))
    finally:
        db.close()


def import_nhentai(job_id: str):
    db = SessionLocal()
    work_dir: Path | None = None
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        if job.status == "cancelled":
            return
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.updated_at = datetime.now(timezone.utc)
        db.commit()

        payload = json.loads(job.payload_json or "{}")
        gallery_id_remote = str(payload.get("id") or "").strip()
        if not gallery_id_remote.isdigit():
            raise ValueError("A numeric nhentai gallery id is required")

        title, media_id, page_count, pages = _gallery_info(gallery_id_remote)

        gallery_uuid = str(uuid.uuid4())
        work_dir = LIBRARY_ROOT / gallery_uuid
        work_dir.mkdir(parents=True, exist_ok=True)

        _job_update(job_id, progress_total=page_count)

        image_paths = []
        scraper = _scraper()
        for page in pages:
            if _job_cancelled(job_id):
                raise ProviderCancelled()
            page_number = int(page.get("number") or (len(image_paths) + 1))
            rel_path = page.get("path")
            if not rel_path:
                continue
            url = f"{CDN_BASE}/{rel_path}"
            response = scraper.get(url, timeout=30)
            if response.status_code != 200 or not response.content:
                continue
            target = work_dir / f"{page_number}.webp"
            target.write_bytes(response.content)
            image_paths.append((target, page))

            if page_number % 3 == 0 or page_number == page_count:
                _job_update(job_id, progress_current=page_number)

        if not image_paths:
            raise ValueError("No pages could be downloaded")

        valid_pages = []
        for target, page in sorted(image_paths, key=lambda x: int(x[1].get("number", 0))):
            try:
                with Image.open(target) as img:
                    img.verify()
                with Image.open(target) as img:
                    width, height = img.width, img.height
            except Exception:
                continue
            relative = target.relative_to(LIBRARY_ROOT).as_posix()
            valid_pages.append(
                {
                    "page_index": len(valid_pages),
                    "relative_path": relative,
                    "mime_type": mime_for(target),
                    "width": width,
                    "height": height,
                }
            )

        if not valid_pages:
            raise ValueError("Downloaded images were unreadable")

        content_hash = folder_fingerprint([LIBRARY_ROOT / p["relative_path"] for p in valid_pages], LIBRARY_ROOT)
        duplicate = db.query(Gallery).filter(Gallery.content_hash == content_hash).first()
        db.rollback()
        if duplicate:
            _job_update(
                job_id,
                status="completed",
                progress_current=len(valid_pages),
                progress_total=page_count,
                result_id=duplicate.id,
                error_code="DUPLICATE",
                error_message="This gallery is already in your library.",
                finished_at=datetime.now(timezone.utc),
            )
            if work_dir:
                shutil.rmtree(work_dir, ignore_errors=True)
            return

        gallery = Gallery(
            id=gallery_uuid,
            relative_path=gallery_uuid,
            title=title,
            language="unknown",
            page_count=len(valid_pages),
            file_size=sum((LIBRARY_ROOT / p["relative_path"]).stat().st_size for p in valid_pages),
            content_hash=content_hash,
            source_id="nhentai",
            external_id=gallery_id_remote,
        )
        db.add(gallery)
        db.flush()
        db.add_all([GalleryPage(gallery_id=gallery_uuid, **page) for page in valid_pages])

        cover_source = LIBRARY_ROOT / valid_pages[0]["relative_path"]
        cover_dest = work_dir / "_cover.jpg"
        try:
            with Image.open(cover_source) as img:
                img = img.convert("RGB")
                width, height = img.size
                target_width = min(560, width)
                if target_width < width:
                    target_height = max(1, round(height * target_width / width))
                    img = img.resize((target_width, target_height), Image.LANCZOS)
                img.save(cover_dest, "JPEG", quality=86, optimize=True)
            gallery.cover_path = cover_dest.relative_to(LIBRARY_ROOT).as_posix()
        except Exception:
            gallery.cover_path = valid_pages[0]["relative_path"]

        db.add(ReadingProgress(gallery_id=gallery_uuid, current_page=0, status="unread"))
        gallery.updated_at = datetime.now(timezone.utc)
        db.commit()

        _job_update(
            job_id,
            status="completed",
            progress_current=len(valid_pages),
            progress_total=page_count,
            result_id=gallery_uuid,
            finished_at=datetime.now(timezone.utc),
        )
    except ProviderCancelled:
        db.rollback()
        if work_dir:
            shutil.rmtree(work_dir, ignore_errors=True)
        _job_update(
            job_id,
            status="cancelled",
            finished_at=datetime.now(timezone.utc),
            error_message="Import cancelled.",
        )
    except Exception as exc:
        db.rollback()
        if work_dir:
            shutil.rmtree(work_dir, ignore_errors=True)
        _job_update(
            job_id,
            status="failed",
            error_code="PROVIDER_IMPORT_FAILED",
            error_message=str(exc)[:1000],
            finished_at=datetime.now(timezone.utc),
        )
    finally:
        db.close()
