import pandas as pd
import ta
import math
from typing import Any, Optional
from core.logging import get_logger
from tools.utils.fundamental_tool_helper import _df_row

logger = get_logger(__name__)

def extract_charts_data(raw_data: dict, fundamental_data: dict) -> Optional[dict]:
    """
    Extract and format chart-friendly data for the UI components.
    Computes historical time-series arrays for technical indicators
    and formats financial history data.
    """
    charts_data: dict[str, Any] = {}

    # ── Technical history (OHLCV + indicators) ──────────────────────────
    try:
        raw_ohlcv = raw_data.get("ohlcv")
        if raw_ohlcv is not None and not raw_ohlcv.empty:
            df = raw_ohlcv.copy()
            close = df["Close"]

            # Compute indicators
            ma50 = close.rolling(50).mean()
            ma200 = close.rolling(200).mean()

            bb = ta.volatility.BollingerBands(close)
            bb_upper = bb.bollinger_hband()
            bb_lower = bb.bollinger_lband()
            bb_mid = bb.bollinger_mavg()

            rsi = ta.momentum.RSIIndicator(close, window=14).rsi()

            volume = df["Volume"] if "Volume" in df.columns else pd.Series(dtype=float)

            def _safe(val: Any) -> Any:
                """Convert NaN/inf to None for JSON serialization."""
                if val is None:
                    return None
                try:
                    f = float(val)
                    if math.isnan(f) or math.isinf(f):
                        return None
                    return round(f, 2)
                except (ValueError, TypeError):
                    return None

            technical_history = []
            limit = min(120, len(df))
            start_idx = len(df) - limit
            for i in range(start_idx, len(df)):
                row = {
                    "date": str(df.index[i].date()) if hasattr(df.index[i], "date") else str(df.index[i]),
                    "close": _safe(close.iloc[i]),
                    "ma50": _safe(ma50.iloc[i]),
                    "ma200": _safe(ma200.iloc[i]),
                    "bb_upper": _safe(bb_upper.iloc[i]),
                    "bb_lower": _safe(bb_lower.iloc[i]),
                    "bb_mid": _safe(bb_mid.iloc[i]),
                    "rsi": _safe(rsi.iloc[i]),
                    "volume": _safe(volume.iloc[i]) if len(volume) > i else None,
                }
                technical_history.append(row)
            charts_data["technical_history"] = technical_history
    except Exception as exc:
        logger.warning(f"Failed to extract technical chart data: {exc}")
        charts_data["technical_history"] = []

    # ── Financials history ──────────────────────────────────────────────
    try:
        financials_df = raw_data.get("financials")
        balance_sheet_df = raw_data.get("balance_sheet")
        cash_flow_df = raw_data.get("cash_flow")
        
        financials_history = {}

        if financials_df is not None and not financials_df.empty:
            financials_history["income_stmt"] = {
                "revenue": _df_row(financials_df, "Total Revenue"),
                "ebitda": _df_row(financials_df, "EBITDA", "Normalized EBITDA"),
                "net_income": _df_row(financials_df, "Net Income", "Net Income Common Stockholders"),
                "eps_diluted": _df_row(financials_df, "Diluted EPS"),
            }
        else:
            financials_history["income_stmt"] = {}

        if balance_sheet_df is not None and not balance_sheet_df.empty:
            financials_history["balance_sheet"] = {
                "cash": _df_row(balance_sheet_df, "Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"),
                "total_liabilities": _df_row(balance_sheet_df, "Total Liabilities Net Minority Interest", "Total Liabilities"),
                "total_debt": _df_row(balance_sheet_df, "Total Debt"),
                "shareholders_equity": _df_row(balance_sheet_df, "Stockholders Equity", "Common Stock Equity"),
            }
        else:
            financials_history["balance_sheet"] = {}

        if cash_flow_df is not None and not cash_flow_df.empty:
            ocf = _df_row(cash_flow_df, "Operating Cash Flow", "Cash Flow From Continuing Operating Activities")
            capex = _df_row(cash_flow_df, "Capital Expenditure", "Purchase Of PPE")
            free_cash_flow = {
                date: (round(ocf[date] - abs(capex[date]), 2) if ocf.get(date) is not None and capex.get(date) is not None else None)
                for date in ocf
            }
            financials_history["cash_flow"] = {
                "operating_cash_flow": ocf,
                "free_cash_flow": free_cash_flow,
            }
        else:
            financials_history["cash_flow"] = {}

        if fundamental_data and fundamental_data.get("status") == "success":
            fundamentals = fundamental_data.get("fundamentals", {})
            financials_history["ratios"] = fundamentals.get("fundamentals", {})
        else:
            financials_history["ratios"] = {}

        charts_data["financials_history"] = financials_history
    except Exception as exc:
        logger.warning(f"Failed to extract financials chart data: {exc}")

    return charts_data if charts_data else None
