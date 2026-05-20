import json

from langchain_core.messages import HumanMessage
from langchain_core.runnables import (
    RunnableLambda,
    RunnableBranch,
)
from langchain_core.output_parsers import StrOutputParser

from agents.base_agent import BaseAgent


def _extract_market_section(data: dict, key: str):

    section = data.get("market_data", {}).get("data", {}).get(key, {})

    if section.get("status") == "success":
        return json.dumps(section.get("data", {}), indent=2)

    return "Data not available"


def _build_messages(data: dict) -> dict:

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

    def __init__(self):

        super().__init__()

        success_chain = (
            RunnableLambda(_build_messages) | self.prompt | self.llm | StrOutputParser()
        )

        error_chain = RunnableLambda(
            lambda x: (
                "Failed to fetch market data:\n"
                f"{x.get('market_data', {}).get('error', 'unknown error')}"
            )
        )

        branch = RunnableBranch(
            (
                lambda x: x.get("market_data", {}).get("status") == "success",
                success_chain,
            ),
            error_chain,
        )

        self.chain = branch

    def run(self, state) -> str:

        return self.chain.invoke(
            {
                "ticker": state["ticker_of_company"],
                "market_data": state.get("data_bundle", {}).get("market_data"),
            }
        )
