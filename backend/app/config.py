import os
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "CardDeal AI"
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "").strip()
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "").strip()
    SERPAPI_API_KEY: str = os.getenv("SERPAPI_API_KEY", "").strip()
    DEFAULT_GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip()
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004").strip()
    HF_TOKEN: str = (os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN") or "").strip()
    HF_LLAMA_MODEL: str = os.getenv("HF_LLAMA_MODEL", "meta-llama/Llama-3.2-3B-Instruct").strip()
    HF_EMBEDDING_MODEL: str = os.getenv("HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2").strip()
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "*"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
