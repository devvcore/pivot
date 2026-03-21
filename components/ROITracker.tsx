"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { Zap, Clock, DollarSign, Activity } from "lucide-react";

interface ROITrackerProps {
  orgId: string;
}

interface TaskRecord {
  id: string;
  agent_id: string;
  status: string;
  created_at: string;
  title: string;
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
          authFetch(`/api/execution/tasks?orgId=${encodeURIComponent(orgId)}&status=completed&limit=100`),
          authFetch(`/api/execution/costs?orgId=${encodeURIComponent(orgId)}&from=${encodeURIComponent(monthStart)}`),
        ]);

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          const monthlyTasks = (tasksData.tasks || []).filter(
            (t: TaskRecord) => new Date(t.created_at) >= new Date(monthStart)
          );
          setTasks(monthlyTasks);
        }

        if (costsRes.ok) {
          const costsData = await costsRes.json();
          setCostTotal(costsData.totals?.totalCostUsd ?? 0);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    };

    fetchData();
  }, [orgId]);

  if (loading) {
    return (
      <div className="border border-stone-200 rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-stone-100 rounded w-40 mb-3" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-stone-50 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const taskCount = tasks.length;
  if (taskCount === 0) return null;

  // Count meaningful actions (not test evals)
  const actionTasks = tasks.filter(t => {
    const lower = t.title?.toLowerCase() ?? '';
    // Filter out likely test/eval tasks
    return !lower.includes('eval') && !lower.includes('test') && !lower.includes('smoke');
  });
  const actionCount = actionTasks.length;

  // Categorize what agents actually DID
  const agentWork: Record<string, number> = {};
  for (const t of actionTasks) {
    const agent = t.agent_id ?? 'other';
    agentWork[agent] = (agentWork[agent] ?? 0) + 1;
  }
  const topAgent = Object.entries(agentWork).sort(([, a], [, b]) => b - a)[0];

  return (
    <div className="border border-stone-200 rounded-xl p-5 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-stone-800">Agent Activity</h3>
        <span className="pivot-label ml-auto">this month</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-stone-50 rounded-lg px-3 py-2.5">
          <div className="pivot-label mb-1">Tasks Done</div>
          <p className="text-xl font-bold tabular-nums text-stone-900">{actionCount}</p>
        </div>
        <div className="bg-stone-50 rounded-lg px-3 py-2.5">
          <div className="pivot-label mb-1">Total Runs</div>
          <p className="text-xl font-bold tabular-nums text-stone-900">{taskCount}</p>
        </div>
        <div className="bg-stone-50 rounded-lg px-3 py-2.5">
          <div className="pivot-label mb-1">AI Cost</div>
          <p className="text-xl font-bold tabular-nums text-stone-900">${costTotal.toFixed(2)}</p>
        </div>
        <div className="bg-stone-50 rounded-lg px-3 py-2.5">
          <div className="pivot-label mb-1">Top Agent</div>
          <p className="text-sm font-semibold text-stone-900 truncate">
            {topAgent ? `${topAgent[0]} (${topAgent[1]})` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
