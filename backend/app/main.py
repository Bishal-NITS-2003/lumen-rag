import logging
from datetime import datetime
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.schemas import (
    SearchResponse, IndexSourcesRequest, IndexSourcesResponse,
    ChatMessageRequest, ChatMessageResponse, ChatSessionInfo
)
from app.scrapers import generate_search_queries, fetch_media_for_queries, load_source_documents
from app.rag import get_or_create_session, list_all_sessions, delete_session

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="LangChain RAG Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"app": "LangChain RAG Assistant", "status": "online"}

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "has_google_key": bool(settings.GOOGLE_API_KEY),
        "has_serpapi_key": bool(settings.SERPAPI_API_KEY),
        "model": settings.DEFAULT_GEMINI_MODEL
    }

# --- Session Management ---

@app.get("/api/sessions", response_model=List[ChatSessionInfo])
async def get_sessions():
    """Returns list of previous chat sessions for the sidebar."""
    return list_all_sessions()

@app.post("/api/sessions/new", response_model=ChatSessionInfo)
async def create_new_session(payload: Dict[str, str]):
    session_id = payload.get("session_id") or f"sess_{int(datetime.now().timestamp())}"
    title = payload.get("title") or "New Research"
    sess = get_or_create_session(session_id, title=title)
    return ChatSessionInfo(
        session_id=sess.session_id,
        title=sess.title,
        created_at=sess.created_at,
        message_count=0,
        is_indexed=False,
        source_count=0
    )

@app.get("/api/sessions/{session_id}")
async def get_session_details(session_id: str):
    sess = get_or_create_session(session_id)
    history = []
    for msg in sess.chat_history:
        history.append({
            "role": "user" if msg.type == "human" else "assistant",
            "content": msg.content
        })
    return {
        "session_id": session_id,
        "title": sess.title,
        "created_at": sess.created_at,
        "is_indexed": len(sess.docs) > 0,
        "indexed_sources": sess.indexed_sources,
        "chat_history": history
    }

@app.delete("/api/sessions/{session_id}")
async def remove_session(session_id: str):
    success = delete_session(session_id)
    return {"success": success}

# --- Search & Content Acquisition ---

@app.post("/api/search", response_model=SearchResponse)
async def search_sources(payload: Dict[str, str]):
    """
    1. Generates 5 queries via Gemini structured output.
    2. Fetches 2 YouTube videos + 2 Google articles per query (10 YouTube + 10 Google).
    """
    prompt = payload.get("prompt", "").strip()
    session_id = payload.get("session_id", "default_session")

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    # Initialize session title
    sess = get_or_create_session(session_id, title=prompt[:32])

    try:
        # Step 1: 5 Search queries
        queries = await generate_search_queries(prompt)

        # Step 2: 10 YouTube videos & 10 Google articles
        results = await fetch_media_for_queries(queries)

        return SearchResponse(
            session_id=session_id,
            user_prompt=prompt,
            queries=queries,
            youtube_videos=results["youtube"],
            google_articles=results["articles"]
        )
    except Exception as e:
        logger.error(f"Error in search workflow: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# --- Document Indexing into RAG Vector Store ---

@app.post("/api/index-sources", response_model=IndexSourcesResponse)
async def index_sources(req: IndexSourcesRequest):
    """
    Loads transcripts and article contents from max 5 user-selected items,
    splits with RecursiveCharacterTextSplitter, and indexes into Chroma vector store.
    """
    if not req.selected_items:
        raise HTTPException(status_code=400, detail="Please select at least 1 source.")
    if len(req.selected_items) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 sources allowed.")

    sess = get_or_create_session(req.session_id)

    try:
        raw_docs = await load_source_documents(req.selected_items)
        chunks_count = sess.index_documents(raw_docs, req.selected_items)

        return IndexSourcesResponse(
            session_id=req.session_id,
            indexed_count=len(req.selected_items),
            chunks_count=chunks_count,
            message=f"Successfully indexed {len(req.selected_items)} sources ({chunks_count} knowledge chunks) into vector store.",
            sources=req.selected_items
        )
    except Exception as e:
        logger.error(f"Error indexing sources: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# --- Conversational RAG Chat ---

@app.post("/api/chat", response_model=ChatMessageResponse)
async def chat_with_rag(req: ChatMessageRequest):
    """
    Pure LangChain Conversational RAG Q&A:
    Uses Retriever + MessagesPlaceholder('chat_history') + ChatPromptTemplate + StrOutputParser.
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    sess = get_or_create_session(req.session_id)

    try:
        res = await sess.chat(req.message.strip())
        return ChatMessageResponse(
            session_id=req.session_id,
            role="assistant",
            content=res["answer"],
            sources=res["sources"]
        )
    except Exception as e:
        logger.error(f"Error in RAG chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
