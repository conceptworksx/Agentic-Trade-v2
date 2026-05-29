"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { useRouter } from "next/navigation";
import { clearCached } from "@/lib/api";
import DebateLoader from "./DebateLoader";

interface Ticker {
  symbol: string;
  name: string;
}

export function TickerSearch() {
  const router = useRouter();
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selected, setSelected] = useState<Ticker | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groqApiKey, setGroqApiKey] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [showIntro, setShowIntro] = useState(true);
  const [fadeOutIntro, setFadeOutIntro] = useState(false);

  // Load tickers and saved API key on mount
  useEffect(() => {
    fetch("/nse-tickers.json")
      .then((r) => r.json())
      .then(setTickers)
      .catch(() => setTickers([]));

    const savedKey = localStorage.getItem("groq_api_key");
    if (savedKey) {
      setGroqApiKey(savedKey);
    }
  }, []);

  // Intro loading delay
  useEffect(() => {
    const fadeTimeout = setTimeout(() => {
      setFadeOutIntro(true);
    }, 2600);

    const removeTimeout = setTimeout(() => {
      setShowIntro(false);
    }, 3100);

    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(removeTimeout);
    };
  }, []);


  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGroqApiKey(val);
    localStorage.setItem("groq_api_key", val);
  };

  const fuse = useMemo(
    () =>
      new Fuse(tickers, {
        keys: ["symbol", "name"],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [tickers],
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query).slice(0, 8).map((r) => r.item);
  }, [query, fuse]);

  const handleSelect = (t: Ticker) => {
    setSelected(t);
    setQuery(`${t.symbol} — ${t.name}`);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open && results.length > 0) {
        setOpen(true);
        setHighlight(0);
        return;
      }
      if (results.length === 0) return;
      setHighlight((h) => {
        const next = Math.min(h + 1, results.length - 1);
        scrollToItem(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open || results.length === 0) return;
      setHighlight((h) => {
        const next = Math.max(h - 1, 0);
        scrollToItem(next);
        return next;
      });
    } else if (e.key === "Enter") {
      if (open && results.length > 0) {
        e.preventDefault();
        handleSelect(results[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const scrollToItem = (index: number) => {
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      const item = list.children[index] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    });
  };

  const handleAnalyse = async () => {
    if (!selected) return;
    
    if (!groqApiKey || !groqApiKey.trim().startsWith("gsk_")) {
      setError("Please enter a valid Groq API Key starting with 'gsk_'");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      clearCached(selected.symbol);
      router.push(`/research/${selected.symbol}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reach analysis service",
      );
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingPanel ticker={selected?.symbol ?? ""} />;
  }

  return (
    <>
      {showIntro && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white text-black transition-opacity duration-500 ${
            fadeOutIntro ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div className="text-center">
            <div className="candle-wrapper">
              <div className="candle-chart">
                {[...Array(18)].map((_, i) => (
                  <div key={i} className="candle" />
                ))}
              </div>
            </div>
            <h1 className="mt-6 font-mono text-[13px] tracking-[0.25em] text-black uppercase animate-pulse">
              Artha Analytics
            </h1>
            <p className="mt-2 font-mono text-[10px] tracking-wider text-zinc-400 uppercase">
              Connecting to Indian markets
            </p>
          </div>
        </div>
      )}

      <div
        className={`flex min-h-screen items-center justify-center px-6 transition-all duration-700 ${
          fadeOutIntro ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <div className="w-full max-w-[420px]">
          {/* Landing Page Hero Logo */}
          <div className="mb-6 flex justify-center">
            <img 
              src="/landing_hero.png" 
              alt="Artha Analytics Logo" 
              className="w-60 h-60 object-contain" 
            />
          </div>

          {/* Groq API Key input */}
          <div className="mb-6">
            <label className="mb-2 block font-mono text-[11px] tracking-wider text-[var(--label)]">
              GROQ API KEY
            </label>
            <input
              type="password"
              value={groqApiKey}
              onChange={handleApiKeyChange}
              placeholder="gsk_..."
              className="block h-12 w-full border border-[var(--border)] bg-white px-4 font-mono text-[14px] text-[var(--foreground)] placeholder:text-[var(--label)] focus:border-[var(--foreground)] focus:outline-none rounded-lg shadow-sm"
            />
          </div>

          {/* Ticker Search Input */}
          <div className="mb-6">
            <label className="mb-2 block font-mono text-[11px] tracking-wider text-[var(--label)]">
              SEARCH NSE TICKER
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  setSelected(null);
                  setHighlight(0);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                onKeyDown={handleKey}
                placeholder="e.g. RELIANCE, TCS, INFY  ..."
                className="block h-12 w-full border border-[var(--border)] bg-white px-4 font-mono text-[14px] text-[var(--foreground)] placeholder:text-[var(--label)] focus:border-[var(--foreground)] focus:outline-none rounded-lg shadow-sm"
              />

              {open && results.length > 0 && (
                <div ref={listRef} role="listbox" className="absolute left-0 right-0 top-full z-10 max-h-[352px] overflow-y-auto border border-t-0 border-[var(--border)] bg-white rounded-b-lg shadow-lg">
                  {results.map((t, i) => (
                    <button
                      key={t.symbol}
                      type="button"
                      role="option"
                      aria-selected={i === highlight}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(t);
                      }}
                      onMouseEnter={() => setHighlight(i)}
                      className={`flex h-11 w-full items-center justify-between px-4 text-left transition-colors duration-100 ${
                        i === highlight ? "bg-[#f0f0ee]" : "bg-white"
                      }`}
                    >
                      <span className="font-mono text-[13px] font-bold text-[var(--foreground)]">
                        {t.symbol}
                      </span>
                      <span className="ml-4 truncate text-[13px] text-[var(--muted-foreground)]">
                        {t.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selected && (
            <button
              onClick={handleAnalyse}
              className="mt-3 block h-12 w-full bg-[var(--foreground)] text-[14px] font-medium text-[var(--background)] transition-colors hover:bg-[#333330] rounded-lg shadow-sm"
            >
              Analyse {selected.symbol} →
            </button>
          )}

          {error && (
            <p className="mt-4 font-mono text-[11px] text-[var(--sell)]">
              {error}
            </p>
          )}

          <div className="mt-10 flex flex-col items-center gap-2.5 font-mono tracking-wider text-[var(--label)]">
            <span className="text-[12px] mb-3">NSE EQUITY | INDIA</span>
            <span className="text-[11px] opacity-75">MADE BY CONCEPTWORKSX</span>
            <div className="mx-auto h-px w-full max-w-[240px] bg-[var(--border)]" />
            <a
              href="https://github.com/conceptworksx/Agentic-Trade-v2"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[12px] tracking-wider text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span>Contribute on GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}


const STEPS = [
  "Fetching news signals",
  "Running technical analysis",
  "Evaluating fundamentals",
  "Scanning market & sector data",
];

function LoadingPanel({ ticker }: { ticker: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[480px] text-center">
        <h1 className="font-mono text-[13px] tracking-widest">ARTHA ANALYTICS</h1>
        <div className="mx-auto my-3 h-px w-full bg-[var(--border)]" />
        <p className="font-mono text-[13px] text-[var(--muted-foreground)]">
          Initialising agents for {ticker}...
        </p>
        <div className="mt-6">
          <DebateLoader />
        </div>
        <p className="mt-4 font-mono text-[12px] text-[var(--muted-foreground)]">
          {STEPS[step]}
        </p>
      </div>
    </div>
  );
}
