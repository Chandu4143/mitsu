from sqlalchemy.orm import Session

from app.models.models import Collection, CollectionItem, Gallery
from app.services.library import to_gallery_out


def _summary(c: Collection):
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "item_count": len(c.items),
        "created_at": c.created_at,
    }


def list_collections(db: Session):
    collections = db.query(Collection).order_by(Collection.created_at.desc()).all()
    return [_summary(c) for c in collections]


def create_collection(db: Session, name: str, description=None):
    c = Collection(name=name.strip(), description=description)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _summary(c)


def get_collection(db: Session, cid: str):
    return db.query(Collection).filter(Collection.id == cid).first()


def get_collection_detail(db: Session, cid: str):
    c = get_collection(db, cid)
    if not c:
        return None
    items = []
    for item in c.items:
        gallery = db.query(Gallery).filter(Gallery.id == item.gallery_id).first()
        if gallery:
            items.append(to_gallery_out(gallery))
    out = _summary(c)
    out["items"] = items
    out["gallery_ids"] = [item.gallery_id for item in c.items]
    return out


def patch_collection(db: Session, cid: str, name=None, description=None):
    c = get_collection(db, cid)
    if not c:
        return None
    if name is not None:
        c.name = name.strip()
    if description is not None:
        c.description = description
    db.commit()
    db.refresh(c)
    return _summary(c)


def delete_collection(db: Session, cid: str):
    c = get_collection(db, cid)
    if not c:
        return False
    db.delete(c)
    db.commit()
    return True


def add_items(db: Session, cid: str, gallery_ids: list):
    c = get_collection(db, cid)
    if not c:
        return None
    existing = {item.gallery_id for item in c.items}
    max_order = max([item.sort_order for item in c.items], default=-1)
    for gid in gallery_ids:
        if gid in existing:
            continue
        gallery = db.query(Gallery).filter(Gallery.id == gid).first()
        if not gallery:
            continue
        max_order += 1
        db.add(CollectionItem(collection_id=cid, gallery_id=gid, sort_order=max_order))
        existing.add(gid)
    db.commit()
    db.refresh(c)
    return _summary(c)


def remove_item(db: Session, cid: str, gid: str):
    item = (
        db.query(CollectionItem)
        .filter(CollectionItem.collection_id == cid, CollectionItem.gallery_id == gid)
        .first()
    )
    if item:
        db.delete(item)
        db.commit()
        return True
    return False


def reorder_items(db: Session, cid: str, gallery_ids: list):
    c = get_collection(db, cid)
    if not c:
        return None
    membership = {item.gallery_id: item for item in c.items}
    for index, gid in enumerate(gallery_ids):
        if gid in membership:
            membership[gid].sort_order = index
    db.commit()
    return get_collection_detail(db, cid)


def collection_gallery_ids(db: Session, cid: str):
    c = get_collection(db, cid)
    if not c:
        return []
    return [item.gallery_id for item in c.items]
