"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FinancialsHistory {
  income_stmt: {
    revenue?: Record<string, number | null>;
    ebitda?: Record<string, number | null>;
    net_income?: Record<string, number | null>;
    eps_diluted?: Record<string, number | null>;
  };
  balance_sheet: {
    cash?: Record<string, number | null>;
    total_liabilities?: Record<string, number | null>;
    total_debt?: Record<string, number | null>;
    shareholders_equity?: Record<string, number | null>;
  };
  cash_flow: {
    operating_cash_flow?: Record<string, number | null>;
    free_cash_flow?: Record<string, number | null>;
  };
  ratios: {
    net_margin_pct?: Record<string, number | null>;
    roe_pct?: Record<string, number | null>;
    roce_pct?: Record<string, number | null>;
    debt_to_equity?: Record<string, number | null>;
    interest_coverage?: Record<string, number | null>;
  };
}

export function FundamentalChart({ data }: { data?: FinancialsHistory }) {
  if (!data || !data.income_stmt || !data.income_stmt.revenue) {
    return (
      <Card className="mb-6 border-[var(--border)] bg-white shadow-xs">
        <CardContent className="py-10 text-center font-mono text-[12px] text-[var(--muted-foreground)]">
          No financials chart data available
        </CardContent>
      </Card>
    );
  }

  // Get chronological years list
  const dates = Object.keys(data.income_stmt.revenue || {})
    .filter((dateStr) => data.income_stmt.revenue![dateStr] !== null)
    .sort();
  if (dates.length === 0) {
    return (
      <Card className="mb-6 border-[var(--border)] bg-white shadow-xs">
        <CardContent className="py-10 text-center font-mono text-[12px] text-[var(--muted-foreground)]">
          No financials chart dates found
        </CardContent>
      </Card>
    );
  }

  // Map to structured list
  const chartData = dates.map((dateStr) => {
    const yearStr = dateStr.split("-")[0];
    const yearLabel = `FY${yearStr.slice(2)}`;
    const netMarginVal = data.ratios.net_margin_pct?.[dateStr] ?? null;
    const roeVal = data.ratios.roe_pct?.[dateStr] ?? null;

    return {
      date: dateStr,
      year: yearLabel,
      revenue: data.income_stmt.revenue?.[dateStr] ?? null,
      netIncome: data.income_stmt.net_income?.[dateStr] ?? null,
      debtToEquity: data.ratios.debt_to_equity?.[dateStr] ?? null,
      netMargin: netMarginVal,
      roe: roeVal,
      // Cap at [-100, 100] for visual charting to prevent outliers from squishing the scale
      plotNetMargin: netMarginVal !== null ? Math.max(-100, Math.min(100, netMarginVal)) : null,
      plotRoe: roeVal !== null ? Math.max(-100, Math.min(100, roeVal)) : null,
    };
  });

  const formatValue = (num: number) => {
    const absVal = Math.abs(num);
    if (absVal >= 1e7) {
      return `₹${(num / 1e7).toFixed(2)}\u00A0Cr`;
    }
    if (absVal >= 1e5) {
      return `₹${(num / 1e5).toFixed(2)}\u00A0L`;
    }
    return `₹${num.toLocaleString()}`;
  };

  return (
    <Card className="mb-8 border-[var(--border)] bg-white p-4 shadow-sm rounded-xl">
      <Tabs defaultValue="growth" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--border)] pb-3 mb-4 gap-2">
          <CardHeader className="p-0">
            <CardTitle className="font-mono text-[13px] font-bold text-[var(--foreground)] tracking-wide">
              HISTORICAL FINANCIALS & PERFORMANCE RATIOS
            </CardTitle>
          </CardHeader>
          <TabsList className="bg-slate-100 p-0.5 h-7">
            <TabsTrigger value="growth" className="text-[10px] font-mono font-bold py-1 h-6">
              GROWTH
            </TabsTrigger>
            <TabsTrigger value="profitability" className="text-[10px] font-mono font-bold py-1 h-6">
              PROFITABILITY & DEBT
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Growth Tab (Revenue & Net Income Bars) */}
        <TabsContent value="growth" className="mt-0 outline-none">
          <div className="h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="year"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "monospace", fontWeight: "bold" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatValue}
                  width={90}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "monospace" }}
                />
                <Tooltip
                  formatter={(value: number | string) => [formatValue(Number(value)), ""]}
                  contentStyle={{
                    background: "white",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={32}
                  iconSize={10}
                  wrapperStyle={{ fontFamily: "monospace", fontSize: "11px" }}
                />
                <Bar name="Revenue" dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={45} />
                <Bar name="Net Income" dataKey="netIncome" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* Profitability & Leverage Tab */}
        <TabsContent value="profitability" className="mt-0 outline-none">
          <div className="h-[280px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="year"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "monospace", fontWeight: "bold" }}
                />
                {/* Primary Axis: Margins (%) */}
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "monospace" }}
                />
                {/* Secondary Axis: Debt/Equity ratio */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}x`}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "monospace" }}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: string, props: any) => {
                    const dataRow = props.payload;
                    if (name === "Net Margin %") {
                      return [dataRow.netMargin !== null ? `${dataRow.netMargin}%` : "N/A", name];
                    }
                    if (name === "ROE %") {
                      return [dataRow.roe !== null ? `${dataRow.roe}%` : "N/A", name];
                    }
                    if (name === "Debt-to-Equity") {
                      return [dataRow.debtToEquity !== null ? `${dataRow.debtToEquity}x` : "N/A", name];
                    }
                    return [value, name];
                  }}
                  contentStyle={{
                    background: "white",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={32}
                  iconSize={10}
                  wrapperStyle={{ fontFamily: "monospace", fontSize: "11px" }}
                />
                <Line
                  yAxisId="left"
                  name="Net Margin %"
                  type="monotone"
                  dataKey="plotNetMargin"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="left"
                  name="ROE %"
                  type="monotone"
                  dataKey="plotRoe"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  name="Debt-to-Equity"
                  type="monotone"
                  dataKey="debtToEquity"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
