// @ts-nocheck
"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, formatDollar, parseDollarString } from "./chart-utils";
import { OverlayProjection } from "./OverlayProjection";

interface PricingTier {
  tier: string;
  range: string;
  targetSegment: string;
}

interface OverlayData {
  dataPoints: { month: string; baseline: number; projected: number }[];
  title?: string;
  subtitle?: string;
  insight?: string;
  totalImpact?: string;
}

interface Props {
  tiers: PricingTier[];
  overlay?: OverlayData;
  onDismissOverlay?: () => void;
}

export function PricingComparisonChart({ tiers, overlay, onDismissOverlay }: Props) {
  if (!tiers?.length) return null;

  // Parse range like "$500-$1,200" into low/high
  const data = tiers.map((t) => {
    const parts = t.range.replace(/[^0-9.KMkm\-–]/g, " ").split(/[\-–\s]+/).filter(Boolean);
    const low = parseDollarString(parts[0] ?? "0");
    const high = parts.length > 1 ? parseDollarString(parts[1]) : low;
    return {
      name: t.tier,
      low,
      high,
      spread: high - low,
    };
  });

  if (data.every((d) => d.low === 0 && d.high === 0)) return null;

  return (
    <div>
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
          Recommended Pricing Tiers
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ left: 5, right: 5 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tickFormatter={(v) => formatDollar(v)} tick={{ fontSize: 9 }} />
            <Tooltip
              formatter={(v) => formatDollar(Number(v ?? 0))}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
            <Bar dataKey="low" fill={CHART_COLORS.muted} radius={[4, 4, 0, 0]} name="Floor" stackId="range" />
            <Bar dataKey="spread" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} name="Range" stackId="range" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {overlay && overlay.dataPoints?.length > 0 && (
        <OverlayProjection data={overlay} onDismiss={onDismissOverlay} />
      )}
    </div>
  );
}
