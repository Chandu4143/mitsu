from pathlib import Path
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app.models.models import (
    Artist,
    Collection,
    Favorite,
    Gallery,
    GalleryArtist,
    GalleryPage,
    GalleryTag,
    MetadataRecord,
    ReadingProgress,
    Tag,
)
from app.core.config import LIBRARY_ROOT


def resolve_library_path(relative_path: str) -> Path:
    root = LIBRARY_ROOT.resolve()
    target = (root / relative_path).resolve()
    if target != root and root not in target.parents:
        raise ValueError("Path escapes the library root")
    return target


def to_gallery_out(g: Gallery):
    progress = g.progress
    status = progress.status if progress else "unread"
    current = progress.current_page if progress else 0
    missing = False
    if g.pages:
        try:
            missing = not resolve_library_path(g.pages[0].relative_path).exists()
        except ValueError:
            missing = True
    else:
        missing = True
    return {
        "id": g.id,
        "title": g.title,
        "alternate_title": g.alternate_title,
        "language": g.language or "unknown",
        "page_count": g.page_count or 0,
        "favorite": g.favorites is not None,
        "reading_status": status,
        "current_page": current,
        "cover_url": f"/api/v1/galleries/{g.id}/cover" if g.cover_path else None,
        "date_added": g.date_added,
        "last_opened_at": g.last_opened_at,
        "file_size": g.file_size or 0,
        "source_id": g.source_id,
        "missing": missing,
    }


def list_galleries(
    db: Session,
    q=None,
    tag=None,
    artist=None,
    language=None,
    status=None,
    favorite=None,
    sort="date_added",
    page=1,
    page_size=40,
):
    query = db.query(Gallery)

    if q:
        like = f"%{q.strip()}%"
        tag_match = (
            db.query(GalleryTag.gallery_id)
            .join(Tag, Tag.id == GalleryTag.tag_id)
            .filter(Tag.name.ilike(like))
        )
        artist_match = (
            db.query(GalleryArtist.gallery_id)
            .join(Artist, Artist.id == GalleryArtist.artist_id)
            .filter(Artist.name.ilike(like))
        )
        query = query.filter(
            or_(
                Gallery.title.ilike(like),
                Gallery.alternate_title.ilike(like),
                Gallery.language.ilike(like),
                Gallery.external_id.ilike(like),
                Gallery.id.in_(tag_match),
                Gallery.id.in_(artist_match),
            )
        )

    if tag:
        query = (
            query.join(GalleryTag, GalleryTag.gallery_id == Gallery.id)
            .join(Tag, Tag.id == GalleryTag.tag_id)
            .filter(Tag.normalized_name == tag.strip().lower())
        )

    if artist:
        query = (
            query.join(GalleryArtist, GalleryArtist.gallery_id == Gallery.id)
            .join(Artist, Artist.id == GalleryArtist.artist_id)
            .filter(Artist.normalized_name == artist.strip().lower())
        )

    if language:
        query = query.filter(Gallery.language == language.lower())

    if favorite:
        query = query.join(Favorite, Favorite.gallery_id == Gallery.id)

    if status:
        if status == "unread":
            query = query.outerjoin(ReadingProgress, ReadingProgress.gallery_id == Gallery.id).filter(
                or_(ReadingProgress.gallery_id.is_(None), ReadingProgress.status == "unread")
            )
        else:
            query = query.join(ReadingProgress, ReadingProgress.gallery_id == Gallery.id).filter(
                ReadingProgress.status == status
            )

    if sort == "title":
        query = query.order_by(func.lower(Gallery.title).asc())
    elif sort == "last_opened":
        query = query.order_by(case((Gallery.last_opened_at.is_(None), 1), else_=0), Gallery.last_opened_at.desc())
    elif sort == "page_count":
        query = query.order_by(Gallery.page_count.desc(), Gallery.title.asc())
    else:
        query = query.order_by(Gallery.date_added.desc())

    total = query.distinct().count()
    page = max(1, page)
    page_size = min(max(1, page_size), 200)
    items = (
        query.distinct()
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [to_gallery_out(g) for g in items], total


def get_gallery(db: Session, gid: str):
    return db.query(Gallery).filter(Gallery.id == gid).first()


def get_gallery_detail(db: Session, gid: str):
    g = get_gallery(db, gid)
    if not g:
        return None
    out = to_gallery_out(g)
    out["tags"] = [gt.tag.name for gt in g.tags if gt.tag]
    out["artists"] = [ga.artist.name for ga in g.artists if ga.artist]
    out["pages"] = [
        {
            "page_index": p.page_index,
            "content_url": f"/api/v1/galleries/{gid}/pages/{p.page_index}/content",
            "width": p.width,
            "height": p.height,
        }
        for p in g.pages
    ]
    records = (
        db.query(MetadataRecord)
        .filter(MetadataRecord.gallery_id == gid)
        .order_by(MetadataRecord.fetched_at.desc())
        .all()
    )
    out["metadata"] = [
        {
            "id": r.id,
            "source_id": r.source_id,
            "external_id": r.external_id,
            "fetched_at": r.fetched_at,
            "applied": r.applied,
            "payload": __import__("json").loads(r.payload_json or "{}"),
        }
        for r in records
    ]
    return out


def get_page_content_path(db: Session, gid: str, index: int):
    g = get_gallery(db, gid)
    if not g:
        return None
    if index < 0 or index >= (g.page_count or 0):
        return None
    page = (
        db.query(GalleryPage)
        .filter(GalleryPage.gallery_id == gid, GalleryPage.page_index == index)
        .first()
    )
    if not page:
        return None
    try:
        path = resolve_library_path(page.relative_path)
    except ValueError:
        return None
    if not path.exists():
        return None
    return path, page.mime_type


def get_cover_path(db: Session, gid: str):
    g = get_gallery(db, gid)
    if not g or not g.cover_path:
        return None
    try:
        path = resolve_library_path(g.cover_path)
    except ValueError:
        return None
    return path if path.exists() else None


def set_tags(db: Session, gid: str, tags: list[str]):
    db.query(GalleryTag).filter(GalleryTag.gallery_id == gid).delete()
    for raw in tags:
        name = raw.strip()
        if not name:
            continue
        norm = name.lower()
        tag = db.query(Tag).filter(Tag.normalized_name == norm, Tag.category == "general").first()
        if not tag:
            tag = Tag(name=name, normalized_name=norm, category="general")
            db.add(tag)
            db.flush()
        db.add(GalleryTag(gallery_id=gid, tag_id=tag.id, source="user", is_user_override=True))


def delete_gallery(db: Session, gid: str):
    g = get_gallery(db, gid)
    if not g:
        return False
    db.delete(g)
    db.commit()
    return True


def stats(db: Session):
    galleries = db.query(func.count(Gallery.id)).scalar() or 0
    pages = db.query(func.coalesce(func.sum(Gallery.page_count), 0)).scalar() or 0
    favorites = db.query(func.count(Favorite.gallery_id)).scalar() or 0
    collections = db.query(func.count(Collection.id)).scalar() or 0
    size = db.query(func.coalesce(func.sum(Gallery.file_size), 0)).scalar() or 0
    from app.models.models import LibraryRoot

    roots = db.query(func.count(LibraryRoot.id)).scalar() or 0
    return {
        "galleries": galleries,
        "pages": pages,
        "favorites": favorites,
        "collections": collections,
        "bytes": size,
        "roots": roots,
    }
