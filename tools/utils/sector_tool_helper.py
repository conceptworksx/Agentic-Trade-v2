"""
Sector helper logic used by SectorAnalyst for mapping and parsing.
Contains internal support functions for API fetching and JSON parsing.
"""

import json
import logging
import re
from typing import Any

from core.constants import SectorName
from service.pdf_service import get_pdf_content

logger = logging.getLogger(__name__)


def _parse_json_object(text: str) -> dict[str, Any]:
    """
    Extract and parse the first valid JSON object from a potentially messy LLM response.
    Returns a status dict containing the parsed data or an error message.
    """
    result = {
        "status": "failed",
        "data": None,
        "error": None,
    }

    raw_text = "" if text is None else str(text).strip()

    try:
        # Fast path: exact JSON match
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        # Slow path: find JSON within text blocks or markdown code fences
        match = re.search(r"\{.*\}", raw_text, flags=re.DOTALL)
        if not match:
            result["error"] = "LLM response did not contain a valid JSON object."
            return result

        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            result["error"] = f"Failed to parse identified JSON block: {exc}"
            return result
    except TypeError as exc:
        result["error"] = f"Invalid JSON input type: {exc}"
        return result

    if not isinstance(parsed, dict):
        result["error"] = "Extracted JSON must be an object (dictionary)."
        return result

    result.update({
        "status": "success",
        "data": parsed,
    })
    return result


def _fetch_sector_data(sector_name: str) -> dict[str, Any]:
    """
    Fetch the structured PDF analysis payload for a validated catalog sector.
    Now fetches directly from Cloudinary via pdf_service.
    """
    sector_name = str(sector_name).strip()
    
    result = {
        "status": "failed",
        "sector": sector_name,
        "data": None,
        "error": None,
    }

    # Final safety check against the official sector list
    valid_sector_names = {sector.value for sector in SectorName}
    if sector_name not in valid_sector_names:
        result["error"] = f"Sector {sector_name!r} is not in the supported catalog"
        return result

    logger.info(f"Requesting sector report from Cloudinary | sector={sector_name}")

    # Call Cloudinary directly via the shared service (bypass local API server)
    pdf_result = get_pdf_content(sector_name)

    if pdf_result["status"] == "success" and pdf_result.get("content") and pdf_result.get("total_pages", 0) > 0:
        result["data"] = pdf_result
        result["status"] = "success"
    else:
        result["error"] = pdf_result.get("error") or "Sector report PDF is unavailable or contains no text."

    return result
