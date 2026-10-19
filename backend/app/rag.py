import re
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langchain_core.output_parsers import StrOutputParser

from app.config import settings
from app.schemas import MediaSourceItem, ChatSessionInfo

logger = logging.getLogger(__name__)

# --- 1. HuggingFace Embeddings & Text Splitters ---

_EMBEDDINGS: Optional[HuggingFaceEmbeddings] = None

def get_embeddings() -> HuggingFaceEmbeddings:
    global _EMBEDDINGS
    if _EMBEDDINGS is None:
        _EMBEDDINGS = HuggingFaceEmbeddings(model_name=settings.HF_EMBEDDING_MODEL)
    return _EMBEDDINGS

TEXT_SPLITTER = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)

# --- 2. Conversational RAG Prompt with MessagesPlaceholder ---

RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are an expert AI research assistant equipped with curated YouTube video transcripts and web articles.\n"
        "Answer the user's questions thoroughly, clearly, and accurately using ONLY the retrieved context below.\n"
        "Reference source titles and types (e.g. [YouTube Video: ...] or [Article: ...]) when citing specific claims.\n\n"
        "=== RETRIEVED CONTEXT ===\n{context}"
    )),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{question}")
])

# --- 3. Session RAG Engine ---

class SessionRAGEngine:
    def __init__(self, session_id: str, title: str = "New Research"):
        self.session_id = session_id
        self.title = title
        self.created_at = datetime.now().strftime("%b %d, %H:%M")
        self.chat_history: List[BaseMessage] = []
        self.indexed_sources: List[MediaSourceItem] = []
        self.docs: List[Document] = []
        self._collection = None
        self._init_vector_store()

    def _init_vector_store(self):
        try:
            import chromadb
            client = chromadb.Client()
            safe_name = f"sess_{re.sub(r'[^a-zA-Z0-9_-]', '_', self.session_id)}"
            self._collection = client.create_collection(
                name=safe_name,
                metadata={"hnsw:space": "cosine"}
            )
        except Exception as e:
            logger.warning(f"Chroma initialization fallback: {e}")

    def index_documents(self, raw_docs: List[Document], sources: List[MediaSourceItem]) -> int:
        chunks = TEXT_SPLITTER.split_documents(raw_docs)
        self.docs.extend(chunks)
        self.indexed_sources = sources

        if self._collection and chunks:
            embeddings = get_embeddings()
            texts = [c.page_content for c in chunks]
            metadatas = [c.metadata for c in chunks]
            ids = [f"{self.session_id}_{i}" for i in range(len(chunks))]
            vectors = embeddings.embed_documents(texts)
            self._collection.add(documents=texts, metadatas=metadatas, embeddings=vectors, ids=ids)

        return len(chunks)

    def retrieve(self, query: str, k: int = 4) -> List[Document]:
        """Retrieves top-k relevant chunks from vector store."""
        if self._collection and len(self.docs) > 0:
            try:
                embeddings = get_embeddings()
                query_vector = embeddings.embed_query(query)
                res = self._collection.query(
                    query_embeddings=[query_vector],
                    n_results=min(k, len(self.docs))
                )
                if res and res.get("documents"):
                    results = []
                    docs_texts = res["documents"][0]
                    metas = res["metadatas"][0] if res.get("metadatas") else [{}] * len(docs_texts)
                    for text, meta in zip(docs_texts, metas):
                        results.append(Document(page_content=text, metadata=meta))
                    return results
            except Exception as e:
                logger.warning(f"Vector search error: {e}")

        # In-memory keyword fallback
        q_tokens = set(query.lower().split())
        scored = []
        for d in self.docs:
            score = sum(1 for t in q_tokens if t in d.page_content.lower())
            scored.append((score, d))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:k]]

    async def chat(self, user_question: str) -> Dict[str, Any]:
        """Runs LangChain Conversational RAG chain using ChatModel, PromptTemplate, and OutputParser."""
        if not settings.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY is not configured in backend/.env")

        retrieved_docs = self.retrieve(user_question, k=4)
        if not retrieved_docs:
            context_str = "No documents have been indexed yet. Please index research sources first."
            sources_used = []
        else:
            context_str = "\n\n---\n\n".join([
                f"[{d.metadata.get('type', 'source').upper()}: {d.metadata.get('title', 'Document')}]\n{d.page_content}"
                for d in retrieved_docs
            ])
            sources_used = list({d.metadata.get("title", "") for d in retrieved_docs if d.metadata.get("title")})

        # LangChain Chat Model & Runnable Chain
        llm = ChatGoogleGenerativeAI(
            model=settings.DEFAULT_GEMINI_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.3
        )

        rag_chain = RAG_PROMPT | llm | StrOutputParser()

        # Execute Chain with chat_history MessagesPlaceholder
        answer = await rag_chain.ainvoke({
            "context": context_str,
            "chat_history": self.chat_history,
            "question": user_question
        })

        # Append to conversational history
        self.chat_history.append(HumanMessage(content=user_question))
        self.chat_history.append(AIMessage(content=answer))

        return {
            "answer": answer,
            "sources": sources_used
        }

# --- 4. In-Memory Session Manager ---

_SESSIONS: Dict[str, SessionRAGEngine] = {}

def get_or_create_session(session_id: str, title: Optional[str] = None) -> SessionRAGEngine:
    if session_id not in _SESSIONS:
        _SESSIONS[session_id] = SessionRAGEngine(session_id, title=title or "New Research")
    elif title and _SESSIONS[session_id].title == "New Research":
        _SESSIONS[session_id].title = title
    return _SESSIONS[session_id]

def list_all_sessions() -> List[ChatSessionInfo]:
    infos = []
    for s in reversed(list(_SESSIONS.values())):
        infos.append(ChatSessionInfo(
            session_id=s.session_id,
            title=s.title,
            created_at=s.created_at,
            message_count=len(s.chat_history),
            is_indexed=len(s.docs) > 0,
            source_count=len(s.indexed_sources)
        ))
    return infos

def delete_session(session_id: str) -> bool:
    if session_id in _SESSIONS:
        del _SESSIONS[session_id]
        return True
    return False
