from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import CACHE_DIR, DATA_DIR, DB_PATH, LIBRARY_ROOT, THUMB_DIR
from app.db.session import get_db
from app.schemas.schemas import StatsOut
from app.services import library as libsvc
from app.services.jobs import get_settings, save_settings

router = APIRouter(tags=["settings"])


class SettingsIn(BaseModel):
    reader_mode: str | None = None
    reading_direction: str | None = None
    reader_background: str | None = None
    fit_mode: str | None = None
    library_view: str | None = None
    library_sort: str | None = None


@router.get("/settings")
def read_settings(db: Session = Depends(get_db)):
    return {
        "preferences": get_settings(db),
        "paths": {
            "data": str(DATA_DIR),
            "database": str(DB_PATH),
            "library": str(LIBRARY_ROOT),
            "thumbnails": str(THUMB_DIR),
            "cache": str(CACHE_DIR),
        },
        "stats": libsvc.stats(db),
    }


@router.put("/settings")
def update_settings(body: SettingsIn, db: Session = Depends(get_db)):
    values: dict[str, Any] = body.model_dump(exclude_none=True)
    allowed = {
        "reader_mode": {"single", "continuous"},
        "reading_direction": {"ltr", "rtl"},
        "reader_background": {"dark", "warm", "black"},
        "fit_mode": {"width", "screen"},
        "library_view": {"grid", "list"},
        "library_sort": {"date_added", "title", "last_opened", "page_count"},
    }
    for key, value in values.items():
        if key in allowed and value not in allowed[key]:
            values[key] = None
    return {"preferences": save_settings(db, values)}


@router.get("/stats", response_model=StatsOut)
def read_stats(db: Session = Depends(get_db)):
    return libsvc.stats(db)
