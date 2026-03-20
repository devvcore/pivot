// @ts-nocheck
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { PIE_PALETTE, TOOLTIP_STYLE } from "./chart-utils";

interface FunnelChartProps {
  stages: any[];
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

export default function FunnelChart({ stages, nameKey, valueKey }: FunnelChartProps) {
  if (!stages || stages.length === 0) return null;

  const sample = stages[0];
  const nk = nameKey || findKey(sample, ["name", "stage", "label", "step", "phase"]) || Object.keys(sample)[0];
  const vk = valueKey || findKey(sample, ["count", "value", "volume", "number", "leads", "amount"]) || Object.keys(sample).find(k => typeof sample[k] === "number") || Object.keys(sample)[1];

  const data = stages.slice(0, 8).map((item, i) => ({
    name: String(item[nk] || `Stage ${i + 1}`),
    value: typeof item[vk] === "number" ? item[vk] as number : parseFloat(String(item[vk])) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ left: 12, right: 48, top: 8, bottom: 8 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: "#52525b" }} tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + "…" : v} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
          <LabelList dataKey="value" position="right" fontSize={11} fill="#52525b" fontWeight={600} />
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} opacity={1 - i * 0.06} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
