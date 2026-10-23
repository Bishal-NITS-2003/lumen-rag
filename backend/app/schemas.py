from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field

# ─── Scraper & Query Schemas ──────────────────────────────────
class SearchQueries(BaseModel):
    queries: List[str] = Field(default_factory=list, description="5 search queries")

class MediaSourceItem(BaseModel):
    id: str
    title: str
    link: str
    type: str  # "youtube" | "article"
    thumbnail: Optional[str] = None
    channel: Optional[str] = None
    source: Optional[str] = None
    snippet: Optional[str] = None

# ─── Notebook Schemas ──────────────────────────────────────────
class NotebookCreate(BaseModel):
    title: str = Field(default="Untitled Notebook", max_length=255)
    description: Optional[str] = Field(default="", max_length=1000)

class NotebookUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class SourceResponse(BaseModel):
    id: str
    notebook_id: str
    title: str
    source_type: str
    original_url: Optional[str] = None
    summary: Optional[str] = None
    word_count: int = 0
    is_active: bool = True
    extraction_status: str = "success"  # 'success' | 'failed' | 'partial'
    extraction_error: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SourceDetailResponse(SourceResponse):
    content: str

class CitationItem(BaseModel):
    citation_index: int
    source_id: str
    source_title: str
    snippet: str
    full_snippet: Optional[str] = None

class ChatMessageResponse(BaseModel):
    id: str
    notebook_id: str
    role: str
    content: str
    citations: List[CitationItem] = []
    model: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class NoteResponse(BaseModel):
    id: str
    notebook_id: str
    content: str = ""
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NoteUpdateRequest(BaseModel):
    content: str

class NoteAppendRequest(BaseModel):
    text: str

class StudioNoteResponse(BaseModel):
    id: str
    notebook_id: str
    note_type: str
    title: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class NotebookResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    title: str
    description: Optional[str] = ""
    source_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NotebookDetailResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    title: str
    description: Optional[str] = ""
    sources: List[SourceResponse] = []
    messages: List[ChatMessageResponse] = []
    manual_note: Optional[NoteResponse] = None
    notes: List[StudioNoteResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ─── Request Schemas ───────────────────────────────────────────
class AddUrlSourceRequest(BaseModel):
    url: str
    title: Optional[str] = None

class GenerateSourcesRequest(BaseModel):
    prompt: str

class CandidateSourceItem(BaseModel):
    id: Optional[str] = None
    title: str
    url: str
    type: str  # 'youtube' | 'web'
    snippet: str
    channel_or_source: Optional[str] = None
    thumbnail: Optional[str] = None
    duration: Optional[str] = None

class CandidateSourcesResponse(BaseModel):
    query: str
    candidates: List[CandidateSourceItem]

class AddSelectedSourcesRequest(BaseModel):
    candidates: List[CandidateSourceItem]

class SourceToggleRequest(BaseModel):
    is_active: bool

class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = "openai/gpt-oss-120b"
    source_ids: Optional[List[str]] = None  # None means use all active sources

class GenerateStudioNoteRequest(BaseModel):
    note_type: str  # 'study_guide', 'briefing_doc', 'faq', 'audio_overview'
    custom_prompt: Optional[str] = None
