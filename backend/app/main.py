from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import HOST, PORT, FRONTEND_ORIGIN, API_PREFIX
from app.db.session import init_db
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.services.importer import ensure_default_root

app = FastAPI(title="Mitsu API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.v1.galleries import router as galleries_router
from app.api.v1.imports import router as imports_router
from app.api.v1.collections import router as collections_router
from app.api.v1.metadata import router as metadata_router
from app.api.v1.providers import router as providers_router

app.include_router(galleries_router, prefix=API_PREFIX)
app.include_router(imports_router, prefix=API_PREFIX)
app.include_router(collections_router, prefix=API_PREFIX)
app.include_router(metadata_router, prefix=API_PREFIX)
app.include_router(providers_router, prefix=API_PREFIX)

@app.on_event("startup")
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        ensure_default_root(db)
    finally:
        db.close()

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
