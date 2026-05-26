"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  analyseTicker,
  cacheResponse,
  readCached,
  type AnalyseResponse,
} from "@/lib/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Sidebar, type ViewKey } from "@/components/Sidebar";
import { ReportView } from "@/components/ReportView";
import { DebateRoom } from "@/components/DebateRoom";
import { decisionColor } from "@/components/VerdictBadge";

export default function ResearchDashboardClient({ ticker }: { ticker: string }) {
  const router = useRouter();
  const [data, setData] = useState<AnalyseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewKey>("news");

  useEffect(() => {
    let cancelled = false;
    const cached = readCached(ticker);
    if (cached) {
      setData(cached);
      return;
    }

    const groqApiKey = localStorage.getItem("groq_api_key") || "";

    analyseTicker(ticker, groqApiKey)
      .then((d) => {
        if (cancelled) return;
        cacheResponse(ticker, d);
        setData(d);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load analysis");
      });

    return () => {
      cancelled = true;
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

  const verdict = data.research_verdict.decision;
  const isError = data.status && data.status !== "success";

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
        <Sidebar active={view} onSelect={setView} verdict={verdict} />

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
            <ViewSwitch view={view} data={data} />
          )}
        </main>
      </div>
    </div>
  );
}

function ViewSwitch({
  view,
  data,
}: {
  view: ViewKey;
  data: AnalyseResponse;
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
          filenameBase={`${t}_technical_report`}
        />
      );
    case "fundamental":
      return (
        <ReportView
          title="Fundamental Analyst"
          ticker={t}
          status={data.status}
          content={data.fundamental_report}
          filenameBase={`${t}_fundamental_report`}
        />
      );
    case "market":
      return (
        <ReportView
          title="Market Analyst"
          ticker={t}
          status={data.status}
          content={data.market_report}
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
