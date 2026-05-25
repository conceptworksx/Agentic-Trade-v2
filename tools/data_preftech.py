import threading
import yfinance as yf

from core.yf_context import yf_call, YFinance401Error
from tools.utils.data_prefetch_helper import (_normalize_df, _get_cached , _set_cached)
from core.logging import get_logger

logger = get_logger(__name__)

# ── Global serialization gate ────────────────────────────────────────────────
# yfinance internally shares session/cookie/crumb state.
# Concurrent access from multiple FastAPI requests can corrupt that state
# and trigger intermittent "Invalid Crumb" / 401 errors.
#
# This lock guarantees:
# ONE request owns yfinance completely during the prefetch lifecycle.
#
# Important:
# - We intentionally serialize the ENTIRE pipeline.
# - ThreadPoolExecutor was removed because it added thread overhead
#   while the semaphore already forced sequential execution.
#
_YF_SEMAPHORE = threading.Semaphore(1)

# ── Fixed market index tickers ───────────────────────────────────────────────

_MARKET_TICKERS: dict[str, str] = {
    "GSPC": "^GSPC",
    "VIX": "^VIX",
    "NSEI": "^NSEI",
    "BSESN": "^BSESN",
    "IXIC": "^IXIC",
}

# ── Main prefetch function ───────────────────────────────────────────────────


