from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db

router = APIRouter(prefix="/metadata", tags=["metadata"])

@router.get("/sources")
def list_sources():
    return [{"id": "local", "name": "Local embedded", "capabilities": ["metadata"], "enabled": True}]

@router.post("/galleries/{gid}/lookup")
def lookup(gid: str):
    return {"job_id": None, "status": "not_implemented"}

@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    return {"status": "not_found"}
