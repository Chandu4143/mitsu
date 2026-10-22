import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = Path(os.getenv("MITSU_DATA_DIR", str(BASE_DIR / "data")))
DB_PATH = DATA_DIR / "database" / "mitsu.db"
THUMB_DIR = DATA_DIR / "thumbnails"
CACHE_DIR = DATA_DIR / "cache"
LIBRARY_ROOT = Path(os.getenv("MITSU_LIBRARY_ROOT", str(DATA_DIR / "library")))

for d in (DATA_DIR, DATA_DIR / "database", THUMB_DIR, CACHE_DIR, LIBRARY_ROOT):
    d.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"
API_PREFIX = "/api/v1"
HOST = os.getenv("MITSU_HOST", "127.0.0.1")
PORT = int(os.getenv("MITSU_PORT", "8000"))
FRONTEND_ORIGIN = os.getenv("MITSU_FRONTEND_ORIGIN", "http://localhost:3000")

# Import safety limits
MAX_ARCHIVE_BYTES = int(os.getenv("MITSU_MAX_ARCHIVE_BYTES", str(4 * 1024 * 1024 * 1024)))
MAX_EXTRACTED_BYTES = int(os.getenv("MITSU_MAX_EXTRACTED_BYTES", str(8 * 1024 * 1024 * 1024)))
MAX_ARCHIVE_ENTRIES = int(os.getenv("MITSU_MAX_ARCHIVE_ENTRIES", "20000"))
MAX_IMAGE_PIXELS = int(os.getenv("MITSU_MAX_IMAGE_PIXELS", str(80_000_000)))
