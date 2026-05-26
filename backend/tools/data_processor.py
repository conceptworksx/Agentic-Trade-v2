from tools.fundamental_tools import process_fundamental_data
from tools.technical_tools import process_technical_data
from tools.sector_tools import get_company_sector
from tools.market_tools import process_market_data
from tools.news_tools import get_company_news
import json


def process_prefetch_result(raw_data: dict) -> dict:
    """
    Process the raw data fetched in the prefetch step to extract relevant information
    for each analyst. Make the raw_bundlle to the structired format expected by the analysts.
    This function serves as a bridge between the raw data collection and the structured analysis stages.
    """
    processed_bundle = {}

    processed_bundle["technical_data"] = process_technical_data(raw_data)

    processed_bundle["fundamental_data"] = process_fundamental_data(raw_data)

    processed_bundle["market_data"] = process_market_data(
        ticker=raw_data.get("ticker"),
        prefetched_indices=raw_data.get("market_indices", {}),
    )

    processed_bundle["news_data"] = {
        "company_news": get_company_news(
            ticker=raw_data.get("ticker"), prefetched_news=raw_data.get("news", [])
        )
    }
    processed_bundle["sector_data"] = get_company_sector(
        ticker=raw_data.get("ticker", ""), prefetched_info=raw_data.get("info", {})
    )  

    # with open("data.json",'w+') as f:
    #     json.dump(processed_bundle,f,indent=2)

    return processed_bundle
