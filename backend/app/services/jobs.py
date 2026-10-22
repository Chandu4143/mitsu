import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.models import AppSetting, Job
from app.services.library import to_gallery_out


def create_job(db: Session, jtype: str, total: int = 0, payload: dict | None = None) -> Job:
    job = Job(
        type=jtype,
        status="queued",
        progress_total=total,
        payload_json=json.dumps(payload or {}),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def update_job(db: Session, job_id: str, **kwargs):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return None
    for key, value in kwargs.items():
        setattr(job, key, value)
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str):
    return db.query(Job).filter(Job.id == job_id).first()


def list_jobs(db: Session, jtype: str | None = None):
    query = db.query(Job)
    if jtype:
        query = query.filter(Job.type == jtype)
    return query.order_by(Job.created_at.desc()).all()


def reconcile_jobs(db: Session):
    """Mark jobs interrupted by a backend restart as failed instead of leaving them running."""
    interrupted = db.query(Job).filter(Job.status == "running").all()
    for job in interrupted:
        job.status = "failed"
        job.error_code = "INTERRUPTED"
        job.error_message = "The backend restarted while this job was running."
        job.finished_at = datetime.now(timezone.utc)
        job.updated_at = datetime.now(timezone.utc)
    if interrupted:
        db.commit()
    return len(interrupted)


def get_settings(db: Session) -> dict:
    defaults = {
        "reader_mode": "single",
        "reading_direction": "ltr",
        "reader_background": "dark",
        "fit_mode": "width",
        "library_view": "grid",
        "library_sort": "date_added",
    }
    row = db.query(AppSetting).filter(AppSetting.key == "preferences").first()
    if not row or not row.value_json:
        return defaults
    try:
        value = json.loads(row.value_json)
    except Exception:
        return defaults
    if isinstance(value, dict):
        defaults.update({k: v for k, v in value.items() if v is not None})
    return defaults


def save_settings(db: Session, values: dict) -> dict:
    allowed = {
        "reader_mode",
        "reading_direction",
        "reader_background",
        "fit_mode",
        "library_view",
        "library_sort",
    }
    current = get_settings(db)
    current.update({k: v for k, v in values.items() if k in allowed})
    row = db.query(AppSetting).filter(AppSetting.key == "preferences").first()
    if not row:
        row = AppSetting(key="preferences")
        db.add(row)
    row.value_json = json.dumps(current)
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return current
