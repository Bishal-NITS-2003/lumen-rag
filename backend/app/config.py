import os
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Lumen Notebook — AI Research Platform"
    
    # Database (PostgreSQL RDS / SQLite)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./notebooks.db").strip()
    
    # Open Source LLM Engines (DeepSeek-R1, Llama 3.3, Qwen 2.5)
    # Option 1: Groq (Recommended - Ultra-fast & Free Tier)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "deepseek-r1-distill-llama-70b").strip()
    
    # Option 2: Local Ollama / vLLM / LM Studio (Zero API Keys needed)
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1").strip()
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "deepseek-r1").strip()
    
    # Option 3: Hugging Face Serverless / Inference Providers
    HF_TOKEN: str = (os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN") or "").strip()
    HF_MODEL: str = os.getenv("HF_MODEL", "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B").strip()
    
    # Option 4: OpenRouter (Free DeepSeek-R1, Qwen & Llama endpoints)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "").strip()
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-r1:free").strip()

    # Local Open Source Vector Embeddings (MiniLM - runs locally on CPU with 0 API calls)
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
    
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "*"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
