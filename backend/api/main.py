import asyncio
from contextlib import asynccontextmanager
from typing import Any, Optional

import uvicorn
from fastapi.responses import JSONResponse
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from api.validators import (
    validate_ticker_format,
    validate_ticker_exists,
    validate_api_keys,
    _refresh_cache_if_stale,
)
from core.error import (
    AgentError,
    AuthenticationError,
    LLMRateLimitError,
    TokenLimitError,
    ModelUnavailableError,
    MaxRetriesExceeded,
    NodeExecutionError,
    DataFetchError,
    ToolCallError,
)
from core.logging import setup_logging, get_logger
from graph.builder import build_graph

setup_logging()
logger = get_logger(__name__)


# ── Error map ───────────────────────────────────────────────────────────────────
_ERROR_MAP: dict[type, tuple[int, str]] = {
    AuthenticationError: (401, "invalid_groq_api_key"),
    LLMRateLimitError: (429, "llm_rate_limit"),
    TokenLimitError: (422, "token_limit_exceeded"),
    ModelUnavailableError: (503, "llm_unavailable"),
    MaxRetriesExceeded: (503, "max_retries_exceeded"),
    DataFetchError: (422, "data_fetch_failed"),
    ToolCallError: (500, "tool_call_failed"),
    NodeExecutionError: (500, "node_execution_failed"),
    AgentError: (500, "analysis_failed"),
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Preload NSE ticker cache at startup."""
    logger.info("Preloading NSE ticker cache...")
    _refresh_cache_if_stale()
    logger.info("NSE ticker cache ready")
    yield


app = FastAPI(
    title="Indian Trading Agent API",
    description="Multi-agent stock analysis for Indian markets",
    version="1.0.0",
    lifespan=lifespan,
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": {
                "error": "app_rate_limit",
                "message": "Too many requests to this API",
            }
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    ticker: str


class AnalyzeResponse(BaseModel):
    ticker: str
    news_report: str
    technical_report: str
    fundamental_report: str
    market_report: str
    sector_report: str
    status: str
    charts_data: Optional[dict] = None


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit("3/minute")
async def analyze(
    request: Request,
    body: AnalyzeRequest,
    groq_api_key: str = Header(..., alias="Groq-API-Key"),
):
    ticker = body.ticker.strip().upper()
    logger.info(f"Analyze request received | ticker={ticker}")

    # Validate API key format
    is_valid_key, key_error = validate_api_keys(groq_api_key=groq_api_key)
    if not is_valid_key:
        logger.warning(f"Invalid API key format | ticker={ticker}")
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_api_key", "message": key_error},
        )

    # Validate ticker format
    is_valid_format, format_error = validate_ticker_format(ticker)
    if not is_valid_format:
        logger.warning(f"Invalid ticker format | ticker={ticker}")
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_ticker_format",
                "message": format_error,
            },
        )

    # Validate ticker exists
    is_valid_ticker, ticker_error = validate_ticker_exists(ticker)
    if not is_valid_ticker:
        logger.warning(f"Ticker not found | ticker={ticker}")
        raise HTTPException(
            status_code=404,
            detail={"error": "ticker_not_found", "message": ticker_error},
        )

    # Run LangGraph workflow
    try:
        logger.info(f"Starting graph execution | ticker={ticker}")
        graph = build_graph(groq_api_key=groq_api_key)
        final_state = await asyncio.to_thread(
            graph.invoke, {"ticker_of_company": ticker}
        )
        logger.info(f"Graph execution completed | ticker={ticker}")

        return AnalyzeResponse(
            ticker=ticker,
            news_report=final_state.get("news_analyst_report", ""),
            technical_report=final_state.get("technical_analyst_report", ""),
            fundamental_report=final_state.get("fundamental_analyst_report", ""),
            market_report=final_state.get("market_analyst_report", ""),
            sector_report=final_state.get("sector_analyst_report", ""),
            charts_data=final_state.get("charts_data"),
            status="success",
        )

    except AgentError as e:
        # AgentErrors are typed and classified
        status_code, error_code = next(
            (v for k, v in _ERROR_MAP.items() if type(e) is k),
            (500, "analysis_failed"),
        )
        logger.error(
            f"Analysis failed | ticker={ticker} | "
            f"error={error_code} | {type(e).__name__}: {e}"
        )
        raise HTTPException(
            status_code=status_code,
            detail={
                "error": error_code,
                "message": e.message,
            },
        )

    except Exception as e:
        logger.exception(f"Unexpected error | ticker={ticker} | error={e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "unexpected_error", "message": str(e)},
        )


# ── Local run ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=False)
