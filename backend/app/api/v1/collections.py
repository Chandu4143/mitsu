from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.schemas.schemas import CollectionOut, CollectionCreate, CollectionPatch, CollectionItemIn
from app.services import collections as colsvc

router = APIRouter(prefix="/collections", tags=["collections"])

@router.get("", response_model=list[CollectionOut])
def list_collections(db: Session=Depends(get_db)):
    return colsvc.list_collections(db)

@router.post("", response_model=CollectionOut, status_code=201)
def create_collection(body: CollectionCreate, db: Session=Depends(get_db)):
    return colsvc.create_collection(db, body.name, body.description)

@router.get("/{cid}")
def get_collection(cid: str, db: Session=Depends(get_db)):
    c = colsvc.get_collection(db, cid)
    if not c:
        raise HTTPException(404, "Collection not found")
    items = colsvc.collection_gallery_ids(db, cid)
    return {"id": c.id, "name": c.name, "description": c.description, "item_count": len(c.items), "created_at": c.created_at, "gallery_ids": items}

@router.patch("/{cid}", response_model=CollectionOut)
def patch_collection(cid: str, body: CollectionPatch, db: Session=Depends(get_db)):
    res = colsvc.patch_collection(db, cid, body.name, body.description)
    if not res:
        raise HTTPException(404, "Collection not found")
    return res

@router.delete("/{cid}", status_code=204)
def delete_collection(cid: str, db: Session=Depends(get_db)):
    ok = colsvc.delete_collection(db, cid)
    if not ok:
        raise HTTPException(404, "Collection not found")
    return None

@router.post("/{cid}/items")
def add_items(cid: str, body: CollectionItemIn, db: Session=Depends(get_db)):
    res = colsvc.add_items(db, cid, body.gallery_ids)
    if not res:
        raise HTTPException(404, "Collection not found")
    return res

@router.delete("/{cid}/items/{gallery_id}", status_code=204)
def remove_item(cid: str, gallery_id: str, db: Session=Depends(get_db)):
    colsvc.remove_item(db, cid, gallery_id)
    return None
