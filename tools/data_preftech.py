# tools/data_prefetch.py
import pandas as pd
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor, as_completed
from core.yf_context import yf_call, YFinance401Error
from core.logging import get_logger

logger = get_logger(__name__)

# Market indices are fixed — same across every pipeline run
_MARKET_TICKERS: dict[str, str] = {
    "GSPC": "^GSPC",
    "VIX": "^VIX",
    "NSEI": "^NSEI",
    "BSESN": "^BSESN",
    "IXIC": "^IXIC",
}


def _normalize_df(df: pd.DataFrame | None) -> pd.DataFrame | None:
    """Shared OHLCV cleanup — same logic your fetch_df already does."""
    if df is None or df.empty:
        return None
    df = df.dropna(how="any")
    if df.empty:
        return None
    df.index = pd.to_datetime(df.index).tz_localize(None)
    df.sort_index(inplace=True)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df


def prefetch_ticker_bundle(ticker: str) -> dict:
    """
    Fetch ALL yfinance data for one company ticker + all market indices
    in a single controlled burst — before any agent runs.

    Returns a bundle dict consumed directly by process_* functions.
    Bundle keys mirror what ticker_data() returns so process_fundamental_data
    can use it with zero structural changes.
    """
    bundle: dict = {
        "ticker": ticker,
        "status": "success",
        "error": None,
        # ── company data (mirrors ticker_data() return shape) ────────────
        "ohlcv": None,  # → TechnicalAnalyst
        "financials": None,  # → FundamentalsAnalyst
        "balance_sheet": None,  # → FundamentalsAnalyst
        "cash_flow": None,  # → FundamentalsAnalyst
        "info": {},  # → FundamentalsAnalyst + SectorAnalyst
        "major_holders": None,  # → FundamentalsAnalyst
        "news": [],  # → NewsAnalyst
        # ── market indices (mirrors fetch_df() return shape per key) ─────
        "market_indices": {},  # → MarketAnalyst
    }

    t = yf.Ticker(ticker)

    # ── company fetch tasks ─────────────────────────────────────────────
    def _ohlcv():
        with yf_call("prefetch_ohlcv"):
            df = yf.download(
                ticker, period="1y", interval="1d", auto_adjust=True, progress=False
            )
        return _normalize_df(df)

    def _financials():
        with yf_call("prefetch_financials"):
            return t.financials

    def _balance_sheet():
        with yf_call("prefetch_balance_sheet"):
            return t.balance_sheet

    def _cash_flow():
        with yf_call("prefetch_cash_flow"):
            return t.cash_flow

    def _info():
        with yf_call("prefetch_info"):
            raw = t.info
        if not isinstance(raw, dict):
            return {}
        return {
            k: v
            for k, v in raw.items()
            if v not in (None, "None", "null", "Null", "", [], {})
        }

    def _holders():
        with yf_call("prefetch_holders"):
            return t.major_holders

    def _news():
        with yf_call("prefetch_news"):
            return t.get_news() or []

    # ── market index fetch tasks ────────────────────────────────────────
    def _market_index(name: str, sym: str):
        with yf_call(f"prefetch_market_{name}"):
            df = yf.download(
                sym, period="1y", interval="1d", auto_adjust=True, progress=False
            )
        normalized = _normalize_df(df)
        return name, {
            "data": normalized,
            "status": "success" if normalized is not None else "failed",
            "error": None if normalized is not None else "empty_dataframe",
            "ticker": sym,
            "source": "yfinance",
        }

    company_tasks: dict[str, callable] = {
        "ohlcv": _ohlcv,
        "financials": _financials,
        "balance_sheet": _balance_sheet,
        "cash_flow": _cash_flow,
        "info": _info,
        "major_holders": _holders,
        "news": _news,
    }

    # cap workers at 5 — avoids the 10-12 concurrent burst that triggers 401
    with ThreadPoolExecutor(max_workers=5) as executor:
        company_futures = {
            executor.submit(fn): key for key, fn in company_tasks.items()
        }
        market_futures = {
            executor.submit(_market_index, name, sym): name
            for name, sym in _MARKET_TICKERS.items()
        }

        for future in as_completed({**company_futures, **market_futures}):
            key = company_futures.get(future) or market_futures.get(future)
            try:
                result = future.result()
                if future in market_futures:
                    idx_name, idx_result = result
                    bundle["market_indices"][idx_name] = idx_result
                else:
                    bundle[key] = result

            except YFinance401Error as e:
                # one 401 means all will 401 — abort immediately
                logger.error(f"[prefetch] 401 in '{e.caller}' — aborting pipeline")
                bundle["status"] = "failed"
                bundle["error"] = f"401 Unauthorized in '{e.caller}'"
                return bundle

            except Exception as e:
                # non-fatal: the analyst that needs this key will handle None
                logger.warning(f"[prefetch] '{key}' fetch failed: {e}")

    logger.info(
        f"[prefetch] bundle ready | ticker={ticker} | "
        f"indices={list(bundle['market_indices'].keys())}"
    )
    return bundle
