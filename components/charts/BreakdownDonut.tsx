// @ts-nocheck
"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PIE_PALETTE, TOOLTIP_STYLE } from "./chart-utils";

interface BreakdownDonutProps {
  items: any[];
  nameKey?: string;
  valueKey?: string;
}

function findKey(obj: any, hints: string[]): string | null {
  const keys = Object.keys(obj);
  for (const h of hints) {
    const found = keys.find((k: string) => k.toLowerCase().includes(h));
    if (found) return found;
  }
  return null;
}

export default function BreakdownDonut({ items, nameKey, valueKey }: BreakdownDonutProps) {
  if (!items || items.length === 0) return null;

  const sample = items[0];
  const nk = nameKey || findKey(sample, ["name", "label", "category", "segment", "source"]) || Object.keys(sample)[0];
  const vk = valueKey || findKey(sample, ["percentage", "share", "value", "amount", "allocation"]) || Object.keys(sample).find((k: string) => typeof sample[k] === "number") || Object.keys(sample)[1];

  const data = items.slice(0, 8).map((item: any, i: number) => ({
    name: String(item[nk] || `Segment ${i + 1}`).slice(0, 25),
    value: typeof item[vk] === "number" ? Math.abs(item[vk] as number) : parseFloat(String(item[vk])) || 0,
  })).filter((d: any) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="50%"
          outerRadius="80%"
          dataKey="value"
          label={(({ name, percent }: { name: string; percent?: number }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`) as any}
          labelLine={false}
          fontSize={11}
        >
          {data.map((_: any, i: number) => (
            <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend fontSize={11} />
      </PieChart>
    </ResponsiveContainer>
  );
}
