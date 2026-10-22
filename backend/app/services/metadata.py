import json
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.models import MetadataRecord
from app.services.library import get_gallery, set_tags


def parse_local_title(title: str) -> dict:
    cleaned = title.replace("_", " ")
    cleaned = re.sub(r"\[[^\]]*\]", " ", cleaned)
    cleaned = re.sub(r"\([^)]*\)", " ", cleaned)
    cleaned = re.sub(r"\b(?:Digital|English|Complete|Ongoing)\b", " ", cleaned, flags=re.I)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -")
    language = "en" if re.search(r"\bEnglish\b", title, re.I) else "unknown"
    return {"title": cleaned or title, "language": language}


def lookup_local(db: Session, gid: str) -> dict | None:
    gallery = get_gallery(db, gid)
    if not gallery:
        return None
    suggestion = parse_local_title(gallery.title)
    payload = {
        "title": suggestion["title"],
        "alternate_title": None,
        "language": suggestion["language"],
        "tags": [],
        "artists": [],
    }
    record = MetadataRecord(
        gallery_id=gid,
        source_id="local",
        payload_json=json.dumps(payload),
        fetched_at=datetime.now(timezone.utc),
        applied=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "gallery_id": gid,
        "source_id": "local",
        "fetched_at": record.fetched_at,
        "applied": False,
        "candidate": payload,
    }


def apply_record(db: Session, gid: str, record_id: str, fields: list[str] | None = None) -> dict | None:
    gallery = get_gallery(db, gid)
    if not gallery:
        return None
    record = (
        db.query(MetadataRecord)
        .filter(MetadataRecord.id == record_id, MetadataRecord.gallery_id == gid)
        .first()
    )
    if not record:
        return None
    payload = json.loads(record.payload_json or "{}")
    allowed = set(fields or ["title", "alternate_title", "language", "tags", "artists"])
    if "title" in allowed and payload.get("title"):
        gallery.title = payload["title"][:500]
    if "alternate_title" in allowed and payload.get("alternate_title"):
        gallery.alternate_title = payload["alternate_title"][:500]
    if "language" in allowed and payload.get("language"):
        gallery.language = payload["language"][:40]
    if "tags" in allowed and payload.get("tags"):
        user_tags = [t for t in gallery.tags if t.is_user_override]
        if not user_tags:
            set_tags(db, gid, payload["tags"])
    record.applied = True
    gallery.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"applied": True, "record_id": record.id, "fields": sorted(allowed)}
