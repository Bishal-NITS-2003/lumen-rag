import re
import os
import json
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from langchain_text_splitters import RecursiveCharacterTextSplitter
try:
    from langchain_huggingface import HuggingFaceEmbeddings
except ImportError:
    try:
        from langchain_community.embeddings import HuggingFaceEmbeddings
    except ImportError:
        HuggingFaceEmbeddings = None

from .config import settings
from .models import DocumentChunk, Source

logger = logging.getLogger(__name__)

# ─── Embedding Initialization & Resilient Fallback ────────────────────────
_PRIMARY_EMBEDDINGS = None
_FALLBACK_EMBEDDINGS = None
_CHROMA_CLIENT = None

def get_google_embeddings():
    """Initializes Google Gemini text-embedding-004 (sub-second cloud embeddings, 0 CPU load)."""
    global _PRIMARY_EMBEDDINGS
    if _PRIMARY_EMBEDDINGS is None and settings.GOOGLE_API_KEY:
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            _PRIMARY_EMBEDDINGS = GoogleGenerativeAIEmbeddings(
                model=settings.GEMINI_EMBEDDING_MODEL,
                google_api_key=settings.GOOGLE_API_KEY
            )
            logger.info("Initialized Google Gemini text-embedding-004.")
        except Exception as e:
            logger.warning(f"Google Gemini embeddings setup warning: {e}")
    return _PRIMARY_EMBEDDINGS

def get_local_fallback_embeddings():
    """Initializes local sentence-transformers/all-MiniLM-L6-v2 as offline backup."""
    global _FALLBACK_EMBEDDINGS
    if _FALLBACK_EMBEDDINGS is None:
        try:
            from langchain_huggingface import HuggingFaceEmbeddings
            _FALLBACK_EMBEDDINGS = HuggingFaceEmbeddings(model_name=settings.HF_EMBEDDING_MODEL)
        except Exception:
            try:
                from langchain_community.embeddings import HuggingFaceEmbeddings
                _FALLBACK_EMBEDDINGS = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
            except Exception as e:
                logger.error(f"Fallback MiniLM setup failed: {e}")
    return _FALLBACK_EMBEDDINGS

def get_embeddings():
    """Returns primary Google Gemini embeddings if configured, else local fallback."""
    emb = get_google_embeddings()
    if emb is not None:
        return emb
    return get_local_fallback_embeddings()

def safe_embed_documents(texts: List[str]) -> List[List[float]]:
    """
    Embeds documents using Google Gemini text-embedding-004.
    Automatically and seamlessly falls back to local MiniLM if Google API times out or fails.
    """
    google_emb = get_google_embeddings()
    if google_emb:
        try:
            return google_emb.embed_documents(texts)
        except Exception as e:
            logger.warning(f"Google Gemini embedding failed ({e}), falling back to local sentence-transformers.")

    fallback_emb = get_local_fallback_embeddings()
    if fallback_emb:
        return fallback_emb.embed_documents(texts)
    raise RuntimeError("No embedding provider available.")

def safe_embed_query(query: str) -> List[float]:
    """
    Embeds query using Google Gemini text-embedding-004 with automatic local fallback.
    """
    google_emb = get_google_embeddings()
    if google_emb:
        try:
            return google_emb.embed_query(query)
        except Exception as e:
            logger.warning(f"Google Gemini query embedding failed ({e}), falling back to local sentence-transformers.")

    fallback_emb = get_local_fallback_embeddings()
    if fallback_emb:
        return fallback_emb.embed_query(query)
    raise RuntimeError("No embedding provider available.")

def get_chroma_client():
    global _CHROMA_CLIENT
    if _CHROMA_CLIENT is None:
        try:
            import chromadb
            persist_dir = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
            os.makedirs(persist_dir, exist_ok=True)
            _CHROMA_CLIENT = chromadb.PersistentClient(path=persist_dir)
        except Exception as e:
            logger.warning(f"Persistent Chroma client failed: {e}. Falling back to ephemeral Client.")
            import chromadb
            _CHROMA_CLIENT = chromadb.Client()
    return _CHROMA_CLIENT

def get_notebook_collection(notebook_id: str):
    client = get_chroma_client()
    safe_name = f"nb_{re.sub(r'[^a-zA-Z0-9_-]', '_', notebook_id)}"
    return client.get_or_create_collection(
        name=safe_name,
        metadata={"hnsw:space": "cosine"}
    )

# Optimized chunk size: 1200 chars cuts chunk count by 50% and provides richer context for RAG
TEXT_SPLITTER = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=150)

