import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Notebook(Base):
    __tablename__ = "notebooks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(128), nullable=True, index=True)
    title = Column(String(255), nullable=False, default="Untitled Notebook")
    description = Column(Text, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sources = relationship("Source", back_populates="notebook", cascade="all, delete-orphan", order_by="desc(Source.created_at)")
    messages = relationship("ChatMessage", back_populates="notebook", cascade="all, delete-orphan", order_by="ChatMessage.created_at")
    manual_note = relationship("NotebookNote", back_populates="notebook", uselist=False, cascade="all, delete-orphan")

class Source(Base):
    __tablename__ = "sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    notebook_id = Column(String(36), ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False)  # 'pdf', 'txt', 'youtube', 'web', 'generated'
    original_url = Column(String(1024), nullable=True)
    file_path = Column(String(1024), nullable=True)
    s3_key = Column(String(1024), nullable=True)
    summary = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    word_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    extraction_status = Column(String(50), default="success")  # 'success' | 'failed' | 'partial'
    extraction_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    notebook = relationship("Notebook", back_populates="sources")
    chunks = relationship("DocumentChunk", back_populates="source", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    notebook_id = Column(String(36), ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False)
    source_id = Column(String(36), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    source = relationship("Source", back_populates="chunks")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    notebook_id = Column(String(36), ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' | 'assistant'
    content = Column(Text, nullable=False)
    citations_json = Column(Text, nullable=True, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)

    notebook = relationship("Notebook", back_populates="messages")

class NotebookNote(Base):
    __tablename__ = "notebook_notes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    notebook_id = Column(String(36), ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, unique=True)
    content = Column(Text, default="", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    notebook = relationship("Notebook", back_populates="manual_note")
