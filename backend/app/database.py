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

        # Fast path: check if target_db already exists by connecting directly
        try:
            test_conn = psycopg2.connect(
                dbname=target_db,
                user=parsed.username,
                password=parsed.password,
                host=parsed.hostname,
                port=parsed.port or 5432,
                connect_timeout=4
            )
            test_conn.close()
            return  # target_db exists and is ready!
        except Exception:
            pass

        conn = psycopg2.connect(
            dbname="postgres",
            user=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port or 5432,
            connect_timeout=5
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target_db,))
        exists = cur.fetchone()
        if not exists:
            logger.info(f"Database '{target_db}' does not exist. Creating it now...")
            cur.execute(f'CREATE DATABASE "{target_db}"')
            logger.info(f"Database '{target_db}' created successfully.")
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning(f"Database setup note: {e}")


db_url = settings.DATABASE_URL
if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    # Auto-normalize postgres:// or postgresql:// without driver to postgresql+psycopg2://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    try:
        ensure_postgres_db_exists(db_url)
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 5}
        )
        # Test connection
        with engine.connect() as conn:
            pass
        logger.info("Successfully connected to AWS RDS PostgreSQL database.")
    except Exception as e:
        logger.warning(
            f"Failed to connect to PostgreSQL ({e}). "
            "Falling back to local SQLite database so the application continues to run seamlessly."
        )
        engine = create_engine("sqlite:///./notebooks.db", connect_args={"check_same_thread": False})

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

    # Safe migration: add extraction_status, extraction_error, and user_id columns if not present
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE sources ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(50) DEFAULT 'success'"))
            conn.execute(text("ALTER TABLE sources ADD COLUMN IF NOT EXISTS extraction_error TEXT"))
            conn.execute(text("ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS user_id VARCHAR(128)"))
            conn.commit()
    except Exception as e:
        logger.debug(f"Column migration check note: {e}")
