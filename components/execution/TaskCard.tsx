"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import type { AgentType } from "./AgentCard";

/* ── Task types ── */
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus =
  | "queued"
  | "executing"
  | "reviewing"
  | "awaiting_approval"
  | "completed"
  | "failed";

export interface TaskData {
  id: string;
  title: string;
  description?: string;
  assignedAgent: AgentType;
  agentName: string;
  priority: TaskPriority;
  status: TaskStatus;
  attempt: number;
  maxAttempts: number;
  costCents: number;
  costCeilingCents: number;
  startedAt?: number;
  completedAt?: number;
  acceptanceCriteria?: string[];
  outputPreview?: string;
}

export interface TaskCardProps {
  task: TaskData;
  onClick?: () => void;
}

/* ── Priority styling ── */
const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-zinc-100 text-zinc-600 border-zinc-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

/* ── Status styling ── */
const STATUS_STYLES: Record<
  TaskStatus,
  { bg: string; text: string; label: string }
> = {
  queued: { bg: "bg-zinc-100", text: "text-zinc-600", label: "Queued" },
  executing: { bg: "bg-blue-50", text: "text-blue-700", label: "Executing" },
  reviewing: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    label: "Reviewing",
  },
  awaiting_approval: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    label: "Awaiting Approval",
  },
  completed: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    label: "Completed",
  },
  failed: { bg: "bg-red-50", text: "text-red-700", label: "Failed" },
};

/* ── Agent avatar colors ── */
const AGENT_AVATAR_COLORS: Record<AgentType, { bg: string; text: string }> = {
  strategist: { bg: "bg-indigo-100", text: "text-indigo-700" },
  marketer: { bg: "bg-rose-100", text: "text-rose-700" },
  analyst: { bg: "bg-cyan-100", text: "text-cyan-700" },
  recruiter: { bg: "bg-amber-100", text: "text-amber-700" },
  operator: { bg: "bg-emerald-100", text: "text-emerald-700" },
  researcher: { bg: "bg-violet-100", text: "text-violet-700" },
};

function formatCost(cents: number): string {
  if (cents === 0) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatElapsed(startMs?: number, endMs?: number): string {
  if (!startMs) return "--";
  const end = endMs ?? Date.now();
  const diffSec = Math.floor((end - startMs) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  return `${h}h ${m}m`;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);

  const priorityCfg = PRIORITY_STYLES[task.priority];
  const statusCfg = STATUS_STYLES[task.status];
  const agentColors = AGENT_AVATAR_COLORS[task.assignedAgent];
  const costPct =
    task.costCeilingCents > 0
      ? Math.min((task.costCents / task.costCeilingCents) * 100, 100)
      : 0;

  return (
    <div
      className={`border border-zinc-200 bg-white rounded-xl transition-all hover:border-zinc-300 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {/* Main row */}
      <div
        className="p-4"
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          {/* Agent avatar */}
          <div
            className={`w-7 h-7 rounded-lg ${agentColors.bg} flex items-center justify-center shrink-0 mt-0.5`}
          >
            <span className={`text-xs font-bold ${agentColors.text}`}>
              {task.agentName.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Task info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-sm font-medium text-zinc-900 truncate">
                {task.title}
              </h4>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Priority badge */}
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${priorityCfg}`}
              >
                {task.priority}
              </span>

              {/* Status chip */}
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusCfg.bg} ${statusCfg.text}`}
              >
                {statusCfg.label}
              </span>

              {/* Attempt */}
              {task.maxAttempts > 1 && (
                <span className="text-[10px] font-mono text-zinc-400">
                  Attempt {task.attempt}/{task.maxAttempts}
                </span>
              )}
            </div>
          </div>

          {/* Right side: cost + time */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1 text-xs font-mono text-zinc-500 tabular-nums">
              <DollarSign className="w-3 h-3" />
              {formatCost(task.costCents)}
              <span className="text-zinc-300">/</span>
              {formatCost(task.costCeilingCents)}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
              <Clock className="w-3 h-3" />
              {formatElapsed(task.startedAt, task.completedAt)}
            </div>
          </div>
        </div>

        {/* Cost progress bar */}
        {task.costCeilingCents > 0 && (
          <div className="mt-3 ml-10">
            <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  costPct > 80 ? "bg-red-400" : costPct > 50 ? "bg-amber-400" : "bg-emerald-400"
                }`}
                style={{ width: `${costPct}%` }}
              />
            </div>
            {costPct > 80 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3 text-red-500" />
                <span className="text-[9px] font-mono text-red-500 uppercase tracking-wider">
                  Near budget limit
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expand toggle */}
      {(task.acceptanceCriteria?.length || task.outputPreview) && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono text-zinc-400 uppercase tracking-wider border-t border-zinc-100 hover:bg-zinc-50 transition-colors"
          >
            {expanded ? (
              <>
                Hide details <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                Show details <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>

          {expanded && (
            <div className="px-4 pb-4 border-t border-zinc-100">
              {/* Acceptance criteria */}
              {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                    Acceptance Criteria
                  </div>
                  <ul className="space-y-1">
                    {task.acceptanceCriteria.map((c, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-zinc-600"
                      >
                        <span className="w-1 h-1 rounded-full bg-zinc-300 mt-1.5 shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Output preview */}
              {task.outputPreview && (
                <div className="mt-3">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                    Output Preview
                  </div>
                  <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 text-xs text-zinc-600 font-mono leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {task.outputPreview}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
