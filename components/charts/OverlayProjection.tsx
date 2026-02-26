// @ts-nocheck
"use client";

import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { X } from "lucide-react";
import { motion } from "motion/react";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar } from "./chart-utils";

interface OverlayProjectionProps {
  data: {
    title?: string;
    subtitle?: string;
    dataPoints: { month: string; baseline: number; projected: number }[];
    insight?: string;
    totalImpact?: string;
  };
  onDismiss?: () => void;
}

export function OverlayProjection({ data, onDismiss }: OverlayProjectionProps) {
  if (!data.dataPoints?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 bg-gradient-to-br from-blue-50/50 to-white border border-blue-200 rounded-2xl p-5 relative shadow-sm"
    >
      {onDismiss && (
        <button onClick={onDismiss} className="absolute top-3 right-3 p-1 text-zinc-400 hover:text-zinc-700 transition-colors rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {data.title && <h4 className="text-xs font-semibold text-zinc-900 mb-0.5">{data.title}</h4>}
      {data.subtitle && <p className="text-[10px] text-zinc-500 mb-3">{data.subtitle}</p>}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data.dataPoints} margin={{ left: 5, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
          <XAxis dataKey="month" tick={{ fontSize: 9 }} tickFormatter={(v) => String(v).split(" ")[0]?.slice(0, 3) ?? v} />
          <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => formatDollar(v)} />
          <Tooltip formatter={(v) => formatDollar(Number(v ?? 0))} contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="baseline" fill="#f4f4f5" stroke={CHART_COLORS.muted} strokeDasharray="5 5" fillOpacity={0.3} name="Baseline" />
          <Line type="monotone" dataKey="projected" stroke={CHART_COLORS.accent} strokeWidth={2} dot={{ r: 2, fill: CHART_COLORS.accent }} name="Projected" />
        </ComposedChart>
      </ResponsiveContainer>
      {(data.insight || data.totalImpact) && (
        <div className="mt-2 pt-2 border-t border-blue-100 flex gap-4 text-[10px]">
          {data.insight && <p className="text-zinc-600 flex-1">{data.insight}</p>}
          {data.totalImpact && <p className="text-zinc-900 font-semibold shrink-0">{data.totalImpact}</p>}
        </div>
      )}
    </motion.div>
  );
}
