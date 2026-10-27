import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schemas import GalleryOut, JobOut
from app.services import library as libsvc
from app.services import maintenance
from app.services.jobs import create_job, list_jobs

router = APIRouter(tags=["system"])

MAX_BACKUP_BYTES = 64 * 1024 * 1024 * 1024  # 64 GB ceiling for uploaded backups


@router.get("/history", response_model=list[GalleryOut])
def history(
    limit: int = Query(60, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return libsvc.reading_history(db, limit)


@router.get("/jobs", response_model=list[JobOut])
def jobs(
    type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    items = list_jobs(db, jtype=type)
    return items[:limit]


@router.get("/backup/info")
def backup_info(db: Session = Depends(get_db)):
    return maintenance.backup_info(db)


@router.get("/backup/export")
def export_backup(
    include_library: bool = Query(True),
):
    try:
        archive, size = maintenance.create_backup(include_library=include_library)
    except Exception as exc:
        raise HTTPException(500, f"Could not create backup: {exc}")
    stamp = Path(archive.name).name
    filename = stamp if stamp.endswith(".zip") else f"{stamp}.zip"
    return FileResponse(
        archive,
        media_type="application/zip",
        filename=filename,
        headers={"Content-Length": str(size)},
        background=BackgroundTask(lambda: archive.unlink(missing_ok=True)),
    )


@router.post("/backup/restore")
async def restore_backup(
    file: UploadFile = File(...),
    include_library: bool = Query(True),
):
    handle = tempfile.NamedTemporaryFile(
        prefix="mitsu-restore-upload-", suffix=".zip", delete=False
    )
    path = Path(handle.name)
    total = 0
    try:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_BACKUP_BYTES:
                raise HTTPException(413, "Backup exceeds the configured size limit")
            handle.write(chunk)
        handle.close()
        try:
            return maintenance.restore_backup(path, include_library=include_library)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        except Exception as exc:
            raise HTTPException(500, f"Restore failed: {exc}")
    finally:
        try:
            handle.close()
        except Exception:
            pass
        path.unlink(missing_ok=True)
        await file.close()


@router.get("/maintenance/duplicates")
def duplicates(db: Session = Depends(get_db)):
    groups = maintenance.find_duplicates(db)
    return {"groups": groups, "total_groups": len(groups)}


@router.post("/maintenance/thumbnails", status_code=202, response_model=JobOut)
def regenerate_thumbnails(background: BackgroundTasks, db: Session = Depends(get_db)):
    job = create_job(db, "thumbnail", 0, {"action": "regenerate-covers"})
    background.add_task(maintenance.regenerate_thumbnails, job.id)
    return job


@router.get("/maintenance/thumbnails/{job_id}", response_model=JobOut)
def thumbnail_job(job_id: str, db: Session = Depends(get_db)):
    job = list_jobs(db, jtype="thumbnail")
    match = next((item for item in job if item.id == job_id), None)
    if not match:
        raise HTTPException(404, "Job not found")
    return match
