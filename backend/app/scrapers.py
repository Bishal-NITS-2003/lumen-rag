import re
import asyncio
import logging
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import settings
from app.schemas import SearchQueries, MediaSourceItem

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

# --- 1. Query Generation with LangChain Structured Output ---

QUERY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are an expert research query planner.\n"
        "Given the user's prompt or research question, generate exactly 5 distinct, high-quality search queries.\n"
        "The queries should cover fundamentals, technical depth, real-world applications, recent developments, and expert explanations.\n"
        "Optimize them for both YouTube video explanations and in-depth web articles."
    )),
    ("human", "{prompt}")
])

async def generate_search_queries(user_prompt: str) -> List[str]:
    """Uses Gemini ChatModel with structured output to generate 5 research queries."""
    if not settings.GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not configured in backend/.env")

    llm = ChatGoogleGenerativeAI(
        model=settings.DEFAULT_GEMINI_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.3
    )

    structured_llm = llm.with_structured_output(SearchQueries)
    chain = QUERY_PROMPT | structured_llm
    result: SearchQueries = await chain.ainvoke({"prompt": user_prompt})

    queries = [q.strip() for q in result.queries if q.strip()]
    return queries[:5]

# --- 2. Search YouTube and Google Articles via SerpApi ---

def extract_youtube_video_id(url: str) -> Optional[str]:
    """Extracts YouTube 11-char video ID from various URL formats."""
    match = re.search(r'(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})', url)
    return match.group(1) if match else None

async def fetch_media_for_queries(queries: List[str]) -> Dict[str, List[MediaSourceItem]]:
    """
    Fetches top 2 YouTube results and top 2 Google articles for each of the 5 queries.
    Yields up to 10 YouTube videos and 10 Google articles.
    """
    if not settings.SERPAPI_API_KEY:
        raise ValueError("SERPAPI_API_KEY is not configured in backend/.env")

    youtube_items: List[MediaSourceItem] = []
    article_items: List[MediaSourceItem] = []
    seen_yt_links = set()
    seen_art_links = set()

    async def search_single_query(query: str):
        async with httpx.AsyncClient(timeout=14.0) as client:
            # 1. YouTube Search using official YouTube Data API v3
            try:
                yt_key = settings.YOUTUBE_API_KEY or settings.GOOGLE_API_KEY
                yt_resp = await client.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    params={
                        "part": "snippet",
                        "q": query,
                        "type": "video",
                        "maxResults": 2,
                        "key": yt_key
                    }
                )
                if yt_resp.status_code == 200:
                    yt_data = yt_resp.json()
                    for item in yt_data.get("items", [])[:2]:
                        vid = item.get("id", {}).get("videoId")
                        if not vid:
                            continue
                        link = f"https://www.youtube.com/watch?v={vid}"
                        if link not in seen_yt_links:
                            seen_yt_links.add(link)
                            snippet = item.get("snippet", {})
                            thumbs = snippet.get("thumbnails", {})
                            thumb_url = (
                                thumbs.get("high", {}).get("url") or
                                thumbs.get("medium", {}).get("url") or
                                thumbs.get("default", {}).get("url") or
                                f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
                            )
                            youtube_items.append(MediaSourceItem(
                                id=str(vid),
                                title=snippet.get("title", "YouTube Video"),
                                link=link,
                                type="youtube",
                                thumbnail=thumb_url,
                                channel=snippet.get("channelTitle", "YouTube Creator"),
                                snippet=snippet.get("description", "")
                            ))
                else:
                    logger.warning(f"YouTube Data API ({yt_resp.status_code}): {yt_resp.text[:120]}")
                    # Fallback to SerpApi YouTube if YouTube Data API key is restricted/unauthorized
                    if settings.SERPAPI_API_KEY:
                        serp_resp = await client.get("https://serpapi.com/search", params={
                            "engine": "youtube",
                            "search_query": query,
                            "api_key": settings.SERPAPI_API_KEY
                        })
                        if serp_resp.status_code == 200:
                            for video in serp_resp.json().get("video_results", [])[:2]:
                                v_link = video.get("link", "")
                                if v_link and v_link not in seen_yt_links:
                                    seen_yt_links.add(v_link)
                                    v_id = video.get("id") or extract_youtube_video_id(v_link) or f"yt_{len(youtube_items)+1}"
                                    v_thumb = video.get("thumbnail")
                                    if isinstance(v_thumb, dict):
                                        v_thumb = v_thumb.get("static") or v_thumb.get("url")
                                    ch = video.get("channel", {})
                                    ch_name = ch.get("name") if isinstance(ch, dict) else str(ch)
                                    youtube_items.append(MediaSourceItem(
                                        id=str(v_id),
                                        title=video.get("title", "YouTube Video"),
                                        link=v_link,
                                        type="youtube",
                                        thumbnail=v_thumb or f"https://i.ytimg.com/vi/{v_id}/hqdefault.jpg",
                                        channel=ch_name or "YouTube Creator",
                                        snippet=video.get("description", "")
                                    ))
            except Exception as e:
                logger.warning(f"Error fetching YouTube Data API for '{query}': {e}")

            # 2. Google Article Search (2 results per query)
            try:
                g_resp = await client.get("https://serpapi.com/search", params={
                    "engine": "google",
                    "q": query,
                    "api_key": settings.SERPAPI_API_KEY,
                    "gl": "in",
                    "hl": "en",
                    "num": 4
                })
                g_data = g_resp.json()
                count = 0
                for item in g_data.get("organic_results", []):
                    link = item.get("link", "")
                    if not link or link in seen_art_links:
                        continue
                    if any(bad in link for bad in ["youtube.com", "youtu.be", "facebook.com", "twitter.com", "instagram.com"]):
                        continue

                    seen_art_links.add(link)
                    count += 1
                    article_items.append(MediaSourceItem(
                        id=f"art_{len(article_items)+1}",
                        title=item.get("title", "Article"),
                        link=link,
                        type="article",
                        snippet=item.get("snippet", ""),
                        source=item.get("displayed_link", "") or item.get("source", "Web")
                    ))
                    if count >= 2:
                        break
            except Exception as e:
                logger.warning(f"Error fetching Google articles for '{query}': {e}")

    await asyncio.gather(*[search_single_query(q) for q in queries[:5]])

    return {
        "youtube": youtube_items[:10],
        "articles": article_items[:10]
    }

