// @ts-nocheck
"use client";

import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { X, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar } from "./chart-utils";

interface OverlayProjectionProps {
  data: {
    title?: string;
    subtitle?: string;
    dataPoints: { month: string; baseline: number; projected: number }[];
    chartData?: { period: string; baseline: number; projected: number }[];
    metrics?: {
      currentValue: number;
      projectedValue: number;
      changePercent: number;
      timeframe: string;
    };
    insight?: string;
    totalImpact?: string;
  };
  onDismiss?: () => void;
}

export function OverlayProjection({ data, onDismiss }: OverlayProjectionProps) {
  // Use chartData if available, fall back to dataPoints
  const chartPoints = data.dataPoints?.length
    ? data.dataPoints
    : data.chartData?.map(d => ({ month: d.period, baseline: d.baseline, projected: d.projected })) ?? [];

  if (!chartPoints.length) return null;

  const metrics = data.metrics;
  const isPositive = metrics ? metrics.changePercent >= 0 : true;

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

      {/* Metrics cards */}
      {metrics && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white/70 rounded-lg px-2.5 py-1.5 border border-blue-100">
            <p className="text-[8px] font-mono text-zinc-400 uppercase tracking-wider">Current</p>
            <p className="text-xs font-bold text-zinc-900 tabular-nums">{formatDollar(metrics.currentValue)}</p>
          </div>
          <div className="bg-white/70 rounded-lg px-2.5 py-1.5 border border-blue-100 flex flex-col items-center justify-center">
            <ArrowRight className="w-3 h-3 text-zinc-400 mb-0.5" />
            <p className="text-[8px] font-mono text-zinc-400 uppercase">{metrics.timeframe}</p>
          </div>
          <div className={`rounded-lg px-2.5 py-1.5 border ${isPositive ? "bg-emerald-50/70 border-emerald-200" : "bg-red-50/70 border-red-200"}`}>
            <p className="text-[8px] font-mono text-zinc-400 uppercase tracking-wider">Projected</p>
            <div className="flex items-center gap-0.5">
              <p className={`text-xs font-bold tabular-nums ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
                {formatDollar(metrics.projectedValue)}
              </p>
              <span className={`flex items-center text-[8px] font-semibold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {isPositive ? "+" : ""}{metrics.changePercent}%
              </span>
            </div>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={chartPoints} margin={{ top: 8, right: 12, bottom: 16, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#a1a1aa" }} tickFormatter={(v) => String(v).split(" ")[0]?.slice(0, 3) ?? v} axisLine={{ stroke: "#e4e4e7" }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickFormatter={(v) => formatDollar(v)} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => formatDollar(Number(v ?? 0))} contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="baseline" fill="#f4f4f5" stroke={CHART_COLORS.muted} strokeDasharray="5 5" fillOpacity={0.3} name="Baseline" />
          <Line type="monotone" dataKey="projected" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={{ r: 3.5, fill: CHART_COLORS.accent, stroke: "#fff", strokeWidth: 1.5 }} name="Projected" />
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
