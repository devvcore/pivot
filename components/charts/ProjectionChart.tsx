// @ts-nocheck
"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ReferenceLine, ReferenceArea,
} from "recharts";
import { TrendingUp, TrendingDown, ArrowRight, RotateCcw, SlidersHorizontal, GripVertical } from "lucide-react";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar } from "./chart-utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface DataPoint {
  month: string;
  baseline: number;
  projected: number;
  optimistic?: number;
  pessimistic?: number;
}

interface ProjectionMetrics {
  currentValue: number;
  projectedValue: number;
  changePercent: number;
  timeframe: string;
}

interface ParameterConfig {
  min: number;
  max: number;
  default: number;
  step: number;
  label: string;
  unit: string;
}

type TimeHorizon = "1m" | "3m" | "6m" | "1y";

interface ProjectionData {
  title: string;
  subtitle?: string;
  dataPoints: DataPoint[];
  chartData?: { period: string; baseline: number; projected: number }[];
  metrics?: ProjectionMetrics;
  parameters?: Record<string, ParameterConfig>;
  formula?: string;
  insight?: string;
  totalImpact?: string;
}

interface Props {
  data: ProjectionData;
  narrative?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const HORIZON_LABELS: Record<TimeHorizon, string> = {
  "1m": "1 Month",
  "3m": "3 Months",
  "6m": "6 Months",
  "1y": "1 Year",
};

const SCENARIO_VARIANCE = {
  optimistic: 0.15, // +15%
  pessimistic: 0.12, // -12%
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate scenario bands (optimistic/pessimistic) around projected values */
function addScenarioBands(points: DataPoint[]): DataPoint[] {
  return points.map((p, i) => {
    // Variance grows with distance from start
    const distanceFactor = Math.min(i / Math.max(points.length - 1, 1), 1);
    const optVariance = 1 + SCENARIO_VARIANCE.optimistic * distanceFactor;
    const pessVariance = 1 - SCENARIO_VARIANCE.pessimistic * distanceFactor;

    return {
      ...p,
      optimistic: Math.round(p.projected * optVariance),
      pessimistic: Math.round(p.projected * pessVariance),
    };
  });
}

/** Slice data to match time horizon */
function sliceToHorizon(points: DataPoint[], horizon: TimeHorizon): DataPoint[] {
  const maxPoints: Record<TimeHorizon, number> = { "1m": 4, "3m": 12, "6m": 24, "1y": 52 };
  const max = maxPoints[horizon];
  if (points.length <= max) return points;
  // Evenly sample points to fit the horizon
  const step = Math.max(1, Math.floor(points.length / max));
  const sampled: DataPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]);
  }
  // Always include the last point
  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }
  return sampled;
}

/** Recalculate projected values based on slider parameters */
function recalculateProjection(
  baselinePoints: DataPoint[],
  params: Record<string, number>,
  originalParams: Record<string, ParameterConfig>,
): DataPoint[] {
  if (!baselinePoints || !baselinePoints.length) return baselinePoints ?? [];

  return baselinePoints.map((point, i) => {
    if (i === 0) return { ...point, projected: point.projected };

    let multiplier = 1;
    for (const [key, config] of Object.entries(originalParams)) {
      const currentVal = params[key] ?? config.default;
      const defaultVal = config.default;
      if (defaultVal === 0) continue;
      const paramRatio = currentVal / defaultVal;
      const effectWeight = 1 / Object.keys(originalParams).length;
      multiplier *= 1 + (paramRatio - 1) * effectWeight;
    }

    const originalDelta = point.projected - point.baseline;
    const adjustedDelta = originalDelta * multiplier;

    return {
      ...point,
      projected: Math.round(point.baseline + adjustedDelta),
    };
  });
}

/** Calculate slope between two points */
function calculateSlope(points: DataPoint[]): { monthlyRate: number; direction: string } {
  if (points.length < 2) return { monthlyRate: 0, direction: "flat" };
  const first = points[0].projected;
  const last = points[points.length - 1].projected;
  const periods = points.length - 1;
  const monthlyRate = periods > 0 ? (last - first) / periods : 0;
  const direction = monthlyRate > 0 ? "growing" : monthlyRate < 0 ? "declining" : "flat";
  return { monthlyRate, direction };
}

