"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { useRouter } from "next/navigation";
import { analyseTicker, cacheResponse } from "@/lib/api";
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
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
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
      const data = await analyseTicker(selected.symbol, groqApiKey);
      cacheResponse(selected.symbol, data);
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
        <div className="w-full max-w-[480px]">
          <div className="mb-12 text-center">
            <h1 className="font-mono text-[13px] tracking-widest text-[var(--foreground)]">
              ARTHA ANALYTICS
            </h1>
            <div className="mx-auto my-3 h-px w-full bg-[var(--border)]" />
            <p className="text-[13px] text-[var(--muted-foreground)]">
              AI-powered equity analytics for Indian markets
            </p>
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
                <div className="absolute left-0 right-0 top-full z-10 max-h-[352px] overflow-y-auto border border-t-0 border-[var(--border)] bg-white rounded-b-lg shadow-lg">
                  {results.map((t, i) => (
                    <button
                      key={t.symbol}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(t);
                      }}
                      onMouseEnter={() => setHighlight(i)}
                      className={`flex h-11 w-full items-center justify-between px-4 text-left ${
                        i === highlight ? "bg-[var(--background)]" : "bg-white"
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

          <div className="mt-10 flex flex-col items-center gap-1.5 font-mono text-[10px] tracking-wider text-[var(--label)]">
            <span>NSE EQUITY | INDIA</span>
            <span className="text-[9px] opacity-75">MADE BY CONCEPTWORKSX</span>
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
  "Bull-Bear debate in session...",
  "Manager reviewing verdict",
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
