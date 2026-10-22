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
    Returns the best available Open Source or fallback LLM:
    1. Groq: DeepSeek-R1 Distill 70B (State-of-the-art Open Reasoning) or Llama 3.3 70B
    2. Hugging Face: DeepSeek-R1 Distill Qwen or Qwen 2.5 7B Instruct
    3. Google Gemini (as resilient fallback)
    """
    # 1. Groq (DeepSeek-R1 Distill 70B or Llama 3.3 70B Versatile)
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
            logger.warning(f"Groq initialization failed: {e}. Falling back.")

    # 2. Hugging Face (DeepSeek-R1 or Qwen 2.5)
    if settings.HF_TOKEN:
        try:
            from langchain_community.llms import HuggingFaceHub
            from langchain_community.chat_models.huggingface import ChatHuggingFace
            model_id = getattr(settings, "HF_MODEL", "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")
            llm = HuggingFaceHub(
                repo_id=model_id,
                huggingfacehub_api_token=settings.HF_TOKEN,
                model_kwargs={"temperature": temperature, "max_new_tokens": 1024}
            )
            return ChatHuggingFace(llm=llm)
        except Exception as e:
            logger.warning(f"Hugging Face initialization failed: {e}. Falling back.")

    # 3. Google Gemini fallback
    if settings.GOOGLE_API_KEY:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model=settings.DEFAULT_GEMINI_MODEL,
                google_api_key=settings.GOOGLE_API_KEY,
                temperature=temperature
            )
        except Exception as e:
            logger.warning(f"Gemini initialization failed: {e}")

    raise ValueError("No LLM API keys configured! Please set GROQ_API_KEY, HF_TOKEN, or GOOGLE_API_KEY in .env.")


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

    # Clean potential markdown markdown block
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
    matching the supplied source chunks.
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
    raw_answer = response.content.strip()

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
    Generates NotebookLM Studio artifacts:
    - Study Guide (Key concepts, review questions, glossary)
    - Briefing Doc (Executive summary, key insights, strategic takeaways)
    - FAQ (Common Q&A based strictly on sources)
    - Audio Overview Script (Engaging two-host podcast script discussing the material)
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
