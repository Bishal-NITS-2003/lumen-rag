import os
import json
import logging
import re
from typing import List, Dict, Any, Tuple, Optional
from langchain_core.messages import SystemMessage, HumanMessage
from .config import settings

logger = logging.getLogger(__name__)

AVAILABLE_GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-safeguard-20b",
    "meta-llama/llama-prompt-guard-2-86m",
    "meta-llama/llama-prompt-guard-2-22m"
]

def get_llm(temperature: float = 0.2, model_name: Optional[str] = None):
    """
    Returns the cloud-hosted Open Source LLM engine via Groq:
    Supports dynamic user-selected models: openai/gpt-oss-120b, qwen/qwen3.8-27b, etc.
    Runs on Groq LPUs with ~300 tok/sec, imposing 0 CPU/GPU load on the AWS server.
    """
    if settings.GROQ_API_KEY:
        try:
            from langchain_groq import ChatGroq
            active_model = model_name or getattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b")
            return ChatGroq(
                groq_api_key=settings.GROQ_API_KEY,
                model_name=active_model,
                temperature=temperature,
                max_tokens=4096
            )
        except Exception as e:
            logger.error(f"Groq initialization failed: {e}")
            raise e

    raise ValueError(
        "Groq API key not configured! Please add GROQ_API_KEY=gsk_... to your backend/.env file. "
        "You can generate a free key in seconds at https://console.groq.com."
    )


def extract_text_content(content: Any) -> str:
    """Safely extracts a string from LLM message content whether it is str, list of dicts, or objects."""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text", ""))
            elif hasattr(part, "text"):
                parts.append(str(part.text))
            else:
                parts.append(str(part))
        return "".join(parts).strip()
    return str(content or "").strip()


def generate_search_queries(prompt: str) -> List[str]:
    """
    Decomposes user topic into 3-5 high-yield search queries for YouTube and Web.
    """
    llm = get_llm(temperature=0.3)
    sys_prompt = (
        "You are an expert research query planner for an AI notebook assistant. "
        "Given a topic or question, generate 3 to 5 distinct, highly targeted search queries. "
        "Include queries suitable for discovering informative YouTube video tutorials and in-depth web articles. "
        "Return strictly a raw JSON array of strings, without code fences or commentary. Example: [\"query 1\", \"query 2\", \"query 3\"]"
    )
    messages = [
        SystemMessage(content=sys_prompt),
        HumanMessage(content=f"Topic: {prompt}")
    ]
    resp = llm.invoke(messages)
    text = extract_text_content(resp.content)

    # Clean potential markdown block
    cleaned = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    cleaned = re.sub(r"```$", "", cleaned, flags=re.MULTILINE).strip()

    try:
        queries = json.loads(cleaned)
        if isinstance(queries, list) and len(queries) > 0:
            return [str(q).strip() for q in queries[:5]]
    except Exception:
        pass

    # Fallback to lines if JSON parse fails
    lines = [l.strip().lstrip("-*0123456789. ") for l in text.splitlines() if l.strip()]
    return lines[:4] if lines else [prompt]


def summarize_text(text: str, max_sentences: int = 2) -> str:
    """Creates a concise 2-sentence summary of a source document."""
    if not text.strip():
        return ""
    if len(text.split()) < 40:
        return text[:200]

    try:
        llm = get_llm(temperature=0.1)
        resp = llm.invoke([
            SystemMessage(content=f"Summarize the following text in exactly {max_sentences} clear, factual sentences. Do not use conversational filler."),
            HumanMessage(content=text[:3500])
        ])
        return extract_text_content(resp.content)
    except Exception as e:
        logger.warning(f"Summary generation failed: {e}")
        return text[:180] + "..."


def generate_grounded_answer(
    query: str,
    chunks: List[Dict[str, Any]],
    conversation_history: List[Dict[str, str]],
    model_name: Optional[str] = None
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Generates grounded RAG response with exact bracketed citations [1], [2]
    matching the supplied source chunks using the selected Open Source LLM via Groq.
    """
    active_model = model_name or getattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b")
    llm = get_llm(temperature=0.2, model_name=active_model)

    if not chunks:
        # No sources available
        return (
            "I couldn't find any relevant information in the selected sources for this notebook. "
            "Please ensure you have active sources uploaded or added to your notebook.",
            []
        )

    # Format context with numbered citation tags
    context_str_parts = []
    citations_map = []

    for i, c in enumerate(chunks, start=1):
        source_id = c.get("source_id", "")
        source_title = c.get("source_title", "Source")
        snippet = c.get("content", "").strip()

        context_str_parts.append(f"[{i}] Source: \"{source_title}\"\n{snippet}\n")
        citations_map.append({
            "citation_index": i,
            "source_id": source_id,
            "source_title": source_title,
            "snippet": snippet[:250] + "..." if len(snippet) > 250 else snippet,
            "full_snippet": snippet
        })

    formatted_context = "\n---\n".join(context_str_parts)

    system_instruction = (
        "You are Lumen, an AI Research Assistant modeled after Google NotebookLM. "
        "Your task is to answer the user's question accurately and objectively using ONLY the provided sources below.\n\n"
        "STRICT GROUNDING & CITATION RULES:\n"
        "1. Every factual claim must be backed by one or more citations formatted like [1], [2], or [1, 3].\n"
        "2. The numbers must correspond directly to the source numbers in the context below.\n"
        "3. If the sources do not contain enough information to answer fully, state clearly what is missing based on the sources.\n"
        "4. Do NOT hallucinate or assume facts beyond what the sources state.\n"
        "5. Format your response cleanly using Markdown headings, bullet points, and bold text for readability."
    )

    history_msgs = []
    # Include up to last 6 chat messages for context
    for msg in conversation_history[-6:]:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "user":
            history_msgs.append(HumanMessage(content=content))
        elif role == "assistant":
            from langchain_core.messages import AIMessage
            history_msgs.append(AIMessage(content=content))

    current_prompt = (
        f"SOURCES CONTEXT:\n{formatted_context}\n\n"
        f"USER QUESTION: {query}\n\n"
        f"Provide a comprehensive, well-structured, citation-grounded response:"
    )

    all_messages = [SystemMessage(content=system_instruction)] + history_msgs + [HumanMessage(content=current_prompt)]

    try:
        response = llm.invoke(all_messages)
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "rate_limit" in err_msg.lower() or "too many requests" in err_msg.lower():
            logger.warning(f"Rate limit exceeded on Groq model {active_model}: {e}")
            raise RuntimeError(f"RATE_LIMIT: Model rate limit reached for '{active_model}'. Please select a different model from the list above and try again.")
        raise e

    raw_answer = extract_text_content(response.content)

    # Clean potential DeepSeek-R1 <think> reasoning tokens
    answer_text = re.sub(r'<think>.*?</think>', '', raw_answer, flags=re.DOTALL).strip()
    if not answer_text:
        answer_text = raw_answer

    # Find which citations were actually used in the answer
    used_indexes = set(map(int, re.findall(r"\[(\d+)\]", answer_text)))
    used_citations = [c for c in citations_map if c["citation_index"] in used_indexes]
    if not used_citations:
        used_citations = citations_map[:3]  # fallback to top relevant if model forgot brackets

    return answer_text, used_citations
