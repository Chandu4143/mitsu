import os
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from typing import Optional, List
from app.db.session import get_db
from app.services import library as libsvc
from app.schemas.schemas import GalleryOut, GalleryListOut, GalleryDetailOut, GalleryPatch, ProgressIn, ProgressOut, FavoriteIn, CollectionOut, CollectionCreate, CollectionPatch, CollectionItemIn, JobOut, ImportIn, LibraryRootIn, LibraryRootOut
from app.services.jobs import get_job, list_jobs
from app.services.importer import process_import
from app.services.collections import *
from app.models.models import Gallery, ReadingProgress, Favorite, Job, LibraryRoot
from app.core.config import LIBRARY_ROOT
import uuid
import shutil
from fastapi import BackgroundTasks

router = APIRouter(prefix="/galleries", tags=["galleries"])

@router.get("", response_model=GalleryListOut)
def list_galleries(q: Optional[str]=None, tag: Optional[str]=None, artist: Optional[str]=None,
                   language: Optional[str]=None, status: Optional[str]=None,
                   favorite: Optional[bool]=None, sort: str="date_added",
                   page: int=1, page_size: int=40, db: Session=Depends(get_db)):
    items, total = libsvc.list_galleries(db, q=q, status=status, favorite=favorite, sort=sort, page=page, page_size=page_size)
    return {"items": items, "page": page, "page_size": page_size, "total": total}

@router.get("/{gid}", response_model=GalleryDetailOut)
def get_gallery(gid: str, db: Session=Depends(get_db)):
    detail = libsvc.get_gallery_detail(db, gid)
    if not detail:
        raise HTTPException(404, "Gallery not found")
    return detail

@router.patch("/{gid}")
def patch_gallery(gid: str, body: GalleryPatch, db: Session=Depends(get_db)):
    g = libsvc.get_gallery(db, gid)
    if not g:
        raise HTTPException(404, "Gallery not found")
    if body.title is not None:
        g.title = body.title
    if body.alternate_title is not None:
        g.alternate_title = body.alternate_title
    if body.language is not None:
        g.language = body.language
    if body.tags is not None:
        # replace tags
        from app.models.models import GalleryTag, Tag
        # remove existing
        db.query(GalleryTag).filter(GalleryTag.gallery_id == gid).delete()
        for tname in body.tags:
            norm = tname.strip().lower()
            tag = db.query(Tag).filter(Tag.normalized_name == norm, Tag.category == "general").first()
            if not tag:
                tag = Tag(name=tname.strip(), normalized_name=norm, category="general")
                db.add(tag)
                db.commit()
                db.refresh(tag)
            gt = GalleryTag(gallery_id=gid, tag_id=tag.id, source="user", is_user_override=True)
            db.add(gt)
    db.commit()
    db.refresh(g)
    return libsvc.get_gallery_detail(db, gid)

@router.delete("/{gid}", status_code=204)
def delete_gallery(gid: str, db: Session=Depends(get_db)):
    g = libsvc.get_gallery(db, gid)
    if not g:
        raise HTTPException(404, "Gallery not found")
    db.delete(g)
    db.commit()
    return None

@router.get("/{gid}/pages")
def list_pages(gid: str, db: Session=Depends(get_db)):
    g = libsvc.get_gallery(db, gid)
    if not g:
        raise HTTPException(404, "Gallery not found")
    return [{"page_index": p.page_index, "content_url": f"/api/v1/galleries/{gid}/pages/{p.page_index}/content", "width": p.width, "height": p.height} for p in g.pages]

@router.get("/{gid}/pages/{page_index}/content")
def page_content(gid: str, page_index: int, db: Session=Depends(get_db)):
    res = libsvc.get_page_content_path(db, gid, page_index)
    if not res:
        raise HTTPException(404, "Page not found")
    path, mime = res
    return FileResponse(path, media_type=mime or "image/jpeg")

@router.get("/{gid}/cover")
def cover(gid: str, db: Session=Depends(get_db)):
    path = libsvc.get_cover_path(db, gid)
    if not path or not path.exists():
        raise HTTPException(404, "Cover not found")
    return FileResponse(path, media_type="image/jpeg")

@router.get("/{gid}/progress", response_model=ProgressOut)
def get_progress(gid: str, db: Session=Depends(get_db)):
    g = libsvc.get_gallery(db, gid)
    if not g:
        raise HTTPException(404, "Gallery not found")
    prog = g.progress
    if not prog:
        prog = ReadingProgress(gallery_id=gid, current_page=0, status="unread")
        db.add(prog)
        db.commit()
        db.refresh(prog)
    return {"current_page": prog.current_page, "status": prog.status, "updated_at": prog.updated_at}

@router.put("/{gid}/progress", response_model=ProgressOut)
def set_progress(gid: str, body: ProgressIn, db: Session=Depends(get_db)):
    g = libsvc.get_gallery(db, gid)
    if not g:
        raise HTTPException(404, "Gallery not found")
    if body.current_page < 0 or body.current_page >= g.page_count:
        raise HTTPException(422, "Page index out of range")
    if body.status not in ("unread", "reading", "completed"):
        raise HTTPException(422, "Invalid status")
    prog = g.progress
    if not prog:
        prog = ReadingProgress(gallery_id=gid)
        db.add(prog)
    prog.current_page = body.current_page
    prog.status = body.status
    prog.updated_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    if body.status == "completed":
        prog.completed_at = prog.updated_at
    g.last_opened_at = prog.updated_at
    db.commit()
    db.refresh(prog)
    return {"current_page": prog.current_page, "status": prog.status, "updated_at": prog.updated_at}

@router.put("/{gid}/favorite")
def set_favorite(gid: str, body: FavoriteIn, db: Session=Depends(get_db)):
    g = libsvc.get_gallery(db, gid)
    if not g:
        raise HTTPException(404, "Gallery not found")
    fav = db.query(Favorite).filter(Favorite.gallery_id == gid).first()
    if body.favorite:
        if not fav:
            db.add(Favorite(gallery_id=gid))
    else:
        if fav:
            db.delete(fav)
    db.commit()
    return {"favorite": body.favorite}

@router.delete("/{gid}/favorite", status_code=204)
def remove_favorite(gid: str, db: Session=Depends(get_db)):
    fav = db.query(Favorite).filter(Favorite.gallery_id == gid).first()
    if fav:
        db.delete(fav)
        db.commit()
    return None
