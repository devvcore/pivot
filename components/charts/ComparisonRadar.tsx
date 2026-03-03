// @ts-nocheck
"use client";

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE } from "./chart-utils";

interface ComparisonRadarProps {
  dimensions: any[];
  nameKey?: string;
  valueKey?: string;
  benchmarkKey?: string;
}

function findKey(obj: any, hints: string[]): string | null {
  const keys = Object.keys(obj);
  for (const h of hints) {
    const found = keys.find(k => k.toLowerCase().includes(h));
    if (found) return found;
  }
  return null;
}

export default function ComparisonRadar({ dimensions, nameKey, valueKey, benchmarkKey }: ComparisonRadarProps) {
  if (!dimensions || dimensions.length === 0) return null;

  const sample = dimensions[0];
  const nk = nameKey || findKey(sample, ["name", "dimension", "label", "category", "area"]) || Object.keys(sample)[0];
  const vk = valueKey || findKey(sample, ["score", "value", "rating", "level"]) || Object.keys(sample).find(k => typeof sample[k] === "number") || Object.keys(sample)[1];
  const bk = benchmarkKey || findKey(sample, ["benchmark", "average", "industryavg", "target"]);

  const data = dimensions.slice(0, 10).map((item, i) => ({
    subject: String(item[nk] || `Dim ${i + 1}`),
    value: typeof item[vk] === "number" ? item[vk] as number : 0,
    ...(bk ? { benchmark: typeof item[bk] === "number" ? item[bk] as number : 0 } : {}),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} outerRadius="55%">
        <PolarGrid stroke="#e4e4e7" />
        <PolarAngleAxis dataKey="subject" fontSize={10} tick={{ fill: "#71717a" }} tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 14) + "…" : v} />
        <PolarRadiusAxis fontSize={10} tick={{ fill: "#a1a1aa" }} />
        <Radar name="Score" dataKey="value" stroke={CHART_COLORS.accent} fill={CHART_COLORS.accent} fillOpacity={0.2} strokeWidth={2} />
        {bk && <Radar name="Benchmark" dataKey="benchmark" stroke={CHART_COLORS.secondary} fill={CHART_COLORS.secondary} fillOpacity={0.1} strokeWidth={1} strokeDasharray="4 4" />}
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
