import type { AnalyseResponse } from "@/lib/api";
import { Markdown } from "./ReportView";
import { decisionColor } from "./VerdictBadge";
import { downloadMarkdown, downloadPdf } from "@/lib/download";

export function DebateRoom({ data }: { data: AnalyseResponse }) {
  const { investment_debate, research_verdict, ticker } = data;
  const { speaker_history, bull_thesis, bear_thesis, final_decision } =
    investment_debate;

  const order = speaker_history?.length
    ? speaker_history
    : ["bull", "bear", "manager"];

  const fullMd = [
    `# Debate Room — ${ticker}`,
    "",
    "## Bull Analyst",
    bull_thesis,
    "",
    "## Bear Analyst",
    bear_thesis,
    "",
    "## Manager Decision",
    `**${final_decision.decision}** — ${final_decision.rationale}`,
    "",
    "## Final Verdict",
    `**${research_verdict.decision}** — ${research_verdict.rationale}`,
  ].join("\n");

  return (
    <div className="mx-auto max-w-[920px]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[18px] font-medium text-[var(--foreground)]">
          Debate Room — Bull vs Bear
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadPdf(`${ticker}_debate_room`, fullMd)}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-zinc-50/50 px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--muted-foreground)] transition-all hover:bg-zinc-100 hover:text-[var(--foreground)] shadow-xs"
          >
            ↓ PDF
          </button>
          <button
            onClick={() => downloadMarkdown(`${ticker}_debate_room`, fullMd)}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-zinc-50/50 px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--muted-foreground)] transition-all hover:bg-zinc-100 hover:text-[var(--foreground)] shadow-xs"
          >
            ↓ MD
          </button>
        </div>
      </div>
      <div className="h-px w-full bg-[var(--border)]" />
      <p className="mt-2 font-mono text-[12px] text-[var(--muted-foreground)]">
        {ticker.split(".")[0]} · Bull–Bear–Manager thread
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {order.map((speaker, i) => (
          <Bubble
            key={i}
            speaker={speaker}
            bull={bull_thesis}
            bear={bear_thesis}
            manager={final_decision.rationale}
            managerDecision={final_decision.decision}
          />
        ))}
      </div>

      <VerdictCard
        decision={research_verdict.decision}
        rationale={research_verdict.rationale}
        ticker={ticker}
      />
    </div>
  );
}

function Bubble({
  speaker,
  bull,
  bear,
  manager,
  managerDecision,
}: {
  speaker: string;
  bull: string;
  bear: string;
  manager: string;
  managerDecision: "BUY" | "SELL" | "HOLD";
}) {
  const s = speaker.toLowerCase();
  let label = "";
  let color = "var(--foreground)";
  let body = "";
  let dot = "";

  if (s.includes("bull")) {
    label = "BULL ANALYST";
    color = decisionColor("BUY");
    body = bull;
    dot = "🟢";
  } else if (s.includes("bear")) {
    label = "BEAR ANALYST";
    color = decisionColor("SELL");
    body = bear;
    dot = "🔴";
  } else {
    label = "MANAGER";
    color = decisionColor(managerDecision);
    body = manager;
    dot = "⚖";
  }

  return (
    <div
      className="border border-[var(--border)] bg-white p-6 rounded-xl shadow-sm"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="mb-3 flex items-center gap-2 font-mono text-[11px] font-bold tracked">
        <span>{dot}</span>
        <span style={{ color }}>{label}</span>
      </div>
      <Markdown content={body} />
    </div>
  );
}

function VerdictCard({
  decision,
  rationale,
  ticker,
}: {
  decision: "BUY" | "SELL" | "HOLD";
  rationale: string;
  ticker: string;
}) {
  const color = decisionColor(decision);
  return (
    <div
      className="mt-8 bg-white p-10 text-center rounded-xl shadow-sm"
      style={{ border: `2px solid ${color}` }}
    >
      <div className="font-mono text-[10px] tracked text-[var(--label)]">
        FINAL VERDICT
      </div>
      <div
        className="my-4 font-mono text-[24px] font-bold leading-none"
        style={{ color }}
      >
        {decision}
      </div>
      <p className="mx-auto max-w-[640px] text-[14px] italic text-[var(--muted-foreground)]">
        {rationale}
      </p>
      <div className="mt-6 font-mono text-[11px] text-[var(--label)]">
        Issued for: {ticker.split(".")[0]} · NSE
        <br />
        Decision by: AI Manager Agent
      </div>
    </div>
  );
}
