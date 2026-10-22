import os
import uuid
import zipfile
import shutil
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.config import LIBRARY_ROOT
from app.models.models import LibraryRoot, Gallery, GalleryPage, ReadingProgress, Job
from app.services.jobs import update_job
from app.services.utils import natural_key
from app.db.session import SessionLocal

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

def ensure_default_root(db: Session) -> LibraryRoot:
    root = db.query(LibraryRoot).filter(LibraryRoot.path == str(LIBRARY_ROOT)).first()
    if not root:
        root = LibraryRoot(path=str(LIBRARY_ROOT), is_enabled=True)
        db.add(root)
        db.commit()
        db.refresh(root)
    return root

def _collect_images_from_dir(d: Path):
    files = []
    for p in d.rglob("*"):
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
            files.append(p)
    files.sort(key=lambda p: natural_key(p.name))
    return files

def _safe_extract(zf: zipfile.ZipFile, dest: Path):
    for member in zf.infolist():
        # security: reject traversal
        target = dest / member.filename
        if ".." in member.filename or member.filename.startswith("/") or member.filename.startswith("\\"):
            raise ValueError(f"Unsafe archive entry: {member.filename}")
        if member.is_dir():
            continue
        if Path(member.filename).suffix.lower() not in IMAGE_EXTS:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(member) as src, open(target, "wb") as dst:
            shutil.copyfileobj(src, dst)

def process_import(job_id: str, src_path: str):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "running"
            job.started_at = datetime.now(timezone.utc)
            db.commit()

        root = ensure_default_root(db)
        src = Path(src_path)
        if not src.exists():
            raise FileNotFoundError(f"Path not found: {src_path}")

        # Prepare a working directory for this gallery
        gallery_id = str(uuid.uuid4())
        work_dir = LIBRARY_ROOT / gallery_id
        work_dir.mkdir(parents=True, exist_ok=True)

        if src.is_file() and src.suffix.lower() in {".zip", ".cbz"}:
            with zipfile.ZipFile(src, "r") as zf:
                _safe_extract(zf, work_dir)
            images = _collect_images_from_dir(work_dir)
        elif src.is_dir():
            images = _collect_images_from_dir(src)
            # copy into work_dir to keep a stable location? We'll just reference src files.
            # For simplicity, if importing a folder, point gallery at src relative to root.
            # But serving requires root containment; src may be outside LIBRARY_ROOT.
            # Copy folder contents into work_dir to be safe.
            if src.resolve() != work_dir.resolve():
                # copy images preserving order
                for p in images:
                    rel = p.relative_to(src)
                    dst = work_dir / rel
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(p, dst)
                images = _collect_images_from_dir(work_dir)
        else:
            raise ValueError("Unsupported import input")

        if not images:
            raise ValueError("No supported images found")

        # Build gallery
        title = src.stem if src.is_file() else src.name
        total_size = sum(p.stat().st_size for p in images)
        # content hash
        h = hashlib.sha256()
        for p in images:
            h.update(p.read_bytes()[:4096])
        content_hash = h.hexdigest()

        gallery = Gallery(
            id=gallery_id,
            root_id=root.id,
            relative_path=gallery_id,
            title=title,
            page_count=len(images),
            file_size=total_size,
            content_hash=content_hash,
        )
        db.add(gallery)
        db.commit()

        # pages
        for idx, img in enumerate(images):
            rel = img.relative_to(LIBRARY_ROOT).as_posix()
            page = GalleryPage(
                gallery_id=gallery_id,
                page_index=idx,
                relative_path=rel,
                mime_type=_mime(img.suffix),
            )
            db.add(page)
        # cover = first page
        first_rel = images[0].relative_to(LIBRARY_ROOT).as_posix()
        gallery.cover_path = first_rel
        # progress
        prog = ReadingProgress(gallery_id=gallery_id, current_page=0, status="unread")
        db.add(prog)
        db.commit()

        # update job
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "completed"
            job.progress_current = len(images)
            job.progress_total = len(images)
            job.finished_at = datetime.now(timezone.utc)
            job.updated_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as e:
        db.rollback()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            job.finished_at = datetime.now(timezone.utc)
            job.updated_at = datetime.now(timezone.utc)
            db.commit()
        # cleanup work_dir on failure? keep for debugging
    finally:
        db.close()

def _mime(suffix):
    return {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
    }.get(suffix.lower(), "image/jpeg")
