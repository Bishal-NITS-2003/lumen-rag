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

def parse_uploaded_document(file_bytes: bytes, filename: str) -> Tuple[str, int]:
    """
    Extracts text content and word count from PDF, TXT, MD, etc.
    Returns: (extracted_text, word_count)
    """
    ext = os.path.splitext(filename)[1].lower()
    text = ""

    if ext == ".pdf":
        import io
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        page_texts = []
        for i, page in enumerate(reader.pages):
            page_content = page.extract_text() or ""
            if page_content.strip():
                page_texts.append(f"[Page {i+1}]\n{page_content.strip()}")
        text = "\n\n".join(page_texts)
    else:
        # Default txt / markdown / csv / json
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1", errors="ignore")

    clean_text = text.strip()
    words = len(clean_text.split())
    return clean_text, words
