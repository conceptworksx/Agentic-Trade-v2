"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-[var(--background)] px-6 py-12">
      {/* Spacer to push content down slightly, keeping it centered */}
      <div />

      <div className="max-w-md text-center">
        {/* Animated Stock Chart SVG */}
        <div className="mx-auto mb-8 flex justify-center">
          <svg
            width="280"
            height="140"
            viewBox="0 0 280 140"
            fill="none"
            className="overflow-visible"
          >
            {/* Background Grid */}
            <g opacity="0.15" stroke="currentColor" strokeWidth="1">
              <line x1="0" y1="20" x2="280" y2="20" strokeDasharray="4 4" />
              <line x1="0" y1="55" x2="280" y2="55" strokeDasharray="4 4" />
              <line x1="0" y1="90" x2="280" y2="90" strokeDasharray="4 4" />
              <line x1="0" y1="125" x2="280" y2="125" strokeDasharray="4 4" />
              <line x1="40" y1="0" x2="40" y2="140" strokeDasharray="4 4" />
              <line x1="100" y1="0" x2="100" y2="140" strokeDasharray="4 4" />
              <line x1="160" y1="0" x2="160" y2="140" strokeDasharray="4 4" />
              <line x1="220" y1="0" x2="220" y2="140" strokeDasharray="4 4" />
            </g>

            {/* Shifting Candlesticks (B&W themed) */}
            {/* Candle 1 (Hollow / Bullish) */}
            <g className="animate-[bounce_3s_infinite_ease-in-out]">
              <line x1="50" y1="40" x2="50" y2="90" stroke="currentColor" strokeWidth="1.5" />
              <rect x="44" y="50" width="12" height="30" fill="var(--background)" stroke="currentColor" strokeWidth="2" rx="1" />
            </g>

            {/* Candle 2 (Filled / Bearish) */}
            <g className="animate-[bounce_3.5s_infinite_ease-in-out]">
              <line x1="110" y1="60" x2="110" y2="120" stroke="currentColor" strokeWidth="1.5" />
              <rect x="104" y="75" width="12" height="35" fill="currentColor" stroke="currentColor" strokeWidth="2" rx="1" />
            </g>

            {/* Candle 3 (Hollow / Bullish) */}
            <g className="animate-[bounce_2.8s_infinite_ease-in-out]">
              <line x1="170" y1="20" x2="170" y2="70" stroke="currentColor" strokeWidth="1.5" />
              <rect x="164" y="30" width="12" height="30" fill="var(--background)" stroke="currentColor" strokeWidth="2" rx="1" />
            </g>

            {/* Candle 4 (Solid Bearish Candle) */}
            <g className="animate-[bounce_3.2s_infinite_ease-in-out]">
              <line x1="230" y1="80" x2="230" y2="135" stroke="currentColor" strokeWidth="1.5" />
              <rect x="224" y="90" width="12" height="35" fill="currentColor" stroke="currentColor" strokeWidth="2" rx="1" />
            </g>

            {/* Animated Trend Line */}
            <path
              d="M 10 75 L 50 65 L 110 92 L 170 45 L 230 110 L 270 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="600"
              strokeDashoffset="600"
              className="animate-[dash_6s_linear_infinite]"
            />

           
            
          </svg>
        </div>

        <p className="font-mono text-[12px] font-bold tracking-wider text-[var(--label)] uppercase">
          404 — PAGE NOT FOUND
        </p>
        
        <h1 className="mt-3 font-mono text-[24px] font-semibold tracking-tight text-[var(--foreground)]">
          Lost in the Data
        </h1>
        
        <p className="mt-4 text-[14px] leading-relaxed text-[var(--muted-foreground)]">
          The research path you requested does not exist or has been moved. Use the options below to return to safety.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center border border-[var(--foreground)] bg-[var(--foreground)] px-5 font-mono text-[12px] text-white rounded-lg shadow-sm transition-all hover:bg-[#333330]"
          >
            ← Back to Home
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center border border-[var(--border)] bg-white px-5 font-mono text-[12px] text-[var(--foreground)] hover:border-[var(--foreground)] rounded-lg shadow-sm transition-all hover:bg-zinc-50"
          >
            New Analysis
          </Link>
        </div>
      </div>

      {/* Consistent Footer */}
      <div className="mt-12 flex flex-col items-center gap-3 w-full max-w-[240px]">
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
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span>Contribute on GitHub</span>
        </a>
      </div>
    </div>
  );
}
