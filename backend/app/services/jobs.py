from sqlalchemy.orm import Session
from app.models.models import Job
from datetime import datetime, timezone

def create_job(db: Session, jtype: str, total: int = 0) -> Job:
    job = Job(type=jtype, status="queued", progress_total=total)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

def update_job(db: Session, job_id: str, **kwargs):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return None
    for k, v in kwargs.items():
        setattr(job, k, v)
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return job

def get_job(db: Session, job_id: str):
    return db.query(Job).filter(Job.id == job_id).first()

def list_jobs(db: Session):
    return db.query(Job).order_by(Job.created_at.desc()).all()
