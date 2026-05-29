export interface AnalyseResponse {
  ticker: string;
  news_report: string;
  technical_report: string;
  fundamental_report: string;
  market_report: string;
  sector_report: string;
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

const API_BASE_URL = "http://localhost:8000";

export function normalizeTicker(ticker: string) {
  let cleanTicker = ticker.trim().toUpperCase();
  if (!cleanTicker.endsWith(".NS")) {
    cleanTicker = `${cleanTicker}.NS`;
  }
  return cleanTicker;
}

// ── Error handling ─────────────────────────────────────────────────────────────

interface BackendErrorDetail {
  error?: string;
  message?: string;
}

export class AnalysisError extends Error {
  title: string;

  constructor({ title, message }: { title: string; message: string }) {
    super(message);
    this.name = "AnalysisError";
    this.title = title;
  }
}

/**
 * Map backend structured error responses to user-friendly messages.
 *
 * Backend error codes:
 *   401 → { error: "invalid_api_key" }
 *   429 → { error: "app_rate_limit" } or { error: "llm_rate_limit" }
 *   404 → { error: "ticker_not_found" }
 *   Everything else → 500 internal server error
 */
function buildErrorMessage(status: number, detail: BackendErrorDetail): { title: string; message: string } {
  const errorCode = detail?.error ?? "";
  const serverMsg = detail?.message ?? "";

  // 401 — Invalid API key
  if (status === 401 || errorCode === "invalid_api_key") {
    return {
      title: "INVALID API KEY",
      message: "We couldn't authenticate your request. The Groq API key provided appears to be invalid, expired, or improperly formatted.",
    };
  }

  // 429 — Rate limits
  if (status === 429) {
    if (errorCode === "app_rate_limit") {
      return {
        title: "TOO MANY REQUESTS",
        message: "You've exceeded the maximum number of analysis requests allowed per minute.",
      };
    }
    if (errorCode === "llm_rate_limit") {
      return {
        title: "LLM RATE LIMIT HIT",
        message: "The Groq AI model has temporarily throttled your requests. Free-tier API keys have a limited number of tokens and requests per minute.",
      };
    }
    return {
      title: "RATE LIMIT REACHED",
      message: "Too many requests in a short period. The service needs a moment to recover.",
    };
  }

  // 404 — Ticker not found
  if (status === 404) {
    return {
      title: "TICKER NOT FOUND",
      message: "The ticker symbol you entered wasn't found on the National Stock Exchange (NSE). It may be delisted, misspelled, or not yet listed.",
    };
  }

  // Everything else → internal server error
  return {
    title: "SOMETHING WENT WRONG",
    message: serverMsg || "The analysis server encountered an unexpected error while processing your request. This is usually a temporary issue on our end.",
  };
}

// ── Main analysis function ─────────────────────────────────────────────────────

export async function analyseTicker({
  ticker,
  groqApiKey,
  signal,
}: {
  ticker: string;
  groqApiKey: string;
  signal?: AbortSignal;
}): Promise<AnalyseResponse> {
  const cleanTicker = normalizeTicker(ticker);
  const url = `${API_BASE_URL}/analyze`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (groqApiKey) {
    headers["Groq-API-Key"] = groqApiKey.trim();
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ticker: cleanTicker }),
      signal,
    });
  } catch (fetchErr) {
    if (signal?.aborted) throw fetchErr;
    throw new AnalysisError({
      title: "CONNECTION FAILED",
      message: "Unable to reach the analysis server. The backend may not be running, or your network connection may be interrupted.",
    });
  }

  if (!res.ok) {
    let detail: BackendErrorDetail = {};
    try {
      const errorBody = await res.json();
      // Backend sends { detail: { error, message } }
      detail = errorBody?.detail ?? errorBody ?? {};
    } catch {
      // JSON parse failed — use empty detail
    }
    throw new AnalysisError(buildErrorMessage(res.status, detail));
  }

  const data: AnalyseResponse = await res.json();
  return data;
}

// ── Session cache ──────────────────────────────────────────────────────────────

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
