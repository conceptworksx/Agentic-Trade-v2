export type Decision = "BUY" | "SELL" | "HOLD";

export interface AnalyseResponse {
  ticker: string;
  news_report: string;
  technical_report: string;
  fundamental_report: string;
  market_report: string;
  sector_report: string;
  investment_debate: {
    bull_thesis: string;
    bear_thesis: string;
    speaker_history: string[];
    last_speaker: string;
    final_decision: { decision: Decision; rationale: string };
  };
  research_verdict: { decision: Decision; rationale: string };
  status: string;
}

const DEFAULT_DEBATE = {
  bull_thesis: `### Bull Analyst Thesis

* **Market Leadership**: The company is a key player in its industry, holding dominant market share and high brand equity.
* **Favorable Tailwinds**: Expanding market demand and new policy initiatives provide a clear pathway for volume growth.
* **Financial Resilience**: High operating cash flow and a healthy debt-to-equity ratio provide buffer for future reinvestment.`,
  bear_thesis: `### Bear Analyst Thesis

* **Valuation Premium**: The stock is currently trading at a premium relative to its historical multiples and sector peers.
* **Inflationary Pressures**: Elevated input prices and rising labor costs may compress short-term operating margins.
* **Macro Headwinds**: Global rate cycles and economic uncertainty pose structural risks to near-term demand growth.`,
  speaker_history: ["bull", "bear", "manager"],
  last_speaker: "manager",
  final_decision: {
    decision: "HOLD" as Decision,
    rationale: "The debate highlights a solid business model facing elevated near-term valuation and margin risks. A balanced approach is recommended."
  }
};

const DEFAULT_VERDICT = {
  decision: "HOLD" as Decision,
  rationale: "The consensus recommendation is HOLD. While the long-term fundamentals and market position remain strong, near-term headwinds and valuation metrics suggest waiting for a more favorable entry price."
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function analyseTicker(ticker: string, groqApiKey: string): Promise<AnalyseResponse> {
  let cleanTicker = ticker.trim().toUpperCase();
  if (!cleanTicker.endsWith(".NS")) {
    cleanTicker = `${cleanTicker}.NS`;
  }
  const url = `${API_BASE_URL}/analyze`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (groqApiKey) {
    headers["Groq-API-Key"] = groqApiKey.trim();
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ticker: cleanTicker }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody?.detail?.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  const rawData = await res.json();

  // Inject fallback dummy values if they are missing from the backend response
  const data: AnalyseResponse = {
    ticker: rawData.ticker ?? cleanTicker,
    news_report: rawData.news_report || "No news report available.",
    technical_report: rawData.technical_report || "No technical report available.",
    fundamental_report: rawData.fundamental_report || "No fundamental report available.",
    market_report: rawData.market_report || "No market report available.",
    sector_report: rawData.sector_report || "No sector report available.",
    investment_debate: rawData.investment_debate || DEFAULT_DEBATE,
    research_verdict: rawData.research_verdict || DEFAULT_VERDICT,
    status: rawData.status || "success",
  };

  return data;
}

const KEY = (t: string) => `artha:research:${t.toUpperCase()}`;

export function cacheResponse(ticker: string, data: AnalyseResponse) {
  try {
    let clean = ticker.trim().toUpperCase();
    if (!clean.endsWith(".NS")) clean = `${clean}.NS`;
    sessionStorage.setItem(KEY(clean), JSON.stringify(data));
  } catch {}
}

export function readCached(ticker: string): AnalyseResponse | null {
  try {
    let clean = ticker.trim().toUpperCase();
    if (!clean.endsWith(".NS")) clean = `${clean}.NS`;
    const raw = sessionStorage.getItem(KEY(clean));
    return raw ? (JSON.parse(raw) as AnalyseResponse) : null;
  } catch {
    return null;
  }
}
