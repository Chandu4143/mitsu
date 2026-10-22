from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schemas import MetadataApplyIn, MetadataLookupIn
from app.services import metadata as metasvc

router = APIRouter(tags=["metadata"])


@router.get("/metadata/sources")
def list_sources():
    return [
        {
            "id": "local",
            "name": "Local embedded",
            "capabilities": ["metadata"],
            "enabled": True,
            "description": "Reads filenames and ComicInfo.xml inside imported files.",
        },
        {
            "id": "remote",
            "name": "Remote lookup",
            "capabilities": ["metadata"],
            "enabled": False,
            "description": "Optional provider. Disabled by default; the library works fully offline.",
        },
    ]


@router.post("/galleries/{gid}/metadata/lookup")
def lookup(gid: str, body: MetadataLookupIn | None = None, db: Session = Depends(get_db)):
    if body and body.source_id not in ("local",):
        raise HTTPException(400, "Only the local metadata source is enabled")
    result = metasvc.lookup_local(db, gid)
    if not result:
        raise HTTPException(404, "Gallery not found")
    return result


@router.get("/metadata/jobs/{job_id}")
def get_lookup(job_id: str, db: Session = Depends(get_db)):
    from app.models.models import MetadataRecord

    record = db.query(MetadataRecord).filter(MetadataRecord.id == job_id).first()
    if not record:
        raise HTTPException(404, "Lookup not found")
    import json

    return {
        "id": record.id,
        "gallery_id": record.gallery_id,
        "source_id": record.source_id,
        "fetched_at": record.fetched_at,
        "applied": record.applied,
        "candidate": json.loads(record.payload_json or "{}"),
    }


@router.post("/metadata/jobs/{job_id}/apply")
def apply_lookup(job_id: str, body: MetadataApplyIn, db: Session = Depends(get_db)):
    if not body.gallery_id:
        raise HTTPException(400, "gallery_id is required")
    result = metasvc.apply_record(db, body.gallery_id, job_id, body.fields)
    if not result:
        raise HTTPException(404, "Lookup or gallery not found")
    return result


@router.post("/galleries/{gid}/metadata/apply")
def apply_for_gallery(gid: str, body: MetadataApplyIn, db: Session = Depends(get_db)):
    result = metasvc.apply_record(db, gid, body.record_id, body.fields)
    if not result:
        raise HTTPException(404, "Lookup or gallery not found")
    return result