def index_source(db: Session, notebook_id: str, source_id: str, title: str, content: str) -> int:
    """
    Chunks document content, saves DocumentChunks in DB, and adds vectors to ChromaDB.
    """
    if not content or not content.strip():
        return 0

    # 1. Chunk text (larger 1200 char chunks = 50% fewer embeddings, much faster)
    raw_chunks = TEXT_SPLITTER.split_text(content)
    if not raw_chunks:
        raw_chunks = [content[:1200]]

    # 2. Delete any old chunks for this source in DB
    db.query(DocumentChunk).filter(DocumentChunk.source_id == source_id).delete()
    db.commit()

    # 3. Add to DB
    chunk_objs = []
    chunk_texts = []
    chunk_metadatas = []
    chunk_ids = []

    for i, chunk_text in enumerate(raw_chunks):
        chunk_obj = DocumentChunk(
            notebook_id=notebook_id,
            source_id=source_id,
            chunk_index=i,
            content=chunk_text,
            metadata_json=json.dumps({"source_id": source_id, "title": title, "index": i})
        )
        chunk_objs.append(chunk_obj)
        chunk_texts.append(chunk_text)
        chunk_metadatas.append({"source_id": source_id, "title": title, "index": i})
        chunk_ids.append(f"{source_id}_{i}")

    db.bulk_save_objects(chunk_objs)
    db.commit()

    # 4. Add to Vector Store using Google Gemini text-embedding-004 (sub-second)
    try:
        collection = get_notebook_collection(notebook_id)
        # Delete existing entries for this source
        try:
            collection.delete(where={"source_id": source_id})
        except Exception:
            pass

        vectors = safe_embed_documents(chunk_texts)
        try:
            collection.add(
                ids=chunk_ids,
                documents=chunk_texts,
                metadatas=chunk_metadatas,
                embeddings=vectors
            )
            logger.info(f"Indexed {len(chunk_texts)} chunks for source '{title}' in notebook '{notebook_id}'")
        except Exception as add_err:
            # Handle collection dimension transition (e.g. 384 -> 768)
            if "dimension" in str(add_err).lower():
                logger.warning(f"ChromaDB dimension transition ({add_err}). Resetting collection for new embedding model.")
                client = get_chroma_client()
                safe_name = f"nb_{re.sub(r'[^a-zA-Z0-9_-]', '_', notebook_id)}"
                try:
                    client.delete_collection(name=safe_name)
                except Exception:
                    pass
                collection = client.create_collection(name=safe_name, metadata={"hnsw:space": "cosine"})
                collection.add(
                    ids=chunk_ids,
                    documents=chunk_texts,
                    metadatas=chunk_metadatas,
                    embeddings=vectors
                )
                logger.info(f"Re-indexed {len(chunk_texts)} chunks in refreshed collection for notebook '{notebook_id}'")
            else:
                raise add_err
    except Exception as e:
        logger.warning(f"Vector store indexing failed ({e}). Database chunks are still preserved.")

    return len(chunk_objs)


def delete_source_index(notebook_id: str, source_id: str):
    """Deletes vectors associated with a source."""
    try:
        collection = get_notebook_collection(notebook_id)
        collection.delete(where={"source_id": source_id})
    except Exception as e:
        logger.warning(f"Failed to delete source from vector store: {e}")


def retrieve_context_chunks(
    db: Session,
    notebook_id: str,
    query: str,
    allowed_source_ids: Optional[List[str]] = None,
    top_k: int = 6
) -> List[Dict[str, Any]]:
    """
    Retrieves top relevant chunks from ChromaDB (with keyword DB fallback).
    Filters by allowed_source_ids.
    """
    results: List[Dict[str, Any]] = []

    # 1. Try Vector Store
    try:
        collection = get_notebook_collection(notebook_id)
        count = collection.count()
        if count > 0:
            q_vector = safe_embed_query(query)
            
            where_filter = None
            if allowed_source_ids:
                if len(allowed_source_ids) == 1:
                    where_filter = {"source_id": allowed_source_ids[0]}
                else:
                    where_filter = {"$or": [{"source_id": sid} for sid in allowed_source_ids]}

            query_kwargs = {
                "query_embeddings": [q_vector],
                "n_results": min(top_k * 2, count)
            }
            if where_filter:
                query_kwargs["where"] = where_filter

            res = collection.query(**query_kwargs)

            if res and res.get("documents") and len(res["documents"][0]) > 0:
                docs = res["documents"][0]
                metas = res["metadatas"][0] if res.get("metadatas") else [{}] * len(docs)
                for doc_text, meta in zip(docs, metas):
                    results.append({
                        "content": doc_text,
                        "source_id": meta.get("source_id", ""),
                        "source_title": meta.get("title", "Document"),
                        "chunk_index": meta.get("index", 0)
                    })
                return results[:top_k]
    except Exception as e:
        logger.warning(f"Vector search exception: {e}. Falling back to DB search.")

    # 2. Database Keyword Fallback
    query_builder = db.query(DocumentChunk, Source.title).join(Source, DocumentChunk.source_id == Source.id)
    query_builder = query_builder.filter(DocumentChunk.notebook_id == notebook_id)
    if allowed_source_ids:
        query_builder = query_builder.filter(DocumentChunk.source_id.in_(allowed_source_ids))

    all_chunks = query_builder.all()
    if not all_chunks:
        return []

    tokens = set(query.lower().split())
    scored = []
    for chunk, source_title in all_chunks:
        text_lower = chunk.content.lower()
        score = sum(1 for t in tokens if t in text_lower)
        scored.append((score, chunk, source_title))

    scored.sort(key=lambda x: x[0], reverse=True)
    for _, chunk, source_title in scored[:top_k]:
        results.append({
            "content": chunk.content,
            "source_id": chunk.source_id,
            "source_title": source_title,
            "chunk_index": chunk.chunk_index
        })

    return results
