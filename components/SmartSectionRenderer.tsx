"use client";

import { useMemo } from "react";
import { SECTION_VIZ, detectVizType } from "@/lib/viz-types";
import type { VizType } from "@/lib/viz-types";
import SourceBadge from "./SourceBadge";
import type { SourceStatus } from "./SourceBadge";
import type { ClaimValidation } from "@/lib/types";
import { formatLabel } from "@/lib/utils";
import ScoreGauge from "./charts/ScoreGauge";
import RankedBarsChart from "./charts/RankedBarsChart";
import BreakdownDonut from "./charts/BreakdownDonut";
import TimeSeriesChart from "./charts/TimeSeriesChart";
import ComparisonRadar from "./charts/ComparisonRadar";
import MatrixScatter from "./charts/MatrixScatter";
import FunnelChart from "./charts/FunnelChart";
import WaterfallChart from "./charts/WaterfallChart";
import InsightCallout from "./infographics/InsightCallout";
import KeyValueGrid from "./infographics/KeyValueGrid";
import StatusGrid from "./infographics/StatusGrid";
import ComparisonBar from "./infographics/ComparisonBar";
import { AcronymText } from "./AcronymTooltip";

interface SmartSectionRendererProps {
  sectionKey: string;
  data: Record<string, unknown>;
  title: string;
  claimValidations?: ClaimValidation[];
  compact?: boolean;
}

// ── Data Extraction Helpers ─────────────────────────────────────────────────

/** Extract the primary score from data if present */
function extractScore(data: Record<string, unknown>): { score: number; grade?: string; label?: string } | null {
  const scoreVal = data.score ?? data.overallScore ?? data.readinessScore ?? data.maturityScore ?? data.healthScore;
  if (typeof scoreVal === "number") {
    return {
      score: scoreVal,
      grade: typeof data.grade === "string" ? data.grade : undefined,
      label: typeof data.label === "string" ? data.label : undefined,
    };
  }
  return null;
}

/** Extract ALL arrays of objects from data (not just the first one) */
function extractAllArrays(data: Record<string, unknown>): { key: string; items: any[] }[] {
  const PRIORITY_KEYS = ["items", "stages", "steps", "dimensions", "categories", "forecast", "projections", "timeline", "periods", "risks", "opportunities", "leaks", "gaps", "findings", "entries", "channels", "segments", "drivers", "actions", "scenarios", "options", "milestones", "tasks"];
  const arrays: { key: string; items: any[] }[] = [];
  const seen = new Set<string>();

  // Priority keys first
  for (const key of PRIORITY_KEYS) {
    const val = data[key];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      arrays.push({ key, items: val });
      seen.add(key);
    }
  }

  // Then remaining arrays
  for (const [key, val] of Object.entries(data)) {
    if (seen.has(key) || key.endsWith("_source") || key.startsWith("_")) continue;
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      arrays.push({ key, items: val });
    }
  }

  return arrays;
}

/** Get string arrays (recommendations, actions, etc.) */
function extractRecommendations(data: Record<string, unknown>): string[] {
  const recs = data.recommendations ?? data.actions ?? data.actionItems ?? data.nextSteps;
  if (Array.isArray(recs)) {
    return recs.filter((r): r is string => typeof r === "string").slice(0, 5);
  }
  return [];
}

/** Extract all additional string arrays (e.g., contentPillars, toolsRecommended) beyond recommendations */
function extractStringArrays(data: Record<string, unknown>): { key: string; items: string[] }[] {
  const skipKeys = new Set(["recommendations", "actions", "actionItems", "nextSteps"]);
  const result: { key: string; items: string[] }[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (skipKeys.has(key) || key.endsWith("_source") || key.startsWith("_")) continue;
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
      result.push({ key, items: val.filter((v): v is string => typeof v === "string") });
    }
  }
  return result.slice(0, 4);
}

