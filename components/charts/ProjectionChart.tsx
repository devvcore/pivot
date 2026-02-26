"use client";

import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar } from "./chart-utils";

interface DataPoint {
  month: string;
  baseline: number;
  projected: number;
}

interface ProjectionData {
  title: string;
  subtitle?: string;
  dataPoints: DataPoint[];
  insight?: string;
  totalImpact?: string;
}

interface Props {
  data: ProjectionData;
}

export function ProjectionChart({ data }: Props) {
  if (!data.dataPoints?.length) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm mt-3">
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-zinc-900">{data.title}</h4>
        {data.subtitle && (
          <p className="text-[10px] text-zinc-500 mt-0.5">{data.subtitle}</p>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data.dataPoints} margin={{ left: 5, right: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 9 }}
            tickFormatter={(v) => {
              const parts = String(v).split(" ");
              return parts[0]?.slice(0, 3) ?? v;
            }}
          />
          <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => formatDollar(v)} />
          <Tooltip
            formatter={(v) => formatDollar(Number(v ?? 0))}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend
            wrapperStyle={{ fontSize: 10 }}
            iconSize={8}
          />
          <Area
            type="monotone"
            dataKey="baseline"
            fill="#f4f4f5"
            stroke={CHART_COLORS.muted}
            strokeDasharray="5 5"
            fillOpacity={0.3}
            name="Baseline (no change)"
          />
          <Line
            type="monotone"
            dataKey="projected"
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.accent }}
            name="Projected (with changes)"
          />
        </ComposedChart>
      </ResponsiveContainer>
      {(data.insight || data.totalImpact) && (
        <div className="mt-3 pt-3 border-t border-zinc-100 flex gap-4 text-[10px]">
          {data.insight && (
            <p className="text-zinc-600 flex-1">{data.insight}</p>
          )}
          {data.totalImpact && (
            <p className="text-zinc-900 font-semibold shrink-0">{data.totalImpact}</p>
          )}
        </div>
      )}
    </div>
  );
}
