import os
import io
import httpx
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from fastapi import HTTPException

import config.settings as settings
import service.cloudinary_service as cloudinary_service
from tools.utils.retry_utils import retry_fetch
from core.logging import get_logger

logger = get_logger(__name__)


# ── Pydantic Schemas ───────────────────────────────────────────────────────────

class IngestResponse(BaseModel):
    message: str
    pdf_name: str
    total_pages: int
    url: str

class PDFContentResponse(BaseModel):
    pdf_name: str
    content: str
    total_pages: int

# ── PDF Service Logic ─────────────────────────────────────────────────────────

def get_pdf_content(pdf_name: str) -> dict:
    """Fetch PDF from Cloudinary, extract text on-the-fly, and return raw content with graceful error handling."""
    result = {
        "status": "failed",
        "pdf_name": pdf_name,
        "content": None,
        "total_pages": 0,
        "error": None,
    }

    def _fetch_task():
        formatted_name = pdf_name if pdf_name.lower().endswith(".pdf") else f"{pdf_name}.pdf"
        url = cloudinary_service.get_pdf_url(formatted_name)
        if not url:
            raise ValueError(f"PDF '{formatted_name}' not found in Cloudinary")

        with httpx.Client() as client:
            response = client.get(url, timeout=60.0)
            response.raise_for_status()

        content, total_pages = extract_text_from_pdf_stream(io.BytesIO(response.content))
        if total_pages == 0:
            raise ValueError(f"PDF '{formatted_name}' contains no pages or could not be parsed")
        if not content.strip():
            raise ValueError(f"PDF '{formatted_name}' contains no extractable text")
        return {"content": content, "total_pages": total_pages}

    try:
        data = retry_fetch(
            _fetch_task,
            retries=3,
            label=f"get_pdf_content:{pdf_name}"
        )
        result.update({
            "status": "success",
            "content": data["content"],
            "total_pages": data["total_pages"],
        })
    except Exception as e:
        logger.error(f"Failed to fetch PDF content | pdf={pdf_name} | {e}")
        result["error"] = str(e)

    return result


def ingest_pdf(pdf_name: str) -> IngestResponse:
    """Upload a local PDF to Cloudinary."""
    pdf_path = os.path.join(settings.PDF_FOLDER, pdf_name)
    if not os.path.exists(pdf_path):
        raise ValueError(f"Local PDF file '{pdf_name}' not found")

    # Use the name as is (filenames are already normalized in the folder)
    formatted_name = pdf_name if pdf_name.lower().endswith(".pdf") else f"{pdf_name}.pdf"

    # Extract text locally first just to get page count
    try:
        _, total_pages = extract_text_from_pdf_file(pdf_path)
    except Exception as e:
        raise RuntimeError(f"Failed to read local PDF: {str(e)}")

    # Upload to Cloudinary
    try:
        upload_result = cloudinary_service.upload_pdf(pdf_path, formatted_name)
        url = upload_result.get("secure_url")
    except Exception as e:
        raise RuntimeError(f"Cloudinary upload failed: {str(e)}")

    return IngestResponse(
        message="PDF uploaded to Cloudinary successfully",
        pdf_name=formatted_name,
        total_pages=total_pages,
        url=url,
    )


def extract_text_from_pdf_file(pdf_path: str) -> tuple[str, int]:
    """Extract text from a local PDF file."""
    from pypdf import PdfReader
    reader = PdfReader(pdf_path)
    content = ""
    for page in reader.pages:
        content += page.extract_text() + "\n"
    return content.strip(), len(reader.pages)


def extract_text_from_pdf_stream(stream: io.BytesIO) -> tuple[str, int]:
    """Extract text from a PDF byte stream."""
    from pypdf import PdfReader
    reader = PdfReader(stream)
    content = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            content += text + "\n"
    return content.strip(), len(reader.pages)
