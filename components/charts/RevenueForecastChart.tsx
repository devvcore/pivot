// @ts-nocheck
"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TOOLTIP_STYLE, formatDollar } from "./chart-utils";
import type { RevenueForecast } from "@/lib/types";

// Scenario color mapping
const SCENARIO_COLORS: Record<string, { stroke: string; fill: string }> = {
  Optimistic: { stroke: "#22c55e", fill: "#22c55e" },   // green-500
  "Base Case": { stroke: "#3b82f6", fill: "#3b82f6" },  // blue-500
  Conservative: { stroke: "#f59e0b", fill: "#f59e0b" },  // amber-500
};

// Fallback colors when scenario names don't match exactly
const FALLBACK_COLORS = [
  { stroke: "#22c55e", fill: "#22c55e" },
  { stroke: "#3b82f6", fill: "#3b82f6" },
  { stroke: "#f59e0b", fill: "#f59e0b" },
];

function getScenarioColor(name: string, index: number) {
  return SCENARIO_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

interface Props {
  forecast: RevenueForecast;
}

export function RevenueForecastChart({ forecast }: Props) {
  const scenarios = forecast.scenarios ?? [];

  // Track which scenarios are visible
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of scenarios) {
      init[s.name] = true;
    }
    return init;
  });

  // Merge all scenario monthly data into a single flat array for Recharts.
  // Each row: { month, <scenarioName>_revenue, <scenarioName>_profit, ... }
  const mergedData = useMemo(() => {
    if (!scenarios.length) return [];

    // Use the scenario with the most months as the base for month labels
    const longestScenario = scenarios.reduce((a, b) =>
      (b.monthly?.length ?? 0) > (a.monthly?.length ?? 0) ? b : a
    );

    return (longestScenario.monthly ?? []).map((_, i) => {
      const row: Record<string, string | number> = {};
      row.month = longestScenario.monthly[i].month;

      for (const s of scenarios) {
        const point = s.monthly?.[i];
        if (point) {
          row[`${s.name}_revenue`] = point.revenue;
          row[`${s.name}_profit`] = point.profit;
          row[`${s.name}_costs`] = point.costs;
        }
      }
      return row;
    });
  }, [scenarios]);

  if (!scenarios.length || !mergedData.length) return null;

  const toggleScenario = (name: string) => {
    setVisible((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="space-y-4">
      {/* Revenue Forecast Chart */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">
              Revenue Forecast — 12 Month Scenarios
            </h3>
            {forecast.currentMRR && (
              <p className="text-[10px] text-zinc-500 mt-1">
                Current MRR: {forecast.currentMRR}
                {forecast.growthRate ? ` | Growth: ${forecast.growthRate}` : ""}
              </p>
            )}
          </div>

          {/* Scenario toggles */}
          <div className="flex gap-3 flex-wrap justify-end">
            {scenarios.map((s, i) => {
              const color = getScenarioColor(s.name, i);
              const isActive = visible[s.name];
              return (
                <button
                  key={s.name}
                  onClick={() => toggleScenario(s.name)}
                  className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md border transition-all ${
                    isActive
                      ? "border-zinc-300 bg-zinc-50 text-zinc-900"
                      : "border-zinc-200 bg-white text-zinc-400 line-through"
                  }`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: isActive ? color.stroke : "#d4d4d8",
                    }}
                  />
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={mergedData} margin={{ left: 5, right: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 9 }}
              tickFormatter={(v) => {
                const parts = String(v).split(" ");
                return parts[0]?.slice(0, 3) ?? v;
              }}
            />
            <YAxis
              tick={{ fontSize: 9 }}
              tickFormatter={(v) => formatDollar(v)}
            />
            <Tooltip
              formatter={(v, name) => {
                const label = String(name)
                  .replace(/_revenue$/, " Revenue")
                  .replace(/_profit$/, " Profit");
                return [formatDollar(Number(v ?? 0)), label];
              }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ fontSize: 10, fontWeight: 600 }}
            />

            {/* Render each visible scenario: area for revenue, dashed line for profit */}
            {scenarios.map((s, i) => {
              if (!visible[s.name]) return null;
              const color = getScenarioColor(s.name, i);
              return (
                <Area
                  key={`${s.name}_revenue`}
                  type="monotone"
                  dataKey={`${s.name}_revenue`}
                  stroke={color.stroke}
                  fill={color.fill}
                  fillOpacity={0.08}
                  strokeWidth={2}
                  dot={false}
                  name={`${s.name}_revenue`}
                  connectNulls
                />
              );
            })}

            {scenarios.map((s, i) => {
              if (!visible[s.name]) return null;
              const color = getScenarioColor(s.name, i);
              return (
                <Line
                  key={`${s.name}_profit`}
                  type="monotone"
                  dataKey={`${s.name}_profit`}
                  stroke={color.stroke}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  name={`${s.name}_profit`}
                  connectNulls
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend hint */}
        <div className="flex items-center gap-4 mt-2 text-[9px] text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-[2px] bg-zinc-400" /> Solid = Revenue
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-[2px] bg-zinc-400 border-dashed" style={{ borderTop: "2px dashed #a1a1aa", height: 0 }} /> Dashed = Profit
          </span>
        </div>
      </div>

      {/* Scenario summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map((s, i) => {
          const color = getScenarioColor(s.name, i);
          return (
            <div
              key={s.name}
              className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color.stroke }}
                />
                <h4 className="text-xs font-semibold text-zinc-900">{s.name}</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <p className="text-zinc-400">12-Mo Revenue</p>
                  <p className="text-zinc-900 font-semibold">
                    {formatDollar(s.totalRevenue12Mo)}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400">12-Mo Profit</p>
                  <p className="text-zinc-900 font-semibold">
                    {formatDollar(s.totalProfit12Mo)}
                  </p>
                </div>
                {s.breakEvenMonth && (
                  <div className="col-span-2">
                    <p className="text-zinc-400">Break-even</p>
                    <p className="text-zinc-900 font-medium">{s.breakEvenMonth}</p>
                  </div>
                )}
              </div>
              {s.assumptions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-100">
                  <p className="text-[9px] text-zinc-400 mb-1">Key Assumptions</p>
                  <ul className="text-[10px] text-zinc-600 space-y-0.5">
                    {s.assumptions.slice(0, 3).map((a, j) => (
                      <li key={j} className="leading-tight">
                        &bull; {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Key Drivers & Risks */}
      {(forecast.keyDrivers?.length > 0 || forecast.risks?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {forecast.keyDrivers?.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
              <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-3">
                Key Revenue Drivers
              </h4>
              <div className="space-y-2">
                {forecast.keyDrivers.map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        d.confidence === "high"
                          ? "bg-green-500"
                          : d.confidence === "medium"
                          ? "bg-amber-500"
                          : "bg-zinc-400"
                      }`}
                    />
                    <div className="text-[10px]">
                      <p className="text-zinc-900 font-medium leading-tight">{d.driver}</p>
                      <p className="text-zinc-500">{d.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {forecast.risks?.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
              <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-3">
                Revenue Risks
              </h4>
              <div className="space-y-2">
                {forecast.risks.map((r, i) => (
                  <div key={i} className="text-[10px]">
                    <p className="text-zinc-900 font-medium leading-tight">{r.risk}</p>
                    <p className="text-zinc-500">
                      Impact: {r.revenueImpact}
                      {r.mitigant ? ` | Mitigant: ${r.mitigant}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data quality note */}
      {forecast.dataQualityNote && (
        <p className="text-[9px] text-zinc-400 italic px-1">{forecast.dataQualityNote}</p>
      )}
    </div>
  );
}
