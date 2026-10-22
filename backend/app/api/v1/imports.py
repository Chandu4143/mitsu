from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.schemas.schemas import JobOut, ImportIn, LibraryRootIn, LibraryRootOut
from app.services.jobs import create_job, get_job, list_jobs
from app.services.importer import process_import
from app.models.models import LibraryRoot
from app.core.config import LIBRARY_ROOT
import os

router = APIRouter(tags=["imports"])

@router.post("/imports", status_code=202, response_model=JobOut)
def start_import(body: ImportIn, bg: BackgroundTasks, db: Session=Depends(get_db)):
    # resolve path
    path = body.path
    if not path:
        raise HTTPException(400, "path required")
    # validate existence
    if not os.path.exists(path):
        raise HTTPException(400, f"Path not found: {path}")
    job = create_job(db, "import", 0)
    bg.add_task(process_import, job.id, path)
    db.refresh(job)
    return job

@router.get("/imports", response_model=list[JobOut])
def list_imports(db: Session=Depends(get_db)):
    return list_jobs(db)

@router.get("/imports/{job_id}", response_model=JobOut)
def get_import(job_id: str, db: Session=Depends(get_db)):
    job = get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job

@router.post("/imports/{job_id}/retry", status_code=202, response_model=JobOut)
def retry_import(job_id: str, bg: BackgroundTasks, db: Session=Depends(get_db)):
    job = get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    # reset
    job.status = "queued"
    job.progress_current = 0
    job.error_code = None
    job.error_message = None
    db.commit()
    db.refresh(job)
    # we don't have original path stored; retry not fully supported without it
    return job

@router.post("/imports/{job_id}/cancel")
def cancel_import(job_id: str, db: Session=Depends(get_db)):
    job = get_job(db, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status in ("queued", "running"):
        job.status = "cancelled"
        db.commit()
    return {"status": job.status}

# Library roots
@router.get("/library-roots")
def list_roots(db: Session=Depends(get_db)):
    return db.query(LibraryRoot).all()

@router.post("/library-roots", response_model=LibraryRootOut)
def create_root(body: LibraryRootIn, db: Session=Depends(get_db)):
    existing = db.query(LibraryRoot).filter(LibraryRoot.path == body.path).first()
    if existing:
        return existing
    r = LibraryRoot(path=body.path, is_enabled=True)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r
