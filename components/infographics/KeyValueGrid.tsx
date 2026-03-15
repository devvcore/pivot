"use client";

import { formatLabel } from "@/lib/utils";

interface KeyValueGridProps {
  data: Record<string, unknown>;
  maxRows?: number;
  title?: string;
}

function formatValue(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "number") {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return val.toLocaleString();
  }
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

// formatLabel imported from @/lib/utils

export default function KeyValueGrid({ data, maxRows = 10, title }: KeyValueGridProps) {
  const entries = Object.entries(data)
    .filter(([k, v]) => !k.endsWith("_source") && !k.startsWith("_") && typeof v !== "object")
    .slice(0, maxRows);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {title && (
        <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-3">{title}</h4>
      )}
      <div className="grid grid-cols-1 gap-2">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-zinc-50 last:border-0">
            <span className="text-xs text-zinc-500 break-words">{formatLabel(key)}</span>
            <span className="text-xs font-medium text-zinc-900 text-right tabular-nums shrink-0">
              {formatValue(val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
