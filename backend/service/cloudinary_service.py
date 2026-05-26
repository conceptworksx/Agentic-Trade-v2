import cloudinary
import cloudinary.uploader
import cloudinary.api
from typing import List, Optional

import config.settings as settings
from tools.utils.retry_utils import with_retry
from core.logging import get_logger

logger = get_logger(__name__)

# Configuration
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)

@with_retry(retries=3, delay=2.0, backoff=2.0)
def upload_pdf(file_path: str, public_id: str) -> dict:
    """
    Upload a local PDF to Cloudinary.
    """
    response = cloudinary.uploader.upload(
        file_path,
        public_id=public_id,
        resource_type="raw",
        folder="agent_trade"
    )
    return response

def get_pdf_url(public_id: str) -> Optional[str]:
    """
    Get the public URL for a PDF by its public ID.
    This constructs the URL manually and does not require API keys for fetching public resources.
    """
    cloud_name = settings.CLOUDINARY_CLOUD_NAME
    if not cloud_name:
        return None
    
    # Standard Cloudinary URL format for raw resources:
    # https://res.cloudinary.com/<cloud_name>/raw/upload/<folder>/<public_id>
    return f"https://res.cloudinary.com/{cloud_name}/raw/upload/agent_trade/{public_id}"

@with_retry(retries=3, delay=2.0, backoff=2.0)
def list_pdfs() -> List[dict]:
    """
    List all PDFs in the agentic_trade/pdfs folder.
    """
    try:
        resources = cloudinary.api.resources(
            resource_type="raw",
            prefix="agent_trade/",
            type="upload"
        )
        return resources.get("resources", [])
    except Exception as e:
        logger.error(f"Error listing PDFs from Cloudinary: {e}", exc_info=True)
        return []
