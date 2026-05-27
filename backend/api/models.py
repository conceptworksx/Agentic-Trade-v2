from pydantic import BaseModel


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
