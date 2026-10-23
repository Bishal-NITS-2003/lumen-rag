import os
import uuid
import logging
from typing import Tuple, Optional
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from pypdf import PdfReader
from .config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.s3_client = None
        self.bucket = settings.AWS_S3_BUCKET
        self.use_s3 = False

        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY and self.bucket:
            try:
                self.s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_REGION
                )
                self.use_s3 = True
                logger.info(f"AWS S3 connected successfully to bucket: {self.bucket}")
            except Exception as e:
                logger.warning(f"Failed to initialize AWS S3 client: {e}. Falling back to local storage.")
                self.use_s3 = False
        else:
            logger.info("AWS S3 credentials not provided. Using local file storage fallback.")

    def save_file(self, file_bytes: bytes, filename: str) -> Tuple[str, Optional[str]]:
        """
        Saves file to S3 or local storage.
        Returns: (file_path_or_url, s3_key)
        """
        ext = os.path.splitext(filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex[:12]}_{filename}"

        if self.use_s3 and self.s3_client:
            s3_key = f"notebook_sources/{unique_name}"
            try:
                self.s3_client.put_object(
                    Bucket=self.bucket,
                    Key=s3_key,
                    Body=file_bytes
                )
                s3_url = f"https://{self.bucket}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
                return s3_url, s3_key
            except Exception as e:
                logger.warning(f"S3 upload failed ({e}), falling back to local disk.")

        # Local fallback
        os.makedirs(settings.STORAGE_DIR, exist_ok=True)
        local_path = os.path.join(settings.STORAGE_DIR, unique_name)
        with open(local_path, "wb") as f:
            f.write(file_bytes)
        return local_path, None

    def delete_file(self, s3_key: Optional[str] = None, file_path: Optional[str] = None):
        """Deletes file from S3 or local disk."""
        if s3_key and self.use_s3 and self.s3_client:
            try:
                self.s3_client.delete_object(Bucket=self.bucket, Key=s3_key)
                logger.info(f"Deleted S3 object: {s3_key}")
            except Exception as e:
                logger.warning(f"Failed to delete S3 object {s3_key}: {e}")
        elif file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Deleted local file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete local file {file_path}: {e}")

storage_service = StorageService()

_RAPID_OCR = None

def get_rapid_ocr():
    global _RAPID_OCR
    if _RAPID_OCR is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _RAPID_OCR = RapidOCR()
        except Exception as e:
            logger.warning(f"RapidOCR initialization notice: {e}")
    return _RAPID_OCR

def parse_uploaded_document(file_bytes: bytes, filename: str) -> Tuple[str, int]:
    """
    Extracts text content and word count from PDF, TXT, MD, and image files.
    Employs a high-speed hybrid strategy:
    1. Direct digital text extraction for instant (<0.1s) parsing of text-based PDFs.
    2. Blazing fast in-memory RapidOCR + pypdfium2 for scanned PDFs and image files.
    Returns: (extracted_text, word_count)
    """
    ext = os.path.splitext(filename)[1].lower()
    text = ""

    if ext == ".pdf":
        import io
        page_texts = []
        needs_ocr = False

        # Step 1: Fast direct text extraction with pypdf
        try:
            pdf_file = io.BytesIO(file_bytes)
            reader = PdfReader(pdf_file)
            for i, page in enumerate(reader.pages):
                page_content = (page.extract_text() or "").strip()
                words = len(page_content.split())
                if words >= 15:
                    page_texts.append(f"[Page {i+1}]\n{page_content}")
                else:
                    # Page has few or no words, likely scanned document or slide
                    needs_ocr = True
        except Exception as e:
            logger.warning(f"Direct PDF text extraction exception: {e}")
            needs_ocr = True

        total_extracted_words = sum(len(p.split()) for p in page_texts)

        # If direct extraction yielded comprehensive text across all pages, use it directly
        if total_extracted_words >= 50 and not needs_ocr:
            text = "\n\n".join(page_texts)
        else:
            # Step 2: High-speed in-memory OCR via pypdfium2 + RapidOCR
            try:
                import pypdfium2 as pdfium
                import numpy as np

                ocr_engine = get_rapid_ocr()
                if ocr_engine is not None:
                    ocr_page_texts = []
                    pdf = pdfium.PdfDocument(file_bytes)
                    for i, page in enumerate(pdf):
                        # If this page already had good digital text (> 35 words), keep it
                        if i < len(page_texts) and len(page_texts[i].split()) > 35:
                            ocr_page_texts.append(page_texts[i])
                            continue

                        # Render page at 1.5x resolution for fast & accurate OCR
                        bitmap = page.render(scale=1.5)
                        pil_img = bitmap.to_pil()
                        img_arr = np.array(pil_img)
                        result, _ = ocr_engine(img_arr)

                        if result:
                            lines = [line[1] for line in result if line and len(line) > 1 and line[1].strip()]
                            page_str = "\n".join(lines).strip()
                            if page_str:
                                ocr_page_texts.append(f"[Page {i+1} (OCR)]\n{page_str}")

                    if ocr_page_texts:
                        text = "\n\n".join(ocr_page_texts)
            except Exception as ocr_err:
                logger.warning(f"RapidOCR PDF fallback failed ({ocr_err}). Falling back to raw text.")

        # Fallback to direct page_texts if OCR was empty
        if not text and page_texts:
            text = "\n\n".join(page_texts)

    elif ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]:
        # Direct image OCR
        try:
            import io
            from PIL import Image
            import numpy as np
            ocr_engine = get_rapid_ocr()
            if ocr_engine:
                pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
                result, _ = ocr_engine(np.array(pil_img))
                if result:
                    lines = [line[1] for line in result if line and len(line) > 1 and line[1].strip()]
                    text = "\n".join(lines).strip()
        except Exception as img_err:
            logger.warning(f"Image OCR failed: {img_err}")

    else:
        # Default txt / markdown / csv / json
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1", errors="ignore")

    clean_text = text.strip()
    words = len(clean_text.split())
    return clean_text, words
