"use client";

import { Loader2 } from "lucide-react";

/* ── Agent types ── */
export type AgentType =
  | "strategist"
  | "marketer"
  | "analyst"
  | "recruiter"
  | "operator"
  | "researcher";

export type AgentStatus = "idle" | "working" | "waiting" | "error";

export interface AgentDefinition {
  type: AgentType;
  name: string;
  role: string;
}

export interface AgentCardProps {
  agent: AgentDefinition;
  status: AgentStatus;
  currentTask?: string;
  costToday: number;
  selected?: boolean;
  onClick?: () => void;
}

/* ── Colors per agent type ── */
const AGENT_COLORS: Record<AgentType, { bg: string; text: string }> = {
  strategist: { bg: "bg-indigo-100", text: "text-indigo-700" },
  marketer: { bg: "bg-rose-100", text: "text-rose-700" },
  analyst: { bg: "bg-cyan-100", text: "text-cyan-700" },
  recruiter: { bg: "bg-amber-100", text: "text-amber-700" },
  operator: { bg: "bg-emerald-100", text: "text-emerald-700" },
  researcher: { bg: "bg-violet-100", text: "text-violet-700" },
};

/* ── Status config ── */
const STATUS_CONFIG: Record<
  AgentStatus,
  { dot: string; label: string; labelClass: string }
> = {
  idle: {
    dot: "bg-emerald-500",
    label: "Idle",
    labelClass: "text-emerald-700",
  },
  working: {
    dot: "bg-blue-500 animate-pulse",
    label: "Working",
    labelClass: "text-blue-700",
  },
  waiting: {
    dot: "bg-amber-500",
    label: "Waiting",
    labelClass: "text-amber-700",
  },
  error: {
    dot: "bg-red-500",
    label: "Error",
    labelClass: "text-red-700",
  },
};

function formatCost(cents: number): string {
  if (cents === 0) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

export function AgentCard({
  agent,
  status,
  currentTask,
  costToday,
  selected = false,
  onClick,
}: AgentCardProps) {
  const colors = AGENT_COLORS[agent.type];
  const statusCfg = STATUS_CONFIG[status];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        selected
          ? "border-indigo-300 bg-indigo-50/50 shadow-sm"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}
        >
          <span className={`text-sm font-bold ${colors.text}`}>
            {agent.name.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-900 truncate">
              {agent.name}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {status === "working" ? (
                <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
              ) : (
                <div className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
              )}
              <span
                className={`text-[10px] font-mono uppercase tracking-wider ${statusCfg.labelClass}`}
              >
                {statusCfg.label}
              </span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mt-0.5">
            {agent.role}
          </div>
        </div>

        {/* Cost */}
        <div className="text-right shrink-0">
          <div className="text-xs font-mono text-zinc-500 tabular-nums">
            {formatCost(costToday)}
          </div>
          <div className="text-[9px] font-mono text-zinc-300 uppercase tracking-wider">
            today
          </div>
        </div>
      </div>

      {/* Current task */}
      {status === "working" && currentTask && (
        <div className="mt-2 pl-12">
          <p className="text-xs text-zinc-500 leading-snug line-clamp-2">
            {currentTask}
          </p>
        </div>
      )}
    </button>
  );
}
