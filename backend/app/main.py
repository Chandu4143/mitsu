from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import API_PREFIX, HOST, PORT, FRONTEND_ORIGIN
from app.db.session import SessionLocal, init_db
from app.services.importer import ensure_default_root
from app.services.jobs import reconcile_jobs

app = FastAPI(title="Mitsu API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_ORIGIN,
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3001",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code = {
        400: "BAD_REQUEST",
        404: "NOT_FOUND",
        409: "CONFLICT",
        413: "CONTENT_TOO_LARGE",
        422: "VALIDATION_ERROR",
        429: "TOO_MANY_REQUESTS",
    }.get(exc.status_code, "HTTP_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": str(exc.detail), "details": {}}},
    )


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "The request did not pass validation.",
                "details": {"errors": exc.errors()},
            }
        },
    )


from app.api.v1.collections import router as collections_router
from app.api.v1.galleries import router as galleries_router
from app.api.v1.imports import router as imports_router
from app.api.v1.metadata import router as metadata_router
from app.api.v1.providers import router as providers_router
from app.api.v1.settings import router as settings_router

app.include_router(galleries_router, prefix=API_PREFIX)
app.include_router(imports_router, prefix=API_PREFIX)
app.include_router(collections_router, prefix=API_PREFIX)
app.include_router(metadata_router, prefix=API_PREFIX)
app.include_router(providers_router, prefix=API_PREFIX)
app.include_router(settings_router, prefix=API_PREFIX)


@app.on_event("startup")
def on_startup():
    init_db()
    db: Session = SessionLocal()
    try:
        ensure_default_root(db)
        reconcile_jobs(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
