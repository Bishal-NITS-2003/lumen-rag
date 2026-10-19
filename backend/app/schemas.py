from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

class SearchQueries(BaseModel):
    queries: List[str] = Field(
        ...,
        description="Exactly 5 distinct, high-quality search queries optimized for finding in-depth technical guides, articles, and video explanations"
    )

class MediaSourceItem(BaseModel):
    id: str
    title: str
    link: str
    type: Literal["youtube", "article"]
    thumbnail: Optional[str] = None
    channel: Optional[str] = None
    snippet: Optional[str] = None
    source: Optional[str] = None

class SearchResponse(BaseModel):
    session_id: str
    user_prompt: str
    queries: List[str]
    youtube_videos: List[MediaSourceItem]
    google_articles: List[MediaSourceItem]

class IndexSourcesRequest(BaseModel):
    session_id: str
    selected_items: List[MediaSourceItem]

class IndexSourcesResponse(BaseModel):
    session_id: str
    indexed_count: int
    chunks_count: int
    message: str
    sources: List[MediaSourceItem]

class ChatMessageRequest(BaseModel):
    session_id: str
    message: str

class ChatMessageResponse(BaseModel):
    session_id: str
    role: str
    content: str
    sources: List[str] = []

class ChatSessionInfo(BaseModel):
    session_id: str
    title: str
    created_at: str
    message_count: int
    is_indexed: bool = False
    source_count: int = 0
