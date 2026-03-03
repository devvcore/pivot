"use client";

import { Info, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { AcronymText } from "../AcronymTooltip";

type Variant = "info" | "warning" | "success" | "critical";

interface InsightCalloutProps {
  text: string;
  variant?: Variant;
  label?: string;
}

const VARIANTS: Record<Variant, { border: string; bg: string; text: string; Icon: typeof Info }> = {
  info:     { border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-800", Icon: Info },
  warning:  { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-800", Icon: AlertTriangle },
  success:  { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-800", Icon: CheckCircle2 },
  critical: { border: "border-red-300", bg: "bg-red-50", text: "text-red-800", Icon: AlertCircle },
};

export default function InsightCallout({ text, variant = "info", label }: InsightCalloutProps) {
  const v = VARIANTS[variant];
  const { Icon } = v;

  return (
    <div className={`border-l-4 ${v.border} ${v.bg} rounded-r-xl px-5 py-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${v.text}`} />
        <div>
          {label && (
            <p className={`text-[10px] font-mono uppercase tracking-widest mb-1 ${v.text} opacity-70`}>
              {label}
            </p>
          )}
          <p className={`text-sm leading-relaxed ${v.text}`}><AcronymText text={text} /></p>
        </div>
      </div>
    </div>
  );
}
