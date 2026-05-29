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
    <div className="flex min-h-screen items-start justify-center px-6 pt-[15vh]">
      <div className="w-full text-center flex flex-col items-center">
        {/* Logo */}
        <div className="mb-1">
          <img 
            src="/landing_hero.png" 
            alt="Artha Analytics Logo" 
            className="w-52 h-52 object-contain" 
          />
        </div>
        <div className="mx-auto my-3 h-px w-full bg-[var(--border)]" />
        <p className="font-mono text-[13px] text-zinc-800 font-medium">
          Initialising agents for {ticker}...
        </p>
        <div className="mt-6 w-full flex justify-center">
          <DebateLoader />
        </div>
        <p className="mt-4 font-mono text-[12px] text-zinc-800 font-medium">
          {STEPS[step]}
        </p>
      </div>
    </div>
  );
}
