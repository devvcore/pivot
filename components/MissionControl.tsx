"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Cpu, Activity, Clock, DollarSign,
  CheckCircle2, AlertCircle, Loader2, RefreshCw,
  Zap, Bot, Play, XCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  title: string;
  agent_id: string;
  status: string;
  cost_spent: number;
  attempts: number;
  created_at: string;
  completed_at: string | null;
  review_feedback: string | null;
}

interface AgentStats {
  agentId: string;
  name: string;
  color: string;
  totalTasks: number;
  completed: number;
  failed: number;
  inProgress: number;
  totalCost: number;
  avgTimeMs: number;
  successRate: number;
}

interface MissionControlProps {
  orgId: string;
  onBack: () => void;
}

// ─── Agent Config ───────────────────────────────────────────────────────────

const AGENTS: Record<string, { name: string; emoji: string; color: string; bg: string }> = {
  strategist: { name: "Atlas", emoji: "S", color: "text-blue-400", bg: "bg-blue-500" },
  marketer: { name: "Maven", emoji: "M", color: "text-pink-400", bg: "bg-pink-500" },
  analyst: { name: "Quant", emoji: "Q", color: "text-emerald-400", bg: "bg-emerald-500" },
  recruiter: { name: "Scout", emoji: "R", color: "text-amber-400", bg: "bg-amber-500" },
  operator: { name: "Forge", emoji: "F", color: "text-violet-400", bg: "bg-violet-500" },
  researcher: { name: "Lens", emoji: "L", color: "text-cyan-400", bg: "bg-cyan-500" },
  codebot: { name: "CodeBot", emoji: "C", color: "text-orange-400", bg: "bg-orange-500" },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  queued: <Clock className="w-3.5 h-3.5 text-zinc-500" />,
  executing: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
  reviewing: <Activity className="w-3.5 h-3.5 text-amber-400" />,
  triaging: <Zap className="w-3.5 h-3.5 text-purple-400" />,
  revision: <RefreshCw className="w-3.5 h-3.5 text-amber-400" />,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function MissionControl({ orgId, onBack }: MissionControlProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/execution/tasks?orgId=${orgId}&limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      setTasks(data.tasks ?? []);
      setLastRefresh(new Date());
    } catch { /* ignore */ }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // Compute agent stats
  const agentStats: AgentStats[] = Object.entries(AGENTS).map(([id, config]) => {
    const agentTasks = tasks.filter(t => t.agent_id === id);
    const completed = agentTasks.filter(t => t.status === 'completed');
    const failed = agentTasks.filter(t => t.status === 'failed');
    const inProgress = agentTasks.filter(t => !['completed', 'failed', 'cancelled'].includes(t.status));
    const totalCost = agentTasks.reduce((s, t) => s + (t.cost_spent ?? 0), 0);
    const completedWithTime = completed.filter(t => t.created_at && t.completed_at);
    const avgTimeMs = completedWithTime.length > 0
      ? completedWithTime.reduce((s, t) => s + (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()), 0) / completedWithTime.length
      : 0;

    return {
      agentId: id,
      name: config.name,
      color: config.color,
      totalTasks: agentTasks.length,
      completed: completed.length,
      failed: failed.length,
      inProgress: inProgress.length,
      totalCost,
      avgTimeMs,
      successRate: agentTasks.length > 0 ? Math.round(completed.length / agentTasks.length * 100) : 0,
    };
  }).filter(a => a.totalTasks > 0).sort((a, b) => b.totalTasks - a.totalTasks);

  // Global stats
  const totalTasks = tasks.length;
  const totalCompleted = tasks.filter(t => t.status === 'completed').length;
  const totalFailed = tasks.filter(t => t.status === 'failed').length;
  const totalInProgress = tasks.filter(t => !['completed', 'failed', 'cancelled'].includes(t.status)).length;
  const totalCost = tasks.reduce((s, t) => s + (t.cost_spent ?? 0), 0);
  const overallSuccessRate = totalTasks > 0 ? Math.round(totalCompleted / totalTasks * 100) : 0;

  // Recent tasks (last 20)
  const recentTasks = tasks.slice(0, 20);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 bg-blue-600 flex items-center justify-center rounded-lg">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Mission Control</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-0.5">Agent Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[10px] text-zinc-600 font-mono">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
            <button onClick={() => { setLoading(true); fetchTasks(); }} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-zinc-800/50 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="grid grid-cols-5 gap-2 sm:gap-4 min-w-[600px] sm:min-w-0">
          <StatCard label="Total Tasks" value={totalTasks} icon={<Zap className="w-4 h-4" />} />
          <StatCard label="Completed" value={totalCompleted} icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} color="text-emerald-400" />
          <StatCard label="In Progress" value={totalInProgress} icon={<Loader2 className="w-4 h-4 text-blue-400" />} color="text-blue-400" />
          <StatCard label="Failed" value={totalFailed} icon={<AlertCircle className="w-4 h-4 text-red-400" />} color="text-red-400" />
          <StatCard label="Total Cost" value={`$${totalCost.toFixed(4)}`} icon={<DollarSign className="w-4 h-4 text-amber-400" />} color="text-amber-400" />
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Agent Performance Cards */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Agent Performance</h2>
          {loading && agentStats.length === 0 ? (
            <div className="flex items-center gap-2 text-zinc-600 text-sm py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading agent data...
            </div>
          ) : agentStats.length === 0 ? (
            <div className="text-zinc-600 text-sm py-8 text-center">No agent tasks yet. Run some tasks from the Execution tab.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agentStats.map(agent => {
                const config = AGENTS[agent.agentId];
                return (
                  <div key={agent.agentId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-7 h-7 ${config?.bg ?? 'bg-zinc-600'} rounded-lg flex items-center justify-center text-white text-xs font-bold`}>
                        {config?.emoji ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{agent.name}</p>
                        <p className="text-[10px] text-zinc-500">{agent.totalTasks} tasks</p>
                      </div>
                      {agent.inProgress > 0 && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                          <Loader2 className="w-3 h-3 animate-spin" /> {agent.inProgress} active
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-emerald-400">{agent.successRate}%</p>
                        <p className="text-[9px] text-zinc-600 uppercase">Success</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-zinc-300">{agent.avgTimeMs > 0 ? `${(agent.avgTimeMs / 1000).toFixed(1)}s` : '-'}</p>
                        <p className="text-[9px] text-zinc-600 uppercase">Avg Time</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-amber-400">${agent.totalCost.toFixed(3)}</p>
                        <p className="text-[9px] text-zinc-600 uppercase">Cost</p>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                      {agent.completed > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${agent.successRate}%` }} />}
                      {agent.failed > 0 && <div className="bg-red-500 h-full" style={{ width: `${Math.round(agent.failed / agent.totalTasks * 100)}%` }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Overall Success Rate */}
          {totalTasks > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Overall Success Rate</h3>
                <span className={`text-2xl font-bold ${overallSuccessRate >= 80 ? 'text-emerald-400' : overallSuccessRate >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                  {overallSuccessRate}%
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${overallSuccessRate >= 80 ? 'bg-emerald-500' : overallSuccessRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${overallSuccessRate}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">
                {totalCompleted} completed, {totalFailed} failed, {totalInProgress} in progress
              </p>
            </div>
          )}
        </div>

        {/* Recent Tasks Feed */}
        <div>
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">Recent Activity</h2>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {recentTasks.length === 0 && !loading && (
              <p className="text-zinc-600 text-sm text-center py-8">No tasks yet</p>
            )}
            {recentTasks.map(task => {
              const config = AGENTS[task.agent_id];
              const timeAgo = getTimeAgo(task.created_at);
              return (
                <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-all">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{STATUS_ICON[task.status] ?? STATUS_ICON.queued}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-mono ${config?.color ?? 'text-zinc-500'}`}>
                          {config?.name ?? task.agent_id}
                        </span>
                        <span className="text-[10px] text-zinc-600">{timeAgo}</span>
                        {task.cost_spent > 0 && (
                          <span className="text-[10px] text-zinc-600">${task.cost_spent.toFixed(4)}</span>
                        )}
                      </div>
                      {task.review_feedback && task.status === 'failed' && (
                        <p className="text-[10px] text-red-400/70 mt-1 truncate">{task.review_feedback.slice(0, 80)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums ${color ?? 'text-zinc-100'}`}>{value}</p>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
