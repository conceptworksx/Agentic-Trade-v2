from graph.state import AgentState
from tools.data_preftech import prefetch_ticker_bundle
from tools.data_processor import process_prefetch_result
from agents.analysis.market_analyst      import MarketAnalyst
from agents.analysis.news_analyst        import NewsAnalyst
from agents.analysis.sector_analyst      import SectorAnalyst
from agents.analysis.technical_analyst   import TechnicalAnalyst
from agents.analysis.fundamental_analyst import FundamentalAnalyst
from core.error import handle_node_errors, validate_state
from core.logging import get_logger

logger = get_logger(__name__)


def make_nodes(groq_api_key: str) -> dict:
    """
    Instantiates all agents with the user's Groq key.
    Returns dict of node functions with agents baked in via closures.
    Key never touches AgentState.
    """

    # Agents instantiated here with key — not at module level
    market_agent      = MarketAnalyst(groq_api_key=groq_api_key)
    fundamental_agent = FundamentalAnalyst(groq_api_key=groq_api_key)
    technical_agent   = TechnicalAnalyst(groq_api_key=groq_api_key)
    news_agent        = NewsAnalyst(groq_api_key=groq_api_key)
    sector_agent      = SectorAnalyst(groq_api_key=groq_api_key)

    # ── Node functions ────────────────────────────────────────────────────

    @handle_node_errors("data_prefetch")
    def run_data_prefetch(state: AgentState) -> dict:
        raw_bundle       = prefetch_ticker_bundle(state["ticker_of_company"])
        processed_bundle = process_prefetch_result(raw_bundle)
        charts_data      = processed_bundle.get("charts_data", {})
        return {"data_bundle": processed_bundle, "charts_data": charts_data}

    @handle_node_errors("market_analyst")
    def run_market_analyst(state: AgentState) -> dict:
        return {"market_analyst_report": market_agent.run(state)}

    @handle_node_errors("fundamental_analyst")
    def run_fundamental_analyst(state: AgentState) -> dict:
        return {"fundamental_analyst_report": fundamental_agent.run(state)}

    @handle_node_errors("technical_analyst")
    def run_technical_analyst(state: AgentState) -> dict:
        return {"technical_analyst_report": technical_agent.run(state)}

    @handle_node_errors("news_analyst")
    def run_news_analyst(state: AgentState) -> dict:
        return {"news_analyst_report": news_agent.run(state)}

    @handle_node_errors("sector_analyst")
    def run_sector_analyst(state: AgentState) -> dict:
        return {"sector_analyst_report": sector_agent.run(state)}

    @handle_node_errors("aggregator")
    def run_aggregator(state: AgentState) -> dict:
        validate_state(
            state,
            "market_analyst_report",
            "fundamental_analyst_report",
            "technical_analyst_report",
            "news_analyst_report",
            "sector_analyst_report",
        )
        final_report = {
            "input"    : {"ticker": state.get("ticker_of_company")},
            "analysis" : {
                "market"      : state.get("market_analyst_report"),
                "fundamental" : state.get("fundamental_analyst_report"),
                "technical"   : state.get("technical_analyst_report"),
                "news"        : state.get("news_analyst_report"),
                "sector"      : state.get("sector_analyst_report"),
            },
        }
        return {"final_report": final_report}

    return {
        "data_prefetch"      : run_data_prefetch,
        "market_analyst"     : run_market_analyst,
        "fundamental_analyst": run_fundamental_analyst,
        "technical_analyst"  : run_technical_analyst,
        "news_analyst"       : run_news_analyst,
        "sector_analyst"     : run_sector_analyst,
        "aggregator"         : run_aggregator,
    }