/** Extract top-level metrics (non-array, non-object scalar values) */
function extractMetrics(data: Record<string, unknown>): { key: string; value: string | number; source?: SourceStatus }[] {
  const metrics: { key: string; value: string | number; source?: SourceStatus }[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === "recommendations" || key === "items" || key === "summary" || key === "relevanceNote") continue;
    if (key.endsWith("_source") || key.startsWith("_")) continue;
    if (Array.isArray(val) || (typeof val === "object" && val !== null)) continue;
    if (typeof val === "string" || typeof val === "number") {
      const sourceKey = `${key}_source`;
      const source = data[sourceKey] as SourceStatus | undefined;
      metrics.push({ key, value: val, source });
    }
  }
  return metrics.slice(0, 8);
}

/** Extract nested objects (non-array, non-scalar) */
function extractSubObjects(data: Record<string, unknown>): { key: string; obj: Record<string, unknown> }[] {
  const objs: { key: string; obj: Record<string, unknown> }[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key.endsWith("_source") || key.startsWith("_") || key === "recommendations") continue;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      objs.push({ key, obj: val as Record<string, unknown> });
    }
  }
  return objs.slice(0, 4);
}

/** Detect if items have status-like fields for StatusGrid */
function hasStatusPattern(items: any[]): boolean {
  if (items.length === 0) return false;
  const first = items[0];
  return (
    typeof first === "object" &&
    ("status" in first || "state" in first || "compliant" in first || "passed" in first) &&
    ("label" in first || "name" in first || "item" in first || "check" in first || "requirement" in first)
  );
}

/** Detect if items have comparison-bar pattern */
function hasComparisonPattern(items: any[]): boolean {
  if (items.length === 0 || items.length > 8) return false;
  const first = items[0];
  return (
    typeof first === "object" &&
    ("value" in first || "score" in first) &&
    ("label" in first || "name" in first || "category" in first)
  );
}

/** Format code key to readable label */
const formatKey = formatLabel;

