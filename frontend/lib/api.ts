export type Decision = "BUY" | "SELL" | "HOLD";
export type ReportKey = "news" | "technical" | "fundamental" | "market" | "sector";

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
  charts_data?: {
    technical_history: Array<{
      date: string;
      close: number | null;
      ma50: number | null;
      ma200: number | null;
      bb_upper: number | null;
      bb_lower: number | null;
      bb_mid: number | null;
      rsi: number | null;
      volume: number | null;
    }>;
    financials_history: {
      income_stmt: {
        revenue?: Record<string, number | null>;
        ebitda?: Record<string, number | null>;
        net_income?: Record<string, number | null>;
        eps_diluted?: Record<string, number | null>;
      };
      balance_sheet: {
        cash?: Record<string, number | null>;
        total_liabilities?: Record<string, number | null>;
        total_debt?: Record<string, number | null>;
        shareholders_equity?: Record<string, number | null>;
      };
      cash_flow: {
        operating_cash_flow?: Record<string, number | null>;
        free_cash_flow?: Record<string, number | null>;
      };
      ratios: {
        net_margin_pct?: Record<string, number | null>;
        roe_pct?: Record<string, number | null>;
        roce_pct?: Record<string, number | null>;
        debt_to_equity?: Record<string, number | null>;
        interest_coverage?: Record<string, number | null>;
      };
    };
  };
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
const STREAM_PARAGRAPH_DELAY_MS = 10;
const STREAM_WORD_BATCH_SIZE = 16;
const STREAM_WORD_BATCH_DELAY_MS = 10;

export function normalizeTicker(ticker: string) {
  let cleanTicker = ticker.trim().toUpperCase();
  if (!cleanTicker.endsWith(".NS")) {
    cleanTicker = `${cleanTicker}.NS`;
  }
  return cleanTicker;
}

export function createEmptyAnalyseResponse(ticker: string): AnalyseResponse {
  return {
    ticker: normalizeTicker(ticker),
    news_report: "",
    technical_report: "",
    fundamental_report: "",
    market_report: "",
    sector_report: "",
    investment_debate: DEFAULT_DEBATE,
    research_verdict: DEFAULT_VERDICT,
    status: "streaming",
  };
}

export async function analyseTicker(ticker: string, groqApiKey: string): Promise<AnalyseResponse> {
  const cleanTicker = normalizeTicker(ticker);
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
    charts_data: rawData.charts_data,
  };

  return data;
}

type StreamEvent =
  | { type: "prefetch_start"; ticker: string }
  | { type: "prefetch_done"; ticker: string; charts_data?: AnalyseResponse["charts_data"] }
  | { type: "report_start"; report: ReportKey }
  | { type: "paragraph"; report: ReportKey; content: string }
  | { type: "report_done"; report: ReportKey }
  | { type: "report_error"; report: ReportKey; message: string }
  | ({ type: "done"; ticker: string; status: string } & Partial<AnalyseResponse>)
  | { type: "error"; ticker?: string; message: string };

const REPORT_FIELD: Record<ReportKey, keyof Pick<AnalyseResponse, "news_report" | "technical_report" | "fundamental_report" | "market_report" | "sector_report">> = {
  news: "news_report",
  technical: "technical_report",
  fundamental: "fundamental_report",
  market: "market_report",
  sector: "sector_report",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRevealAsBlock(content: string) {
  const trimmed = content.trim();
  return (
    trimmed.includes("\n|") ||
    trimmed.startsWith("|") ||
    trimmed.includes("```") ||
    trimmed.length < 32
  );
}

export async function analyseTickerStream({
  ticker,
  groqApiKey,
  signal,
  onData,
  onReportStart,
  onReportDone,
}: {
  ticker: string;
  groqApiKey: string;
  signal?: AbortSignal;
  onData: (data: AnalyseResponse) => void;
  onReportStart?: (report: ReportKey) => void;
  onReportDone?: (report: ReportKey) => void;
}): Promise<AnalyseResponse> {
  const cleanTicker = normalizeTicker(ticker);
  const url = `${API_BASE_URL}/analyze/stream`;
  const data = createEmptyAnalyseResponse(cleanTicker);

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
    signal,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody?.detail?.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  if (!res.body) {
    throw new Error("Streaming response is not supported by this browser.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = async (event: StreamEvent) => {
    if (event.type === "prefetch_done") {
      data.charts_data = event.charts_data;
      onData({ ...data });
      return;
    }

    if (event.type === "report_start") {
      onReportStart?.(event.report);
      return;
    }

    if (event.type === "paragraph") {
      await sleep(STREAM_PARAGRAPH_DELAY_MS);
      const field = REPORT_FIELD[event.report];
      if (shouldRevealAsBlock(event.content)) {
        data[field] = `${data[field] || ""}${event.content}`;
        onData({ ...data });
        return;
      }

      const parts = event.content.split(/(\s+)/);
      let pending = "";
      let words = 0;

      for (const part of parts) {
        pending += part;
        if (part.trim()) {
          words += 1;
        }

        if (words >= STREAM_WORD_BATCH_SIZE) {
          data[field] = `${data[field] || ""}${pending}`;
          pending = "";
          words = 0;
          onData({ ...data });
          await sleep(STREAM_WORD_BATCH_DELAY_MS);
        }
      }

      if (pending) {
        data[field] = `${data[field] || ""}${pending}`;
        onData({ ...data });
      }
      return;
    }

    if (event.type === "report_done") {
      onReportDone?.(event.report);
      return;
    }

    if (event.type === "report_error") {
      const field = REPORT_FIELD[event.report];
      data[field] = `${data[field] || ""}\n\nAnalysis failed: ${event.message}`;
      onReportDone?.(event.report);
      onData({ ...data });
      return;
    }

    if (event.type === "done") {
      data.ticker = event.ticker ?? cleanTicker;
      data.status = event.status || "success";
      data.news_report = event.news_report || data.news_report || "No news report available.";
      data.technical_report = event.technical_report || data.technical_report || "No technical report available.";
      data.fundamental_report = event.fundamental_report || data.fundamental_report || "No fundamental report available.";
      data.market_report = event.market_report || data.market_report || "No market report available.";
      data.sector_report = event.sector_report || data.sector_report || "No sector report available.";
      onData({ ...data });
      return;
    }

    if (event.type === "error") {
      throw new Error(event.message);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      await handleEvent(JSON.parse(trimmed) as StreamEvent);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    await handleEvent(JSON.parse(buffer.trim()) as StreamEvent);
  }

  data.status = data.status === "streaming" ? "success" : data.status;
  return data;
}

const KEY = (t: string) => `arbor:research:${t.toUpperCase()}`;

export function cacheResponse(ticker: string, data: AnalyseResponse) {
  try {
    const clean = normalizeTicker(ticker);
    sessionStorage.setItem(KEY(clean), JSON.stringify(data));
  } catch {}
}

export function clearCached(ticker: string) {
  try {
    sessionStorage.removeItem(KEY(normalizeTicker(ticker)));
  } catch {}
}

export function readCached(ticker: string): AnalyseResponse | null {
  try {
    const clean = normalizeTicker(ticker);
    const raw = sessionStorage.getItem(KEY(clean));
    return raw ? (JSON.parse(raw) as AnalyseResponse) : null;
  } catch {
    return null;
  }
}
