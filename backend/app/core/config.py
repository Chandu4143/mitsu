import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
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
