import os
import logging
from urllib.parse import urlparse
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

logger = logging.getLogger(__name__)

def ensure_postgres_db_exists(url: str):
    """Auto-creates the target database if it does not exist yet on the PostgreSQL server."""
    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

        # Clean scheme for urlparse if needed
        clean_url = url.replace("postgresql+psycopg2://", "postgresql://")
        parsed = urlparse(clean_url)
        target_db = parsed.path.lstrip("/")

        if not target_db or target_db == "postgres":
            return

        conn = psycopg2.connect(
            dbname="postgres",
            user=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port or 5432,
            connect_timeout=10
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute(f"SELECT 1 FROM pg_database WHERE datname = %s", (target_db,))
        exists = cur.fetchone()
        if not exists:
            logger.info(f"Database '{target_db}' does not exist. Creating it now...")
            cur.execute(f'CREATE DATABASE "{target_db}"')
            logger.info(f"Database '{target_db}' created successfully.")
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning(f"Could not auto-create database (may already exist or insufficient permissions): {e}")


db_url = settings.DATABASE_URL
if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    # Auto-normalize postgres:// or postgresql:// without driver to postgresql+psycopg2://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    # Ensure target database exists before creating engine
    ensure_postgres_db_exists(db_url)
    engine = create_engine(db_url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # Make sure storage dir exists
    os.makedirs(settings.STORAGE_DIR, exist_ok=True)
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
