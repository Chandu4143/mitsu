from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.models import Gallery, GalleryPage, ReadingProgress, Favorite, Tag, GalleryTag
from app.core.config import LIBRARY_ROOT
from pathlib import Path

def to_gallery_out(g: Gallery):
    fav = g.favorites is not None
    prog = g.progress
    status = prog.status if prog else "unread"
    current = prog.current_page if prog else 0
    cover_url = f"/api/v1/galleries/{g.id}/cover" if g.cover_path else None
    return {
        "id": g.id,
        "title": g.title,
        "alternate_title": g.alternate_title,
        "language": g.language or "unknown",
        "page_count": g.page_count,
        "favorite": fav,
        "reading_status": status,
        "current_page": current,
        "cover_url": cover_url,
        "date_added": g.date_added,
        "last_opened_at": g.last_opened_at,
    }

def list_galleries(db: Session, q=None, status=None, favorite=None, sort="date_added", page=1, page_size=40):
    query = db.query(Gallery)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Gallery.title.ilike(like), Gallery.alternate_title.ilike(like)))
    if favorite:
        query = query.join(Favorite)
    if status:
        query = query.join(ReadingProgress).filter(ReadingProgress.status == status)
    # sort
    if sort == "title":
        query = query.order_by(Gallery.title.asc())
    elif sort == "last_opened":
        query = query.order_by(Gallery.last_opened_at.desc().nullslast())
    elif sort == "page_count":
        query = query.order_by(Gallery.page_count.desc())
    else:
        query = query.order_by(Gallery.date_added.desc())
    total = query.count()
    items = query.offset((page-1)*page_size).limit(page_size).all()
    return [to_gallery_out(g) for g in items], total

def get_gallery(db: Session, gid: str):
    return db.query(Gallery).filter(Gallery.id == gid).first()

def get_gallery_detail(db: Session, gid: str):
    g = get_gallery(db, gid)
    if not g:
        return None
    out = to_gallery_out(g)
    out["tags"] = [gt.tag.name for gt in g.tags]
    out["artists"] = [ga.artist.name for ga in g.artists]
    out["pages"] = [{"page_index": p.page_index, "content_url": f"/api/v1/galleries/{gid}/pages/{p.page_index}/content", "width": p.width, "height": p.height} for p in g.pages]
    return out

def safe_path(rel: str) -> Path:
    # resolve under LIBRARY_ROOT
    p = (LIBRARY_ROOT / rel).resolve()
    if not str(p).startswith(str(LIBRARY_ROOT.resolve())):
        raise ValueError("path escape")
    return p

def get_page_content_path(db: Session, gid: str, index: int):
    g = get_gallery(db, gid)
    if not g:
        return None
    page = db.query(GalleryPage).filter(GalleryPage.gallery_id == gid, GalleryPage.page_index == index).first()
    if not page:
        return None
    return safe_path(page.relative_path), page.mime_type

def get_cover_path(db: Session, gid: str):
    g = get_gallery(db, gid)
    if not g or not g.cover_path:
        return None
    try:
        return safe_path(g.cover_path)
    except ValueError:
        return None
