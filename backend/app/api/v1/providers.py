from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import Gallery
from app.schemas.schemas import JobOut
from app.services import providers as providersvc
from app.services.jobs import create_job

router = APIRouter(prefix="/providers", tags=["providers"])


class NhentaiImportIn(BaseModel):
    id: str


@router.get("")
def list_providers():
    available = providersvc.is_available()
    return [
        {
            "id": "nhentai",
            "name": "nhentai",
            "enabled": available,
            "capabilities": ["search", "browse", "import"] if available else [],
            "description": (
                "Search nhentai.net and import galleries locally."
                if available
                else "Install the 'cloudscraper' package to enable this provider."
            ),
        }
    ]


@router.get("/nhentai/search")
def search_nhentai(
    q: str = "",
    page: int = Query(1, ge=1),
    sort: str = Query("date"),
    language: str = Query(""),
    db: Session = Depends(get_db),
):
    if not providersvc.is_available():
        raise HTTPException(503, providersvc.PROVIDER_MISSING_MESSAGE)
    try:
        result = providersvc.search_nhentai(q, page, sort, language)
    except providersvc.ProviderRateLimited as exc:
        raise HTTPException(429, str(exc))
    except providersvc.ProviderUnavailable as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, str(exc))

    # Tell the UI which results are already in the local library so it can show
    # "Open" instead of offering a duplicate import.
    ids = [item["id"] for item in result["items"]]
    existing: dict[str, str] = {}
    if ids:
        rows = (
            db.query(Gallery.id, Gallery.external_id)
            .filter(Gallery.source_id == "nhentai", Gallery.external_id.in_(ids))
            .all()
        )
        existing = {external_id: gallery_id for gallery_id, external_id in rows}
    for item in result["items"]:
        item["in_library"] = item["id"] in existing
        item["library_id"] = existing.get(item["id"])

    return result


@router.post("/nhentai/import", status_code=202, response_model=JobOut)
def import_nhentai(body: NhentaiImportIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    if not providersvc.is_available():
        raise HTTPException(503, providersvc.PROVIDER_MISSING_MESSAGE)
    if not body.id.strip().isdigit():
        raise HTTPException(400, "A numeric nhentai gallery id is required")
    job = create_job(db, "import", 0, {"source": "nhentai", "id": body.id.strip()})
    background.add_task(providersvc.import_nhentai, job.id)
    return job
