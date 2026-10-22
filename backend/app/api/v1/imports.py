import json
import os
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import LibraryRoot
from app.schemas.schemas import ImportIn, JobOut, LibraryRootIn, LibraryRootOut
from app.services.importer import process_import
from app.services.jobs import create_job, get_job, list_jobs

router = APIRouter(tags=["imports"])


@router.post("/imports", status_code=202, response_model=JobOut)
def start_import(body: ImportIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    payload = {
        "path": body.path,
        "root_id": body.root_id,
        "relative_path": body.relative_path,
        "mode": body.mode,
    }
    if not body.path and not (body.root_id and body.relative_path):
        raise HTTPException(400, "Provide a path, or a root_id with relative_path")
    if body.path:
        target = Path(body.path).expanduser()
        if not target.exists():
            raise HTTPException(400, f"Path not found: {body.path}")
        payload["path"] = str(target.resolve())
    job = create_job(db, "import", 0, payload)
    background.add_task(process_import, job.id)
    return job


@router.get("/imports", response_model=list[JobOut])
def list_imports(db: Session = Depends(get_db)):
    return list_jobs(db, jtype="import")


@router.get("/imports/{job_id}", response_model=JobOut)
def get_import(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.post("/imports/{job_id}/retry", status_code=202, response_model=JobOut)
def retry_import(job_id: str, background: BackgroundTasks, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status not in ("failed", "cancelled"):
        raise HTTPException(409, "Only failed or cancelled imports can be retried")
    payload = json.loads(job.payload_json or "{}")
    if not payload.get("path"):
        raise HTTPException(400, "This job has no stored source path")
    job.status = "queued"
    job.progress_current = 0
    job.progress_total = 0
    job.error_code = None
    job.error_message = None
    job.result_id = None
    job.cancel_requested = False
    job.started_at = None
    job.finished_at = None
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    background.add_task(process_import, job.id)
    return job


@router.post("/imports/{job_id}/cancel")
def cancel_import(job_id: str, db: Session = Depends(get_db)):
    job = get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status in ("queued", "running"):
        job.cancel_requested = True
        job.status = "cancelled"
        job.finished_at = datetime.now(timezone.utc)
        job.updated_at = datetime.now(timezone.utc)
        db.commit()
    return {"status": job.status}


@router.get("/library-roots", response_model=list[LibraryRootOut])
def list_roots(db: Session = Depends(get_db)):
    return db.query(LibraryRoot).order_by(LibraryRoot.created_at.asc()).all()


@router.post("/library-roots", response_model=LibraryRootOut, status_code=201)
def create_root(body: LibraryRootIn, db: Session = Depends(get_db)):
    path = Path(body.path).expanduser()
    if not path.exists() or not path.is_dir():
        raise HTTPException(400, "Library root must be an existing directory")
    if not os.access(path, os.R_OK):
        raise HTTPException(400, "Library root is not readable")
    normalized = str(path.resolve())
    existing = db.query(LibraryRoot).filter(LibraryRoot.path == normalized).first()
    if existing:
        return existing
    root = LibraryRoot(path=normalized, is_enabled=True)
    db.add(root)
    db.commit()
    db.refresh(root)
    return root


@router.delete("/library-roots/{root_id}", status_code=204)
def delete_root(root_id: str, db: Session = Depends(get_db)):
    root = db.query(LibraryRoot).filter(LibraryRoot.id == root_id).first()
    if not root:
        raise HTTPException(404, "Library root not found")
    db.delete(root)
    db.commit()
    return None