/** Format metric value with auto-detection */
function formatMetricValue(key: string, value: string | number): string {
  if (typeof value === "string") return value;
  const k = key.toLowerCase();
  if (k.includes("percent") || k.includes("pct") || k.includes("rate") || k.includes("margin")) {
    return `${value}%`;
  }
  if (k.includes("score") || k.includes("grade") || k.includes("index")) {
    return String(value);
  }
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (value > 100 && (k.includes("revenue") || k.includes("cost") || k.includes("cash") || k.includes("amount") || k.includes("profit") || k.includes("expense"))) {
    return `$${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

/** Color for metric values */
function getMetricColor(key: string, value: string | number): string {
  const k = key.toLowerCase();
  if (typeof value === "number") {
    if (k.includes("risk") || k.includes("churn") || k.includes("debt") || k.includes("burn")) {
      return value > 50 ? "text-red-600" : "text-zinc-900";
    }
    if (k.includes("score") || k.includes("health") || k.includes("satisfaction")) {
      return value >= 80 ? "text-emerald-600" : value >= 60 ? "text-amber-600" : "text-red-600";
    }
  }
  return "text-zinc-900";
}

// ── Visualization Component ─────────────────────────────────────────────────

function SmartVisualization({ vizType, data, items }: { vizType: VizType; data: Record<string, unknown>; items: any[] }) {
  const scoreInfo = extractScore(data);
  const isCurrency = Object.keys(data).join(" ").toLowerCase().match(/revenue|cash|cost|amount|dollar|margin|profit/) !== null;

  switch (vizType) {
    case "score_gauge":
      if (scoreInfo) return <ScoreGauge score={scoreInfo.score} grade={scoreInfo.grade} label={scoreInfo.label} />;
      return null;
    case "ranked_bars":
      return items.length > 0 ? <RankedBarsChart items={items} isCurrency={isCurrency} /> : null;
    case "breakdown_pie":
      return items.length > 0 ? <BreakdownDonut items={items} /> : null;
    case "time_series":
      return items.length > 0 ? <TimeSeriesChart data={items} isCurrency={isCurrency} /> : null;
    case "comparison_radar":
      return items.length > 0 ? <ComparisonRadar dimensions={items} /> : null;
    case "matrix_scatter":
      return items.length > 0 ? <MatrixScatter items={items} /> : null;
    case "funnel":
      return items.length > 0 ? <FunnelChart stages={items} /> : null;
    case "waterfall":
      return items.length > 0 ? <WaterfallChart items={items} /> : null;
    case "table_only":
    default:
      return null;
  }
}

// ── Data Table Component ────────────────────────────────────────────────────

function DataTable({ items, label, maxRows }: { items: any[]; label?: string; maxRows: number }) {
  if (items.length === 0) return null;
  const cols = Object.keys(items[0]).filter(k => !k.endsWith("_source") && !k.startsWith("_")).slice(0, 6);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm overflow-x-auto">
      {label && <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">{formatKey(label)}</h4>}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-100">
            {cols.map(k => (
              <th key={k} className="text-left py-2 pr-3 font-medium text-zinc-500">{formatKey(k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.slice(0, maxRows).map((item, i) => (
            <tr key={i} className="border-b border-zinc-50">
              {cols.map((k, j) => {
                const v = item[k];
                let display: string;
                if (v == null) display = "—";
                else if (typeof v === "number") display = v.toLocaleString();
                else if (typeof v === "string") display = v;
                else if (Array.isArray(v)) display = v.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(", ");
                else if (typeof v === "object") {
                  // Extract meaningful value from nested objects
                  const obj = v as Record<string, unknown>;
                  display = obj.value != null ? String(obj.value) : obj.name != null ? String(obj.name) : obj.label != null ? String(obj.label) : obj.amount != null ? String(obj.amount) : Object.values(obj).filter(x => typeof x === "string" || typeof x === "number").map(String).join(", ") || "—";
                }
                else display = String(v);
                return (
                  <td key={j} className="py-2 pr-3 text-zinc-700 break-words whitespace-normal">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function SmartSectionRenderer({ sectionKey, data, title, claimValidations, compact = false }: SmartSectionRendererProps) {
  const vizType = useMemo(() => SECTION_VIZ[sectionKey] ?? detectVizType(data), [sectionKey, data]);
  const allArrays = useMemo(() => extractAllArrays(data), [data]);
  const primaryItems = allArrays.length > 0 ? allArrays[0].items : [];
  const secondaryArrays = allArrays.slice(1);
  const recommendations = useMemo(() => extractRecommendations(data), [data]);
  const metrics = useMemo(() => extractMetrics(data), [data]);
  const subObjects = useMemo(() => extractSubObjects(data), [data]);
  const stringArrays = useMemo(() => extractStringArrays(data), [data]);
  const relevanceNote = typeof data.relevanceNote === "string" ? data.relevanceNote : null;
  const summary = typeof data.summary === "string" ? data.summary : null;
  const headline = typeof data.headline === "string" ? data.headline : null;
  const keyFinding = typeof data.keyFinding === "string" ? data.keyFinding : (typeof data.key_finding === "string" ? data.key_finding : null);

  const maxTableRows = compact ? 8 : 15;

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* Headline callout */}
      {headline && (
        <InsightCallout text={headline} variant="info" label="Key Insight" />
      )}

      {/* Key finding callout */}
      {keyFinding && !headline && (
        <InsightCallout text={keyFinding} variant="warning" label="Key Finding" />
      )}

      {/* Summary + relevance + claim validation */}
      {(summary || relevanceNote || (claimValidations && claimValidations.length > 0)) && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          {summary && <p className="text-sm text-zinc-700 leading-relaxed"><AcronymText text={summary} /></p>}
          {relevanceNote && (
            <p className="mt-2 text-xs text-zinc-500 italic">{relevanceNote}</p>
          )}
          {claimValidations && claimValidations.length > 0 && (() => {
            const verified = claimValidations.filter(c => c.status === "verified").length;
            const estimated = claimValidations.filter(c => c.status === "estimated").length;
            const conflicting = claimValidations.filter(c => c.status === "conflicting").length;
            return (
              <div className="flex items-center gap-3 text-xs font-mono mt-3">
                {verified > 0 && <span className="text-emerald-600">{verified} verified</span>}
                {estimated > 0 && <span className="text-amber-600">{estimated} estimated</span>}
                {conflicting > 0 && <span className="text-red-600">{conflicting} conflicting</span>}
              </div>
            );
          })()}
        </div>
      )}

      {/* Top-level metrics cards with auto-formatting and color */}
      {metrics.length > 0 && (
        <div className={`grid gap-3 ${metrics.length <= 2 ? "grid-cols-2" : metrics.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
          {metrics.map(({ key, value, source }) => (
            <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider break-words leading-tight"><AcronymText text={formatKey(key)} /></p>
              <p className={`mt-1 text-lg font-bold tabular-nums ${getMetricColor(key, value)}`}>
                {formatMetricValue(key, value)}
              </p>
              {source && <SourceBadge status={source} compact />}
            </div>
          ))}
        </div>
      )}

      {/* Primary visualization */}
      {primaryItems.length > 0 && vizType !== "table_only" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">{title}</h3>
          {/* Status grid for checklist-like data */}
          {hasStatusPattern(primaryItems) ? (
            <StatusGrid
              items={primaryItems.map(item => ({
                label: item.label ?? item.name ?? item.item ?? item.check ?? item.requirement ?? "—",
                status: item.status ?? item.state ?? (item.compliant ? "pass" : item.passed ? "pass" : "fail"),
              }))}
            />
          ) : hasComparisonPattern(primaryItems) && primaryItems.length <= 6 ? (
            <ComparisonBar
              items={primaryItems.map(item => ({
                label: item.label ?? item.name ?? item.category ?? "—",
                value: item.value ?? item.score ?? 0,
              }))}
            />
          ) : (
            <SmartVisualization vizType={vizType} data={data} items={primaryItems} />
          )}
        </div>
      )}

      {/* Table-only: render all items as table when no chart */}
      {vizType === "table_only" && primaryItems.length > 0 && (
        <DataTable items={primaryItems} label={allArrays[0]?.key} maxRows={maxTableRows} />
      )}

      {/* Primary items detail table (when a chart was shown) */}
      {primaryItems.length > 0 && vizType !== "table_only" && !hasStatusPattern(primaryItems) && !compact && (
        <DataTable items={primaryItems} label="Details" maxRows={maxTableRows} />
      )}

      {/* Secondary arrays — additional tables/charts for multi-array sections */}
      {secondaryArrays.map(({ key, items }) => {
        // String arrays (like recommendations) render as lists
        if (items.length > 0 && typeof items[0] === "string") return null;

        // Status-grid pattern
        if (hasStatusPattern(items)) {
          return (
            <StatusGrid
              key={key}
              title={formatKey(key)}
              items={items.map(item => ({
                label: item.label ?? item.name ?? item.item ?? "—",
                status: item.status ?? item.state ?? "unknown",
              }))}
            />
          );
        }

        // Default: render as table
        return <DataTable key={key} items={items} label={key} maxRows={compact ? 5 : 10} />;
      })}

      {/* Nested sub-objects rendered as key-value grids */}
      {subObjects.length > 0 && !compact && (
        <div className={`grid gap-3 ${subObjects.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
          {subObjects.map(({ key, obj }) => (
            <KeyValueGrid key={key} data={obj} title={formatKey(key)} />
          ))}
        </div>
      )}

      {/* Additional string arrays (contentPillars, toolsRecommended, etc.) */}
      {stringArrays.length > 0 && (
        <div className={`grid gap-3 ${stringArrays.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
          {stringArrays.map(({ key, items }) => (
            <div key={key} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-3">{formatKey(key)}</h4>
              <ul className="space-y-2">
                {items.slice(0, compact ? 4 : 8).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-zinc-400 flex-shrink-0" />
                    <AcronymText text={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-3">Recommendations</h3>
          <ul className="space-y-2">
            {recommendations.slice(0, compact ? 3 : 5).map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-zinc-400 flex-shrink-0" />
                <AcronymText text={rec} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
