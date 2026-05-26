"""
ThreadPoolExecutor spawns thread for get_financials
│
├─ yf_call("get_financials") sets ContextVar on this thread
│
├─ t.financials runs → yfinance hits Yahoo → 401
│
├─ yfinance writes to its own logger internally
│
├─ _YF401Interceptor.emit() fires on this same thread
│   ├─ reads ContextVar → "get_financials"
│   ├─ logs YOUR tagged error line
│   └─ sets thread_local.got_401 = True
│
└─ yf_call finally-block runs
    ├─ sees got_401 = True
    └─ raises YFinance401Error(caller="get_financials")
"""

import contextvars
import logging
import threading
from contextlib import contextmanager
from typing import Optional

logger = logging.getLogger(__name__)

# ── Context variable tracks the active caller function name ──────────────────
_yf_caller: contextvars.ContextVar[str] = contextvars.ContextVar(
    "yf_caller", default="<unknown>"
)


class YFinance401Error(Exception):
    """Raised when yfinance returns a 401 Unauthorized response."""

    def __init__(self, caller: str, original_message: str):
        self.caller = caller
        self.original_message = original_message
        super().__init__(f"[YF-401] Unauthorized in '{caller}': {original_message}")


# ── Custom log handler that intercepts yfinance's internal 401 log lines ─────
class _YF401Interceptor(logging.Handler):
    """
    Attaches to the 'yfinance' logger.  Whenever yfinance emits a log record
    that looks like a 401 / Unauthorized error it:
      1. Re-logs it at ERROR level on YOUR logger, tagged with the calling
         function name read from the context variable.
      2. Sets a thread-local flag that fetch_df / ticker_data etc. can check.
    """

    _tl = threading.local()  # per-thread signal flag

    def emit(self, record: logging.LogRecord) -> None:
        msg = record.getMessage()
        is_401 = (
            "401" in msg
            or "unauthorized" in msg.lower()
            or "possibly delisted" in msg.lower()  # yfinance wraps 401s here too
        )
        if not is_401:
            return

        caller = _yf_caller.get("<unknown>")
        logger.error(
            "[YF-401] Unauthorized response captured | "
            f"caller='{caller}' | yfinance_msg='{msg}'"
        )
        self._tl.got_401 = True  # signal the wrapper

    @classmethod
    def was_401(cls) -> bool:
        return getattr(cls._tl, "got_401", False)

    @classmethod
    def reset(cls) -> None:
        cls._tl.got_401 = False


# Register the interceptor once at import time
_interceptor = _YF401Interceptor()
_interceptor.setLevel(logging.DEBUG)  # catch everything yfinance emits
logging.getLogger("yfinance").addHandler(_interceptor)
logging.getLogger("yfinance").propagate = False


# ── Context manager you wrap every yf call with ──────────────────────────────
@contextmanager
def yf_call(fn_name: str):
    """
    Usage:
        with yf_call("get_financials"):
            df = t.financials

    - Sets the context variable so the 401 interceptor can tag log lines.
    - Resets / checks the thread-local flag before and after.
    - Raises YFinance401Error if a 401 was detected.
    """
    token = _yf_caller.set(fn_name)
    _YF401Interceptor.reset()
    try:
        yield
    finally:
        _yf_caller.reset(token)
        if _YF401Interceptor.was_401():
            _YF401Interceptor.reset()
            raise YFinance401Error(caller=fn_name, original_message="see logs")
