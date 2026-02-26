"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ZAxis,
  CartesianGrid,
} from "recharts";
import { TOOLTIP_STYLE } from "./chart-utils";
import type { RiskItem } from "@/lib/types";

interface Props {
  risks: RiskItem[];
}

function getRiskColor(score: number): string {
  if (score <= 6) return "#22c55e";   // green-500
  if (score <= 12) return "#f59e0b";  // amber-500
  return "#ef4444";                    // red-500
}

const QUADRANT_LABELS = [
  { label: "Monitor", x: 1.5, y: 1.5 },     // low likelihood, low impact
  { label: "Watch", x: 4.5, y: 1.5 },        // high likelihood, low impact
  { label: "Mitigate", x: 1.5, y: 4.5 },     // low likelihood, high impact
  { label: "Critical", x: 4.5, y: 4.5 },     // high likelihood, high impact
];

interface RiskTooltipProps {
  active?: boolean;
  payload?: { payload: { risk: string; category: string; likelihood: number; impact: number; riskScore: number; status: string; mitigation: string } }[];
}

function RiskTooltip({ active, payload }: RiskTooltipProps) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        ...TOOLTIP_STYLE,
        background: "#fff",
        padding: "8px 12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        maxWidth: 260,
      }}
    >
      <p style={{ fontWeight: 600, fontSize: 12, margin: 0, marginBottom: 4 }}>
        {d.risk}
      </p>
      <p style={{ fontSize: 11, margin: 0, color: "#71717a" }}>
        Category: {d.category} | Score: {d.riskScore}
      </p>
      <p style={{ fontSize: 11, margin: 0, color: "#71717a" }}>
        Likelihood: {d.likelihood} | Impact: {d.impact}
      </p>
      {d.mitigation && (
        <p style={{ fontSize: 10, margin: "4px 0 0", color: "#52525b" }}>
          Mitigation: {d.mitigation.slice(0, 120)}
          {d.mitigation.length > 120 ? "..." : ""}
        </p>
      )}
    </div>
  );
}

export function RiskMatrixChart({ risks }: Props) {
  if (!risks || risks.length === 0) return null;

  const scatterData = risks.map((r) => ({
    ...r,
    // Ensure values are numbers in [1,5]
    likelihood: Math.max(1, Math.min(5, r.likelihood ?? 1)),
    impact: Math.max(1, Math.min(5, r.impact ?? 1)),
    riskScore: r.riskScore ?? (r.likelihood ?? 1) * (r.impact ?? 1),
  }));

  // Scale dot sizes: min 60, max 400 based on riskScore (1-25)
  const minSize = 60;
  const maxSize = 400;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
        Risk Matrix
      </h3>

      <div className="relative">
        {/* Quadrant labels rendered as absolutely positioned overlays */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
          {QUADRANT_LABELS.map((q) => (
            <span
              key={q.label}
              className="absolute text-[10px] font-medium text-zinc-300 uppercase tracking-wider"
              style={{
                left: q.x < 3 ? "18%" : "68%",
                top: q.y < 3 ? "68%" : "18%",
                transform: "translate(-50%, -50%)",
              }}
            >
              {q.label}
            </span>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis
              type="number"
              dataKey="likelihood"
              name="Likelihood"
              domain={[0.5, 5.5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 10 }}
              label={{
                value: "Likelihood",
                position: "insideBottom",
                offset: -10,
                style: { fontSize: 10, fill: "#71717a" },
              }}
            />
            <YAxis
              type="number"
              dataKey="impact"
              name="Impact"
              domain={[0.5, 5.5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 10 }}
              label={{
                value: "Impact",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { fontSize: 10, fill: "#71717a" },
              }}
            />
            <ZAxis
              type="number"
              dataKey="riskScore"
              range={[minSize, maxSize]}
              domain={[1, 25]}
            />
            <Tooltip
              content={<RiskTooltip />}
              cursor={{ strokeDasharray: "3 3" }}
            />
            <Scatter data={scatterData}>
              {scatterData.map((entry, i) => (
                <Cell key={i} fill={getRiskColor(entry.riskScore)} fillOpacity={0.75} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#22c55e" }} />
          <span className="text-[10px] text-zinc-500">Low (1-6)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
          <span className="text-[10px] text-zinc-500">Medium (7-12)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />
          <span className="text-[10px] text-zinc-500">High (13-25)</span>
        </div>
      </div>
    </div>
  );
}
