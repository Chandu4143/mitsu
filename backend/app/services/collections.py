from sqlalchemy.orm import Session
from app.models.models import Collection, CollectionItem, Gallery

def list_collections(db: Session):
    cols = db.query(Collection).order_by(Collection.created_at.desc()).all()
    out = []
    for c in cols:
        out.append({"id": c.id, "name": c.name, "description": c.description, "item_count": len(c.items), "created_at": c.created_at})
    return out

def create_collection(db: Session, name: str, description=None):
    c = Collection(name=name, description=description)
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "name": c.name, "description": c.description, "item_count": 0, "created_at": c.created_at}

def get_collection(db: Session, cid: str):
    return db.query(Collection).filter(Collection.id == cid).first()

def patch_collection(db: Session, cid: str, name=None, description=None):
    c = get_collection(db, cid)
    if not c:
        return None
    if name is not None:
        c.name = name
    if description is not None:
        c.description = description
    db.commit()
    db.refresh(c)
    return {"id": c.id, "name": c.name, "description": c.description, "item_count": len(c.items), "created_at": c.created_at}

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
    existing = {ci.gallery_id for ci in c.items}
    max_order = max([ci.sort_order for ci in c.items], default=-1)
    for gid in gallery_ids:
        if gid in existing:
            continue
        max_order += 1
        ci = CollectionItem(collection_id=cid, gallery_id=gid, sort_order=max_order)
        db.add(ci)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "name": c.name, "description": c.description, "item_count": len(c.items), "created_at": c.created_at}

def remove_item(db: Session, cid: str, gid: str):
    ci = db.query(CollectionItem).filter(CollectionItem.collection_id == cid, CollectionItem.gallery_id == gid).first()
    if ci:
        db.delete(ci)
        db.commit()
        return True
    return False

def collection_gallery_ids(db: Session, cid: str):
    c = get_collection(db, cid)
    if not c:
        return []
    return [ci.gallery_id for ci in c.items]
