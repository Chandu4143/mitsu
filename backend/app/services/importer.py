import json
import shutil
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import (
    LIBRARY_ROOT,
    MAX_ARCHIVE_BYTES,
    MAX_ARCHIVE_ENTRIES,
    MAX_EXTRACTED_BYTES,
    MAX_IMAGE_PIXELS,
)
from app.db.session import SessionLocal
from app.models.models import (
    Artist,
    Gallery,
    GalleryArtist,
    GalleryPage,
    GalleryTag,
    Job,
    LibraryRoot,
    ReadingProgress,
    Tag,
)
from app.services.utils import (
    IMAGE_EXTS,
    folder_fingerprint,
    human_title,
    mime_for,
    natural_key,
    sha256_file,
)

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class ImportCancelled(Exception):
    pass


class ImportErrorSafe(Exception):
    pass


def ensure_default_root(db: Session) -> LibraryRoot:
    root = db.query(LibraryRoot).filter(LibraryRoot.path == str(LIBRARY_ROOT)).first()
    if not root:
        root = LibraryRoot(path=str(LIBRARY_ROOT), is_enabled=True)
        db.add(root)
        db.commit()
        db.refresh(root)
    return root


def ensure_root_for_path(db: Session, target: Path) -> LibraryRoot:
    """Register the source parent as an explicit library root.

    Importing a path is an explicit user action; recording its parent keeps later
    imports auditable and ensures file serving stays inside a configured root.
    """
    parent = target if target.is_dir() else target.parent
    parent = parent.resolve()
    root = db.query(LibraryRoot).filter(LibraryRoot.path == str(parent)).first()
    if not root:
        root = LibraryRoot(path=str(parent), is_enabled=True)
        db.add(root)
        db.commit()
        db.refresh(root)
    return root


def resolve_import_source(db: Session, path: str | None, root_id: str | None, relative_path: str | None) -> tuple[Path, LibraryRoot]:
    if root_id:
        root = db.query(LibraryRoot).filter(LibraryRoot.id == root_id).first()
        if not root or not root.is_enabled:
            raise ImportErrorSafe("Library root not found or disabled")
        if not relative_path:
            raise ImportErrorSafe("relative_path is required with root_id")
        root_path = Path(root.path).resolve()
        target = (root_path / relative_path).resolve()
        if target != root_path and root_path not in target.parents:
            raise ImportErrorSafe("Import path escapes the configured library root")
        if not target.exists():
            raise ImportErrorSafe("Import path does not exist")
        return target, root

    if not path:
        raise ImportErrorSafe("An import path is required")
    target = Path(path).expanduser().resolve()
    if not target.exists():
        raise ImportErrorSafe(f"Path not found: {path}")
    root = ensure_root_for_path(db, target)
    return target, root


def _is_unsafe_name(name: str) -> bool:
    normalized = name.replace("\\", "/")
    if normalized.startswith("/") or normalized.startswith("../") or "/../" in normalized:
        return True
    if normalized.startswith("__MACOSX/"):
        return True
    parts = [p for p in normalized.split("/") if p not in ("", ".")]
    return any(p == ".." for p in parts)


def _extract_archive(archive: Path, dest: Path):
    if zipfile.is_zipfile(archive) is False:
        raise ImportErrorSafe("File is not a valid ZIP/CBZ archive")
    if archive.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ImportErrorSafe("Archive exceeds the configured size limit")

    dest.mkdir(parents=True, exist_ok=True)
    extracted = 0
    with zipfile.ZipFile(archive) as zf:
        members = zf.infolist()
        if len(members) > MAX_ARCHIVE_ENTRIES:
            raise ImportErrorSafe("Archive contains too many entries")
        for member in members:
            if member.is_dir():
                continue
            if _is_unsafe_name(member.filename):
                raise ImportErrorSafe(f"Unsafe archive entry: {member.filename}")
            mode = member.external_attr >> 16
            if mode and (mode & 0o170000) == 0o120000:
                raise ImportErrorSafe(f"Archive contains a symbolic link: {member.filename}")
            name = Path(member.filename)
            if name.suffix.lower() not in IMAGE_EXTS:
                continue
            extracted += member.file_size
            if extracted > MAX_EXTRACTED_BYTES:
                raise ImportErrorSafe("Archive expands beyond the configured limit")
            target = (dest / member.filename).resolve()
            if dest.resolve() not in target.parents:
                raise ImportErrorSafe(f"Unsafe archive entry: {member.filename}")
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member) as src, target.open("wb") as out:
                shutil.copyfileobj(src, out)


