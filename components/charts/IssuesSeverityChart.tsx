// @ts-nocheck
"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { SEVERITY_COLORS, CHART_COLORS, TOOLTIP_STYLE, formatDollar } from "./chart-utils";
import { OverlayProjection } from "./OverlayProjection";

interface Issue {
  severity: string;
  financialImpact?: number;
  category?: string;
  title?: string;
  description: string;
}

interface OverlayData {
  dataPoints: { month: string; baseline: number; projected: number }[];
  title?: string;
  subtitle?: string;
  insight?: string;
  totalImpact?: string;
}

interface Props {
  issues: Issue[];
  overlay?: OverlayData;
  onDismissOverlay?: () => void;
}

export function IssuesSeverityChart({ issues, overlay, onDismissOverlay }: Props) {
  if (!issues.length) return null;

  // Group by severity
  const severityCounts: Record<string, number> = {};
  for (const i of issues) {
    const sev = i.severity;
    severityCounts[sev] = (severityCounts[sev] ?? 0) + 1;
  }
  const severityData = Object.entries(severityCounts)
    .sort((a, b) => {
      const order: Record<string, number> = { Critical: 0, HIGH: 1, High: 2, MED: 3, Medium: 4, Low: 5, LOW: 6 };
      return (order[a[0]] ?? 7) - (order[b[0]] ?? 7);
    })
    .map(([name, count]) => ({ name, count }));

  // Top issues by financial impact
  const impactData = issues
    .filter((i) => i.financialImpact && i.financialImpact > 0)
    .sort((a, b) => (b.financialImpact ?? 0) - (a.financialImpact ?? 0))
    .slice(0, 6)
    .map((i) => ({
      name: i.title ?? i.description,
      impact: i.financialImpact!,
      severity: i.severity,
    }));

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
            Issues by Severity
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={severityData} margin={{ left: 5, right: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count">
                {severityData.map((entry, i) => (
                  <Cell key={i} fill={SEVERITY_COLORS[entry.name] ?? CHART_COLORS.secondary} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {impactData.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
              Top Financial Exposure
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={impactData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tickFormatter={(v) => formatDollar(v)} tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 9 }} />
                <Tooltip
                  formatter={(v) => formatDollar(Number(v ?? 0))}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="impact" radius={[0, 4, 4, 0]} name="Financial Impact">
                  {impactData.map((entry, i) => (
                    <Cell key={i} fill={SEVERITY_COLORS[entry.severity] ?? CHART_COLORS.secondary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {overlay && overlay.dataPoints?.length > 0 && (
        <OverlayProjection data={overlay} onDismiss={onDismissOverlay} />
      )}
    </div>
  );
}
