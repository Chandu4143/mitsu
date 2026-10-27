from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import Favorite, ReadingProgress
from app.schemas.schemas import (
    BookmarkIn,
    BookmarkOut,
    CoverIn,
    FavoriteIn,
    GalleryDetailOut,
    GalleryListOut,
    GalleryPatch,
    ProgressIn,
    ProgressOut,
)
from app.services import library as libsvc
from app.services.utils import mime_for

router = APIRouter(prefix="/galleries", tags=["galleries"])


@router.get("", response_model=GalleryListOut)
def list_galleries(
    q: Optional[str] = None,
    tag: Optional[str] = None,
    artist: Optional[str] = None,
    language: Optional[str] = None,
    status: Optional[str] = None,
    favorite: Optional[bool] = None,
    sort: str = "date_added",
    page: int = Query(1, ge=1),
    page_size: int = Query(40, ge=1, le=200),
    db: Session = Depends(get_db),
):
    if sort not in {"date_added", "title", "last_opened", "page_count"}:
        raise HTTPException(400, "Unsupported sort field")
    items, total = libsvc.list_galleries(
        db,
        q=q,
        tag=tag,
        artist=artist,
        language=language,
        status=status,
        favorite=favorite,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "page": page, "page_size": page_size, "total": total}


@router.get("/{gid}", response_model=GalleryDetailOut)
def get_gallery(gid: str, db: Session = Depends(get_db)):
    detail = libsvc.get_gallery_detail(db, gid)
    if not detail:
        raise HTTPException(404, "Gallery not found")
    return detail


@router.patch("/{gid}", response_model=GalleryDetailOut)
def patch_gallery(gid: str, body: GalleryPatch, db: Session = Depends(get_db)):
    gallery = libsvc.get_gallery(db, gid)
    if not gallery:
        raise HTTPException(404, "Gallery not found")
    if body.title is not None:
        gallery.title = body.title.strip()
    if body.alternate_title is not None:
        gallery.alternate_title = body.alternate_title.strip() or None
    if body.language is not None:
        gallery.language = body.language
    if body.tags is not None:
        libsvc.set_tags(db, gid, body.tags)
    gallery.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(gallery)
    return libsvc.get_gallery_detail(db, gid)


@router.delete("/{gid}", status_code=204)
def delete_gallery(gid: str, confirm: bool = Query(False), db: Session = Depends(get_db)):
    if not confirm:
        raise HTTPException(400, "Explicit confirmation is required")
    if not libsvc.delete_gallery(db, gid):
        raise HTTPException(404, "Gallery not found")
    return None


@router.get("/{gid}/pages")
def list_pages(gid: str, db: Session = Depends(get_db)):
    gallery = libsvc.get_gallery(db, gid)
    if not gallery:
        raise HTTPException(404, "Gallery not found")
    return [
        {
            "page_index": page.page_index,
            "content_url": f"/api/v1/galleries/{gid}/pages/{page.page_index}/content",
            "width": page.width,
            "height": page.height,
        }
        for page in gallery.pages
    ]


@router.get("/{gid}/pages/{page_index}/content")
def page_content(gid: str, page_index: int, db: Session = Depends(get_db)):
    result = libsvc.get_page_content_path(db, gid, page_index)
    if not result:
        raise HTTPException(404, "Page not found")
    path, mime = result
    return FileResponse(
        path,
        media_type=mime or mime_for(path),
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/{gid}/cover")
def cover(gid: str, db: Session = Depends(get_db)):
    path = libsvc.get_cover_path(db, gid)
    if not path or not path.exists():
        raise HTTPException(404, "Cover not found")
    return FileResponse(
        path,
        media_type=mime_for(path),
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.put("/{gid}/cover", response_model=GalleryDetailOut)
def set_cover(gid: str, body: CoverIn, db: Session = Depends(get_db)):
    try:
        detail = libsvc.set_cover_from_page(db, gid, body.page_index)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    if not detail:
        raise HTTPException(404, "Gallery or page not found")
    return detail


@router.get("/{gid}/bookmarks", response_model=list[BookmarkOut])
def get_bookmarks(gid: str, db: Session = Depends(get_db)):
    gallery = libsvc.get_gallery(db, gid)
    if not gallery:
        raise HTTPException(404, "Gallery not found")
    return libsvc.list_bookmarks(db, gid)


@router.post("/{gid}/bookmarks", response_model=BookmarkOut, status_code=201)
def create_bookmark(gid: str, body: BookmarkIn, db: Session = Depends(get_db)):
    try:
        bookmark = libsvc.add_bookmark(db, gid, body.page_index, body.note)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    if not bookmark:
        raise HTTPException(404, "Gallery not found")
    return bookmark


@router.delete("/{gid}/bookmarks/{bookmark_id}", status_code=204)
def remove_bookmark(gid: str, bookmark_id: str, db: Session = Depends(get_db)):
    if not libsvc.delete_bookmark(db, gid, bookmark_id):
        raise HTTPException(404, "Bookmark not found")
    return None


@router.get("/{gid}/progress", response_model=ProgressOut)
def get_progress(gid: str, db: Session = Depends(get_db)):
    gallery = libsvc.get_gallery(db, gid)
    if not gallery:
        raise HTTPException(404, "Gallery not found")
    progress = gallery.progress
    if not progress:
        progress = ReadingProgress(gallery_id=gid, current_page=0, status="unread")
        db.add(progress)
        db.commit()
        db.refresh(progress)
    return {
        "current_page": progress.current_page,
        "status": progress.status,
        "updated_at": progress.updated_at,
    }


@router.put("/{gid}/progress", response_model=ProgressOut)
def set_progress(gid: str, body: ProgressIn, db: Session = Depends(get_db)):
    gallery = libsvc.get_gallery(db, gid)
    if not gallery:
        raise HTTPException(404, "Gallery not found")
    if body.status not in ("unread", "reading", "completed"):
        raise HTTPException(422, "Invalid reading status")
    if gallery.page_count <= 0:
        raise HTTPException(422, "Gallery has no pages")
    if body.current_page < 0 or body.current_page >= gallery.page_count:
        raise HTTPException(422, "Page index out of range")
    progress = gallery.progress
    if not progress:
        progress = ReadingProgress(gallery_id=gid)
        db.add(progress)
    progress.current_page = body.current_page
    progress.status = body.status
    progress.updated_at = datetime.now(timezone.utc)
    if body.status == "completed":
        progress.completed_at = progress.updated_at
    else:
        progress.completed_at = None
    gallery.last_opened_at = progress.updated_at
    db.commit()
    db.refresh(progress)
    return {
        "current_page": progress.current_page,
        "status": progress.status,
        "updated_at": progress.updated_at,
    }


@router.put("/{gid}/favorite")
def set_favorite(gid: str, body: FavoriteIn, db: Session = Depends(get_db)):
    gallery = libsvc.get_gallery(db, gid)
    if not gallery:
        raise HTTPException(404, "Gallery not found")
    favorite = db.query(Favorite).filter(Favorite.gallery_id == gid).first()
    if body.favorite and not favorite:
        db.add(Favorite(gallery_id=gid))
    elif not body.favorite and favorite:
        db.delete(favorite)
    db.commit()
    return {"favorite": body.favorite}


@router.delete("/{gid}/favorite", status_code=204)
def remove_favorite(gid: str, db: Session = Depends(get_db)):
    favorite = db.query(Favorite).filter(Favorite.gallery_id == gid).first()
    if favorite:
        db.delete(favorite)
        db.commit()
    return None
