import copy
import json
import shutil
import threading
import time
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.parse import quote

from PIL import Image

from app.core.config import LIBRARY_ROOT, MAX_IMAGE_PIXELS
from app.db.session import SessionLocal
from app.models.models import (
    Artist,
    Gallery,
    GalleryArtist,
    GalleryPage,
    GalleryTag,
    Job,
    ReadingProgress,
    Tag,
)
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


class ProviderRateLimited(Exception):
    """Raised when nhentai asks us to slow down."""


API_BASE = "https://nhentai.net/api/v2"
CDN_BASE = "https://i.nhentai.net"
THUMB_BASE = "https://t1.nhentai.net"

PROVIDER_MISSING_MESSAGE = (
    "The nhentai provider requires the 'cloudscraper' package. "
    "Install it with: python -m pip install -r backend/requirements.txt"
)

RATE_LIMIT_MESSAGE = (
    "nhentai is rate limiting requests. Wait a few seconds and try again."
)

# Sort keys accepted by the API, mapped to the labels the UI offers.
SORTS = {
    "date": "date",
    "popular": "popular",
    "popular-today": "popular-today",
    "popular-week": "popular-week",
    "popular-month": "popular-month",
}

# nhentai search syntax supports `language:<name>` terms.
LANGUAGES = {
    "en": "english",
    "ja": "japanese",
    "zh": "chinese",
}

# nhentai language tags are free-form; map them onto the codes Mitsu stores.
LANGUAGE_CODES = {
    "english": "en",
    "japanese": "ja",
    "chinese": "zh",
    "korean": "ko",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "portuguese": "pt",
    "italian": "it",
    "russian": "ru",
}

# Search responses are cached briefly: typing and paging should not hammer the
# provider, and Cloudflare starts returning 429 long before a human would.
_CACHE_TTL_SECONDS = 90
_CACHE_MAX_ENTRIES = 64
_cache: "OrderedDict[tuple, tuple[float, dict]]" = OrderedDict()
_cache_lock = threading.Lock()

_local = threading.local()


def _scraper():
    if cloudscraper is None:
        raise ProviderUnavailable(PROVIDER_MISSING_MESSAGE)
    session = getattr(_local, "session", None)
    if session is None:
        session = cloudscraper.create_scraper()
        session.headers.update({"User-Agent": "Mitsu/1.0 (https://github.com/mitsu)"})
        _local.session = session
    return session


def is_available() -> bool:
    """Return True when the nhentai provider can be used."""
    return cloudscraper is not None


def _cache_get(key: tuple) -> dict | None:
    now = time.monotonic()
    with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if expires_at <= now:
            _cache.pop(key, None)
            return None
        _cache.move_to_end(key)
        return copy.deepcopy(value)


def _cache_set(key: tuple, value: dict) -> None:
    with _cache_lock:
        _cache[key] = (time.monotonic() + _CACHE_TTL_SECONDS, value)
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_MAX_ENTRIES:
            _cache.popitem(last=False)


def clear_cache() -> None:
    """Drop cached provider responses (used by tests and manual retries)."""
    with _cache_lock:
        _cache.clear()


def _api_get(path: str):
    response = _scraper().get(API_BASE + path, timeout=30)
    if response.status_code == 429:
        raise ProviderRateLimited(RATE_LIMIT_MESSAGE)
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
        "num_favorites": int(data.get("num_favorites") or 0),
        "blacklisted": bool(data.get("blacklisted")),
        "source": "nhentai",
        "source_url": f"https://nhentai.net/g/{gallery_id}/",
    }