# --- 3. Document Extraction (Transcripts & Clean Article Text) ---

def clean_html_text(html: str) -> str:
    """Removes scripts/styles and extracts readable text from HTML."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.extract()

    # Prefer main article containers if available
    container = soup.find("article") or soup.find("main") or soup.find(id=re.compile(r"content|article|post|body", re.I)) or soup.body
    text = container.get_text(separator="\n", strip=True) if container else soup.get_text(separator="\n", strip=True)

    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in text.splitlines()]
    return "\n".join([line for line in lines if len(line) > 2])

async def fetch_youtube_transcript_text(url: str, title: str) -> str:
    """Fetches video transcript using YouTubeTranscriptApi."""
    video_id = extract_youtube_video_id(url)
    if not video_id:
        return f"Video Title: {title}\nURL: {url}"

    try:
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id)
        if hasattr(transcript, "snippets"):
            text = " ".join([s.text for s in transcript.snippets])
        elif isinstance(transcript, list):
            text = " ".join([item.get("text", "") for item in transcript])
        else:
            text = str(transcript)
        return text if text.strip() else f"Video Title: {title}\nURL: {url}"
    except Exception as e:
        logger.info(f"Could not fetch live transcript for {video_id} ({e}), using metadata fallback.")
        return f"Video Title: {title}\nURL: {url}\nSummary: Educational YouTube Video covering {title}."

async def fetch_article_text(url: str, title: str) -> str:
    """Fetches and cleans article HTML text."""
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                cleaned = clean_html_text(resp.text)
                if len(cleaned) > 100:
                    return cleaned
    except Exception as e:
        logger.warning(f"Error fetching article content from {url}: {e}")

    return f"Article Title: {title}\nURL: {url}"

async def load_source_documents(selected_items: List[MediaSourceItem]) -> List[Document]:
    """Loads transcripts and article contents as LangChain Documents."""
    docs: List[Document] = []

    for item in selected_items[:5]:  # Enforce max 5 selections
        if item.type == "youtube":
            content = await fetch_youtube_transcript_text(item.link, item.title)
        else:
            content = await fetch_article_text(item.link, item.title)

        doc = Document(
            page_content=content,
            metadata={
                "title": item.title,
                "source": item.link,
                "type": item.type,
                "channel_or_source": item.channel or item.source or "Web"
            }
        )
        docs.append(doc)

    return docs
