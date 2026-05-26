import {
  Newspaper,
  LineChart,
  BarChart2,
  Globe,
  Layers,
  TrendingUp,
  TrendingDown,
  Gavel,
  type LucideIcon,
} from "lucide-react";
import type { Decision } from "@/lib/api";
import { decisionColor } from "./VerdictBadge";

export type ViewKey =
  | "news"
  | "technical"
  | "fundamental"
  | "market"
  | "sector"
  | "bull"
  | "bear"
  | "manager";

interface Item {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  accent?: Decision;
}

const ANALYSTS: Item[] = [
  { key: "news", label: "News Analyst", icon: Newspaper },
  { key: "technical", label: "Technical Analyst", icon: LineChart },
  { key: "fundamental", label: "Fundamental Analyst", icon: BarChart2 },
  { key: "market", label: "Market Analyst", icon: Globe },
  { key: "sector", label: "Sector Analyst", icon: Layers },
];

const DEBATE: Item[] = [
  { key: "bull", label: "Bull Analyst", icon: TrendingUp, accent: "BUY" },
  { key: "bear", label: "Bear Analyst", icon: TrendingDown, accent: "SELL" },
  { key: "manager", label: "Manager Decision", icon: Gavel },
];

export function Sidebar({
  active,
  onSelect,
  verdict,
}: {
  active: ViewKey;
  onSelect: (k: ViewKey) => void;
  verdict: Decision;
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-white">
      <div className="flex-1">
        <SectionLabel>ANALYSTS</SectionLabel>
        {ANALYSTS.map((it) => (
          <Row key={it.key} item={it} active={active === it.key} onSelect={onSelect} />
        ))}

        {/*
        <Divider />
        <SectionLabel>DEBATE ROOM</SectionLabel>
        {DEBATE.map((it) => (
          <Row
            key={it.key}
            item={it}
            active={active === it.key}
            onSelect={onSelect}
            accent={
              it.accent
                ? decisionColor(it.accent)
                : it.key === "manager"
                  ? decisionColor(verdict)
                  : undefined
            }
          />
        ))}
        */}
      </div>

      <div className="mt-auto p-4 border-t border-[var(--border)] font-mono text-[9px] text-center tracking-wider text-[var(--muted-foreground)] opacity-75">
        MADE BY CONCEPTWORKSX
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pb-2 pt-6 font-mono text-[11px] font-bold tracking-widest text-zinc-500">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="mx-4 my-1 h-px bg-[var(--border)]" />;
}

function Row({
  item,
  active,
  onSelect,
  accent,
}: {
  item: Item;
  active: boolean;
  onSelect: (k: ViewKey) => void;
  accent?: string;
}) {
  const Icon = item.icon;
  const useAccent = active && accent;
  return (
    <button
      onClick={() => onSelect(item.key)}
      className={`flex h-10 items-center gap-3 px-3 mx-2 text-left text-[14px] font-medium transition-all rounded-lg ${
        active
          ? useAccent
            ? "text-white"
            : "bg-[var(--foreground)] text-white"
          : "text-[var(--muted-foreground)] hover:bg-zinc-50 hover:text-[var(--foreground)]"
      }`}
      style={useAccent ? { background: accent } : undefined}
    >
      <Icon size={16} />
      <span>{item.label}</span>
    </button>
  );
}
