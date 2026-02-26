// @ts-nocheck
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "./chart-utils";

interface ScoreGaugeProps {
  score: number;         // 0-100
  grade?: string;        // A-F
  label?: string;        // "Health Score"
  maxScore?: number;     // default 100
}

export default function ScoreGauge({ score, grade, label, maxScore = 100 }: ScoreGaugeProps) {
  const pct = Math.min(Math.max(score / maxScore, 0), 1);
  const color = pct >= 0.7 ? CHART_COLORS.success : pct >= 0.4 ? CHART_COLORS.warning : CHART_COLORS.danger;
  const data = [
    { name: "score", value: pct * 100 },
    { name: "remaining", value: (1 - pct) * 100 },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-40 w-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="95%"
              startAngle={180}
              endAngle={0}
              innerRadius="65%"
              outerRadius="100%"
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="#f4f4f5" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className="text-3xl font-bold text-zinc-900">{score}</span>
          {grade && <span className="text-lg font-semibold text-zinc-500">Grade: {grade}</span>}
        </div>
      </div>
      {label && <p className="mt-1 text-sm font-medium text-zinc-600">{label}</p>}
    </div>
  );
}
