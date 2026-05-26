import json
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableParallel, RunnableLambda
from langchain_core.output_parsers import StrOutputParser

from agents.base_agent import BaseAgent
from tools.news_tools import (
    get_indian_market_news,
    get_global_market_news,
)
from core.logging import get_logger

logger = get_logger(__name__)


def _build_messages(data: dict) -> dict:
    """
    Format the input for the News Analyst stage. Combines all relevant news data into a single message.
    """
    content = f"""
Analyze the news sentiment for {data['ticker']}.

COMPANY NEWS:
{json.dumps(data['company_news'], indent=2)}

INDIAN MARKET NEWS:
{json.dumps(data['indian_news'], indent=2)}

GLOBAL MARKET NEWS:
{json.dumps(data['global_news'], indent=2)}
"""
    return {"messages": [HumanMessage(content=content)]}


class NewsAnalyst(BaseAgent):

    prompt_path = "prompts/news_analyst_prompt.yaml"

    def __init__(self, groq_api_key: str):

        super().__init__(groq_api_key)

        # Define a parallel runnable to fetch all relevant news data simultaneously
        news_fetcher = RunnableParallel(
            {
                "ticker": RunnableLambda(lambda x: x["ticker"]),
                "company_news": RunnableLambda(lambda x: x.get("company_news")),
                "indian_news": RunnableLambda(lambda _: get_indian_market_news()),
                "global_news": RunnableLambda(lambda _: get_global_market_news()),
            }
        )

        # Define the chain to process the news data and generate the report
        self.chain = (
            news_fetcher
            | RunnableLambda(_build_messages)
            | self.prompt
            | self.llm
            | StrOutputParser()
        )

    def run(self, state) -> str:
        """Invoke the News Analyst chain with the relevant portion of the state."""

        logger.info(
            f"Running news analyst pipeline | ticker={state['ticker_of_company']}"
        )
        return self.chain.invoke(
            {
                "ticker": state["ticker_of_company"],
                "company_news": state.get("data_bundle", {}).get("news_data"),
            }
        )

    def stream(self, state):
        """Stream the News Analyst chain output."""

        logger.info(
            f"Streaming news analyst pipeline | ticker={state['ticker_of_company']}"
        )
        yield from self.chain.stream(
            {
                "ticker": state["ticker_of_company"],
                "company_news": state.get("data_bundle", {}).get("news_data"),
            }
        )
