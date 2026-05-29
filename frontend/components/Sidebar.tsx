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
  | "sector";

interface Item {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
}

const ANALYSTS: Item[] = [
  { key: "technical", label: "Technical Analyst", icon: LineChart },
  { key: "fundamental", label: "Fundamental Analyst", icon: BarChart2 },
  { key: "market", label: "Market Analyst", icon: Globe },
  { key: "sector", label: "Sector Analyst", icon: Layers },
  { key: "news", label: "News Analyst", icon: Newspaper },
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

      <div className="mt-auto flex flex-col items-center gap-4 p-5">
        <span className="font-mono text-[11px] tracking-wider text-[var(--muted-foreground)] opacity-75">
          MADE BY CONCEPTWORKSX
        </span>
        <div className="h-px w-full bg-[var(--border)]" />
        <a
          href="https://github.com/conceptworksx/Agentic-Trade-v2"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span>Contribute</span>
        </a>
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
      className={`flex h-10 items-center gap-3 px-3 mx-2 text-left text-[14px] font-medium transition-all rounded-lg ${active
          ? "bg-[var(--foreground)] text-white"
          : "text-[var(--muted-foreground)] hover:bg-zinc-50 hover:text-[var(--foreground)]"
        }`}
    >
      <Icon size={16} />
      <span>{item.label}</span>
    </button>
  );
}