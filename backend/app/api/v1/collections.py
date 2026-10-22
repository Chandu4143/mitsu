from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schemas import (
    CollectionCreate,
    CollectionDetailOut,
    CollectionItemIn,
    CollectionOrderIn,
    CollectionOut,
    CollectionPatch,
)
from app.services import collections as colsvc

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("", response_model=list[CollectionOut])
def list_collections(db: Session = Depends(get_db)):
    return colsvc.list_collections(db)


@router.post("", response_model=CollectionOut, status_code=201)
def create_collection(body: CollectionCreate, db: Session = Depends(get_db)):
    return colsvc.create_collection(db, body.name, body.description)


@router.get("/{cid}", response_model=CollectionDetailOut)
def get_collection(cid: str, db: Session = Depends(get_db)):
    detail = colsvc.get_collection_detail(db, cid)
    if not detail:
        raise HTTPException(404, "Collection not found")
    return detail


@router.patch("/{cid}", response_model=CollectionOut)
def patch_collection(cid: str, body: CollectionPatch, db: Session = Depends(get_db)):
    result = colsvc.patch_collection(db, cid, body.name, body.description)
    if not result:
        raise HTTPException(404, "Collection not found")
    return result


@router.delete("/{cid}", status_code=204)
def delete_collection(cid: str, db: Session = Depends(get_db)):
    if not colsvc.delete_collection(db, cid):
        raise HTTPException(404, "Collection not found")
    return None


@router.post("/{cid}/items", response_model=CollectionOut)
def add_items(cid: str, body: CollectionItemIn, db: Session = Depends(get_db)):
    result = colsvc.add_items(db, cid, body.gallery_ids)
    if not result:
        raise HTTPException(404, "Collection not found")
    return result


@router.patch("/{cid}/items/order", response_model=CollectionDetailOut)
def reorder_items(cid: str, body: CollectionOrderIn, db: Session = Depends(get_db)):
    result = colsvc.reorder_items(db, cid, body.gallery_ids)
    if not result:
        raise HTTPException(404, "Collection not found")
    return result


@router.delete("/{cid}/items/{gallery_id}", status_code=204)
def remove_item(cid: str, gallery_id: str, db: Session = Depends(get_db)):
    colsvc.remove_item(db, cid, gallery_id)
    return None
