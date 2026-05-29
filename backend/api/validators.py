import re
import time
import threading
import requests
import pandas as pd
from io import StringIO
from langchain_groq import ChatGroq
from core.logging import get_logger

logger = get_logger(__name__)


# Symbol cache
_cache: dict = {
    "nse_symbols": set(),
    "loaded_at": 0,
}

_cache_lock = threading.Lock()

# Refresh once per day
_CACHE_TTL_SEC = 86_400

# Official NSE equity list
NSE_LIST_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"


# Load NSE symbols
def _load_nse_symbols() -> set[str]:
    """
    Download official NSE symbol list.
    Example symbols:
        INFY
        RELIANCE
        TCS
    """
    try:
        headers = {"User-Agent": "Mozilla/5.0"}

        resp = requests.get(
            NSE_LIST_URL,
            headers=headers,
            timeout=15,
        )

        resp.raise_for_status()

        df = pd.read_csv(StringIO(resp.text))

        symbols = set(df["SYMBOL"].astype(str).str.strip().str.upper())

        logger.info(f"NSE symbols loaded: {len(symbols)}")

        return symbols

    except Exception as exc:
        logger.exception(f"NSE symbol fetch failed: {exc}")
        return set()


# Refresh cache
def _refresh_cache_if_stale() -> None:
    """
    Refresh symbol cache once daily.
    """
    with _cache_lock:

        age = time.time() - _cache["loaded_at"]

        if age < _CACHE_TTL_SEC and _cache["nse_symbols"]:
            return

        logger.info("Refreshing ticker symbol cache...")

        _cache["nse_symbols"] = _load_nse_symbols()

        _cache["loaded_at"] = time.time()

        logger.info("Ticker cache refreshed | " f"NSE={len(_cache['nse_symbols'])}")


# Format validation
_FORMAT_RE = re.compile(
    r"^[A-Z0-9&\-]{1,20}\.NS$",
    re.IGNORECASE,
)


def validate_ticker_format(
    ticker: str,
) -> tuple[bool, str | None]:
    """
    Validate ticker format.

    Valid:
        INFY.NS
        RELIANCE.NS
    """

    if not ticker or not ticker.strip():
        return False, "Ticker cannot be empty."

    ticker = ticker.strip().upper()

    if not _FORMAT_RE.match(ticker):
        logger.warning(f"Ticker format validation failed | ticker={ticker}")
        return (
            False,
            (
                f"'{ticker}' is not a valid ticker format. "
                "Use NSE ticker format like 'RELIANCE.NS'."
            ),
        )

    return True, None


# Existence validation
def validate_ticker_exists(
    ticker: str,
) -> tuple[bool, str | None]:
    """
    Validate ticker existence using cached
    official NSE symbol list.
    """

    _refresh_cache_if_stale()

    ticker = ticker.strip().upper()

    symbol, exchange = ticker.rsplit(".", 1)

    # NSE validation
    if exchange == "NS":

        if not _cache["nse_symbols"]:

            logger.warning("NSE cache unavailable")

            return (False, "Ticker validation service temporarily unavailable.")

        if symbol not in _cache["nse_symbols"]:
            logger.warning(f"NSE Ticker not found | ticker={ticker}")
            return (
                False,
                (
                    f"'{symbol}' was not found on NSE. "
                    "Please verify the ticker symbol."
                ),
            )

    return True, None


def validate_api_keys(groq_api_key: str) -> tuple[bool, str]:
    if not groq_api_key or not groq_api_key.strip():
        return False, "Groq API key is required."
    try:
        llm = ChatGroq(
            api_key=groq_api_key,
            model="llama-3.1-8b-instant",
            temperature=0,
        )

        # tiny validation request
        llm.invoke("ping")

        return True, None

    except Exception:
        return False, "Invalid Groq API key"
