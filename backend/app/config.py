import os
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Lumen Notebook — AI Research Platform"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./notebooks.db").strip()
    
    # Model API Keys (State-of-the-art Open Source Models: DeepSeek-R1 & Qwen 2.5)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", os.getenv("GROQ_LLAMA_MODEL", "deepseek-r1-distill-llama-70b")).strip()
    
    HF_TOKEN: str = (os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN") or "").strip()
    HF_MODEL: str = os.getenv("HF_MODEL", os.getenv("HF_LLAMA_MODEL", "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")).strip()
    HF_EMBEDDING_MODEL: str = os.getenv("HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2").strip()
    
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "").strip()
    DEFAULT_GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip()
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004").strip()
    
    # External Data Sources
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "").strip()
    SERPAPI_API_KEY: str = os.getenv("SERPAPI_API_KEY", "").strip()
    
    # AWS Services
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1").strip()
    AWS_S3_BUCKET: str = os.getenv("AWS_S3_BUCKET", "").strip()
    
    # Local Storage fallback
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "./storage/uploads").strip()
    
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "*"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
