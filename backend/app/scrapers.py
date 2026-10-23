import re
import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple
import httpx
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi

from app.config import settings
from app.schemas import CandidateSourceItem

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Referer": "https://www.google.com/",
    "Cache-Control": "max-age=0",
}

def extract_youtube_video_id(url: str) -> Optional[str]:
    """Extracts YouTube 11-char video ID from various URL formats."""
    match = re.search(r'(?:v=|\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})', url)
    return match.group(1) if match else None

def clean_html_text(html: str) -> str:
    """Removes scripts/styles and extracts readable text from HTML."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "svg", "button"]):
        tag.extract()

    # Prefer main article containers if available
    container = (
        soup.find("article") or
        soup.find("main") or
        soup.find(id=re.compile(r"content|article|post|body|story", re.I)) or
        soup.find(class_=re.compile(r"content|article|post|body|story", re.I)) or
        soup.body
    )
    text = container.get_text(separator="\n", strip=True) if container else soup.get_text(separator="\n", strip=True)

    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in text.splitlines()]
    return "\n".join([line for line in lines if len(line) > 3])

# --- 1. Unified Google Search via SerpApi (Articles + YouTube Videos) ---

async def discover_google_sources(query: str) -> List[CandidateSourceItem]:
    """
    Directly queries Google via SerpAPI to extract both YouTube videos (inline_videos)
    and Web articles (organic_results) in a single fast call (< 1.5s).
    Returns a unified list of candidate resources for selection.
    """
    if not settings.SERPAPI_API_KEY:
        raise ValueError("SERPAPI_API_KEY is not configured in backend/.env")

    clean_key = settings.SERPAPI_API_KEY.strip()
    candidates: List[CandidateSourceItem] = []
    seen_urls = set()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://serpapi.com/search", params={
                "engine": "google",
                "q": query,
                "api_key": clean_key,
                "gl": "in",
                "hl": "en",
                "num": 10
            })
            if resp.status_code != 200:
                logger.error(f"SerpAPI returned status {resp.status_code}: {resp.text[:200]}")
                raise RuntimeError(f"Google Search failed with status {resp.status_code}")

            data = resp.json()

            # 1. Extract YouTube videos from Google inline_videos carousel
            for v in data.get("inline_videos", []):
                link = v.get("link", "")
                if link and link not in seen_urls:
                    seen_urls.add(link)
                    ch_name = v.get("channel", "YouTube")
                    dur = v.get("duration", "")
                    snippet = f"Duration: {dur} • Channel: {ch_name}" if dur else f"Channel: {ch_name}"
                    candidates.append(CandidateSourceItem(
                        id=f"yt_{len(candidates)+1}",
                        title=v.get("title", "YouTube Video"),
                        url=link,
                        type="youtube",
                        channel_or_source=ch_name,
                        thumbnail=v.get("thumbnail"),
                        duration=dur,
                        snippet=snippet
                    ))

            # 2. Extract Web articles and video links from organic_results
            for item in data.get("organic_results", []):
                link = item.get("link", "")
                if not link or link in seen_urls:
                    continue
                seen_urls.add(link)

                is_yt = "youtube.com/watch" in link or "youtu.be/" in link
                title = item.get("title", "Article")
                snippet = item.get("snippet", "")
                source_name = item.get("displayed_link") or item.get("source") or ("YouTube" if is_yt else "Web")

                candidates.append(CandidateSourceItem(
                    id=f"res_{len(candidates)+1}",
                    title=title,
                    url=link,
                    type="youtube" if is_yt else "web",
                    channel_or_source=source_name,
                    thumbnail=item.get("thumbnail"),
                    duration=None,
                    snippet=snippet or f"Source: {source_name}"
                ))

    except Exception as e:
        logger.error(f"Error querying Google via SerpAPI: {e}")
        raise e

    return candidates

# --- 2. Robust Document Extraction (Transcripts & Clean Article Text) ---

async def fetch_youtube_transcript_text(url: str, title: str) -> Tuple[str, str, Optional[str]]:
    """
    Fetches video transcript using YouTubeTranscriptApi.
    Supports English, regional, and auto-generated captions with non-blocking thread and 3.5s timeout.
    Returns: (content, extraction_status, extraction_error)
    """
    video_id = extract_youtube_video_id(url)
    if not video_id:
        return f"Video Title: {title}\nURL: {url}", "failed", "Invalid YouTube URL format."

    def _sync_fetch():
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
        selected_transcript = None

        # 1. Try finding transcripts in common languages
        try:
            selected_transcript = transcript_list.find_transcript(['en', 'en-US', 'en-GB', 'hi', 'es', 'fr', 'de'])
        except Exception:
            # 2. Or take the first available transcript in any language
            for tr in transcript_list:
                selected_transcript = tr
                break

        if selected_transcript:
            data = selected_transcript.fetch()
            snippets = data.snippets if hasattr(data, "snippets") else data
            text_lines = []
            for s in snippets:
                txt = getattr(s, "text", s.get("text", "") if isinstance(s, dict) else str(s))
                if txt.strip():
                    text_lines.append(txt.strip())

            full_text = " ".join(text_lines)
            if len(full_text.split()) >= 25:
                header = f"=== YouTube Video Transcript ===\nTitle: {title}\nVideo URL: {url}\nLanguage: {selected_transcript.language}\n\n"
                return header + full_text, "success", None
        return None, "failed", "No captions or transcript available for this YouTube video."

    try:
        res = await asyncio.wait_for(asyncio.to_thread(_sync_fetch), timeout=3.5)
        if res and res[0]:
            return res
    except Exception as e:
        logger.info(f"Could not retrieve transcript in time for {video_id}: {e}")

    # Fallback message
    fallback_content = (
        f"=== YouTube Video ===\n"
        f"Title: {title}\n"
        f"URL: {url}\n\n"
        f"[Note: Auto-captions were not published or are disabled for this YouTube video.]"
    )
    return fallback_content, "failed", "No captions or transcript available for this YouTube video."

async def fetch_article_text(url: str, title: str) -> Tuple[str, str, Optional[str]]:
    """
    Fetches and cleans article HTML text using realistic human browser headers and readability parsing.
    Returns: (content, extraction_status, extraction_error)
    """
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url)
            
            # If blocked with 403, try once with mobile user agent
            if resp.status_code in (403, 401):
                mobile_headers = {
                    **HEADERS,
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
                    "Sec-Ch-Ua-Mobile": "?1",
                    "Sec-Ch-Ua-Platform": '"iOS"'
                }
                resp = await client.get(url, headers=mobile_headers)

            if resp.status_code == 200:
                cleaned = clean_html_text(resp.text)
                words = len(cleaned.split())
                if words >= 40:
                    header = f"=== Article: {title} ===\nSource URL: {url}\n\n"
                    return header + cleaned, "success", None
                elif words >= 15:
                    header = f"=== Article: {title} ===\nSource URL: {url}\n\n"
                    return header + cleaned, "partial", "Limited text extracted from webpage."
                else:
                    return f"Article Title: {title}\nURL: {url}", "failed", "Webpage contains insufficient readable text."
            else:
                return f"Article Title: {title}\nURL: {url}", "failed", f"Webpage returned HTTP status {resp.status_code}."
    except Exception as e:
        logger.warning(f"Error fetching article content from {url}: {e}")
        return f"Article Title: {title}\nURL: {url}", "failed", f"Failed to connect or site blocked scraping: {str(e)[:80]}"
