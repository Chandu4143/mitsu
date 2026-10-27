from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_columns():
    """Small, safe additive migrations for the local SQLite database."""
    wanted = {
        "galleries": {
            "updated_at": "DATETIME",
            "metadata_json": "TEXT",
            "cover_page_index": "INTEGER",
        },
        "jobs": {
            "payload_json": "TEXT",
            "result_id": "VARCHAR",
            "cancel_requested": "INTEGER DEFAULT 0",
        },
    }
    with engine.connect() as conn:
        for table, columns in wanted.items():
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            existing = {row[1] for row in rows}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
        conn.commit()


def init_db():
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    with engine.connect() as c:
        c.execute(text("PRAGMA journal_mode=WAL"))
        c.execute(text("PRAGMA busy_timeout=30000"))
        c.execute(text("PRAGMA foreign_keys=ON"))
        c.commit()
