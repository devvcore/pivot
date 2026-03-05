"use client";

import { DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AgentType } from "./AgentCard";

/* ── Types ── */
export interface AgentCostEntry {
  agentType: AgentType;
  agentName: string;
  costCents: number;
}

export interface DailyCostEntry {
  date: string; // e.g. "Mar 1"
  costCents: number;
}

export interface TaskCostEntry {
  taskId: string;
  taskTitle: string;
  agentName: string;
  costCents: number;
}

export interface CostOverviewProps {
  totalTodayCents: number;
  dailyBudgetCents: number;
  agentCosts: AgentCostEntry[];
  dailyTrend: DailyCostEntry[];
  taskCosts: TaskCostEntry[];
}

/* ── Agent colors for bars ── */
const AGENT_BAR_COLORS: Record<AgentType, string> = {
  strategist: "bg-indigo-500",
  marketer: "bg-rose-500",
  analyst: "bg-cyan-500",
  recruiter: "bg-amber-500",
  operator: "bg-emerald-500",
  researcher: "bg-violet-500",
};

function formatDollars(cents: number): string {
  if (cents === 0) return "$0.00";
  if (cents >= 100_00) return `$${(cents / 100).toFixed(0)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

function CostBar({
  label,
  value,
  maxValue,
  colorClass,
}: {
  label: string;
  value: number;
  maxValue: number;
  colorClass: string;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-[10px] font-mono text-zinc-500 uppercase tracking-wider truncate shrink-0">
        {label}
      </div>
      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-16 text-right text-xs font-mono text-zinc-600 tabular-nums shrink-0">
        {formatDollars(value)}
      </div>
    </div>
  );
}

export function CostOverview({
  totalTodayCents,
  dailyBudgetCents,
  agentCosts,
  dailyTrend,
  taskCosts,
}: CostOverviewProps) {
  const budgetRemaining = dailyBudgetCents - totalTodayCents;
  const budgetPct =
    dailyBudgetCents > 0
      ? Math.min((totalTodayCents / dailyBudgetCents) * 100, 100)
      : 0;

  const maxAgentCost = Math.max(...agentCosts.map((a) => a.costCents), 1);
  const maxDailyCost = Math.max(...dailyTrend.map((d) => d.costCents), 1);

  // Trend calculation
  const todayCost = dailyTrend.length > 0 ? dailyTrend[dailyTrend.length - 1]?.costCents ?? 0 : 0;
  const yesterdayCost = dailyTrend.length > 1 ? dailyTrend[dailyTrend.length - 2]?.costCents ?? 0 : 0;
  const trendDirection = todayCost > yesterdayCost ? "up" : todayCost < yesterdayCost ? "down" : "flat";

  return (
    <div className="space-y-6">
      {/* Total cost today */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-zinc-500" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">
                Cost Today
              </div>
              <div className="text-2xl font-light text-zinc-900 tabular-nums">
                {formatDollars(totalTodayCents)}
              </div>
            </div>
          </div>

          {/* Trend indicator */}
          <div className="flex items-center gap-1">
            {trendDirection === "up" && (
              <TrendingUp className="w-4 h-4 text-red-500" />
            )}
            {trendDirection === "down" && (
              <TrendingDown className="w-4 h-4 text-emerald-500" />
            )}
            {trendDirection === "flat" && (
              <Minus className="w-4 h-4 text-zinc-400" />
            )}
            <span
              className={`text-[10px] font-mono uppercase tracking-wider ${
                trendDirection === "up"
                  ? "text-red-500"
                  : trendDirection === "down"
                  ? "text-emerald-500"
                  : "text-zinc-400"
              }`}
            >
              vs yesterday
            </span>
          </div>
        </div>

        {/* Budget bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              Daily Budget
            </span>
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {formatDollars(budgetRemaining)} remaining
            </span>
          </div>
          <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                budgetPct > 90
                  ? "bg-red-500"
                  : budgetPct > 70
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] font-mono text-zinc-300 tabular-nums">
              $0
            </span>
            <span className="text-[9px] font-mono text-zinc-300 tabular-nums">
              {formatDollars(dailyBudgetCents)}
            </span>
          </div>
        </div>
      </div>

      {/* Cost by agent */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
          Cost by Agent
        </h3>
        <div className="space-y-3">
          {agentCosts.length === 0 ? (
            <p className="text-xs text-zinc-400">No agent costs recorded</p>
          ) : (
            agentCosts.map((entry) => (
              <CostBar
                key={entry.agentType}
                label={entry.agentName}
                value={entry.costCents}
                maxValue={maxAgentCost}
                colorClass={AGENT_BAR_COLORS[entry.agentType] ?? "bg-zinc-400"}
              />
            ))
          )}
        </div>
      </div>

      {/* Daily trend (sparkline-style bars) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
          Last 7 Days
        </h3>
        <div className="flex items-end gap-1 h-20">
          {dailyTrend.map((day, i) => {
            const heightPct =
              maxDailyCost > 0
                ? Math.max((day.costCents / maxDailyCost) * 100, 4)
                : 4;
            const isToday = i === dailyTrend.length - 1;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div className="text-[9px] font-mono text-zinc-400 tabular-nums">
                  {formatDollars(day.costCents)}
                </div>
                <div className="w-full flex items-end justify-center" style={{ height: "48px" }}>
                  <div
                    className={`w-full max-w-6 rounded-t transition-all ${
                      isToday ? "bg-indigo-500" : "bg-zinc-200"
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <div
                  className={`text-[9px] font-mono uppercase tracking-wider ${
                    isToday ? "text-indigo-600 font-bold" : "text-zinc-400"
                  }`}
                >
                  {day.date}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-task cost breakdown */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4">
          Task Costs
        </h3>
        {taskCosts.length === 0 ? (
          <p className="text-xs text-zinc-400">No task costs recorded</p>
        ) : (
          <div className="space-y-2">
            {taskCosts.map((task) => (
              <div
                key={task.taskId}
                className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-xs text-zinc-900 truncate">
                    {task.taskTitle}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    {task.agentName}
                  </div>
                </div>
                <div className="text-xs font-mono text-zinc-600 tabular-nums shrink-0 ml-3">
                  {formatDollars(task.costCents)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
