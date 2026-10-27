import os
import tempfile

import pytest

# Configure an isolated data directory before any app module is imported.
os.environ.setdefault("MITSU_DATA_DIR", tempfile.mkdtemp(prefix="mitsu-tests-"))

from fastapi.testclient import TestClient  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models.models import (  # noqa: E402
    Artist,
    Bookmark,
    Collection,
    CollectionItem,
    Favorite,
    Gallery,
    GalleryArtist,
    GalleryPage,
    GalleryTag,
    Job,
    LibraryRoot,
    MetadataRecord,
    ReadingProgress,
    Tag,
)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


# Child rows first so the cleanup works even without foreign-key cascade.
_CLEANUP_ORDER = (
    Bookmark,
    CollectionItem,
    Collection,
    Favorite,
    ReadingProgress,
    GalleryPage,
    GalleryTag,
    GalleryArtist,
    MetadataRecord,
    Gallery,
    Tag,
    Artist,
    Job,
    LibraryRoot,
)


@pytest.fixture(autouse=True)
def clean_database():
    yield
    db = SessionLocal()
    try:
        for model in _CLEANUP_ORDER:
            db.query(model).delete()
        db.commit()
    finally:
        db.close()
