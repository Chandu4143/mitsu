from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
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
    file_size: int = 0
    source_id: Optional[str] = None
    missing: bool = False
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
    metadata: List[Dict[str, Any]] = []


class GalleryPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    alternate_title: Optional[str] = Field(default=None, max_length=500)
    language: Optional[str] = Field(default=None, max_length=40)
    tags: Optional[List[str]] = None

    @field_validator("language")
    @classmethod
    def valid_language(cls, v):
        if v is None:
            return v
        allowed = {"unknown", "en", "ja", "ko", "zh", "es", "fr", "de", "pt", "it", "ru"}
        if v.lower() not in allowed:
            raise ValueError("Unsupported language code")
        return v.lower()


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
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)


class CollectionPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)


class CollectionItemIn(BaseModel):
    gallery_ids: List[str]


class CollectionOrderIn(BaseModel):
    gallery_ids: List[str]


class CollectionDetailOut(CollectionOut):
    items: List[GalleryOut] = []
    gallery_ids: List[str] = []


class JobOut(BaseModel):
    id: str
    type: str
    status: str
    progress_current: int
    progress_total: int
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    result_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    class Config:
        from_attributes = True


class ImportIn(BaseModel):
    path: Optional[str] = None
    root_id: Optional[str] = None
    relative_path: Optional[str] = None
    mode: str = "import"


class LibraryRootIn(BaseModel):
    path: str = Field(min_length=1, max_length=4096)


class LibraryRootOut(BaseModel):
    id: str
    path: str
    is_enabled: bool
    class Config:
        from_attributes = True


class StatsOut(BaseModel):
    galleries: int
    pages: int
    favorites: int
    collections: int
    bytes: int
    roots: int


class MetadataLookupIn(BaseModel):
    source_id: str = "local"


class MetadataApplyIn(BaseModel):
    record_id: str = ""
    gallery_id: Optional[str] = None
    fields: List[str] = []
