// @ts-nocheck
"use client";

import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { SEVERITY_COLORS, CHART_COLORS } from "./chart-utils";

interface MatrixScatterProps {
  items: any[];
  xKey?: string;          // e.g. "likelihood"
  yKey?: string;          // e.g. "impact"
  labelKey?: string;
  colorKey?: string;      // e.g. "severity"
}

function findKey(obj: any, hints: string[]): string | null {
  const keys = Object.keys(obj);
  for (const h of hints) {
    const found = keys.find(k => k.toLowerCase().includes(h));
    if (found) return found;
  }
  return null;
}

function severityToNumber(s: unknown): number {
  if (typeof s === "number") return s;
  const map: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, minimal: 1 };
  return map[String(s).toLowerCase()] ?? 3;
}

export default function MatrixScatter({ items, xKey, yKey, labelKey, colorKey }: MatrixScatterProps) {
  if (!items || items.length === 0) return null;

  const sample = items[0];
  const xk = xKey || findKey(sample, ["likelihood", "probability", "effort", "feasibility"]) || "likelihood";
  const yk = yKey || findKey(sample, ["impact", "severity", "value", "importance"]) || "impact";
  const lk = labelKey || findKey(sample, ["name", "title", "label", "issue", "risk"]) || Object.keys(sample)[0];
  const ck = colorKey || findKey(sample, ["severity", "priority", "level"]);

  const data = items.slice(0, 20).map((item, i) => ({
    x: severityToNumber(item[xk]),
    y: severityToNumber(item[yk]),
    name: String(item[lk] || `Item ${i + 1}`),
    color: ck ? (SEVERITY_COLORS[String(item[ck])] || CHART_COLORS.accent) : CHART_COLORS.accent,
    z: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis type="number" dataKey="x" name={xk} domain={[0, 6]} fontSize={11} tick={{ fill: "#71717a" }} label={{ value: xk.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, s => s.toUpperCase()), position: "bottom", fontSize: 11, fill: "#71717a" }} />
        <YAxis type="number" dataKey="y" name={yk} domain={[0, 6]} fontSize={11} tick={{ fill: "#71717a" }} label={{ value: yk.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, s => s.toUpperCase()), angle: -90, position: "left", fontSize: 11, fill: "#71717a" }} />
        <ZAxis dataKey="z" range={[60, 60]} />
        <Tooltip content={({ payload }) => {
          if (!payload?.[0]) return null;
          const d = payload[0].payload;
          return <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm"><strong>{d.name}</strong></div>;
        }} />
        <Scatter data={data}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
