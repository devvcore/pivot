// @ts-nocheck
"use client";

import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar } from "./chart-utils";

interface DataPoint {
  month: string;
  baseline: number;
  projected: number;
}

interface ProjectionMetrics {
  currentValue: number;
  projectedValue: number;
  changePercent: number;
  timeframe: string;
}

interface ProjectionData {
  title: string;
  subtitle?: string;
  dataPoints: DataPoint[];
  chartData?: { period: string; baseline: number; projected: number }[];
  metrics?: ProjectionMetrics;
  insight?: string;
  totalImpact?: string;
}

interface Props {
  data: ProjectionData;
  /** Optional narrative text to display below the chart */
  narrative?: string;
}

/** Try to extract chart data from text-only projections (fallback parser) */
function parseTextToChartData(text: string): DataPoint[] | null {
  // Look for patterns like "Week 1: $5,000" or "Opening Balance: $5,000 ... Closing Balance: $6,250"
  const weekPattern = /(?:Week|Month|Period)\s*(\d+)[^$]*\$?([\d,]+(?:\.\d+)?)/gi;
  const points: DataPoint[] = [];
  let match: RegExpExecArray | null;

  while ((match = weekPattern.exec(text)) !== null) {
    const period = `Week ${match[1]}`;
    const value = parseFloat(match[2].replace(/,/g, ""));
    if (!isNaN(value)) {
      points.push({ month: period, baseline: value * 0.85, projected: value });
    }
  }

  if (points.length >= 2) return points;

  // Try opening/closing balance pattern
  const balancePattern = /(?:Opening|Starting|Current)\s*(?:Balance|Value)?[:\s]*\$?([\d,]+(?:\.\d+)?)/i;
  const closingPattern = /(?:Closing|Final|Projected|End)\s*(?:Balance|Value)?[:\s]*\$?([\d,]+(?:\.\d+)?)/i;
  const openMatch = text.match(balancePattern);
  const closeMatch = text.match(closingPattern);

  if (openMatch && closeMatch) {
    const openVal = parseFloat(openMatch[1].replace(/,/g, ""));
    const closeVal = parseFloat(closeMatch[1].replace(/,/g, ""));
    if (!isNaN(openVal) && !isNaN(closeVal)) {
      const steps = 4;
      for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        points.push({
          month: `Week ${i + 1}`,
          baseline: openVal,
          projected: openVal + (closeVal - openVal) * ratio,
        });
      }
      return points;
    }
  }

  return null;
}

export function ProjectionChart({ data, narrative }: Props) {
  // Use chartData if available, fall back to dataPoints
  const chartPoints = data.dataPoints?.length
    ? data.dataPoints
    : data.chartData?.map(d => ({ month: d.period, baseline: d.baseline, projected: d.projected })) ?? [];

  if (!chartPoints.length) return null;

  const metrics = data.metrics;
  const isPositive = metrics ? metrics.changePercent >= 0 : true;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm mt-3">
      {/* Header */}
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-zinc-900">{data.title}</h4>
        {data.subtitle && (
          <p className="text-[10px] text-zinc-500 mt-0.5">{data.subtitle}</p>
        )}
      </div>

      {/* Metrics cards */}
      {metrics && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-zinc-50 rounded-xl px-3 py-2">
            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Current</p>
            <p className="text-sm font-bold text-zinc-900 tabular-nums">{formatDollar(metrics.currentValue)}</p>
          </div>
          <div className="bg-zinc-50 rounded-xl px-3 py-2 flex flex-col items-center justify-center">
            <ArrowRight className="w-3.5 h-3.5 text-zinc-400 mb-0.5" />
            <p className="text-[9px] font-mono text-zinc-400 uppercase">{metrics.timeframe}</p>
          </div>
          <div className={`rounded-xl px-3 py-2 ${isPositive ? "bg-emerald-50" : "bg-red-50"}`}>
            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Projected</p>
            <div className="flex items-center gap-1">
              <p className={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-700" : "text-red-700"}`}>
                {formatDollar(metrics.projectedValue)}
              </p>
              <span className={`flex items-center text-[9px] font-semibold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? "+" : ""}{metrics.changePercent}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartPoints} margin={{ left: 5, right: 10, bottom: 5 }}>
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

      {/* Insight + impact */}
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

      {/* Narrative text (from agent response) */}
      {narrative && (
        <div className="mt-3 pt-3 border-t border-zinc-100">
          <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap">{narrative}</p>
        </div>
      )}
    </div>
  );
}

/** Export the text parser for use in other components */
export { parseTextToChartData };
