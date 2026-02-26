// @ts-nocheck
"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import { TOOLTIP_STYLE, formatDollar, parseDollarString } from "./chart-utils";
import type { MarketSizing } from "@/lib/types";

interface Props {
  marketSizing: MarketSizing;
}

interface BarDatum {
  name: string;
  label: string;
  value: number;
  displayValue: string;
  methodology: string;
  color: string;
}

interface MarketTooltipProps {
  active?: boolean;
  payload?: { payload: BarDatum }[];
}

function MarketTooltip({ active, payload }: MarketTooltipProps) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        ...TOOLTIP_STYLE,
        background: "#fff",
        padding: "8px 12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        maxWidth: 300,
      }}
    >
      <p style={{ fontWeight: 600, fontSize: 12, margin: 0 }}>
        {d.label}: {formatDollar(d.value)}
      </p>
      {d.methodology && (
        <p style={{ fontSize: 10, margin: "4px 0 0", color: "#71717a" }}>
          {d.methodology}
        </p>
      )}
    </div>
  );
}

const FUNNEL_COLORS = {
  TAM: "#bfdbfe", // blue-200
  SAM: "#60a5fa", // blue-400
  SOM: "#2563eb", // blue-600
};

export function MarketSizingChart({ marketSizing }: Props) {
  if (!marketSizing) return null;

  const { tam, sam, som, growthRate } = marketSizing;

  if (!tam?.value && !sam?.value && !som?.value) return null;

  const tamValue = parseDollarString(tam.value);
  const samValue = parseDollarString(sam.value);
  const somValue = parseDollarString(som.value);

  // If all values are zero, nothing to render
  if (tamValue === 0 && samValue === 0 && somValue === 0) return null;

  const barData: BarDatum[] = [
    {
      name: "TAM",
      label: "Total Addressable Market",
      value: tamValue,
      displayValue: tam.value,
      methodology: tam.methodology,
      color: FUNNEL_COLORS.TAM,
    },
    {
      name: "SAM",
      label: "Serviceable Addressable Market",
      value: samValue,
      displayValue: sam.value,
      methodology: sam.methodology,
      color: FUNNEL_COLORS.SAM,
    },
    {
      name: "SOM",
      label: "Serviceable Obtainable Market",
      value: somValue,
      displayValue: som.value,
      methodology: som.methodology,
      color: FUNNEL_COLORS.SOM,
    },
  ];

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
        Market Sizing (TAM / SAM / SOM)
      </h3>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={barData}
          layout="vertical"
          margin={{ left: 10, right: 60 }}
        >
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatDollar(v)}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={40}
            tick={{ fontSize: 11, fontWeight: 600 }}
          />
          <Tooltip content={<MarketTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={36}>
            {barData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <LabelList
              dataKey="displayValue"
              position="right"
              style={{ fontSize: 11, fontWeight: 500, fill: "#3f3f46" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {growthRate && (
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
            Growth Rate: {growthRate}
          </span>
        </div>
      )}
    </div>
  );
}
