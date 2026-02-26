"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  ComposedChart, Bar, Line,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar } from "./chart-utils";

interface WeeklyProjection {
  week: number;
  label: string;
  openingBalance: number;
  inflows: number;
  outflows: number;
  closingBalance: number;
  riskFlag?: string;
}

interface Props {
  projections: WeeklyProjection[];
}

export function CashFlowChart({ projections }: Props) {
  if (!projections?.length) return null;

  const data = projections.map((p) => ({
    name: p.label || `W${p.week}`,
    inflows: p.inflows,
    outflows: p.outflows,
    closing: p.closingBalance,
    riskFlag: p.riskFlag,
  }));

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Combined bar + line chart */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
          Cash Balance Trend
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ left: 5, right: 5 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tickFormatter={(v) => formatDollar(v)} tick={{ fontSize: 9 }} />
            <Tooltip
              formatter={(v, name) => [formatDollar(Number(v ?? 0)), String(name)]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Bar dataKey="inflows" fill={CHART_COLORS.success} opacity={0.6} radius={[2, 2, 0, 0]} name="Inflows" />
            <Bar dataKey="outflows" fill={CHART_COLORS.danger} opacity={0.6} radius={[2, 2, 0, 0]} name="Outflows" />
            <Line
              type="monotone"
              dataKey="closing"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              dot={false}
              name="Closing Balance"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Inflow/Outflow area chart */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
          Inflows vs Outflows
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ left: 5, right: 5 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tickFormatter={(v) => formatDollar(v)} tick={{ fontSize: 9 }} />
            <Tooltip
              formatter={(v, name) => [formatDollar(Number(v ?? 0)), String(name)]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Area
              type="monotone"
              dataKey="inflows"
              stackId="1"
              stroke={CHART_COLORS.success}
              fill={CHART_COLORS.success}
              fillOpacity={0.3}
              name="Inflows"
            />
            <Area
              type="monotone"
              dataKey="outflows"
              stackId="2"
              stroke={CHART_COLORS.danger}
              fill={CHART_COLORS.danger}
              fillOpacity={0.3}
              name="Outflows"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