def _copy_folder(source: Path, dest: Path):
    files = [p for p in source.rglob("*") if p.is_file()]
    total = 0
    for file in files:
        if file.is_symlink():
            continue
        if file.suffix.lower() not in IMAGE_EXTS:
            continue
        resolved = file.resolve()
        if source.resolve() not in resolved.parents:
            continue
        total += file.stat().st_size
        if total > MAX_EXTRACTED_BYTES:
            raise ImportErrorSafe("Folder expands beyond the configured import limit")
        rel = resolved.relative_to(source.resolve())
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(resolved, target)


def _collect_images(root: Path) -> list[Path]:
    images = []
    for path in root.rglob("*"):
        if not path.is_file() or path.is_symlink():
            continue
        if path.name.startswith(".") or path.name == "_cover.jpg":
            continue
        if path.suffix.lower() in IMAGE_EXTS:
            images.append(path)
    images.sort(key=lambda p: natural_key(p.relative_to(root).as_posix()))
    return images


def _read_comic_info(source: Path) -> dict:
    xml_bytes = None
    try:
        if source.is_file() and source.suffix.lower() in {".zip", ".cbz"}:
            with zipfile.ZipFile(source) as zf:
                for name in zf.namelist():
                    if Path(name).name.lower() == "comicinfo.xml":
                        xml_bytes = zf.read(name)
                        break
        elif source.is_dir():
            for candidate in source.rglob("ComicInfo.xml"):
                xml_bytes = candidate.read_bytes()
                break
    except Exception:
        return {}
    if not xml_bytes:
        return {}
    try:
        root = ElementTree.fromstring(xml_bytes)
    except ElementTree.ParseError:
        return {}
    result = {}
    for child in root:
        text = (child.text or "").strip()
        if text:
            result[child.tag] = text
    return result


def _apply_comic_info(db: Session, gallery: Gallery, info: dict):
    if not info:
        return
    if info.get("Title"):
        gallery.alternate_title = info["Title"][:500]
    if info.get("LanguageISO"):
        gallery.language = info["LanguageISO"][:40].lower()
    if info.get("Writer"):
        for name in [n.strip() for n in info["Writer"].split(",") if n.strip()]:
            norm = name.lower()
            artist = db.query(Artist).filter(Artist.normalized_name == norm).first()
            if not artist:
                artist = Artist(name=name, normalized_name=norm)
                db.add(artist)
                db.flush()
            db.add(GalleryArtist(gallery_id=gallery.id, artist_id=artist.id, source="embedded"))
    for genre in [g.strip() for g in (info.get("Genre") or "").split(",") if g.strip()]:
        norm = genre.lower()
        tag = db.query(Tag).filter(Tag.normalized_name == norm, Tag.category == "general").first()
        if not tag:
            tag = Tag(name=genre, normalized_name=norm, category="general")
            db.add(tag)
            db.flush()
        db.add(GalleryTag(gallery_id=gallery.id, tag_id=tag.id, source="embedded", is_user_override=False))


def _probe_image(path: Path) -> tuple[int | None, int | None]:
    try:
        with Image.open(path) as img:
            img.verify()
        with Image.open(path) as img:
            return img.width, img.height
    except Exception:
        return None, None


def _make_cover(first_image: Path, dest: Path) -> bool:
    try:
        with Image.open(first_image) as img:
            img = img.convert("RGB")
            width, height = img.size
            target_width = min(560, width)
            if target_width < width:
                target_height = max(1, round(height * target_width / width))
                img = img.resize((target_width, target_height), Image.LANCZOS)
            img.save(dest, "JPEG", quality=86, optimize=True)
        return True
    except Exception:
        return False


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