def search_nhentai(
    query: str, page: int = 1, sort: str = "date", language: str = ""
) -> dict:
    """Search (or browse) nhentai and return items plus paging metadata.

    An empty query browses the most recently uploaded galleries. A numeric query
    is resolved straight from the gallery endpoint so codes work even though the
    text search does not index them.
    """
    query = (query or "").strip()
    page = max(1, int(page or 1))
    sort = sort if sort in SORTS else "date"
    language = language if language in LANGUAGES else ""

    cache_key = ("search", query, page, sort, language)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if query.isdigit() and not language:
        try:
            data = _api_get(f"/galleries/{query}")
        except ProviderRateLimited:
            raise
        except Exception:
            data = None
        if data and data.get("id"):
            result = {
                "items": [_normalize_gallery(data)],
                "page": 1,
                "per_page": 1,
                "total": 1,
                "num_pages": 1,
                "sort": sort,
                "language": language,
                "query": query,
            }
            _cache_set(cache_key, result)
            return copy.deepcopy(result)

    if query:
        terms = query
        if language:
            terms = f"{terms} language:{LANGUAGES[language]}"
        path = f"/search?query={quote(terms)}&page={page}&sort={SORTS[sort]}"
    else:
        # The galleries endpoint is the only browse endpoint with paging metadata.
        path = f"/galleries?page={page}"

    data = _api_get(path)
    items = []
    seen = set()
    for item in data.get("result", []) or []:
        if item.get("blacklisted"):
            continue
        gallery_id = str(item.get("id"))
        if gallery_id in seen:
            continue
        seen.add(gallery_id)
        items.append(_normalize_gallery(item))

    result = {
        "items": items,
        "page": page,
        "per_page": int(data.get("per_page") or 25),
        "total": int(data.get("total") or 0),
        "num_pages": int(data.get("num_pages") or 0),
        "sort": sort,
        "language": language,
        "query": query,
    }
    _cache_set(cache_key, result)
    return copy.deepcopy(result)


def _clean_language(name: str) -> str:
    base = (name or "").split("|")[0].strip().lower()
    return LANGUAGE_CODES.get(base, "unknown")


def _apply_nhentai_metadata(db, gallery: Gallery, data: dict) -> None:
    """Copy nhentai tags, artists, and language onto an imported gallery.

    Search cards only expose tag ids, but the gallery endpoint includes names and
    types. Persisting them makes imports searchable by tag and artist locally.
    """
    title_obj = data.get("title")
    if isinstance(title_obj, dict):
        japanese = title_obj.get("japanese")
        if japanese and japanese != gallery.title:
            gallery.alternate_title = unescape(japanese)[:500]

    tags = data.get("tags") or []
    languages = []
    seen_tags = set()
    seen_artists = set()

    for entry in tags:
        name = (entry.get("name") or "").strip()
        kind = (entry.get("type") or "").strip()
        if not name:
            continue

        if kind == "language":
            languages.append(name)
            continue

        if kind == "artist":
            normalized = name.lower()
            if normalized in seen_artists:
                continue
            seen_artists.add(normalized)
            artist = db.query(Artist).filter(Artist.normalized_name == normalized).first()
            if not artist:
                artist = Artist(name=name, normalized_name=normalized)
                db.add(artist)
                db.flush()
            db.add(
                GalleryArtist(
                    gallery_id=gallery.id,
                    artist_id=artist.id,
                    source="nhentai",
                )
            )
            continue

        category = "general" if kind == "tag" else (kind or "general")
        normalized = name.lower()
        key = (normalized, category)
        if key in seen_tags:
            continue
        seen_tags.add(key)
        tag = (
            db.query(Tag)
            .filter(Tag.normalized_name == normalized, Tag.category == category)
            .first()
        )
        if not tag:
            tag = Tag(name=name, normalized_name=normalized, category=category)
            db.add(tag)
            db.flush()
        db.add(
            GalleryTag(
                gallery_id=gallery.id,
                tag_id=tag.id,
                source="nhentai",
                is_user_override=False,
            )
        )

    resolved = next(
        (code for code in (_clean_language(name) for name in languages) if code != "unknown"),
        "unknown",
    )
    gallery.language = resolved


def _gallery_info(gallery_id: str) -> tuple[str, str, int, list[dict], dict]:
    data = _api_get(f"/galleries/{gallery_id}")
    title_obj = data.get("title") or {}
    title = title_obj.get("english") or title_obj.get("pretty") or title_obj.get("japanese") or f"nhentai {gallery_id}"
    media_id = str(data.get("media_id") or "")
    if not media_id:
        raise ValueError("Gallery media id could not be determined")
    pages = data.get("pages") or []
    if not pages:
        raise ValueError("Gallery has no readable pages")
    return unescape(title), media_id, len(pages), pages, data


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

        title, media_id, page_count, pages, data = _gallery_info(gallery_id_remote)

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
        _apply_nhentai_metadata(db, gallery, data)
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
