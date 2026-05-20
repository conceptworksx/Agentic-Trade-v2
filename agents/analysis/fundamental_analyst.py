import json
from langchain_core.messages import HumanMessage
from langchain_core.runnables import (
    RunnableLambda,
    RunnableBranch,
)
from langchain_core.output_parsers import StrOutputParser

from agents.base_agent import BaseAgent


def _build_messages(data: dict) -> dict:

    fund = data.get("fundamental_data", {})

    income = fund.get("income_stmt", {}).get("income_statement", {})
    balance = fund.get("balance_sheet", {}).get("balance_sheet", {})
    cash = fund.get("cash_flow", {}).get("cash_flow", {})
    fundamentals = fund.get("fundamentals", {}).get("fundamentals", {})
    eps_trend = fund.get("eps_trend", {}).get("eps_trend", {})
    valuation = fund.get("valuation", {}).get("valuation", {})
    growth = fund.get("growth", {}).get("growth", {})

    content = f"""
Analyze the financial fundamentals of the company {data.get('ticker')}:

INCOME STATEMENT:
{json.dumps(income, indent=2)}

BALANCE SHEET:
{json.dumps(balance, indent=2)}

CASH FLOW:
{json.dumps(cash, indent=2)}

FUNDAMENTALS:
{json.dumps(fundamentals, indent=2)}

EPS TREND:
{json.dumps(eps_trend, indent=2)}

VALUATION:
{json.dumps(valuation, indent=2)}

GROWTH:
{json.dumps(growth, indent=2)}
"""

    return {"messages": [HumanMessage(content=content)]}


class FundamentalAnalyst(BaseAgent):

    prompt_path = "prompts/fundamental_analyst_prompt.yaml"

    def __init__(self):

        super().__init__()

        success_chain = (
            RunnableLambda(_build_messages) | self.prompt | self.llm | StrOutputParser()
        )

        error_chain = RunnableLambda(
            lambda x: f"Failed to fetch fundamental data for "
            f"{x['ticker']}: {x['error']}"
        )

        branch = RunnableBranch(
            (
                lambda x: (x.get("fundamental_data") or {}).get("status") == "success",
                success_chain,
            ),
            error_chain,
        )

        self.chain = branch

    def run(self, state):

        return self.chain.invoke(
            {
                "ticker": state["ticker_of_company"],
                "fundamental_data": state.get("data_bundle", {}).get(
                    "fundamental_data"
                ),
            }
        )
