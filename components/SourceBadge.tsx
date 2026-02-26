"use client";

import { ShieldCheck, Calculator, AlertTriangle, HelpCircle } from "lucide-react";

export type SourceStatus = "verified" | "estimated" | "conflicting" | "insufficient";

const CONFIG: Record<SourceStatus, { icon: typeof ShieldCheck; label: string; className: string }> = {
  verified: {
    icon: ShieldCheck,
    label: "From docs",
    className: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  estimated: {
    icon: Calculator,
    label: "AI estimate",
    className: "text-amber-600 bg-amber-50 border-amber-200",
  },
  conflicting: {
    icon: AlertTriangle,
    label: "Conflicting",
    className: "text-red-600 bg-red-50 border-red-200",
  },
  insufficient: {
    icon: HelpCircle,
    label: "Limited data",
    className: "text-zinc-500 bg-zinc-50 border-zinc-200",
  },
};

interface SourceBadgeProps {
  status: SourceStatus;
  compact?: boolean;
}

export default function SourceBadge({ status, compact }: SourceBadgeProps) {
  const { icon: Icon, label, className } = CONFIG[status] ?? CONFIG.estimated;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${className}`}
      title={label}
    >
      <Icon className="h-3 w-3" />
      {!compact && <span>{label}</span>}
    </span>
  );
}