/** Try to extract chart data from text-only projections (fallback parser) */
function parseTextToChartData(text: string): DataPoint[] | null {
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

  const balancePattern = /(?:Opening|Starting|Current)\s*(?:Balance|Value)?[:\s]*\$?([\d,]+(?:\.\d+)?)/i;
  const closingPattern = /(?:Closing|Final|Projected|End)\s*(?:Balance|Value)?[:\s]*\$?([\d,]+(?:\.\d+)?)/i;
  const openMatch = text.match(balancePattern);
  const closeMatch = text.match(closingPattern);

  if (openMatch && closeMatch) {
    const openVal = parseFloat(openMatch[1].replace(/,/g, ""));
    const closeVal = parseFloat(closeMatch[1].replace(/,/g, ""));
    if (!isNaN(openVal) && !isNaN(closeVal)) {
      for (let i = 0; i <= 4; i++) {
        const ratio = i / 4;
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

// ── Animated Data Hook ───────────────────────────────────────────────────────
// Interpolates data values at 60fps for smooth chart morphing when sliders change

function useAnimatedData(targetData: DataPoint[]): DataPoint[] {
  const [display, setDisplay] = useState(targetData);
  const prevRef = useRef(targetData);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = targetData;

    // If lengths differ, snap immediately
    if (prev.length !== targetData.length) {
      setDisplay(targetData);
      return;
    }

    // Check if data actually changed
    const changed = targetData.some((t, i) =>
      t.projected !== prev[i]?.projected || t.optimistic !== prev[i]?.optimistic
    );
    if (!changed) return;

    const startTime = performance.now();
    const duration = 350;

    function tick(now: number) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

      const interpolated = targetData.map((target, i) => ({
        ...target,
        projected: Math.round((prev[i]?.projected ?? target.projected) + (target.projected - (prev[i]?.projected ?? target.projected)) * eased),
        baseline: Math.round((prev[i]?.baseline ?? target.baseline) + (target.baseline - (prev[i]?.baseline ?? target.baseline)) * eased),
        optimistic: target.optimistic != null
          ? Math.round((prev[i]?.optimistic ?? target.optimistic) + (target.optimistic - (prev[i]?.optimistic ?? target.optimistic)) * eased)
          : undefined,
        pessimistic: target.pessimistic != null
          ? Math.round((prev[i]?.pessimistic ?? target.pessimistic) + (target.pessimistic - (prev[i]?.pessimistic ?? target.pessimistic)) * eased)
          : undefined,
      }));

      setDisplay(interpolated);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }

    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameRef.current);
  }, [targetData]);

  return display;
}

// ── Draggable Dot ────────────────────────────────────────────────────────────
// Renders a dot that can be dragged vertically to adjust projected values

