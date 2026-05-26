from langgraph.graph import END, START, StateGraph
from graph.state import AgentState
from core.logging import get_logger
from graph.nodes import make_nodes

logger = get_logger(__name__)


def build_graph(groq_api_key: str):
    """
    Built per request with groq_api_key baked into node closures.
    Key never enters AgentState — not visible in LangSmith traces.
    """

    nodes = make_nodes(groq_api_key)

    work_flow = StateGraph(AgentState)

    work_flow.add_node("data_prefetch", nodes["data_prefetch"])
    work_flow.add_node("market_analyst", nodes["market_analyst"])
    work_flow.add_node("technical_analyst", nodes["technical_analyst"])
    work_flow.add_node("news_analyst", nodes["news_analyst"])
    work_flow.add_node("fundamental_analyst", nodes["fundamental_analyst"])
    work_flow.add_node("sector_analyst", nodes["sector_analyst"])
    work_flow.add_node("aggregator", nodes["aggregator"])

    work_flow.add_edge(START, "data_prefetch")
    work_flow.add_edge("data_prefetch", "market_analyst")
    work_flow.add_edge("data_prefetch", "fundamental_analyst")
    work_flow.add_edge("data_prefetch", "technical_analyst")
    work_flow.add_edge("data_prefetch", "news_analyst")
    work_flow.add_edge("data_prefetch", "sector_analyst")

    work_flow.add_edge("market_analyst", "aggregator")
    work_flow.add_edge("fundamental_analyst", "aggregator")
    work_flow.add_edge("technical_analyst", "aggregator")
    work_flow.add_edge("news_analyst", "aggregator")
    work_flow.add_edge("sector_analyst", "aggregator")
    work_flow.add_edge("aggregator", END)

    return work_flow.compile(debug=False)
