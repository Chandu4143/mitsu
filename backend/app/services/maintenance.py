"""Housekeeping: cover regeneration, duplicate detection, and backups."""

import json
import os
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import DB_PATH, LIBRARY_ROOT
from app.db.session import SessionLocal, engine, init_db
from app.models.models import Gallery, Job
from app.services import library as libsvc

APP_VERSION = "1.1.0"


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


def regenerate_thumbnails(job_id: str) -> None:
    """Rebuild every gallery cover. Runs in the background, never in a request."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job or job.status == "cancelled":
            return
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.updated_at = datetime.now(timezone.utc)
        db.commit()

        galleries = db.query(Gallery).order_by(Gallery.date_added.asc()).all()
        total = len(galleries)
        _job_update(job_id, progress_total=total)

        rebuilt = 0
        for index, gallery in enumerate(galleries, start=1):
            if _job_cancelled(job_id):
                _job_update(
                    job_id,
                    status="cancelled",
                    finished_at=datetime.now(timezone.utc),
                    error_message="Cover regeneration cancelled.",
                )
                return
            if libsvc.regenerate_cover(db, gallery):
                rebuilt += 1
            if index % 10 == 0 or index == total:
                db.commit()
                _job_update(job_id, progress_current=index)

        db.commit()
        _job_update(
            job_id,
            status="completed",
            progress_current=total,
            progress_total=total,
            error_message=f"Rebuilt {rebuilt} of {total} covers.",
            finished_at=datetime.now(timezone.utc),
        )
    except Exception as exc:  # pragma: no cover - defensive
        db.rollback()
        _job_update(
            job_id,
            status="failed",
            error_code="THUMBNAIL_FAILED",
            error_message=str(exc)[:1000],
            finished_at=datetime.now(timezone.utc),
        )
    finally:
        db.close()


def find_duplicates(db: Session) -> list[dict]:
    """Group galleries that share a content fingerprint."""
    rows = (
        db.query(Gallery.content_hash, func.count(Gallery.id))
        .filter(Gallery.content_hash.isnot(None), Gallery.content_hash != "")
        .group_by(Gallery.content_hash)
        .having(func.count(Gallery.id) > 1)
        .all()
    )
    groups = []
    for content_hash, count in rows:
        galleries = (
            db.query(Gallery)
            .filter(Gallery.content_hash == content_hash)
            .order_by(Gallery.date_added.asc())
            .all()
        )
        groups.append(
            {
                "content_hash": content_hash,
                "count": count,
                "items": [libsvc.to_gallery_out(g) for g in galleries],
            }
        )
    groups.sort(key=lambda group: group["count"], reverse=True)
    return groups


def backup_info(db: Session) -> dict:
    stats = libsvc.stats(db)
    db_size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
    library_exists = LIBRARY_ROOT.exists()
    return {
        "version": APP_VERSION,
        "database_bytes": db_size,
        "library_bytes": stats["bytes"],
        "library_path": str(LIBRARY_ROOT),
        "backup_bytes": db_size + stats["bytes"],
        "stats": stats,
        "library_available": library_exists,
    }


def _snapshot_database(destination: Path) -> None:
    """Copy SQLite safely, including committed WAL contents."""
    source = sqlite3.connect(str(DB_PATH))
    try:
        target = sqlite3.connect(str(destination))
        try:
            source.backup(target)
        finally:
            target.close()
    finally:
        source.close()


def create_backup(include_library: bool = True) -> tuple[Path, int]:
    """Write a portable zip and return its path and size."""
    handle = tempfile.NamedTemporaryFile(
        prefix="mitsu-backup-", suffix=".zip", delete=False
    )
    handle.close()
    archive_path = Path(handle.name)

    with tempfile.TemporaryDirectory(prefix="mitsu-snapshot-") as temp_dir:
        temp = Path(temp_dir)
        snapshot = temp / "mitsu.db"
        _snapshot_database(snapshot)

        check = sqlite3.connect(str(snapshot))
        try:
            integrity = check.execute("PRAGMA integrity_check").fetchone()
            if not integrity or integrity[0] != "ok":
                raise ValueError("The database snapshot failed its integrity check")
            galleries = check.execute("SELECT COUNT(*) FROM galleries").fetchone()[0]
        finally:
            check.close()

        manifest = {
            "app": "mitsu",
            "version": APP_VERSION,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "includes_library": include_library,
            "galleries": galleries,
        }

        db = SessionLocal()
        try:
            stats = libsvc.stats(db)
        finally:
            db.close()

        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_STORED, allowZip64=True) as zf:
            zf.writestr("manifest.json", json.dumps(manifest, indent=2))
            zf.write(snapshot, "database/mitsu.db")
            if include_library and LIBRARY_ROOT.exists():
                root = LIBRARY_ROOT.resolve()
                for folder, _dirs, files in os.walk(root):
                    for name in files:
                        path = Path(folder) / name
                        if not path.is_file():
                            continue
                        try:
                            relative = path.resolve().relative_to(root)
                        except ValueError:
                            continue
                        zf.write(path, f"library/{relative.as_posix()}")
            zf.writestr("stats.json", json.dumps(stats, indent=2))

    return archive_path, archive_path.stat().st_size


def _safe_zip_members(zf: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
    safe = []
    for member in zf.infolist():
        if member.is_dir():
            continue
        name = member.filename.replace("\\", "/")
        if name.startswith("/") or name.startswith("../"):
            raise ValueError(f"Unsafe backup entry: {member.filename}")
        parts = [part for part in name.split("/") if part not in ("", ".")]
        if any(part == ".." for part in parts):
            raise ValueError(f"Unsafe backup entry: {member.filename}")
        safe.append(member)
    return safe


def restore_backup(upload_path: Path, include_library: bool = True) -> dict:
    """Replace the database (and optionally the managed library) from a backup zip."""
    if not zipfile.is_zipfile(upload_path):
        raise ValueError("The uploaded file is not a zip archive")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    safety_db = DB_PATH.with_suffix(f".db.bak-{stamp}")
    library_backup: Path | None = None
    replaced_db = False

    with tempfile.TemporaryDirectory(prefix="mitsu-restore-") as temp_dir:
        temp = Path(temp_dir)
        with zipfile.ZipFile(upload_path) as zf:
            members = _safe_zip_members(zf)
            database_members = [
                member for member in members if member.filename == "database/mitsu.db"
            ]
            if not database_members:
                raise ValueError("Backup does not contain database/mitsu.db")

            extracted_db = temp / "mitsu.db"
            with zf.open(database_members[0]) as src, extracted_db.open("wb") as out:
                shutil.copyfileobj(src, out)

            check = sqlite3.connect(str(extracted_db))
            try:
                integrity = check.execute("PRAGMA integrity_check").fetchone()
                if not integrity or integrity[0] != "ok":
                    raise ValueError("The backup database failed its integrity check")
                tables = {
                    row[0]
                    for row in check.execute(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    ).fetchall()
                }
                if "galleries" not in tables:
                    raise ValueError("The backup database is not a Mitsu database")
            finally:
                check.close()

            library_members = [
                member
                for member in members
                if member.filename.startswith("library/")
            ]

            # Safety copy of the current state before touching anything.
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            if DB_PATH.exists():
                _snapshot_database(safety_db)
            if include_library and library_members and LIBRARY_ROOT.exists():
                library_backup = LIBRARY_ROOT.with_name(f"{LIBRARY_ROOT.name}.bak-{stamp}")
                shutil.move(str(LIBRARY_ROOT), str(library_backup))

            try:
                engine.dispose()
                for suffix in ("-wal", "-shm"):
                    sidecar = Path(str(DB_PATH) + suffix)
                    if sidecar.exists():
                        sidecar.unlink()
                shutil.copy2(extracted_db, DB_PATH)
                replaced_db = True

                if include_library and library_members:
                    LIBRARY_ROOT.mkdir(parents=True, exist_ok=True)
                    root = LIBRARY_ROOT.resolve()
                    for member in library_members:
                        relative = member.filename.split("library/", 1)[1]
                        target = (root / relative).resolve()
                        if target != root and root not in target.parents:
                            raise ValueError(
                                f"Unsafe backup entry: {member.filename}"
                            )
                        target.parent.mkdir(parents=True, exist_ok=True)
                        with zf.open(member) as src, target.open("wb") as out:
                            shutil.copyfileobj(src, out)

                init_db()
            except Exception:
                engine.dispose()
                if replaced_db and safety_db.exists():
                    shutil.copy2(safety_db, DB_PATH)
                if library_backup and library_backup.exists():
                    if LIBRARY_ROOT.exists():
                        shutil.rmtree(LIBRARY_ROOT, ignore_errors=True)
                    shutil.move(str(library_backup), str(LIBRARY_ROOT))
                init_db()
                raise

    db = SessionLocal()
    try:
        stats = libsvc.stats(db)
    finally:
        db.close()

    return {
        "restored": True,
        "restored_library": bool(include_library and library_members),
        "safety_database": str(safety_db) if safety_db.exists() else None,
        "library_backup": str(library_backup) if library_backup else None,
        "stats": stats,
    }
