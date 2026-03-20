// @ts-nocheck
"use client";

import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar } from "./chart-utils";
import { OverlayProjection } from "./OverlayProjection";

interface Customer {
  name: string;
  riskScore?: number;
  revenueAtRisk?: number;
}

interface OverlayData {
  dataPoints: { month: string; baseline: number; projected: number }[];
  title?: string;
  subtitle?: string;
  insight?: string;
  totalImpact?: string;
}

interface Props {
  customers: Customer[];
  overlay?: OverlayData;
  onDismissOverlay?: () => void;
  onDataClick?: (question: string) => void;
}

export function CustomerRiskScatter({ customers, overlay, onDismissOverlay, onDataClick }: Props) {
  if (!customers || !customers.length) return null;

  const data = customers
    .filter((c) => c.riskScore != null && c.revenueAtRisk != null)
    .map((c) => ({
      name: c.name,
      risk: c.riskScore!,
      revenue: c.revenueAtRisk!,
    }));

  if (data.length === 0) return null;

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div>
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
          Customer Risk vs Revenue Exposure
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
            <XAxis
              dataKey="risk"
              type="number"
              domain={[0, 100]}
              name="Risk Score"
              tick={{ fontSize: 9 }}
              label={{ value: "Risk Score", position: "bottom", fontSize: 10 }}
            />
            <YAxis
              dataKey="revenue"
              type="number"
              name="Revenue at Risk"
              tickFormatter={(v) => formatDollar(v)}
              tick={{ fontSize: 9 }}
            />
            <ZAxis dataKey="revenue" range={[60, 400]} />
            <Tooltip
              formatter={(v, name) =>
                name === "Revenue at Risk" ? formatDollar(Number(v ?? 0)) : String(v ?? 0)
              }
              contentStyle={TOOLTIP_STYLE}
            />
            <Scatter
              data={data}
              name="Customers"
              cursor={onDataClick ? "pointer" : undefined}
              onClick={(data) => {
                if (onDataClick && data?.name) {
                  onDataClick(`How do I retain ${data.name}? They have a ${data.risk}% risk score with ${formatDollar(data.revenue)} revenue at risk.`);
                }
              }}
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.risk > 70 ? CHART_COLORS.danger : entry.risk > 40 ? CHART_COLORS.warning : CHART_COLORS.success}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
          {data.slice(0, 5).map((d, i) => (
            <span
              key={i}
              className={`text-[10px] text-zinc-500 whitespace-nowrap ${onDataClick ? "cursor-pointer hover:text-indigo-600 transition-colors" : ""}`}
              onClick={() => onDataClick?.(`How do I retain ${d.name}? They have a ${d.risk}% risk score with ${formatDollar(d.revenue)} revenue at risk.`)}
              title={onDataClick ? "Click to ask Pivvy" : undefined}
            >
              {d.name}: {d.risk}% risk, {formatDollar(d.revenue)}
            </span>
          ))}
          {data.length > 5 && (
            <span className="text-[10px] text-zinc-400">+{data.length - 5} more</span>
          )}
        </div>
      </div>

      {overlay && overlay.dataPoints?.length > 0 && (
        <OverlayProjection data={overlay} onDismiss={onDismissOverlay} />
      )}
    </div>
  );
}
