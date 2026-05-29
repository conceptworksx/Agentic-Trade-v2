"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TechDataPoint {
  date: string;
  close: number | null;
  ma50: number | null;
  ma200: number | null;
  bb_upper: number | null;
  bb_lower: number | null;
  bb_mid: number | null;
  rsi: number | null;
  volume: number | null;
}

export function TechnicalChart({ data }: { data?: TechDataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <Card className="mb-6 border-[var(--border)] bg-white shadow-xs">
        <CardContent className="py-10 text-center font-mono text-[12px] text-[var(--muted-foreground)]">
          No chart data available
        </CardContent>
      </Card>
    );
  }

  // Format date labels nicely (e.g. "25 May")
  const formatDate = (val: string) => {
    try {
      const d = new Date(val);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return val;
    }
  };

  return (
    <Card className="mb-8 border-[var(--border)] bg-white p-4 shadow-sm rounded-xl">
      <CardHeader className="p-2 pb-4">
        <CardTitle className="font-mono text-[13px] font-bold text-[var(--foreground)] tracking-wide">
          TECHNICAL INDICATORS & TREND PATTERNS
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 p-0">
        {/* Price Sub-chart */}
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} syncId="techChart" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.05} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "monospace" }}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${v}`}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "monospace" }}
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                labelFormatter={formatDate}
              />
              {/* Bollinger Bands Shading */}
              <Area
                name="BB Upper"
                type="monotone"
                dataKey="bb_upper"
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="none"
              />
              <Area
                name="BB Lower"
                type="monotone"
                dataKey="bb_lower"
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="none"
              />
              {/* Price Area */}
              <Area
                name="Close"
                type="monotone"
                dataKey="close"
                stroke="var(--foreground)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorClose)"
              />
              {/* Moving Averages */}
              <Line
                name="SMA 50"
                type="monotone"
                dataKey="ma50"
                stroke="#f43f5e"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
              />
              <Line
                name="SMA 200"
                type="monotone"
                dataKey="ma200"
                stroke="#10b981"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* RSI Sub-chart */}
        <div className="h-[120px] w-full border-t border-[var(--border)] pt-4">
          <div className="mb-2 font-mono text-[10px] font-bold text-[var(--muted-foreground)] tracking-wide px-2">
            MOMENTUM (RSI 14)
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} syncId="techChart" margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                hide
              />
              <YAxis
                domain={[10, 90]}
                tickLine={false}
                axisLine={false}
                ticks={[30, 50, 70]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "monospace" }}
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                labelFormatter={formatDate}
              />
              <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "OB", fill: "#f43f5e", fontSize: 9, position: "insideLeft", fontFamily: "monospace" }} />
              <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" label={{ value: "OS", fill: "#10b981", fontSize: 9, position: "insideLeft", fontFamily: "monospace" }} />
              <ReferenceLine y={50} stroke="#cbd5e1" strokeDasharray="2 2" />
              <Line
                name="RSI"
                type="monotone"
                dataKey="rsi"
                stroke="#d97706"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
