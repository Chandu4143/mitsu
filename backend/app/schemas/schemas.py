from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class GalleryOut(BaseModel):
    id: str
    title: str
    alternate_title: Optional[str] = None
    language: str = "unknown"
    page_count: int = 0
    favorite: bool = False
    reading_status: str = "unread"
    current_page: int = 0
    cover_url: Optional[str] = None
    date_added: Optional[datetime] = None
    last_opened_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class GalleryListOut(BaseModel):
    items: List[GalleryOut]
    page: int
    page_size: int
    total: int

class GalleryPageOut(BaseModel):
    page_index: int
    content_url: str
    width: Optional[int] = None
    height: Optional[int] = None

class GalleryDetailOut(GalleryOut):
    tags: List[str] = []
    artists: List[str] = []
    pages: List[GalleryPageOut] = []

class GalleryPatch(BaseModel):
    title: Optional[str] = None
    alternate_title: Optional[str] = None
    language: Optional[str] = None
    tags: Optional[List[str]] = None

class ProgressOut(BaseModel):
    current_page: int
    status: str
    updated_at: Optional[datetime] = None

class ProgressIn(BaseModel):
    current_page: int
    status: str

class FavoriteIn(BaseModel):
    favorite: bool

class CollectionOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    item_count: int = 0
    created_at: Optional[datetime] = None

class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class CollectionItemIn(BaseModel):
    gallery_ids: List[str]

class JobOut(BaseModel):
    id: str
    type: str
    status: str
    progress_current: int
    progress_total: int
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class ImportIn(BaseModel):
    path: Optional[str] = None
    mode: str = "index"

class LibraryRootIn(BaseModel):
    path: str

class LibraryRootOut(BaseModel):
    id: str
    path: str
    is_enabled: bool
    class Config:
        from_attributes = True
