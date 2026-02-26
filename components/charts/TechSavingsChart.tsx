"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar, parseDollarString } from "./chart-utils";

interface TechRec {
  rank: number;
  currentTool: string;
  suggestedAlternative: string;
  estimatedSaving: string;
  migrationEffort: string;
}

interface Props {
  recommendations: TechRec[];
}

const EFFORT_FILLS: Record<string, string> = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#ef4444",
};

export function TechSavingsChart({ recommendations }: Props) {
  const data = recommendations
    .filter((r) => r.estimatedSaving)
    .map((r) => ({
      name: `${r.currentTool} → ${r.suggestedAlternative}`.slice(0, 28),
      saving: parseDollarString(r.estimatedSaving),
      effort: r.migrationEffort,
    }))
    .sort((a, b) => b.saving - a.saving);

  if (data.length === 0) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
        Potential Savings by Migration
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis type="number" tickFormatter={(v) => formatDollar(v)} tick={{ fontSize: 9 }} />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 9 }} />
          <Tooltip
            formatter={(v) => formatDollar(Number(v ?? 0))}
            contentStyle={TOOLTIP_STYLE}
          />
          <Bar dataKey="saving" radius={[0, 4, 4, 0]} name="Monthly Savings">
            {data.map((entry, i) => (
              <Cell key={i} fill={EFFORT_FILLS[entry.effort] ?? CHART_COLORS.secondary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 mt-2 justify-center text-[10px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Low effort</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Medium</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> High</span>
      </div>
    </div>
  );
}
