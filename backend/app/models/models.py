import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base

def uid():
    return str(uuid.uuid4())

def now():
    return datetime.now(timezone.utc)

class LibraryRoot(Base):
    __tablename__ = "library_roots"
    id = Column(String, primary_key=True, default=uid)
    path = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=now)
    is_enabled = Column(Boolean, default=True)

class Gallery(Base):
    __tablename__ = "galleries"
    id = Column(String, primary_key=True, default=uid)
    root_id = Column(String, ForeignKey("library_roots.id"), nullable=True)
    relative_path = Column(String, nullable=False)
    title = Column(String, nullable=False)
    alternate_title = Column(String, nullable=True)
    language = Column(String, default="unknown")
    page_count = Column(Integer, default=0)
    cover_path = Column(String, nullable=True)
    source_id = Column(String, nullable=True)
    external_id = Column(String, nullable=True)
    file_size = Column(Integer, default=0)
    content_hash = Column(String, nullable=True)
    date_added = Column(DateTime, default=now)
    last_opened_at = Column(DateTime, nullable=True)
    pages = relationship("GalleryPage", back_populates="gallery", cascade="all, delete-orphan", order_by="GalleryPage.page_index")
    tags = relationship("GalleryTag", back_populates="gallery", cascade="all, delete-orphan")
    artists = relationship("GalleryArtist", back_populates="gallery", cascade="all, delete-orphan")
    progress = relationship("ReadingProgress", back_populates="gallery", uselist=False, cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="gallery", uselist=False, cascade="all, delete-orphan")

class GalleryPage(Base):
    __tablename__ = "gallery_pages"
    id = Column(String, primary_key=True, default=uid)
    gallery_id = Column(String, ForeignKey("galleries.id"), nullable=False)
    page_index = Column(Integer, nullable=False)
    relative_path = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    gallery = relationship("Gallery", back_populates="pages")
    __table_args__ = (UniqueConstraint("gallery_id", "page_index"),)

class Tag(Base):
    __tablename__ = "tags"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String, nullable=False)
    normalized_name = Column(String, nullable=False)
    category = Column(String, default="general")
    __table_args__ = (UniqueConstraint("normalized_name", "category"),)

class GalleryTag(Base):
    __tablename__ = "gallery_tags"
    gallery_id = Column(String, ForeignKey("galleries.id"), primary_key=True)
    tag_id = Column(String, ForeignKey("tags.id"), primary_key=True)
    source = Column(String, default="import")
    is_user_override = Column(Boolean, default=False)
    gallery = relationship("Gallery", back_populates="tags")
    tag = relationship("Tag")

class Artist(Base):
    __tablename__ = "artists"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String, nullable=False)
    normalized_name = Column(String, nullable=False, unique=True)

class GalleryArtist(Base):
    __tablename__ = "gallery_artists"
    gallery_id = Column(String, ForeignKey("galleries.id"), primary_key=True)
    artist_id = Column(String, ForeignKey("artists.id"), primary_key=True)
    source = Column(String, default="import")
    gallery = relationship("Gallery", back_populates="artists")
    artist = relationship("Artist")

class ReadingProgress(Base):
    __tablename__ = "reading_progress"
    gallery_id = Column(String, ForeignKey("galleries.id"), primary_key=True)
    current_page = Column(Integer, default=0)
    status = Column(String, default="unread")
    updated_at = Column(DateTime, default=now)
    completed_at = Column(DateTime, nullable=True)
    gallery = relationship("Gallery", back_populates="progress")

class Favorite(Base):
    __tablename__ = "favorites"
    gallery_id = Column(String, ForeignKey("galleries.id"), primary_key=True)
    created_at = Column(DateTime, default=now)
    gallery = relationship("Gallery", back_populates="favorites")

class Collection(Base):
    __tablename__ = "collections"
    id = Column(String, primary_key=True, default=uid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now)
    items = relationship("CollectionItem", back_populates="collection", cascade="all, delete-orphan", order_by="CollectionItem.sort_order")

class CollectionItem(Base):
    __tablename__ = "collection_items"
    collection_id = Column(String, ForeignKey("collections.id"), primary_key=True)
    gallery_id = Column(String, ForeignKey("galleries.id"), primary_key=True)
    sort_order = Column(Integer, default=0)
    collection = relationship("Collection", back_populates="items")
    gallery = relationship("Gallery")

class Job(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True, default=uid)
    type = Column(String, nullable=False)
    status = Column(String, default="queued")
    progress_current = Column(Integer, default=0)
    progress_total = Column(Integer, default=0)
    error_code = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

class AppSetting(Base):
    __tablename__ = "app_settings"
    key = Column(String, primary_key=True)
    value_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=now)
