import os
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Lumen Notebook — AI Research Platform"
    
    # Database (PostgreSQL RDS / SQLite)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./notebooks.db").strip()
    
    # Cloud Open Source LLM Engine: Groq (Qwen 3.8 27B / LLaMA)
    # Hosted on Groq LPUs with ~300 tok/s - 0 CPU/GPU load on AWS EC2
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip()

    # Local Vector Embeddings (MiniLM - lightweight CPU sentence embeddings with 0 external API calls)
    HF_EMBEDDING_MODEL: str = os.getenv("HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2").strip()
    
    # Search API (SerpAPI for Google discovery of articles and YouTube metadata)
    SERPAPI_API_KEY: str = os.getenv("SERPAPI_API_KEY", "").strip()
    
    # AWS Services (S3 bucket for document persistence)
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1").strip()
    AWS_S3_BUCKET: str = os.getenv("AWS_S3_BUCKET", "").strip()
    
    # Local Storage fallback
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "./storage/uploads").strip()
    
    CORS_ORIGINS: List[str] = [
        "https://lumen-rag-orcin.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173" 
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
