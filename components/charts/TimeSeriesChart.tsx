// @ts-nocheck
"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar } from "./chart-utils";

interface TimeSeriesProps {
  data: any[];
  xKey?: string;         // time axis key
  yKeys?: string[];      // value keys (auto-detected if not provided)
  isCurrency?: boolean;
}

function findTimeKey(obj: any): string | null {
  const hints = ["period", "month", "date", "year", "quarter", "week", "time", "label"];
  const keys = Object.keys(obj);
  for (const h of hints) {
    const found = keys.find(k => k.toLowerCase().includes(h));
    if (found) return found;
  }
  return keys[0]; // first key as fallback
}

function findValueKeys(obj: any, exclude: string): string[] {
  return Object.keys(obj).filter(k => k !== exclude && typeof obj[k] === "number").slice(0, 3);
}

const LINE_COLORS = [CHART_COLORS.accent, CHART_COLORS.success, CHART_COLORS.warning];

export default function TimeSeriesChart({ data, xKey, yKeys, isCurrency }: TimeSeriesProps) {
  if (!data || data.length === 0) return null;

  const sample = data[0];
  const xk = xKey || findTimeKey(sample) || "period";
  const yks = yKeys || findValueKeys(sample, xk);
  if (yks.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
        <XAxis dataKey={xk} tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} />
        <YAxis tickFormatter={isCurrency ? formatDollar : undefined} tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={((v: number) => isCurrency ? formatDollar(v) : v.toLocaleString()) as any}
          contentStyle={TOOLTIP_STYLE}
        />
        {yks.map((yk, i) => (
          <Area
            key={yk}
            type="monotone"
            dataKey={yk}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            fill={LINE_COLORS[i % LINE_COLORS.length]}
            fillOpacity={0.1}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