function DraggableDot(props: any) {
  const { cx, cy, index, payload, onDrag, yDomain, chartHeight, marginTop, marginBottom } = props;
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const isFuture = index > 0; // First point is current, rest are projections

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isFuture) return;
    e.stopPropagation();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }, [isFuture]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !onDrag) return;
    const svg = (e.target as SVGElement).closest("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgY = e.clientY - rect.top;
    const plotHeight = (chartHeight ?? 220) - (marginTop ?? 5) - (marginBottom ?? 25);
    const ratio = Math.max(0, Math.min(1, (svgY - (marginTop ?? 5)) / plotHeight));
    const [yMin, yMax] = yDomain ?? [0, 100];
    const value = yMax - ratio * (yMax - yMin);
    onDrag(index, Math.round(value));
  }, [dragging, onDrag, index, yDomain, chartHeight, marginTop, marginBottom]);

  const handlePointerUp = useCallback(() => setDragging(false), []);

  if (cx == null || cy == null) return null;

  return (
    <g>
      {/* Hit area */}
      {isFuture && (
        <circle
          cx={cx} cy={cy} r={14}
          fill="transparent"
          style={{ cursor: "ns-resize" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => { setHovered(false); setDragging(false); }}
          onPointerEnter={() => setHovered(true)}
        />
      )}
      {/* Visible dot */}
      <circle
        cx={cx} cy={cy}
        r={dragging ? 7 : hovered && isFuture ? 6 : 4}
        fill={dragging ? "#1d4ed8" : CHART_COLORS.accent}
        stroke="#fff"
        strokeWidth={2}
        style={{ transition: "r 100ms ease", pointerEvents: "none" }}
      />
      {/* Drag ring indicator */}
      {(hovered || dragging) && isFuture && (
        <circle
          cx={cx} cy={cy}
          r={dragging ? 10 : 8}
          fill="none"
          stroke={CHART_COLORS.accent}
          strokeWidth={1}
          strokeDasharray="3 2"
          opacity={0.4}
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-zinc-900 mb-1.5">{label}</p>
      <div className="space-y-1">
        {data.optimistic != null && (
          <div className="flex justify-between gap-4">
            <span className="text-emerald-500">Best case</span>
            <span className="font-mono font-semibold text-emerald-600">{formatDollar(data.optimistic)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-blue-500">Projected</span>
          <span className="font-mono font-bold text-blue-600">{formatDollar(data.projected)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Baseline</span>
          <span className="font-mono text-zinc-500">{formatDollar(data.baseline)}</span>
        </div>
        {data.pessimistic != null && (
          <div className="flex justify-between gap-4">
            <span className="text-amber-500">Conservative</span>
            <span className="font-mono font-semibold text-amber-600">{formatDollar(data.pessimistic)}</span>
          </div>
        )}
      </div>
      {data.optimistic != null && data.pessimistic != null && (
        <div className="mt-1.5 pt-1.5 border-t border-zinc-100">
          <p className="text-[9px] text-zinc-400">
            Range: {formatDollar(data.pessimistic)} — {formatDollar(data.optimistic)}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ProjectionChart({ data, narrative }: Props) {
  // Parse original data points
  const originalPoints = useMemo(() => {
    return data.dataPoints?.length
      ? data.dataPoints
      : data.chartData?.map(d => ({ month: d.period, baseline: d.baseline, projected: d.projected })) ?? [];
  }, [data]);

  // State
  const hasParams = data.parameters && Object.keys(data.parameters).length > 0;
  const [showSliders, setShowSliders] = useState(false);
  const [showScenarios, setShowScenarios] = useState(true);
  const [horizon, setHorizon] = useState<TimeHorizon>("3m");
  const [paramValues, setParamValues] = useState<Record<string, number>>(() => {
    if (!data.parameters) return {};
    const defaults: Record<string, number> = {};
    for (const [key, config] of Object.entries(data.parameters)) {
      defaults[key] = config.default;
    }
    return defaults;
  });

  const isModified = useMemo(() => {
    if (!data.parameters) return false;
    return Object.entries(data.parameters).some(
      ([key, config]) => paramValues[key] !== config.default
    );
  }, [paramValues, data.parameters]);

  // Recalculate when params change
  const recalculated = useMemo(() => {
    if (!isModified || !data.parameters) return originalPoints;
    return recalculateProjection(originalPoints, paramValues, data.parameters);
  }, [originalPoints, paramValues, isModified, data.parameters]);

  // Add scenario bands
  const withScenarios = useMemo(() => addScenarioBands(recalculated), [recalculated]);

  // Slice to time horizon
  const chartPoints = useMemo(() => sliceToHorizon(withScenarios, horizon), [withScenarios, horizon]);

  // Drag overrides: user-adjusted data points
  const [dragOverrides, setDragOverrides] = useState<Record<number, number>>({});
  const chartPointsWithDrag = useMemo(() => {
    if (Object.keys(dragOverrides).length === 0) return chartPoints;
    return chartPoints.map((p, i) => {
      if (dragOverrides[i] != null) {
        const val = dragOverrides[i];
        return { ...p, projected: val, optimistic: Math.round(val * 1.15), pessimistic: Math.round(val * 0.88) };
      }
      return p;
    });
  }, [chartPoints, dragOverrides]);

  // Animate data transitions for smooth morphing
  const animatedPoints = useAnimatedData(chartPointsWithDrag);

  // Drag handler
  const handleDotDrag = useCallback((index: number, value: number) => {
    setDragOverrides(prev => ({ ...prev, [index]: value }));
  }, []);

  // Reset drag overrides when sliders or horizon change
  useEffect(() => { setDragOverrides({}); }, [paramValues, horizon]);

  // Slope info
  const slope = useMemo(() => calculateSlope(animatedPoints), [animatedPoints]);

  // Metrics
  const metrics = useMemo(() => {
    if (!data.metrics) return undefined;
    if (!isModified) return data.metrics;
    const first = animatedPoints[0];
    const last = animatedPoints[animatedPoints.length - 1];
    if (!first || !last) return data.metrics;
    const currentValue = first.baseline;
    const projectedValue = last.projected;
    const changePercent = currentValue > 0
      ? Math.round(((projectedValue - currentValue) / currentValue) * 100)
      : 0;
    return { ...data.metrics, projectedValue, changePercent };
  }, [data.metrics, animatedPoints, isModified, dragOverrides]);

  const handleParamChange = useCallback((key: string, value: number) => {
    setParamValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    if (!data.parameters) return;
    const defaults: Record<string, number> = {};
    for (const [key, config] of Object.entries(data.parameters)) {
      defaults[key] = config.default;
    }
    setParamValues(defaults);
  }, [data.parameters]);

  if (!animatedPoints.length) return null;

  const hasDragOverrides = Object.keys(dragOverrides).length > 0;

  const isPositive = metrics ? metrics.changePercent >= 0 : true;

  // Calculate Y-axis domain with padding for scenario bands
  const allValues = animatedPoints.flatMap(p => [
    p.baseline, p.projected,
    p.optimistic ?? p.projected,
    p.pessimistic ?? p.projected,
  ].filter(v => v > 0));
  const yMin = Math.floor(Math.min(...allValues) * 0.9);
  const yMax = Math.ceil(Math.max(...allValues) * 1.05);

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm mt-3 overflow-hidden">
      {/* Header bar */}
      <div className="px-5 pt-4 pb-2 flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-xs font-semibold text-zinc-900">{data.title}</h4>
          {data.subtitle && (
            <p className="text-[10px] text-zinc-500 mt-0.5">{data.subtitle}</p>
          )}
          {/* Slope indicator */}
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
              slope.direction === "growing" ? "bg-emerald-50 text-emerald-600" :
              slope.direction === "declining" ? "bg-red-50 text-red-600" :
              "bg-zinc-50 text-zinc-500"
            }`}>
              {slope.direction === "growing" ? <TrendingUp className="w-2.5 h-2.5" /> :
               slope.direction === "declining" ? <TrendingDown className="w-2.5 h-2.5" /> : null}
              {slope.direction === "flat" ? "Flat" :
                `${slope.monthlyRate > 0 ? "+" : ""}${formatDollar(Math.abs(slope.monthlyRate))}/period`}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {/* Scenario toggle */}
          <button
            onClick={() => setShowScenarios(!showScenarios)}
            className={`text-[9px] font-medium px-2 py-1 rounded-lg transition-all ${
              showScenarios ? "bg-blue-50 text-blue-600" : "bg-zinc-50 text-zinc-400 hover:bg-zinc-100"
            }`}
            title="Toggle scenario bands"
          >
            ±
          </button>

          {/* Time horizon selector */}
          <div className="flex bg-zinc-100 rounded-lg p-0.5">
            {(Object.keys(HORIZON_LABELS) as TimeHorizon[]).map(h => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`text-[9px] font-medium px-2 py-0.5 rounded-md transition-all ${
                  horizon === h
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {h.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Adjust button */}
          {hasParams && (
            <button
              onClick={() => setShowSliders(!showSliders)}
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-all ${
                showSliders ? "bg-blue-50 text-blue-600" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              Adjust
            </button>
          )}
        </div>
      </div>

      {/* Metrics row */}
      {metrics && (
        <div className="px-5 pb-3">
          <div className="grid grid-cols-3 gap-2">
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
        </div>
      )}

      {/* Parameter sliders (collapsible) */}
      {hasParams && showSliders && data.parameters && (
        <div className="mx-5 mb-3 bg-zinc-50 rounded-xl p-3 space-y-3 border border-zinc-100">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">What-If Analysis</p>
            {isModified && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
          {Object.entries(data.parameters).map(([key, config]) => {
            const val = paramValues[key] ?? config.default;
            const pct = ((val - config.min) / (config.max - config.min)) * 100;
            const isChanged = val !== config.default;
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-zinc-600">{config.label}</label>
                  <span className={`text-[10px] font-mono font-semibold tabular-nums ${
                    isChanged ? "text-blue-600" : "text-zinc-900"
                  }`}>
                    {config.unit === "$"
                      ? `$${val.toLocaleString()}`
                      : `${val}${config.unit}`
                    }
                    {isChanged && (
                      <span className="ml-1 text-[8px] text-zinc-400">
                        (was {config.unit === "$" ? `$${config.default.toLocaleString()}` : `${config.default}${config.unit}`})
                      </span>
                    )}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={val}
                    onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-200 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md
                      [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                      [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
                      [&::-webkit-slider-thumb]:hover:scale-110
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                      [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500
                      [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white
                      [&::-moz-range-thumb]:cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${pct}%, #e4e4e7 ${pct}%, #e4e4e7 100%)`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[8px] text-zinc-400 mt-0.5">
                  <span>{config.unit === "$" ? `$${config.min.toLocaleString()}` : `${config.min}${config.unit}`}</span>
                  <span>{config.unit === "$" ? `$${config.max.toLocaleString()}` : `${config.max}${config.unit}`}</span>
                </div>
              </div>
            );
          })}
          {isModified && (
            <div className="flex items-center gap-2 pt-1.5 border-t border-zinc-200">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-[9px] text-blue-600 font-medium">
                Showing adjusted scenario — chart updates in real-time
              </p>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="px-3">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={animatedPoints} margin={{ left: 8, right: 12, bottom: 16, top: 8 }}>
            <defs>
              <linearGradient id="scenarioBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4d4d8" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#d4d4d8" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 9, fill: "#a1a1aa" }}
              tickFormatter={(v) => {
                const parts = String(v).split(" ");
                return parts.length > 1 ? `${parts[0]?.slice(0, 1)}${parts[1]}` : v?.slice(0, 3) ?? v;
              }}
              axisLine={{ stroke: "#e4e4e7" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#a1a1aa" }}
              tickFormatter={(v) => formatDollar(v)}
              axisLine={false}
              tickLine={false}
              domain={[yMin, yMax]}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Scenario band — optimistic to pessimistic range */}
            {showScenarios && (
              <>
                <Area
                  type="monotone"
                  dataKey="optimistic"
                  stroke="none"
                  fill="url(#scenarioBand)"
                  fillOpacity={1}
                  animationDuration={500}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="pessimistic"
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={0}
                  animationDuration={500}
                />
                <Line
                  type="monotone"
                  dataKey="optimistic"
                  stroke="#22c55e"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                  animationDuration={500}
                  name="Best case"
                />
                <Line
                  type="monotone"
                  dataKey="pessimistic"
                  stroke="#f59e0b"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                  animationDuration={500}
                  name="Conservative"
                />
              </>
            )}

            {/* Baseline area */}
            <Area
              type="monotone"
              dataKey="baseline"
              fill="url(#baselineGrad)"
              stroke={CHART_COLORS.muted}
              strokeDasharray="5 5"
              strokeWidth={1}
              fillOpacity={1}
              name="No change"
              animationDuration={500}
            />

            {/* Main projection line — dots are draggable */}
            <Line
              type="monotone"
              dataKey="projected"
              stroke={hasDragOverrides ? "#1d4ed8" : CHART_COLORS.accent}
              strokeWidth={2.5}
              dot={(dotProps: any) => (
                <DraggableDot
                  key={dotProps.index}
                  {...dotProps}
                  onDrag={handleDotDrag}
                  yDomain={[yMin, yMax]}
                  chartHeight={220}
                  marginTop={5}
                  marginBottom={25}
                />
              )}
              activeDot={false}
              name="Projected"
              animationDuration={0}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend + scenario range */}
      {showScenarios && animatedPoints.length > 1 && (
        <div className="px-5 pb-2">
          <div className="flex items-center gap-4 text-[9px] text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-emerald-500 inline-block" style={{ borderTop: "1px dashed #22c55e" }} />
              Best: {formatDollar(animatedPoints[animatedPoints.length - 1]?.optimistic ?? 0)}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-blue-500 inline-block" />
              Expected: {formatDollar(animatedPoints[animatedPoints.length - 1]?.projected ?? 0)}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-amber-500 inline-block" style={{ borderTop: "1px dashed #f59e0b" }} />
              Conservative: {formatDollar(animatedPoints[animatedPoints.length - 1]?.pessimistic ?? 0)}
            </span>
          </div>
        </div>
      )}

      {/* Drag mode indicator */}
      {hasDragOverrides && (
        <div className="mx-5 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[9px] text-indigo-500 font-medium">
            <GripVertical className="w-3 h-3" />
            {Object.keys(dragOverrides).length} point{Object.keys(dragOverrides).length !== 1 ? "s" : ""} manually adjusted — drag dots to reshape the projection
          </div>
          <button
            onClick={() => setDragOverrides({})}
            className="flex items-center gap-1 text-[9px] text-zinc-400 hover:text-zinc-600"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      )}

      {/* Insight + impact */}
      {(data.insight || data.totalImpact) && (
        <div className="mx-5 mb-3 pt-3 border-t border-zinc-100 flex gap-4 text-[10px]">
          {data.insight && (
            <p className="text-zinc-600 flex-1">{data.insight}</p>
          )}
          {data.totalImpact && (
            <p className="text-zinc-900 font-semibold shrink-0">{data.totalImpact}</p>
          )}
        </div>
      )}

      {/* Narrative */}
      {narrative && (
        <div className="mx-5 mb-4 pt-3 border-t border-zinc-100">
          <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap">{narrative}</p>
        </div>
      )}
    </div>
  );
}

export { parseTextToChartData };
