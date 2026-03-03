// @ts-nocheck
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PIE_PALETTE, TOOLTIP_STYLE, formatDollar } from "./chart-utils";

interface RankedBarsProps {
  items: any[];
  nameKey?: string;       // field for label
  valueKey?: string;      // field for bar value
  isCurrency?: boolean;
}

function findKey(obj: any, hints: string[]): string | null {
  const keys = Object.keys(obj);
  for (const h of hints) {
    const found = keys.find(k => k.toLowerCase().includes(h));
    if (found) return found;
  }
  return null;
}

export default function RankedBarsChart({ items, nameKey, valueKey, isCurrency }: RankedBarsProps) {
  if (!items || items.length === 0) return null;

  const sample = items[0];
  const nk = nameKey || findKey(sample, ["name", "label", "title", "category", "source", "area"]) || Object.keys(sample)[0];
  const vk = valueKey || findKey(sample, ["amount", "value", "revenue", "cost", "impact", "score", "count"]) || Object.keys(sample).find(k => typeof sample[k] === "number") || Object.keys(sample)[1];

  const data = items.slice(0, 12).map((item, i) => ({
    name: String(item[nk] || `Item ${i + 1}`),
    value: typeof item[vk] === "number" ? item[vk] as number : parseFloat(String(item[vk])) || 0,
  })).sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
        <XAxis type="number" tickFormatter={isCurrency ? formatDollar : undefined} fontSize={11} />
        <YAxis type="category" dataKey="name" width={180} fontSize={10} tick={{ fill: "#71717a" }} tickFormatter={(v: string) => v.length > 26 ? v.slice(0, 24) + "…" : v} />
        <Tooltip formatter={((v: number) => isCurrency ? formatDollar(v) : v.toLocaleString()) as any} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
