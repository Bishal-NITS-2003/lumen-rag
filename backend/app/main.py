import os
import json
import logging
import asyncio
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db, init_db
from .models import Notebook, Source, ChatMessage, StudioNote, DocumentChunk, NotebookNote
from .schemas import (
    NotebookCreate, NotebookUpdate, NotebookResponse, NotebookDetailResponse,
    SourceResponse, SourceDetailResponse, SourceToggleRequest,
    AddUrlSourceRequest, GenerateSourcesRequest, CandidateSourcesResponse, CandidateSourceItem,
    AddSelectedSourcesRequest, ChatRequest, ChatMessageResponse,
    NoteResponse, NoteUpdateRequest, NoteAppendRequest,
    GenerateStudioNoteRequest, StudioNoteResponse
)
from .aws_service import storage_service, parse_uploaded_document
from .rag import index_source, delete_source_index, retrieve_context_chunks
from .llm import (
    summarize_text,
    generate_grounded_answer,
    generate_studio_note
)
from .scrapers import (
    discover_google_sources,
    fetch_youtube_transcript_text,
    fetch_article_text,
    extract_youtube_video_id
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize database schema
init_db()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Full-stack AI Research Assistant modeled after Google NotebookLM with DeepSeek-R1 / Qwen / Llama and AWS integration.",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── System & Health ──────────────────────────────────────────
@app.get("/api/health")
def health_check():
    active_llm = (
        f"DeepSeek-R1 (Groq: {getattr(settings, 'GROQ_MODEL', 'deepseek-r1-distill-llama-70b')})"
        if settings.GROQ_API_KEY
        else (
            f"Ollama Local ({getattr(settings, 'OLLAMA_MODEL', 'deepseek-r1')})"
            if settings.OLLAMA_BASE_URL
            else (
                f"OpenRouter ({getattr(settings, 'OPENROUTER_MODEL', 'deepseek/deepseek-r1:free')})"
                if settings.OPENROUTER_API_KEY
                else (
                    f"Hugging Face ({getattr(settings, 'HF_MODEL', 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B')})"
                    if settings.HF_TOKEN
                    else "None"
                )
            )
        )
    )
    return {
        "status": "healthy",
        "llm_engine": active_llm,
        "database": "PostgreSQL (AWS RDS)" if "postgresql" in settings.DATABASE_URL else "SQLite (Local/Resilient)",
        "aws_s3_connected": storage_service.use_s3,
        "aws_region": settings.AWS_REGION if storage_service.use_s3 else "local-storage"
    }


# ─── Notebook Management ──────────────────────────────────────
@app.get("/api/notebooks", response_model=List[NotebookResponse])
def list_notebooks(db: Session = Depends(get_db)):
    notebooks = db.query(Notebook).order_by(Notebook.updated_at.desc()).all()
    results = []
    for nb in notebooks:
        results.append(NotebookResponse(
            id=nb.id,
            title=nb.title,
            description=nb.description or "",
            source_count=len(nb.sources),
            created_at=nb.created_at,
            updated_at=nb.updated_at
        ))
    return results


@app.post("/api/notebooks", response_model=NotebookResponse, status_code=status.HTTP_201_CREATED)
def create_notebook(payload: NotebookCreate, db: Session = Depends(get_db)):
    nb = Notebook(title=payload.title, description=payload.description or "")
    db.add(nb)
    db.commit()
    db.refresh(nb)

    # Initialize empty manual note
    manual_note = NotebookNote(notebook_id=nb.id, content="")
    db.add(manual_note)
    db.commit()

    return NotebookResponse(
        id=nb.id,
        title=nb.title,
        description=nb.description or "",
        source_count=0,
        created_at=nb.created_at,
        updated_at=nb.updated_at
    )


@app.get("/api/notebooks/{notebook_id}", response_model=NotebookDetailResponse)
def get_notebook_detail(notebook_id: str, db: Session = Depends(get_db)):
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    messages_data = []
    for msg in nb.messages:
        citations = []
        if msg.citations_json:
            try:
                citations = json.loads(msg.citations_json)
            except Exception:
                citations = []
        messages_data.append(ChatMessageResponse(
            id=msg.id,
            notebook_id=msg.notebook_id,
            role=msg.role,
            content=msg.content,
            citations=citations,
            created_at=msg.created_at
        ))

    # Fetch or auto-create manual note
    manual_note = db.query(NotebookNote).filter(NotebookNote.notebook_id == notebook_id).first()
    if not manual_note:
        manual_note = NotebookNote(notebook_id=notebook_id, content="")
        db.add(manual_note)
        db.commit()
        db.refresh(manual_note)

    return NotebookDetailResponse(
        id=nb.id,
        title=nb.title,
        description=nb.description or "",
        sources=nb.sources,
        messages=messages_data,
        manual_note=manual_note,
        notes=nb.notes,
        created_at=nb.created_at,
        updated_at=nb.updated_at
    )


@app.put("/api/notebooks/{notebook_id}", response_model=NotebookResponse)
def update_notebook(notebook_id: str, payload: NotebookUpdate, db: Session = Depends(get_db)):
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if payload.title is not None:
        nb.title = payload.title
    if payload.description is not None:
        nb.description = payload.description
    db.commit()
    db.refresh(nb)
    return NotebookResponse(
        id=nb.id,
        title=nb.title,
        description=nb.description or "",
        source_count=len(nb.sources),
        created_at=nb.created_at,
        updated_at=nb.updated_at
    )


@app.delete("/api/notebooks/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notebook(notebook_id: str, db: Session = Depends(get_db)):
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    for src in nb.sources:
        try:
            delete_source_index(notebook_id, src.id)
            storage_service.delete_file(s3_key=src.s3_key, file_path=src.file_path)
        except Exception as e:
            logger.warning(f"Error cleaning source {src.id} during notebook delete: {e}")
    db.delete(nb)
    db.commit()
    return None


# ─── Manual Notebook Notes Endpoints ──────────────────────────
@app.get("/api/notebooks/{notebook_id}/note", response_model=NoteResponse)
def get_notebook_note(notebook_id: str, db: Session = Depends(get_db)):
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    note = db.query(NotebookNote).filter(NotebookNote.notebook_id == notebook_id).first()
    if not note:
        note = NotebookNote(notebook_id=notebook_id, content="")
        db.add(note)
        db.commit()
        db.refresh(note)
    return note


@app.put("/api/notebooks/{notebook_id}/note", response_model=NoteResponse)
def update_notebook_note(notebook_id: str, payload: NoteUpdateRequest, db: Session = Depends(get_db)):
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    note = db.query(NotebookNote).filter(NotebookNote.notebook_id == notebook_id).first()
    if not note:
        note = NotebookNote(notebook_id=notebook_id, content=payload.content)
        db.add(note)
    else:
        note.content = payload.content
    db.commit()
    db.refresh(note)
    return note


@app.post("/api/notebooks/{notebook_id}/note/append", response_model=NoteResponse)
def append_to_notebook_note(notebook_id: str, payload: NoteAppendRequest, db: Session = Depends(get_db)):
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    text_to_append = payload.text.strip()
    if not text_to_append:
        raise HTTPException(status_code=400, detail="Text to append cannot be empty.")

    note = db.query(NotebookNote).filter(NotebookNote.notebook_id == notebook_id).first()
    if not note:
        note = NotebookNote(notebook_id=notebook_id, content=text_to_append)
        db.add(note)
    else:
        if note.content and note.content.strip():
            note.content = f"{note.content.rstrip()}\n\n{text_to_append}"
        else:
            note.content = text_to_append

    db.commit()
    db.refresh(note)
    return note


MAX_SOURCES_PER_NOTEBOOK = 5

# ─── Sources Management ───────────────────────────────────────
@app.post("/api/notebooks/{notebook_id}/sources/upload", response_model=SourceResponse)
async def upload_file_source(
    notebook_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Uploads a PDF, TXT, or MD document into the notebook, saves to AWS S3/local, and indexes."""
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    if len(nb.sources) >= MAX_SOURCES_PER_NOTEBOOK:
        raise HTTPException(
            status_code=400,
            detail=f"Notebook limit reached: Maximum {MAX_SOURCES_PER_NOTEBOOK} sources allowed per notebook. Delete a source to add new ones."
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # 1. Parse document text
    text_content, word_count = parse_uploaded_document(file_bytes, file.filename)
    if not text_content.strip():
        raise HTTPException(status_code=400, detail="Could not extract readable text from uploaded file.")

    # 2. Save to AWS S3 or local storage
    file_path, s3_key = storage_service.save_file(file_bytes, file.filename)

    # 3. Generate summary (quick excerpt)
    summary = text_content[:220].strip() + "..." if len(text_content) > 220 else text_content.strip()

    # 4. Save Source record in DB
    source = Source(
        notebook_id=notebook_id,
        title=file.filename,
        source_type="pdf" if file.filename.lower().endswith(".pdf") else "document",
        file_path=file_path,
        s3_key=s3_key,
        summary=summary,
        content=text_content,
        word_count=word_count,
        is_active=True,
        extraction_status="success",
        extraction_error=None
    )
    db.add(source)
    db.commit()
    db.refresh(source)

    # 5. Index into Chroma Vector Store and DocumentChunks table
    index_source(db, notebook_id, source.id, source.title, text_content)

    return source


@app.post("/api/notebooks/{notebook_id}/sources/url", response_model=SourceResponse)
async def add_url_source(
    notebook_id: str,
    payload: AddUrlSourceRequest,
    db: Session = Depends(get_db)
):
    """Fetches YouTube transcript or Web article from a URL and adds as a source."""
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    if len(nb.sources) >= MAX_SOURCES_PER_NOTEBOOK:
        raise HTTPException(
            status_code=400,
            detail=f"Notebook limit reached: Maximum {MAX_SOURCES_PER_NOTEBOOK} sources allowed per notebook. Delete a source to add new ones."
        )

    url = payload.url.strip()
    is_yt = "youtube.com" in url or "youtu.be" in url

    if is_yt:
        title = payload.title or "YouTube Video"
        content, extract_status, extract_err = await fetch_youtube_transcript_text(url, title)
        source_type = "youtube"
    else:
        title = payload.title or "Web Article"
        content, extract_status, extract_err = await fetch_article_text(url, title)
        source_type = "web"

    summary = (content[:220].strip() + "...") if extract_status != "failed" else (extract_err or "Extraction failed.")
    words = len(content.split())

    source = Source(
        notebook_id=notebook_id,
        title=title,
        source_type=source_type,
        original_url=url,
        summary=summary,
        content=content,
        word_count=words,
        is_active=(extract_status != "failed"),
        extraction_status=extract_status,
        extraction_error=extract_err
    )
    db.add(source)
    db.commit()
    db.refresh(source)

    if extract_status != "failed":
        index_source(db, notebook_id, source.id, source.title, content)

    return source


@app.post("/api/notebooks/{notebook_id}/sources/generate-candidates", response_model=CandidateSourcesResponse)
async def generate_candidate_sources(
    notebook_id: str,
    payload: GenerateSourcesRequest,
    db: Session = Depends(get_db)
):
    """
    Directly queries Google Search API via SerpAPI for articles and YouTube videos
    in one unified fast call (< 1.5s).
    """
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Search topic cannot be empty.")

    try:
        candidates = await discover_google_sources(prompt)
        return CandidateSourcesResponse(query=prompt, candidates=candidates)
    except Exception as e:
        logger.error(f"Discover from topic search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)[:150]}")


@app.post("/api/notebooks/{notebook_id}/sources/add-candidates", response_model=List[SourceResponse])
async def add_candidate_sources(
    notebook_id: str,
    payload: AddSelectedSourcesRequest,
    db: Session = Depends(get_db)
):
    """
    Extracts transcripts and articles for selected candidates IN PARALLEL with timeouts,
    uses instant search snippets for summaries (no slow LLM calls), and enforces max 5 sources per notebook.
    """
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    existing_count = len(nb.sources)
    if existing_count >= MAX_SOURCES_PER_NOTEBOOK:
        raise HTTPException(
            status_code=400,
            detail=f"Notebook limit reached: Maximum {MAX_SOURCES_PER_NOTEBOOK} sources allowed per notebook."
        )

    slots_left = min(5, MAX_SOURCES_PER_NOTEBOOK - existing_count)
    selected = payload.candidates[:slots_left]

    async def extract_one(item: CandidateSourceItem):
        try:
            if item.type == "youtube":
                content, stat, err = await fetch_youtube_transcript_text(item.url, item.title)
                src_type = "youtube"
            else:
                content, stat, err = await fetch_article_text(item.url, item.title)
                src_type = "web"
            return item, content, src_type, stat, err
        except Exception as e:
            return item, f"Title: {item.title}\nURL: {item.url}", item.type, "failed", str(e)

    # Run extraction in parallel (< 3.5s)
    results = await asyncio.gather(*[extract_one(item) for item in selected])

    added_sources: List[Source] = []
    for item, content, src_type, extract_status, extract_err in results:
        words = len(content.split())
        # Use existing Google search snippet directly for instant 0ms summary
        summary = (
            item.snippet.strip()
            if (item.snippet and len(item.snippet.strip()) > 10)
            else (content[:220].strip() + "...")
        ) if extract_status != "failed" else (extract_err or "Extraction failed. No content available.")

        source = Source(
            notebook_id=notebook_id,
            title=item.title,
            source_type=src_type,
            original_url=item.url,
            summary=summary,
            content=content,
            word_count=words,
            is_active=(extract_status != "failed"),
            extraction_status=extract_status,
            extraction_error=extract_err
        )
        db.add(source)
        db.commit()
        db.refresh(source)

        if extract_status != "failed":
            index_source(db, notebook_id, source.id, source.title, content)

        added_sources.append(source)

    return added_sources


@app.patch("/api/notebooks/{notebook_id}/sources/{source_id}/toggle", response_model=SourceResponse)
def toggle_source(notebook_id: str, source_id: str, payload: SourceToggleRequest, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id, Source.notebook_id == notebook_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    source.is_active = payload.is_active
    db.commit()
    db.refresh(source)
    return source


@app.get("/api/notebooks/{notebook_id}/sources/{source_id}", response_model=SourceDetailResponse)
def get_source_detail(notebook_id: str, source_id: str, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id, Source.notebook_id == notebook_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@app.delete("/api/notebooks/{notebook_id}/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(notebook_id: str, source_id: str, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id, Source.notebook_id == notebook_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    # 1. Delete Chroma vectors
    try:
        delete_source_index(notebook_id, source_id)
    except Exception as e:
        logger.warning(f"Error deleting vectors for source {source_id}: {e}")

    # 2. Delete S3 or local file
    try:
        storage_service.delete_file(s3_key=source.s3_key, file_path=source.file_path)
    except Exception as e:
        logger.warning(f"Error deleting file for source {source_id}: {e}")

    # 3. Explicitly delete DocumentChunks to prevent foreign key issues
    db.query(DocumentChunk).filter(DocumentChunk.source_id == source_id).delete()

    # 4. Delete Source record
    db.delete(source)
    db.commit()
    return None


# ─── Chat & RAG (DeepSeek-R1 / Qwen Grounded) ──────────────────
@app.post("/api/notebooks/{notebook_id}/chat", response_model=ChatMessageResponse)
def chat_with_notebook(
    notebook_id: str,
    payload: ChatRequest,
    db: Session = Depends(get_db)
):
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    user_query = payload.message.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # All sources present in the notebook contribute to context by default
    allowed_source_ids = [s.id for s in nb.sources if s.extraction_status != "failed"]

    try:
        # Save User message in DB
        user_msg = ChatMessage(
            notebook_id=notebook_id,
            role="user",
            content=user_query,
            citations_json="[]"
        )
        db.add(user_msg)
        db.commit()

        # Retrieve context chunks
        chunks = retrieve_context_chunks(
            db,
            notebook_id=notebook_id,
            query=user_query,
            allowed_source_ids=allowed_source_ids,
            top_k=6
        )

        # Fetch recent conversation history
        recent_msgs = db.query(ChatMessage).filter(
            ChatMessage.notebook_id == notebook_id
        ).order_by(ChatMessage.created_at.desc()).limit(8).all()
        history = [{"role": m.role, "content": m.content} for m in reversed(recent_msgs[:-1])]

        # Generate answer with DeepSeek-R1 / Qwen / Gemini & citations
        answer_text, citations = generate_grounded_answer(
            query=user_query,
            chunks=chunks,
            conversation_history=history
        )

        # Save Assistant message in DB
        assistant_msg = ChatMessage(
            notebook_id=notebook_id,
            role="assistant",
            content=answer_text,
            citations_json=json.dumps(citations)
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)

        return ChatMessageResponse(
            id=assistant_msg.id,
            notebook_id=assistant_msg.notebook_id,
            role=assistant_msg.role,
            content=assistant_msg.content,
            citations=citations,
            created_at=assistant_msg.created_at
        )
    except Exception as e:
        logger.error(f"Chat error in chat_with_notebook: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Chat query failed: {str(e)}")


@app.delete("/api/notebooks/{notebook_id}/chat", status_code=status.HTTP_204_NO_CONTENT)
def clear_chat_history(notebook_id: str, db: Session = Depends(get_db)):
    db.query(ChatMessage).filter(ChatMessage.notebook_id == notebook_id).delete()
    db.commit()
    return None


# ─── Legacy Studio Endpoints (Preserved for compatibility) ────
@app.post("/api/notebooks/{notebook_id}/studio/generate", response_model=StudioNoteResponse)
def create_studio_note(
    notebook_id: str,
    payload: GenerateStudioNoteRequest,
    db: Session = Depends(get_db)
):
    nb = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    active_sources = [s for s in nb.sources if s.is_active and s.extraction_status != "failed"]
    if not active_sources:
        raise HTTPException(status_code=400, detail="No active sources in notebook to generate from.")

    combined_text = "\n\n=== SOURCE ===\n\n".join([
        f"Title: {s.title}\n{s.content[:3500]}" for s in active_sources
    ])

    title, note_content = generate_studio_note(
        note_type=payload.note_type,
        sources_text=combined_text,
        custom_prompt=payload.custom_prompt
    )

    studio_note = StudioNote(
        notebook_id=notebook_id,
        note_type=payload.note_type,
        title=title,
        content=note_content
    )
    db.add(studio_note)
    db.commit()
    db.refresh(studio_note)
    return studio_note


@app.delete("/api/notebooks/{notebook_id}/studio/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_studio_note(notebook_id: str, note_id: str, db: Session = Depends(get_db)):
    note = db.query(StudioNote).filter(StudioNote.id == note_id, StudioNote.notebook_id == notebook_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Studio note not found")
    db.delete(note)
    db.commit()
    return None
