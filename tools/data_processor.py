from tools.fundamental_tools import process_fundamental_data
from tools.technical_tools import process_technical_data
from tools.sector_tools import get_company_sector
from tools.market_tools import process_market_data
from tools.news_tools import get_company_news
import json


def process_prefetch_result(raw_data: dict) -> dict:
    """
    Process the raw data fetched in the prefetch step to extract relevant information
    for each analyst. This function can be expanded to include more complex processing
    logic as needed.
    """
    print(raw_data)
    processed_data = {}

    processed_data["technical_data"] = process_technical_data(raw_data)
    processed_data["fundamental_data"] = process_fundamental_data(raw_data)
    processed_data["market_data"] = process_market_data(
        raw_data.get("ticker"), prefetched_indices=raw_data.get("market_indices", {})
    )
    processed_data["news_data"] = {
        "company_news": get_company_news(
            raw_data.get("ticker"), prefetched_news=raw_data.get("news", [])
        )
    }
    processed_data["sector_data"] = get_company_sector(
        raw_data.get("ticker", ""), prefetched_info=raw_data.get("info", {})
    )

    with open("processed_data.json", "w") as f:
        json.dump(processed_data, f, indent=4)

    return processed_data
