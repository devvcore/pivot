// @ts-nocheck
"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie,
} from "recharts";
import { CHART_COLORS, PIE_PALETTE, TOOLTIP_STYLE, formatDollar } from "./chart-utils";
import { OverlayProjection } from "./OverlayProjection";

interface LeakItem {
  description: string;
  amount: number;
  category?: string;
  confidence?: string;
  annualImpact?: number;
}

interface OverlayData {
  dataPoints: { month: string; baseline: number; projected: number }[];
  title?: string;
  subtitle?: string;
  insight?: string;
  totalImpact?: string;
}

interface Props {
  items: LeakItem[];
  overlay?: OverlayData;
  onDismissOverlay?: () => void;
}

export function RevenueLeakChart({ items, overlay, onDismissOverlay }: Props) {
  if (!items.length) return null;

  const barData = items
    .slice(0, 8)
    .sort((a, b) => (b.annualImpact ?? b.amount ?? 0) - (a.annualImpact ?? a.amount ?? 0))
    .map((item) => ({
      name: item.description ?? "",
      amount: item.annualImpact ?? item.amount ?? 0,
      confidence: item.confidence ?? "Medium",
    }));

  const categoryMap = new Map<string, number>();
  for (const item of items) {
    const cat = item.category || "Other";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + (item.annualImpact ?? item.amount ?? 0));
  }
  const pieData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
            Revenue Leaks by Amount
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(220, barData.length * 36)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
              <XAxis type="number" tickFormatter={(v) => formatDollar(v)} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.length > 30 ? v.slice(0, 28) + "…" : v} />
              <Tooltip
                formatter={(v) => formatDollar(Number(v ?? 0))}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {barData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.confidence === "High" ? CHART_COLORS.primary : CHART_COLORS.secondary}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {pieData.length > 1 && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
              By Category
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={35}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => formatDollar(Number(v ?? 0))}
                  contentStyle={TOOLTIP_STYLE}
                />
              </PieChart>
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