def prefetch_ticker_bundle(ticker: str) -> dict:
    """
    Fetch ALL yfinance data needed by every analyst in one controlled pass.

    Data fetched
    ------------
    Company:
        - ohlcv
        - financials
        - balance_sheet
        - cash_flow
        - info
        - major_holders
        - news

    Market:
        - GSPC
        - VIX
        - NSEI
        - BSESN
        - IXIC

    Concurrency model
    -----------------
    FastAPI may execute multiple requests concurrently.

    yfinance is NOT reliably thread-safe because it internally shares:
        - curl_cffi session
        - cookies
        - Yahoo crumb tokens

    Therefore:
        - ONE global semaphore serializes ALL yfinance access.
        - The entire prefetch lifecycle runs under one lock.
        - No ThreadPoolExecutor is used.

    Returns
    -------
    dict
        {
            "status": "success" | "invalid_ticker" | "failed"
        }
    """

    cached = _get_cached(ticker)
    if cached:
        logger.info("Returning cached data")
        return cached
    
    bundle: dict = {
        "ticker": ticker,
        "status": "success",
        "error": None,
        # ── company data ──────────────────────────────────────────────
        "ohlcv": None,
        "financials": None,
        "balance_sheet": None,
        "cash_flow": None,
        "info": {},
        "major_holders": None,
        "news": [],
        # ── market data ───────────────────────────────────────────────
        "market_indices": {},
    }

    # ── entire yfinance lifecycle serialized ─────────────────────────

    with _YF_SEMAPHORE:

        try:

            # ── create ONE reusable ticker instance ──────────────────
            stock = yf.Ticker(ticker)

            # ──────────────────────────────────────────────────────────
            # OHLCV
            # ──────────────────────────────────────────────────────────

            try:
                with yf_call("prefetch_ohlcv"):

                    df = yf.download(
                        ticker,
                        period="1y",
                        interval="1d",
                        auto_adjust=True,
                        progress=False,
                    )

                bundle["ohlcv"] = _normalize_df(df)

            except Exception as exc:
                logger.warning(f"[prefetch] 'ohlcv' fetch failed (non-fatal): {exc}")

            # ──────────────────────────────────────────────────────────
            # Financials
            # ──────────────────────────────────────────────────────────

            try:
                with yf_call("prefetch_financials"):
                    bundle["financials"] = stock.financials

            except Exception as exc:
                logger.warning(
                    f"[prefetch] 'financials' fetch failed (non-fatal): {exc}"
                )

            # ──────────────────────────────────────────────────────────
            # Balance sheet
            # ──────────────────────────────────────────────────────────

            try:
                with yf_call("prefetch_balance_sheet"):
                    bundle["balance_sheet"] = stock.balance_sheet

            except Exception as exc:
                logger.warning(
                    f"[prefetch] 'balance_sheet' fetch failed (non-fatal): {exc}"
                )

            # ──────────────────────────────────────────────────────────
            # Cash flow
            # ──────────────────────────────────────────────────────────

            try:
                with yf_call("prefetch_cash_flow"):
                    bundle["cash_flow"] = stock.cash_flow

            except Exception as exc:
                logger.warning(
                    f"[prefetch] 'cash_flow' fetch failed (non-fatal): {exc}"
                )

            # ──────────────────────────────────────────────────────────
            # Info
            # ──────────────────────────────────────────────────────────

            try:
                with yf_call("prefetch_info"):
                    raw_info = stock.info

                if isinstance(raw_info, dict):

                    bundle["info"] = {
                        k: v
                        for k, v in raw_info.items()
                        if v
                        not in (
                            None,
                            "None",
                            "null",
                            "Null",
                            "",
                            [],
                            {},
                        )
                    }

            except Exception as exc:
                logger.warning(f"[prefetch] 'info' fetch failed (non-fatal): {exc}")

            # ──────────────────────────────────────────────────────────
            # Major holders
            # ──────────────────────────────────────────────────────────

            try:
                with yf_call("prefetch_holders"):
                    bundle["major_holders"] = stock.major_holders

            except Exception as exc:
                logger.warning(
                    f"[prefetch] 'major_holders' fetch failed (non-fatal): {exc}"
                )

            # ──────────────────────────────────────────────────────────
            # News
            # ──────────────────────────────────────────────────────────

            try:
                with yf_call("prefetch_news"):
                    bundle["news"] = stock.get_news() or []

            except Exception as exc:
                logger.warning(f"[prefetch] 'news' fetch failed (non-fatal): {exc}")

            # ──────────────────────────────────────────────────────────
            # Market indices
            # ──────────────────────────────────────────────────────────

            for name, sym in _MARKET_TICKERS.items():

                try:

                    with yf_call(f"prefetch_market_{name}"):

                        idx_df = yf.download(
                            sym,
                            period="1y",
                            interval="1d",
                            auto_adjust=True,
                            progress=False,
                        )

                    normalized = _normalize_df(idx_df)

                    bundle["market_indices"][name] = {
                        "data": normalized,
                        "status": ("success" if normalized is not None else "failed"),
                        "error": (
                            None if normalized is not None else "empty_dataframe"
                        ),
                        "ticker": sym,
                        "source": "yfinance",
                    }

                except Exception as exc:

                    logger.warning(f"[prefetch] market '{name}' fetch failed: {exc}")

        except YFinance401Error as e:

            logger.error(f"[prefetch] 401 in '{e.caller}' — aborting pipeline")

            bundle["status"] = "failed"
            bundle["error"] = f"401 Unauthorized in '{e.caller}'"

            return bundle

    # ── validity check ───────────────────────────────────────────────────────

    info = bundle.get("info", {})

    has_identity = any(info.get(k) for k in ("longName", "shortName", "symbol"))

    if not has_identity:

        logger.warning(
            f"[prefetch] no identity fields in info — "
            f"ticker likely invalid | ticker={ticker}"
        )

        bundle["status"] = "invalid_ticker"

        bundle["error"] = (
            f"Ticker '{ticker}' returned no identifiable company data. "
            "Check the symbol and exchange suffix "
            "(e.g. RELIANCE.NS)."
        )

        return bundle

    # ── success log ──────────────────────────────────────────────────────────

    logger.info(
        f"[prefetch] bundle ready | ticker={ticker} "
        f"| company={info.get('longName', 'N/A')} "
        f"| indices={list(bundle['market_indices'].keys())}"
    )

    if bundle["status"] == "success":
        _set_cached(ticker, bundle)

    return bundle
