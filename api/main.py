# api/main.py

from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel,field_validator
import uvicorn
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from api.validators import (
    validate_ticker_format,
    validate_ticker_exists,
    validate_api_keys,
    _refresh_cache_if_stale,
)
from graph.builder import build_graph
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
from queue import Queue
from typing import Any

from agents.analysis.market_analyst      import MarketAnalyst
from agents.analysis.news_analyst        import NewsAnalyst
from agents.analysis.sector_analyst      import SectorAnalyst
from agents.analysis.technical_analyst   import TechnicalAnalyst
from agents.analysis.fundamental_analyst import FundamentalAnalyst
from core.logging import setup_logging, get_logger
from tools.data_preftech import prefetch_ticker_bundle
from tools.data_processor import process_prefetch_result

setup_logging()
logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Preload NSE ticker cache at startup.
    """
    logger.info("Preloading NSE ticker cache...")
    _refresh_cache_if_stale()
    logger.info("NSE ticker cache ready")
    yield


# FastAPI App
app = FastAPI(
    title="Indian Trading Agent API",
    description="Multi-agent stock analysis for Indian markets",
    version="1.0.0",
    lifespan=lifespan,
)


# Rate Limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later for frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request / Response Model
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
    charts_data: dict | None = None


REPORT_FIELDS = {
    "news": "news_report",
    "technical": "technical_report",
    "fundamental": "fundamental_report",
    "market": "market_report",
    "sector": "sector_report",
}


def _build_charts_data(data_bundle: dict) -> dict:
    technical_data = data_bundle.get("technical_data", {})
    fundamental_data = data_bundle.get("fundamental_data", {})

    return {
        "technical_history": technical_data.get("history", []),
        "financials_history": {
            "income_stmt": fundamental_data.get("income_stmt", {}).get("income_statement", {}),
            "balance_sheet": fundamental_data.get("balance_sheet", {}).get("balance_sheet", {}),
            "cash_flow": fundamental_data.get("cash_flow", {}).get("cash_flow", {}),
            "ratios": fundamental_data.get("fundamentals", {}).get("fundamentals", {}),
        }
    }


def _ndjson(event: dict[str, Any]) -> str:
    return json.dumps(event, ensure_ascii=False, default=str) + "\n"


def _paragraph_chunks(token_iter):
    """
    Convert token streams into stable markdown chunks.
    Paragraphs, markdown tables, and lists are emitted after a blank line so
    the frontend does not render half-built blocks row-by-row.
    """
    buffer = ""

    for token in token_iter:
        if not token:
            continue
        buffer += str(token)

        while "\n\n" in buffer:
            chunk, buffer = buffer.split("\n\n", 1)
            chunk = chunk.strip()
            if chunk:
                yield chunk + "\n\n"

    tail = buffer.strip()
    if tail:
        yield tail


def _stream_analyze_events(ticker: str, groq_api_key: str):
    reports: dict[str, str] = {field: "" for field in REPORT_FIELDS.values()}

    try:
        yield _ndjson({"type": "prefetch_start", "ticker": ticker})
        raw_bundle = prefetch_ticker_bundle(ticker)
        data_bundle = process_prefetch_result(raw_bundle)
        state = {"ticker_of_company": ticker, "data_bundle": data_bundle}

        yield _ndjson(
            {
                "type": "prefetch_done",
                "ticker": ticker,
                "charts_data": _build_charts_data(data_bundle),
            }
        )

        agents = {
            "news": NewsAnalyst(groq_api_key=groq_api_key),
            "technical": TechnicalAnalyst(groq_api_key=groq_api_key),
            "fundamental": FundamentalAnalyst(groq_api_key=groq_api_key),
            "market": MarketAnalyst(groq_api_key=groq_api_key),
            "sector": SectorAnalyst(groq_api_key=groq_api_key),
        }

        events: Queue[dict[str, Any]] = Queue()

        def run_report(report: str, agent):
            try:
                events.put({"type": "report_start", "report": report})
                for chunk in _paragraph_chunks(agent.stream(state)):
                    events.put({"type": "paragraph", "report": report, "content": chunk})
                events.put({"type": "report_done", "report": report})
            except Exception as exc:
                logger.exception(
                    f"Streaming report failed | ticker={ticker} | report={report} | error={exc}"
                )
                events.put(
                    {
                        "type": "report_error",
                        "report": report,
                        "message": str(exc),
                    }
                )

        with ThreadPoolExecutor(max_workers=len(agents)) as executor:
            futures = [
                executor.submit(run_report, report, agent)
                for report, agent in agents.items()
            ]
            finished_reports = 0
            expected_reports = len(agents)

            while finished_reports < expected_reports:
                event = events.get()
                if event["type"] == "paragraph":
                    field = REPORT_FIELDS[event["report"]]
                    reports[field] += event["content"]
                elif event["type"] in {"report_done", "report_error"}:
                    finished_reports += 1

                yield _ndjson(event)

            for future in futures:
                future.result()

        yield _ndjson(
            {
                "type": "done",
                "ticker": ticker,
                "status": "success",
                **reports,
            }
        )
    except Exception as exc:
        logger.exception(f"Streaming analysis failed | ticker={ticker} | error={exc}")
        yield _ndjson(
            {
                "type": "error",
                "ticker": ticker,
                "message": str(exc),
            }
        )


# Routes
@app.get("/health")
def health_check():
    """
    Health check endpoint.
    """
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit("3/minute")
async def analyze(request: Request, body: AnalyzeRequest, groq_api_key: str = Header(..., alias="Groq-API-Key")):
    
    logger.info("Testing key scrubber: gsk_1234567890abcdefghijklmnopqrstuvwxyz")
    ticker = body.ticker.strip().upper()
    logger.info(f"Analyze request received | ticker={ticker}")
    
    is_valid_key, key_error = validate_api_keys(groq_api_key=groq_api_key)

    # validate key format
    if not is_valid_key:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_api_key", "message": key_error}
        )
    
    is_valid_format, format_error = validate_ticker_format(ticker)
    
    # validate ticker format
    if not is_valid_format:
        logger.warning(f"Invalid ticker format received | ticker={ticker}")
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_ticker_format",
                "message": format_error,
                "hint": ("Use NSE format like 'RELIANCE.NS'"),
            },
        )


    # validate ticker exists
    is_valid_ticker, ticker_error = validate_ticker_exists(ticker)

    if not is_valid_ticker:
        logger.warning(f"Ticker not found | ticker={ticker}")
        raise HTTPException(
            status_code=404,
            detail={
                "error": "ticker_not_found",
                "message": ticker_error,
            },
        )

    # Run LangGraph workflow 
    try:
        logger.info(f"Starting graph execution | ticker={ticker}")
        # Graph built per request
        graph = build_graph(groq_api_key=groq_api_key)
        final_state = await asyncio.to_thread(
            graph.invoke, {"ticker_of_company": ticker}
        )
        logger.info(f"Graph execution completed | ticker={ticker}")

        charts_data = _build_charts_data(final_state.get("data_bundle", {}))

        return AnalyzeResponse(
            ticker=ticker,
            news_report=final_state.get("news_analyst_report", ""),
            technical_report=final_state.get("technical_analyst_report", ""),
            fundamental_report=final_state.get("fundamental_analyst_report", ""),
            market_report=final_state.get("market_analyst_report", ""),
            sector_report=final_state.get("sector_analyst_report", ""),
            status="success",
            charts_data=charts_data,
        )

    except Exception as e:
        logger.exception(f"Analysis failed | ticker={ticker} | error={e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "analysis_failed",
                "message": str(e),
            },
        )


@app.post("/analyze/stream")
@limiter.limit("3/minute")
async def analyze_stream(request: Request, body: AnalyzeRequest, groq_api_key: str = Header(..., alias="Groq-API-Key")):
    ticker = body.ticker.strip().upper()
    logger.info(f"Streaming analyze request received | ticker={ticker}")

    is_valid_key, key_error = validate_api_keys(groq_api_key=groq_api_key)
    if not is_valid_key:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_api_key", "message": key_error}
        )

    is_valid_format, format_error = validate_ticker_format(ticker)
    if not is_valid_format:
        logger.warning(f"Invalid ticker format received | ticker={ticker}")
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_ticker_format",
                "message": format_error,
                "hint": ("Use NSE format like 'RELIANCE.NS'"),
            },
        )

    is_valid_ticker, ticker_error = validate_ticker_exists(ticker)
    if not is_valid_ticker:
        logger.warning(f"Ticker not found | ticker={ticker}")
        raise HTTPException(
            status_code=404,
            detail={
                "error": "ticker_not_found",
                "message": ticker_error,
            },
        )

    return StreamingResponse(
        _stream_analyze_events(ticker=ticker, groq_api_key=groq_api_key),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# Local Run
if __name__ == "__main__":

    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )
