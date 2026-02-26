"use client";

import { useMemo } from "react";
import { SECTION_VIZ, detectVizType } from "@/lib/viz-types";
import type { VizType } from "@/lib/viz-types";
import SourceBadge from "./SourceBadge";
import type { SourceStatus } from "./SourceBadge";
import type { ClaimValidation } from "@/lib/types";
import ScoreGauge from "./charts/ScoreGauge";
import RankedBarsChart from "./charts/RankedBarsChart";
import BreakdownDonut from "./charts/BreakdownDonut";
import TimeSeriesChart from "./charts/TimeSeriesChart";
import ComparisonRadar from "./charts/ComparisonRadar";
import MatrixScatter from "./charts/MatrixScatter";
import FunnelChart from "./charts/FunnelChart";
import WaterfallChart from "./charts/WaterfallChart";

interface SmartSectionRendererProps {
  sectionKey: string;
  data: Record<string, unknown>;
  title: string;
  claimValidations?: ClaimValidation[];
}

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

/** Extract array data from common field names */
function extractItems(data: Record<string, unknown>): any[] {
  for (const key of ["items", "stages", "steps", "dimensions", "categories", "forecast", "projections", "timeline", "periods", "risks", "opportunities", "leaks", "gaps", "findings", "entries"]) {
    const val = data[key];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      return val as any[];
    }
  }
  // Fallback: find any array of objects
  for (const val of Object.values(data)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      return val as any[];
    }
  }
  return [];
}

/** Get recommendations from data */
function extractRecommendations(data: Record<string, unknown>): string[] {
  const recs = data.recommendations ?? data.actions ?? data.actionItems ?? data.nextSteps;
  if (Array.isArray(recs)) {
    return recs.filter((r): r is string => typeof r === "string").slice(0, 5);
  }
  return [];
}

/** Extract top-level metrics (non-array, non-object scalar values) */
function extractMetrics(data: Record<string, unknown>): { key: string; value: string | number; source?: SourceStatus }[] {
  const metrics: { key: string; value: string | number; source?: SourceStatus }[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === "recommendations" || key === "items" || key.startsWith("_") || key === "relevanceNote") continue;
    if (Array.isArray(val) || (typeof val === "object" && val !== null)) continue;
    if (typeof val === "string" || typeof val === "number") {
      const sourceKey = `${key}_source`;
      const source = data[sourceKey] as SourceStatus | undefined;
      metrics.push({ key, value: val, source });
    }
  }
  return metrics.slice(0, 8);
}

/** Format camelCase key to readable label */
function formatKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
}

function SmartVisualization({ vizType, data, items }: { vizType: VizType; data: Record<string, unknown>; items: any[] }) {
  const scoreInfo = extractScore(data);
  const isCurrency = Object.keys(data).join(" ").toLowerCase().match(/revenue|cash|cost|amount|dollar|margin|profit/) !== null;

  switch (vizType) {
    case "score_gauge":
      if (scoreInfo) {
        return <ScoreGauge score={scoreInfo.score} grade={scoreInfo.grade} label={scoreInfo.label} />;
      }
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

export default function SmartSectionRenderer({ sectionKey, data, title, claimValidations }: SmartSectionRendererProps) {
  const vizType = useMemo(() => SECTION_VIZ[sectionKey] ?? detectVizType(data), [sectionKey, data]);
  const items = useMemo(() => extractItems(data), [data]);
  const recommendations = useMemo(() => extractRecommendations(data), [data]);
  const metrics = useMemo(() => extractMetrics(data), [data]);
  const relevanceNote = typeof data.relevanceNote === "string" ? data.relevanceNote : null;
  const summary = typeof data.summary === "string" ? data.summary : null;

  return (
    <div className="space-y-6">
      {/* Hero: Summary + relevance note + claim validation */}
      {(summary || relevanceNote || (claimValidations && claimValidations.length > 0)) && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {summary && <p className="text-sm text-zinc-700 leading-relaxed">{summary}</p>}
          {relevanceNote && (
            <p className="mt-2 text-xs text-zinc-500 italic">{relevanceNote}</p>
          )}
          {/* Claim validation summary */}
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

      {/* Top-level metrics cards */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map(({ key, value, source }) => (
            <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">{formatKey(key)}</p>
              <p className="mt-1 text-lg font-bold text-zinc-900">
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
              {source && <SourceBadge status={source} compact />}
            </div>
          ))}
        </div>
      )}

      {/* Smart visualization */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">{title}</h3>
        <SmartVisualization vizType={vizType} data={data} items={items} />
      </div>

      {/* Data table for items */}
      {items.length > 0 && vizType !== "table_only" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm overflow-x-auto">
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">Details</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-100">
                {Object.keys(items[0]).filter(k => !k.endsWith("_source")).slice(0, 6).map((k) => (
                  <th key={k} className="text-left py-2 pr-3 font-medium text-zinc-500">{formatKey(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 15).map((item, i) => (
                <tr key={i} className="border-b border-zinc-50">
                  {Object.entries(item).filter(([k]) => !k.endsWith("_source")).slice(0, 6).map(([k, v], j) => (
                    <td key={j} className="py-2 pr-3 text-zinc-700">
                      {typeof v === "number" ? v.toLocaleString() : String(v ?? "—").slice(0, 80)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table-only: render all items as a table when no chart */}
      {vizType === "table_only" && items.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-100">
                {Object.keys(items[0]).filter(k => !k.endsWith("_source")).slice(0, 6).map((k) => (
                  <th key={k} className="text-left py-2 pr-3 font-medium text-zinc-500">{formatKey(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 20).map((item, i) => (
                <tr key={i} className="border-b border-zinc-50">
                  {Object.entries(item).filter(([k]) => !k.endsWith("_source")).slice(0, 6).map(([k, v], j) => (
                    <td key={j} className="py-2 pr-3 text-zinc-700">
                      {typeof v === "number" ? v.toLocaleString() : String(v ?? "—").slice(0, 80)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-3">Recommendations</h3>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-400 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
