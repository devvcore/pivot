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
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 8, bottom: 8 }}>
        <XAxis type="number" tickFormatter={isCurrency ? formatDollar : undefined} tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10, fill: "#52525b" }} tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + "…" : v} axisLine={false} tickLine={false} />
        <Tooltip formatter={((v: number) => isCurrency ? formatDollar(v) : v.toLocaleString()) as any} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
