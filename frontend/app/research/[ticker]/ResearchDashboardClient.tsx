"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  analyseTickerStream,
  cacheResponse,
  createEmptyAnalyseResponse,
  readCached,
  type AnalyseResponse,
  type ReportKey,
} from "@/lib/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Sidebar, type ViewKey } from "@/components/Sidebar";
import { ReportView } from "@/components/ReportView";
import { DebateRoom } from "@/components/DebateRoom";
import { decisionColor } from "@/components/VerdictBadge";
import { TechnicalChart } from "@/components/TechnicalChart";
import { FundamentalChart } from "@/components/FundamentalChart";

export default function ResearchDashboardClient({ ticker }: { ticker: string }) {
  const router = useRouter();
  const [data, setData] = useState<AnalyseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewKey>("technical");
  const [streamingReports, setStreamingReports] = useState<Record<ReportKey, boolean>>({
    news: false,
    technical: false,
    fundamental: false,
    market: false,
    sector: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCached(ticker);
    if (cached) {
      setData(cached);
      return;
    }

    const groqApiKey = localStorage.getItem("groq_api_key") || "";
    setData(createEmptyAnalyseResponse(ticker));

    analyseTickerStream({
      ticker,
      groqApiKey,
      signal: controller.signal,
      onData: setData,
      onReportStart: (report) =>
        setStreamingReports((prev) => ({ ...prev, [report]: true })),
      onReportDone: (report) =>
        setStreamingReports((prev) => ({ ...prev, [report]: false })),
    })
      .then((d) => {
        cacheResponse(ticker, d);
        setData(d);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load analysis");
      });

    return () => {
      controller.abort();
    };
  }, [ticker]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-[11px] tracking-wider text-[var(--label)]">
            ANALYSIS FAILED
          </p>
          <p className="mt-3 text-[14px] text-[var(--foreground)]">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 h-10 border border-[var(--border)] bg-white px-4 font-mono text-[12px] hover:border-[var(--foreground)] rounded-lg shadow-sm transition-all hover:bg-zinc-50"
          >
            ← New Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <LoadingScreen ticker={ticker} />;

  const isError = data.status && !["success", "streaming"].includes(data.status);

  return (
    <div className="flex h-screen flex-col">
      {/* Navbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-white px-5">
        <div className="font-mono text-[13px] tracking-wider text-[var(--foreground)]">
          ARTHA ANALYTICS
        </div>
        <div className="font-mono text-[13px] text-[var(--muted-foreground)]">
          {data.ticker.split(".")[0].toUpperCase()}.NS · NSE
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-mono text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            ← New Analysis
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar active={view} onSelect={setView} />

        <main className="flex-1 overflow-y-auto bg-[var(--background)] p-8">
          {isError ? (
            <div className="mx-auto max-w-[920px] border border-[var(--sell)] bg-white p-6 rounded-xl shadow-sm">
              <p className="font-mono text-[11px] tracking-wider text-[var(--sell)]">
                STATUS: {data.status}
              </p>
              <p className="mt-2 text-[14px] text-[var(--foreground)]">
                The backend returned a non-success status. Reports may be
                incomplete.
              </p>
            </div>
          ) : (
            <ViewSwitch view={view} data={data} streamingReports={streamingReports} />
          )}
        </main>
      </div>
    </div>
  );
}

function ViewSwitch({
  view,
  data,
  streamingReports,
}: {
  view: ViewKey;
  data: AnalyseResponse;
  streamingReports: Record<ReportKey, boolean>;
}) {
  const t = data.ticker;

  switch (view) {
    case "news":
      return (
        <ReportView
          title="News Analyst"
          ticker={t}
          status={data.status}
          content={data.news_report}
          isStreaming={streamingReports.news}
          filenameBase={`${t}_news_report`}
        />
      );
    case "technical":
      return (
        <ReportView
          title="Technical Analyst"
          ticker={t}
          status={data.status}
          content={data.technical_report}
          isStreaming={streamingReports.technical}
          filenameBase={`${t}_technical_report`}
        >
          <TechnicalChart data={data.charts_data?.technical_history} />
        </ReportView>
      );
    case "fundamental":
      return (
        <ReportView
          title="Fundamental Analyst"
          ticker={t}
          status={data.status}
          content={data.fundamental_report}
          isStreaming={streamingReports.fundamental}
          filenameBase={`${t}_fundamental_report`}
        >
          <FundamentalChart data={data.charts_data?.financials_history} />
        </ReportView>
      );
    case "market":
      return (
        <ReportView
          title="Market Analyst"
          ticker={t}
          status={data.status}
          content={data.market_report}
          isStreaming={streamingReports.market}
          filenameBase={`${t}_market_report`}
        />
      );
    case "sector":
      return (
        <ReportView
          title="Sector Analyst"
          ticker={t}
          status={data.status}
          content={data.sector_report}
          isStreaming={streamingReports.sector}
          filenameBase={`${t}_sector_report`}
        />
      );
    case "bull":
      return (
        <ReportView
          title="Bull Analyst — Investment Thesis"
          ticker={t}
          status={data.status}
          content={data.investment_debate.bull_thesis}
          accent={decisionColor("BUY")}
          filenameBase={`${t}_bull_thesis`}
        />
      );
    case "bear":
      return (
        <ReportView
          title="Bear Analyst — Investment Thesis"
          ticker={t}
          status={data.status}
          content={data.investment_debate.bear_thesis}
          accent={decisionColor("SELL")}
          filenameBase={`${t}_bear_thesis`}
        />
      );
    case "manager":
      return <DebateRoom data={data} />;
  }
}
