"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { TrendingUp, Clock, DollarSign, Zap, BarChart3 } from "lucide-react";

interface ROITrackerProps {
  orgId: string;
}

interface TaskRecord {
  id: string;
  agent_id: string;
  status: string;
  created_at: string;
}

interface CostTotals {
  totalCostUsd: number;
  totalRecords: number;
}

// Estimated manual hours by agent type
const HOURS_BY_AGENT: Record<string, number> = {
  researcher: 2,
  analyst: 3,
  marketer: 1,
  recruiter: 1.5,
  operator: 1.5,
  strategist: 2,
  codebot: 2,
};

const CONSULTANT_RATE = 50; // $/hr

function miniSparkline(data: number[]): string {
  if (data.length === 0) return "";
  const max = Math.max(...data, 1);
  const h = 24;
  const w = 80;
  const step = w / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return points;
}

export function ROITracker({ orgId }: ROITrackerProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [costTotal, setCostTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const fetchData = async () => {
      try {
        const [tasksRes, costsRes] = await Promise.all([
          authFetch(
            `/api/execution/tasks?orgId=${encodeURIComponent(orgId)}&status=completed&limit=100`
          ),
          authFetch(
            `/api/execution/costs?orgId=${encodeURIComponent(orgId)}&from=${encodeURIComponent(monthStart)}`
          ),
        ]);

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          // Filter to this month client-side
          const monthlyTasks = (tasksData.tasks || []).filter(
            (t: TaskRecord) => new Date(t.created_at) >= new Date(monthStart)
          );
          setTasks(monthlyTasks);
        }

        if (costsRes.ok) {
          const costsData = await costsRes.json();
          const totals: CostTotals = costsData.totals || { totalCostUsd: 0, totalRecords: 0 };
          setCostTotal(totals.totalCostUsd);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId]);

  // Calculate metrics
  const taskCount = tasks.length;
  const timeSaved = tasks.reduce((sum, t) => sum + (HOURS_BY_AGENT[t.agent_id] ?? 1.5), 0);
  const valueSaved = timeSaved * CONSULTANT_RATE;
  const netROI = costTotal > 0 ? ((valueSaved - costTotal) / costTotal) * 100 : valueSaved > 0 ? 999 : 0;

  // Weekly sparkline: last 4 weeks of task counts
  const weeklyData: number[] = [];
  const now = new Date();
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const count = tasks.filter((t) => {
      const d = new Date(t.created_at);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeklyData.push(count);
  }

  if (loading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-zinc-100 rounded w-40 mb-4" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-zinc-50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Don't show if no tasks at all
  if (taskCount === 0 && costTotal === 0) return null;

  const sparkPoints = miniSparkline(weeklyData);

  return (
    <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 leading-none">Pivot saved you</h3>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-0.5">This month</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-light text-emerald-700 tabular-nums">
            ${valueSaved >= 1000 ? `${(valueSaved / 1000).toFixed(1)}K` : valueSaved.toFixed(0)}
          </span>
          <div className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider">estimated value</div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {/* Tasks completed */}
        <div className="bg-white/80 rounded-xl p-3 border border-zinc-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3 h-3 text-zinc-400" />
            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Tasks</span>
          </div>
          <div className="text-xl font-light text-zinc-900 tabular-nums">{taskCount}</div>
        </div>

        {/* Time saved */}
        <div className="bg-white/80 rounded-xl p-3 border border-zinc-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Hours Saved</span>
          </div>
          <div className="text-xl font-light text-zinc-900 tabular-nums">{timeSaved.toFixed(1)}</div>
        </div>

        {/* Agent cost */}
        <div className="bg-white/80 rounded-xl p-3 border border-zinc-100">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3 h-3 text-zinc-400" />
            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Agent Cost</span>
          </div>
          <div className="text-xl font-light text-zinc-900 tabular-nums">
            ${costTotal < 1 ? costTotal.toFixed(2) : costTotal.toFixed(0)}
          </div>
        </div>

        {/* Net ROI */}
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-[9px] font-mono text-emerald-600 uppercase tracking-wider">Net ROI</span>
          </div>
          <div className="text-xl font-light text-emerald-700 tabular-nums">
            {netROI > 999 ? "999+" : Math.round(netROI)}%
          </div>
        </div>

        {/* Weekly sparkline */}
        <div className="bg-white/80 rounded-xl p-3 border border-zinc-100">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="w-3 h-3 text-zinc-400" />
            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Trend</span>
          </div>
          <svg viewBox={`0 0 80 24`} className="w-full h-6 mt-1" preserveAspectRatio="none">
            {sparkPoints && (
              <>
                <polyline
                  points={sparkPoints}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {weeklyData.map((v, i) => {
                  const max = Math.max(...weeklyData, 1);
                  const step = 80 / Math.max(weeklyData.length - 1, 1);
                  return (
                    <circle
                      key={i}
                      cx={i * step}
                      cy={24 - (v / max) * 24}
                      r="2.5"
                      fill="#10b981"
                    />
                  );
                })}
              </>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
