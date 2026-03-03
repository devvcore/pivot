"use client";

import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";

interface StatusItem {
  label: string;
  status: string;
}

interface StatusGridProps {
  items: StatusItem[];
  title?: string;
  columns?: number;
}

function getStatusConfig(status: string) {
  const s = status.toLowerCase();
  if (s === "pass" || s === "passed" || s === "yes" || s === "complete" || s === "compliant" || s === "green" || s === "done" || s === "active") {
    return { Icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" };
  }
  if (s === "warning" || s === "partial" || s === "in progress" || s === "medium" || s === "amber" || s === "review" || s === "pending") {
    return { Icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50" };
  }
  if (s === "fail" || s === "failed" || s === "no" || s === "critical" || s === "red" || s === "non-compliant" || s === "missing") {
    return { Icon: XCircle, color: "text-red-500", bg: "bg-red-50" };
  }
  return { Icon: HelpCircle, color: "text-zinc-400", bg: "bg-zinc-50" };
}

export default function StatusGrid({ items, title, columns = 2 }: StatusGridProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {title && (
        <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-3">{title}</h4>
      )}
      <div className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : columns === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {items.map((item, i) => {
          const { Icon, color, bg } = getStatusConfig(item.status);
          return (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg}`}>
              <Icon className={`w-4 h-4 shrink-0 ${color}`} />
              <span className="text-xs text-zinc-700 break-words">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
