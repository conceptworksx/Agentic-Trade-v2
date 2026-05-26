import { useEffect, useState } from "react";
import DebateLoader from "./DebateLoader";

const STEPS = [
  "Fetching news signals",
  "Running technical analysis",
  "Evaluating fundamentals",
  "Scanning market & sector data",
  "Bull-Bear debate in session...",
  "Manager reviewing verdict",
];

export function LoadingScreen({ ticker }: { ticker: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[480px] text-center">
        <h1 className="font-mono text-[13px] tracked">ARTHA ANALYTICS</h1>
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
