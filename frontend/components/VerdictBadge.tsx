import type { Decision } from "@/lib/api";

const colorVar = (d: Decision) =>
  d === "BUY" ? "var(--buy)" : d === "SELL" ? "var(--sell)" : "var(--hold)";

export function decisionColor(d: Decision) {
  return colorVar(d);
}

export function VerdictBadge({ decision }: { decision: Decision }) {
  return (
    <span className="inline-flex items-center gap-2 border border-[var(--border)] bg-white px-2.5 py-1">
      <span
        className="inline-block h-2 w-2"
        style={{ background: colorVar(decision) }}
      />
      <span
        className="font-mono text-[11px] font-bold tracked"
        style={{ color: colorVar(decision) }}
      >
        {decision}
      </span>
    </span>
  );
}
