// @ts-nocheck
"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  ComposedChart, Bar, Line, CartesianGrid,
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

interface OverlayData {
  dataPoints: { month: string; baseline: number; projected: number }[];
  title?: string;
  insight?: string;
  totalImpact?: string;
}

interface Props {
  projections: WeeklyProjection[];
  overlay?: OverlayData;
  onDataClick?: (question: string) => void;
}

export function CashFlowChart({ projections, overlay, onDataClick }: Props) {
  if (!projections?.length) return null;

  const baseData = projections.map((p) => ({
    name: p.label || `W${p.week}`,
    inflows: p.inflows,
    outflows: p.outflows,
    closing: p.closingBalance,
    riskFlag: p.riskFlag,
    projected: undefined as number | undefined,
  }));

  // When overlay exists, merge projected data onto the existing chart data
  // and extend with future projected weeks
  let mergedData = baseData;
  if (overlay?.dataPoints?.length) {
    // Create a map of overlay data by month label
    const overlayMap = new Map<string, number>();
    for (const dp of overlay.dataPoints) {
      overlayMap.set(dp.month, dp.projected);
    }

    // First, try to match overlay months to existing data points
    const matchedNames = new Set<string>();
    mergedData = baseData.map((d) => {
      const projValue = overlayMap.get(d.name);
      if (projValue !== undefined) {
        matchedNames.add(d.name);
        return { ...d, projected: projValue };
      }
      return d;
    });

    // Then append any overlay data points that don't match existing weeks
    for (const dp of overlay.dataPoints) {
      if (!matchedNames.has(dp.month) && !mergedData.some((d) => d.name === dp.month)) {
        mergedData.push({
          name: dp.month,
          inflows: 0,
          outflows: 0,
          closing: dp.baseline,
          riskFlag: undefined,
          projected: dp.projected,
        });
      }
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Combined bar + line chart */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
          Cash Balance Trend
          {overlay && <span className="text-blue-500 ml-2">+ Projection</span>}
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={mergedData} margin={{ top: 8, right: 12, bottom: 16, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} />
            <YAxis tickFormatter={(v) => formatDollar(v)} tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v, name) => [formatDollar(Number(v ?? 0)), String(name)]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Bar
              dataKey="inflows"
              fill={CHART_COLORS.success}
              opacity={0.6}
              radius={[2, 2, 0, 0]}
              name="Inflows"
              cursor={onDataClick ? "pointer" : undefined}
              onClick={(data) => {
                if (onDataClick && data?.name) {
                  const trend = data.inflows > data.outflows ? "up" : "down";
                  onDataClick(`Why is my cash flow ${trend} in ${data.name}? Inflows: ${formatDollar(data.inflows)}, Outflows: ${formatDollar(data.outflows)}.`);
                }
              }}
            />
            <Bar
              dataKey="outflows"
              fill={CHART_COLORS.danger}
              opacity={0.6}
              radius={[2, 2, 0, 0]}
              name="Outflows"
              cursor={onDataClick ? "pointer" : undefined}
              onClick={(data) => {
                if (onDataClick && data?.name) {
                  const trend = data.inflows > data.outflows ? "up" : "down";
                  onDataClick(`Why is my cash flow ${trend} in ${data.name}? Inflows: ${formatDollar(data.inflows)}, Outflows: ${formatDollar(data.outflows)}.`);
                }
              }}
            />
            <Line
              type="monotone"
              dataKey="closing"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              dot={false}
              name="Closing Balance"
            />
            {overlay && (
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: "#3b82f6", stroke: "#fff", strokeWidth: 1.5 }}
                name="Projected"
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Inflow/Outflow area chart */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
          Inflows vs Outflows
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={mergedData} margin={{ top: 8, right: 12, bottom: 16, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} />
            <YAxis tickFormatter={(v) => formatDollar(v)} tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
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
