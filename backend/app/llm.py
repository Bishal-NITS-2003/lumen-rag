import os
import json
import logging
import re
from typing import List, Dict, Any, Tuple
from langchain_core.messages import SystemMessage, HumanMessage
from .config import settings

logger = logging.getLogger(__name__)

def get_llm(temperature: float = 0.2):
    """
    Returns the configured Open Source LLM engine:
    1. Groq (DeepSeek-R1 Distill 70B, Llama 3.3 70B, or Qwen 2.5) - Recommended Free High Speed
    2. Local Ollama (e.g. DeepSeek-R1, Llama 3.2, Qwen running locally on localhost:11434)
    3. OpenRouter (Free DeepSeek-R1, Qwen & Llama endpoints)
    4. Hugging Face (Open Source models)
    """
    # 1. Groq: Ultra-fast Open Source inference (DeepSeek-R1 / Llama 3.3 / Qwen)
    if settings.GROQ_API_KEY:
        try:
            from langchain_groq import ChatGroq
            return ChatGroq(
                groq_api_key=settings.GROQ_API_KEY,
                model_name=getattr(settings, "GROQ_MODEL", "deepseek-r1-distill-llama-70b"),
                temperature=temperature,
                max_tokens=4096
            )
        except Exception as e:
            logger.warning(f"Groq initialization failed: {e}. Checking alternative engines...")

    # 2. Local Ollama / vLLM / LM Studio (Zero API key, runs fully local)
    if settings.OLLAMA_BASE_URL:
        try:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                base_url=settings.OLLAMA_BASE_URL,
                api_key="ollama",
                model=getattr(settings, "OLLAMA_MODEL", "deepseek-r1"),
                temperature=temperature
            )
        except Exception as e:
            logger.warning(f"Local Ollama initialization failed: {e}")

    # 3. OpenRouter (Free DeepSeek-R1, Qwen & Llama endpoints)
    if settings.OPENROUTER_API_KEY:
        try:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY,
                model=getattr(settings, "OPENROUTER_MODEL", "deepseek/deepseek-r1:free"),
                temperature=temperature
            )
        except Exception as e:
            logger.warning(f"OpenRouter initialization failed: {e}")

    # 4. Hugging Face (Open Source models)
    if settings.HF_TOKEN:
        try:
            from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace
            model_id = getattr(settings, "HF_MODEL", "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")
            endpoint = HuggingFaceEndpoint(
                repo_id=model_id,
                huggingfacehub_api_token=settings.HF_TOKEN,
                max_new_tokens=1024,
                temperature=temperature
            )
            return ChatHuggingFace(llm=endpoint)
        except Exception as e:
            logger.warning(f"Hugging Face initialization failed: {e}")

    raise ValueError(
        "No Open Source LLM configured! Please provide GROQ_API_KEY (for DeepSeek-R1 / Llama 3.3) "
        "or run a local model via Ollama (http://localhost:11434/v1) in your backend/.env file."
    )


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
    text = resp.content.strip()

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
        return resp.content.strip()
    except Exception as e:
        logger.warning(f"Summary generation failed: {e}")
        return text[:180] + "..."


def generate_grounded_answer(
    query: str,
    chunks: List[Dict[str, Any]],
    conversation_history: List[Dict[str, str]]
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Generates grounded RAG response with exact bracketed citations [1], [2]
    matching the supplied source chunks using an Open Source LLM (DeepSeek-R1 / LLaMA / Qwen).
    """
    llm = get_llm(temperature=0.2)

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

    response = llm.invoke(all_messages)

    # Safely extract text whether response.content is str, list of parts, or dicts
    if isinstance(response.content, list):
        text_parts = []
        for part in response.content:
            if isinstance(part, dict):
                text_parts.append(part.get("text", ""))
            elif hasattr(part, "text"):
                text_parts.append(str(part.text))
            else:
                text_parts.append(str(part))
        raw_answer = "".join(text_parts).strip()
    else:
        raw_answer = str(response.content).strip()

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


def generate_studio_note(note_type: str, sources_text: str, custom_prompt: str = None) -> Tuple[str, str]:
    """
    Generates research artifacts using the Open Source LLM:
    - Study Guide
    - Briefing Doc
    - FAQ
    - Audio Overview Script
    """
    llm = get_llm(temperature=0.3)

    prompts = {
        "study_guide": (
            "Generate a comprehensive, academic **Study Guide** based on the sources provided. "
            "Include: \n"
            "1. Core Concepts & Overview\n"
            "2. In-Depth Topic Breakdown\n"
            "3. Key Terms & Definitions (Glossary)\n"
            "4. Practice / Review Questions with Answers\n"
            "Use clear Markdown formatting with headers and bullet points."
        ),
        "briefing_doc": (
            "Generate a professional **Executive Briefing Document** based on the sources provided. "
            "Include:\n"
            "1. Executive Summary\n"
            "2. Key Findings & Data Points\n"
            "3. Strategic Implications & Opportunities\n"
            "4. Recommended Action Items\n"
            "Use formal, analytical language."
        ),
        "faq": (
            "Generate a comprehensive **Frequently Asked Questions (FAQ)** document based on the sources provided. "
            "Provide 8-10 high-value questions that someone studying this material would ask, followed by detailed, accurate answers drawn directly from the text."
        ),
        "audio_overview": (
            "Generate a lively, conversational **Audio Overview (Podcast Deep Dive) Script** between two hosts: "
            "Alex (curious, analytical host) and Jordan (subject-matter explainer). "
            "They should break down the key ideas from the sources in an engaging, natural, easy-to-understand conversational manner, "
            "just like Google NotebookLM's Audio Overview podcast. Format with host dialogue tags like **Alex:** and **Jordan:**."
        )
    }

    base_instruction = prompts.get(note_type, "Synthesize the provided sources into a structured, informative reference document.")
    if custom_prompt:
        base_instruction += f"\nAdditional User Instructions: {custom_prompt}"

    system_msg = (
        "You are an expert AI research analyst for Lumen Notebook. "
        "Create an exceptionally thorough, high-quality document based STRICTLY on the source text provided below. "
        "Structure your response with clear Markdown."
    )

    user_msg = f"{base_instruction}\n\nSOURCES TEXT:\n{sources_text[:12000]}"

    resp = llm.invoke([
        SystemMessage(content=system_msg),
        HumanMessage(content=user_msg)
    ])

    title_map = {
        "study_guide": "Study Guide",
        "briefing_doc": "Executive Briefing Doc",
        "faq": "Frequently Asked Questions",
        "audio_overview": "Audio Overview Podcast Script"
    }

    title = title_map.get(note_type, "Notebook Note")
    return title, resp.content.strip()
