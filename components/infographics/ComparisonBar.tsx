"use client";

interface ComparisonBarProps {
  items: { label: string; value: number; color?: string }[];
  maxValue?: number;
  title?: string;
}

const DEFAULT_COLORS = ["#18181b", "#6366f1", "#10b981", "#f59e0b", "#ef4444"];

export default function ComparisonBar({ items, maxValue, title }: ComparisonBarProps) {
  if (items.length === 0) return null;

  const max = maxValue ?? Math.max(...items.map(i => i.value), 1);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {title && (
        <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-3">{title}</h4>
      )}
      <div className="space-y-3">
        {items.map((item, i) => {
          const pct = Math.min(100, (item.value / max) * 100);
          const color = item.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-600">{item.label}</span>
                <span className="text-xs font-bold text-zinc-900 tabular-nums">{item.value.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
