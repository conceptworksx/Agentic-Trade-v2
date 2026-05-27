import {
  Newspaper,
  LineChart,
  BarChart2,
  Globe,
  Layers,
  type LucideIcon,
} from "lucide-react";

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
}

const ANALYSTS: Item[] = [
  { key: "news", label: "News Analyst", icon: Newspaper },
  { key: "technical", label: "Technical Analyst", icon: LineChart },
  { key: "fundamental", label: "Fundamental Analyst", icon: BarChart2 },
  { key: "market", label: "Market Analyst", icon: Globe },
  { key: "sector", label: "Sector Analyst", icon: Layers },
];

export function Sidebar({
  active,
  onSelect,
}: {
  active: ViewKey;
  onSelect: (k: ViewKey) => void;
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-white">
      <div className="flex-1">
        <SectionLabel>ANALYSTS</SectionLabel>
        {ANALYSTS.map((it) => (
          <Row key={it.key} item={it} active={active === it.key} onSelect={onSelect} />
        ))}
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

function Row({
  item,
  active,
  onSelect,
}: {
  item: Item;
  active: boolean;
  onSelect: (k: ViewKey) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onSelect(item.key)}
      className={`flex h-10 items-center gap-3 px-3 mx-2 text-left text-[14px] font-medium transition-all rounded-lg ${
        active
          ? "bg-[var(--foreground)] text-white"
          : "text-[var(--muted-foreground)] hover:bg-zinc-50 hover:text-[var(--foreground)]"
      }`}
    >
      <Icon size={16} />
      <span>{item.label}</span>
    </button>
  );
}
