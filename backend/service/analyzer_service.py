from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from typing import Any

from core.logging import get_logger
from agents.analysis.market_analyst import MarketAnalyst
from agents.analysis.news_analyst import NewsAnalyst
from agents.analysis.sector_analyst import SectorAnalyst
from agents.analysis.technical_analyst import TechnicalAnalyst
from agents.analysis.fundamental_analyst import FundamentalAnalyst
from tools.data_preftech import prefetch_ticker_bundle
from tools.data_processor import process_prefetch_result

from api.models import REPORT_FIELDS
from api.utils import ndjson, paragraph_chunks

logger = get_logger(__name__)


def build_charts_data(data_bundle: dict) -> dict:
    technical_data = data_bundle.get("technical_data", {})
    fundamental_data = data_bundle.get("fundamental_data", {})

    return {
        "technical_history": technical_data.get("history", []),
        "financials_history": {
            "income_stmt": fundamental_data.get("income_stmt", {}).get(
                "income_statement", {}
            ),
            "balance_sheet": fundamental_data.get("balance_sheet", {}).get(
                "balance_sheet", {}
            ),
            "cash_flow": fundamental_data.get("cash_flow", {}).get("cash_flow", {}),
            "ratios": fundamental_data.get("fundamentals", {}).get("fundamentals", {}),
        },
    }


def stream_analyze_events(ticker: str, groq_api_key: str):
    reports: dict[str, str] = {field: "" for field in REPORT_FIELDS.values()}

    try:
        yield ndjson({"type": "prefetch_start", "ticker": ticker})
        raw_bundle = prefetch_ticker_bundle(ticker)
        data_bundle = process_prefetch_result(raw_bundle)
        state = {"ticker_of_company": ticker, "data_bundle": data_bundle}

        yield ndjson(
            {
                "type": "prefetch_done",
                "ticker": ticker,
                "charts_data": build_charts_data(data_bundle),
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
                for chunk in paragraph_chunks(agent.stream(state)):
                    events.put(
                        {"type": "paragraph", "report": report, "content": chunk}
                    )
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

                yield ndjson(event)

            for future in futures:
                future.result()

        yield ndjson(
            {
                "type": "done",
                "ticker": ticker,
                "status": "success",
                **reports,
            }
        )
    except Exception as exc:
        logger.exception(f"Streaming analysis failed | ticker={ticker} | error={exc}")
        yield ndjson(
            {
                "type": "error",
                "ticker": ticker,
                "message": str(exc),
            }
        )
