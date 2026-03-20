// @ts-nocheck
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar } from "./chart-utils";

interface WaterfallChartProps {
  items: any[];
  nameKey?: string;
  valueKey?: string;
}

function findKey(obj: any, hints: string[]): string | null {
  const keys = Object.keys(obj);
  for (const h of hints) {
    const found = keys.find(k => k.toLowerCase().includes(h));
    if (found) return found;
  }
  return null;
}

export default function WaterfallChart({ items, nameKey, valueKey }: WaterfallChartProps) {
  if (!items || items.length === 0) return null;

  const sample = items[0];
  const nk = nameKey || findKey(sample, ["name", "label", "category", "item"]) || Object.keys(sample)[0];
  const vk = valueKey || findKey(sample, ["amount", "value", "impact", "change"]) || Object.keys(sample).find(k => typeof sample[k] === "number") || Object.keys(sample)[1];

  let cumulative = 0;
  const data = items.slice(0, 10).map((item, i) => {
    const val = typeof item[vk] === "number" ? item[vk] as number : parseFloat(String(item[vk])) || 0;
    const start = cumulative;
    cumulative += val;
    return {
      name: String(item[nk] || `Item ${i + 1}`),
      value: val,
      start,
      end: cumulative,
      fill: val >= 0 ? CHART_COLORS.success : CHART_COLORS.danger,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} angle={-25} textAnchor="end" height={70} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} />
        <YAxis tickFormatter={formatDollar} tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
        <Tooltip formatter={((v: number) => formatDollar(v)) as any} contentStyle={TOOLTIP_STYLE} />
        <ReferenceLine y={0} stroke="#d4d4d8" />
        <Bar dataKey="start" stackId="stack" fill="transparent" />
        <Bar dataKey="value" stackId="stack" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
