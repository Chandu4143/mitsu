from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
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
            "capabilities": ["search", "import"] if available else [],
            "description": (
                "Search nhentai.net and import galleries locally."
                if available
                else "Install the 'cloudscraper' package to enable this provider."
            ),
        }
    ]


@router.get("/nhentai/search")
def search_nhentai(q: str = Query(..., min_length=1), page: int = Query(1, ge=1)):
    if not providersvc.is_available():
        raise HTTPException(503, providersvc.PROVIDER_MISSING_MESSAGE)
    try:
        return {"items": providersvc.search_nhentai(q, page), "page": page}
    except providersvc.ProviderUnavailable as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, str(exc))


@router.post("/nhentai/import", status_code=202, response_model=JobOut)
def import_nhentai(body: NhentaiImportIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    if not providersvc.is_available():
        raise HTTPException(503, providersvc.PROVIDER_MISSING_MESSAGE)
    if not body.id.strip().isdigit():
        raise HTTPException(400, "A numeric nhentai gallery id is required")
    job = create_job(db, "import", 0, {"source": "nhentai", "id": body.id.strip()})
    background.add_task(providersvc.import_nhentai, job.id)
    return job