def process_import(job_id: str):
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
        source, root = resolve_import_source(db, payload.get("path"), payload.get("root_id"), payload.get("relative_path"))
        gallery_id = str(uuid.uuid4())
        work_dir = LIBRARY_ROOT / gallery_id
        work_dir.mkdir(parents=True, exist_ok=True)

        if _job_cancelled(job_id):
            raise ImportCancelled()

        if source.is_file() and source.suffix.lower() in {".zip", ".cbz"}:
            _job_update(job_id, progress_total=1)
            _extract_archive(source, work_dir)
            archived = _collect_images(work_dir)
            content_hash = folder_fingerprint(archived, work_dir)
            file_size = source.stat().st_size
        elif source.is_file() and source.suffix.lower() in IMAGE_EXTS:
            shutil.copy2(source, work_dir / source.name)
            content_hash = sha256_file(source)
            file_size = source.stat().st_size
        elif source.is_dir():
            _copy_folder(source, work_dir)
            files = _collect_images(work_dir)
            content_hash = folder_fingerprint(files, work_dir)
            file_size = sum(p.stat().st_size for p in files)
        else:
            raise ImportErrorSafe("Unsupported import input. Use a CBZ/ZIP archive, image, or folder.")

        if _job_cancelled(job_id):
            raise ImportCancelled()

        images = _collect_images(work_dir)
        if not images:
            raise ImportErrorSafe("No supported images found in the import")

        duplicate = (
            db.query(Gallery)
            .filter(Gallery.content_hash == content_hash)
            .order_by(Gallery.date_added.asc())
            .first()
        )
        db.rollback()
        if duplicate:
            _job_update(
                job_id,
                status="completed",
                progress_current=1,
                progress_total=1,
                result_id=duplicate.id,
                error_code="DUPLICATE",
                error_message="This gallery is already in your library.",
                finished_at=datetime.now(timezone.utc),
            )
            shutil.rmtree(work_dir, ignore_errors=True)
            return

        _job_update(job_id, progress_total=len(images))

        valid_pages: list[dict] = []
        for index, image in enumerate(images):
            if _job_cancelled(job_id):
                raise ImportCancelled()
            width, height = _probe_image(image)
            if width is None:
                continue
            valid_pages.append(
                {
                    "page_index": len(valid_pages),
                    "relative_path": image.relative_to(LIBRARY_ROOT).as_posix(),
                    "mime_type": mime_for(image),
                    "width": width,
                    "height": height,
                }
            )
            if index % 5 == 0 or index == len(images) - 1:
                _job_update(job_id, progress_current=index + 1)

        if not valid_pages:
            raise ImportErrorSafe("Every image in this import was unreadable")

        gallery = Gallery(
            id=gallery_id,
            root_id=root.id,
            relative_path=gallery_id,
            title=human_title(source),
            language="unknown",
            page_count=len(valid_pages),
            file_size=file_size,
            content_hash=content_hash,
            source_id="local",
        )
        db.add(gallery)
        db.flush()
        db.add_all([GalleryPage(gallery_id=gallery_id, **page) for page in valid_pages])

        cover_source = LIBRARY_ROOT / valid_pages[0]["relative_path"]
        cover_dest = work_dir / "_cover.jpg"
        if _make_cover(cover_source, cover_dest):
            gallery.cover_path = cover_dest.relative_to(LIBRARY_ROOT).as_posix()
        else:
            gallery.cover_path = valid_pages[0]["relative_path"]

        _apply_comic_info(db, gallery, _read_comic_info(source))
        db.add(ReadingProgress(gallery_id=gallery_id, current_page=0, status="unread"))
        gallery.updated_at = datetime.now(timezone.utc)
        db.commit()

        skipped = len(images) - len(valid_pages)
        _job_update(
            job_id,
            status="completed",
            progress_current=len(valid_pages),
            progress_total=len(images),
            result_id=gallery_id,
            error_message=f"Skipped {skipped} unreadable image(s)." if skipped else None,
            finished_at=datetime.now(timezone.utc),
        )
    except ImportCancelled:
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
            error_code="IMPORT_FAILED",
            error_message=str(exc)[:1000],
            finished_at=datetime.now(timezone.utc),
        )
    finally:
        db.close()
