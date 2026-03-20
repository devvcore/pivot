/** Shared chart utilities — colors, parsers, formatters */

export const CHART_COLORS = {
  primary: "#18181b",     // zinc-900
  secondary: "#71717a",   // zinc-500
  accent: "#3b82f6",      // blue-500
  danger: "#ef4444",      // red-500
  warning: "#f59e0b",     // amber-500
  success: "#22c55e",     // green-500
  muted: "#d4d4d8",       // zinc-300
};

export const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  HIGH: "#ef4444",
  High: "#f97316",
  MED: "#f59e0b",
  Medium: "#f59e0b",
  Low: "#71717a",
  LOW: "#71717a",
};

export const EFFORT_COLORS: Record<string, string> = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#ef4444",
};

export const PIE_PALETTE = [
  "#3b82f6", "#18181b", "#f59e0b", "#ef4444",
  "#22c55e", "#8b5cf6", "#ec4899", "#06b6d4",
  "#f97316", "#6366f1", "#14b8a6", "#e11d48",
];

export function parseDollarString(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9.KMkm]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (/[Kk]/.test(s)) return num * 1000;
  if (/[Mm]/.test(s)) return num * 1_000_000;
  return num;
}

export function gradeToNumber(grade: string): number {
  const map: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
  return map[grade?.toUpperCase()] ?? 0;
}

export function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export const TOOLTIP_STYLE = {
  fontSize: 11,
  borderRadius: 10,
  border: "1px solid #e4e4e7",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  padding: "8px 12px",
};

/** Standard chart margins that prevent label cutoff */
export const CHART_MARGINS = {
  standard: { top: 8, right: 12, bottom: 16, left: 8 },
  withYLabel: { top: 8, right: 12, bottom: 16, left: 20 },
  horizontal: { top: 8, right: 20, bottom: 8, left: 12 },
};

/** Standard axis tick style */
export const AXIS_TICK = { fontSize: 10, fill: "#71717a" };

/** Standard gridline style */
export const GRID_STYLE = { strokeDasharray: "3 3", stroke: "#e4e4e7" };
