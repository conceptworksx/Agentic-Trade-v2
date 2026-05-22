import json

from langchain_core.messages import HumanMessage
from langchain_core.runnables import (
    RunnableLambda,
    RunnableBranch,
)
from langchain_core.output_parsers import StrOutputParser

from agents.base_agent import BaseAgent
from core.logging import get_logger

logger = get_logger(__name__)


def _extract_market_section(data: dict, key: str):
    """
    Helper function to extract specific market data sections for the Market Analyst stage.
    """

    section = data.get("market_data", {}).get("data", {}).get(key, {})

    if section.get("status") == "success":
        return json.dumps(section.get("data", {}), indent=2)

    return "Data not available"


def _build_messages(data: dict) -> dict:
    """
    Format the input for the Market Analyst stage. Combines all relevant market data into a single message.
    """

    content = f"""
Analyze the Indian and Global market metrics:

S&P 500 Index:
{_extract_market_section(data, 'GSPC')}

NASDAQ Composite Index:
{_extract_market_section(data, 'IXIC')}

Volatility Index (VIX):
{_extract_market_section(data, 'VIX')}

NIFTY 50 Index:
{_extract_market_section(data, 'NSEI')}

SENSEX:
{_extract_market_section(data, 'BSESN')}
"""

    return {"messages": [HumanMessage(content=content.strip())]}


class MarketAnalyst(BaseAgent):

    prompt_path = "prompts/market_analyst_prompt.yaml"
    
    def __init__(self, groq_api_key: str):

        super().__init__(groq_api_key)

        # Define the success and error chains for the Market Analyst
        success_chain = (
            RunnableLambda(_build_messages) | self.prompt | self.llm | StrOutputParser()
        )

        error_chain = RunnableLambda(
            lambda x: (
                "Failed to fetch market data:\n"
                f"{x.get('market_data', {}).get('error', 'unknown error')}"
            )
        )

        # Apply branching logic to handle success and failure scenarios based on the presence of market data
        self.chain = RunnableBranch(
            (
                lambda x: x.get("market_data", {}).get("status") == "success",
                success_chain,
            ),
            error_chain,
        )

    def run(self, state) -> str:
        """Invoke the Market Analyst chain with the relevant portion of the state."""

        logger.info(
            f"Running market analyst pipeline | ticker={state['ticker_of_company']}"
        )
        return self.chain.invoke(
            {
                "ticker": state["ticker_of_company"],
                "market_data": state.get("data_bundle", {}).get("market_data"),
            }
        )
