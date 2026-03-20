"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  ClipboardList,
  Heart,
  Cpu,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Bell,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { authFetch } from "@/lib/auth-fetch";

// ── Types ────────────────────────────────────────────────────────────────────

interface SparkPoint {
  value: number;
  label: string;
}

interface PulseMetric {
  current: number;
  previous: number;
  change: number;
  changeDirection: "up" | "down" | "flat";
  sparkline: SparkPoint[];
  label: string;
}

interface TaskStatusCounts {
  backlog: number;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
}

interface PulseData {
  cashPosition: PulseMetric;
  revenueThisMonth: PulseMetric;
  pipelineValue: PulseMetric;
  openTasks: PulseMetric & { statusCounts: TaskStatusCounts };
  customerHealth: PulseMetric & { activeCount: number; atRiskCount: number };
  agentActivity: PulseMetric & {
    completedToday: number;
    completedThisWeek: number;
    activeNow: number;
    recentAgents: string[];
  };
  aiSummary: string;
  unreadAlerts: number;
  lastUpdated: string;
}

interface PulseDashboardProps {
  orgId: string;
  onNavigate: (view: string) => void;
}

// ── CountUp Animation Hook ───────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const startValue = 0;

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(startValue + (target - startValue) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

// ── Typing Animation Hook ────────────────────────────────────────────────────

function useTypingEffect(text: string, speed = 20): string {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    if (!text) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return displayed;
}

// ── Format Helpers ───────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function agentLabel(id: string): string {
  const map: Record<string, string> = {
    strategist: "Strategist",
    marketer: "Marketer",
    analyst: "Analyst",
    recruiter: "Recruiter",
    operator: "Operator",
    researcher: "Researcher",
    codebot: "Codebot",
  };
  return map[id] ?? id;
}

// ── Change Badge ─────────────────────────────────────────────────────────────

function ChangeBadge({ change, direction }: { change: number; direction: "up" | "down" | "flat" }) {
  const colorClass =
    direction === "up"
      ? "text-emerald-600 bg-emerald-50"
      : direction === "down"
        ? "text-red-600 bg-red-50"
        : "text-zinc-500 bg-zinc-100";

  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

// ── Mini Sparkline ───────────────────────────────────────────────────────────

function Sparkline({
  data,
  color = "#10b981",
  type = "area",
}: {
  data: SparkPoint[];
  color?: string;
  type?: "area" | "bar";
}) {
  if (!data || data.length === 0) {
    return <div className="h-12 w-full bg-zinc-50 rounded animate-pulse" />;
  }

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={48}>
        <BarChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 ? color : `${color}80`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${color})`}
          dot={false}
          isAnimationActive={true}
          animationDuration={1000}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Mini Kanban ──────────────────────────────────────────────────────────────

function MiniKanban({ counts }: { counts: TaskStatusCounts }) {
  const stages = [
    { key: "backlog" as const, label: "BL", color: "bg-zinc-300" },
    { key: "todo" as const, label: "TD", color: "bg-blue-400" },
    { key: "in_progress" as const, label: "IP", color: "bg-amber-400" },
    { key: "review" as const, label: "RV", color: "bg-purple-400" },
  ];
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="flex gap-0.5 h-2 w-full rounded-full overflow-hidden mt-2">
      {stages.map((s) => (
        <div
          key={s.key}
          className={`${s.color} transition-all duration-700`}
          style={{ width: `${(counts[s.key] / total) * 100}%`, minWidth: counts[s.key] > 0 ? "4px" : "0" }}
          title={`${s.label}: ${counts[s.key]}`}
        />
      ))}
    </div>
  );
}

// ── Pulse Card ───────────────────────────────────────────────────────────────

function PulseCard({
  icon: Icon,
  iconColor,
  title,
  value,
  format = "number",
  metric,
  children,
  onClick,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  value: number;
  format?: "currency" | "number";
  metric: PulseMetric;
  children?: React.ReactNode;
  onClick?: () => void;
  delay?: number;
}) {
  const animatedValue = useCountUp(value, 1200);
  const formatted = format === "currency" ? formatCurrency(animatedValue) : formatNumber(animatedValue);

  const sparkColor =
    metric.changeDirection === "up"
      ? "#10b981"
      : metric.changeDirection === "down"
        ? "#ef4444"
        : "#71717a";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      onClick={onClick}
      className={`
        relative bg-white rounded-xl border border-zinc-200 p-5
        shadow-sm hover:border-zinc-300
        transition-colors duration-150
        ${onClick ? "cursor-pointer" : ""}
        group
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-zinc-500">{title}</span>
        </div>
        <ChangeBadge change={metric.change} direction={metric.changeDirection} />
      </div>

      {/* Value */}
      <div className="text-2xl font-bold text-zinc-900 tracking-tight mb-3">
        {formatted}
      </div>

      {/* Sparkline */}
      <Sparkline data={metric.sparkline} color={sparkColor} />

      {/* Extra content */}
      {children}

      {/* Hover arrow */}
      {onClick && (
        <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="w-4 h-4 text-zinc-400" />
        </div>
      )}
    </motion.div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export function PulseDashboard({ orgId, onNavigate }: PulseDashboardProps) {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPulse = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await authFetch("/api/pulse");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load pulse data";
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPulse();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchPulse(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPulse]);

  const typedSummary = useTypingEffect(data?.aiSummary ?? "", 18);

  // ── Loading State ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-8 h-8 text-emerald-500" />
        </motion.div>
        <p className="text-sm text-zinc-500">Loading your business pulse...</p>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => fetchPulse()}
          className="px-4 py-2 text-sm bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const lastUpdated = new Date(data.lastUpdated);
  const timeAgo = Math.round((Date.now() - lastUpdated.getTime()) / 60000);
  const timeLabel = timeAgo < 1 ? "Just now" : `${timeAgo}m ago`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* ── AI Summary Bar ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 rounded-xl px-6 py-4 flex items-center gap-4"
      >

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 bg-zinc-800 rounded-lg shrink-0">
            <Sparkles className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-sm text-zinc-300 truncate">
            {typedSummary}
            <span className="inline-block w-0.5 h-4 bg-zinc-500 ml-0.5 animate-pulse align-middle" />
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {data.unreadAlerts > 0 && (
            <button
              onClick={() => onNavigate("alerts")}
              className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
              title={`${data.unreadAlerts} unread alerts`}
            >
              <Bell className="w-4 h-4 text-zinc-400" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                {data.unreadAlerts > 9 ? "9+" : data.unreadAlerts}
              </span>
            </button>
          )}

          <span className="text-xs text-zinc-500">{timeLabel}</span>

          <button
            onClick={() => fetchPulse(true)}
            disabled={refreshing}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </motion.div>

      {/* ── Metric Cards Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Cash Position */}
        <PulseCard
          icon={DollarSign}
          iconColor="bg-emerald-100 text-emerald-600"
          title="Cash Position"
          value={data.cashPosition.current}
          format="currency"
          metric={data.cashPosition}
          onClick={() => onNavigate("analysis")}
          delay={0}
        />

        {/* Revenue This Month */}
        <PulseCard
          icon={TrendingUp}
          iconColor="bg-blue-100 text-blue-600"
          title="Revenue This Month"
          value={data.revenueThisMonth.current}
          format="currency"
          metric={data.revenueThisMonth}
          onClick={() => onNavigate("analysis")}
          delay={1}
        />

        {/* Pipeline Value */}
        <PulseCard
          icon={Target}
          iconColor="bg-violet-100 text-violet-600"
          title="Pipeline Value"
          value={data.pipelineValue.current}
          format="currency"
          metric={data.pipelineValue}
          onClick={() => onNavigate("crm")}
          delay={2}
        >
          <Sparkline data={data.pipelineValue.sparkline} color="#8b5cf6" type="bar" />
        </PulseCard>

        {/* Open Tasks */}
        <PulseCard
          icon={ClipboardList}
          iconColor="bg-amber-100 text-amber-600"
          title="Open Tasks"
          value={data.openTasks.current}
          format="number"
          metric={data.openTasks}
          onClick={() => onNavigate("pm")}
          delay={3}
        >
          <MiniKanban counts={data.openTasks.statusCounts} />
          <div className="flex gap-2 mt-2 text-[10px] text-zinc-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-300" />BL</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />TD</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />IP</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" />RV</span>
          </div>
        </PulseCard>

        {/* Customer Health */}
        <PulseCard
          icon={Heart}
          iconColor="bg-rose-100 text-rose-600"
          title="Customer Health"
          value={data.customerHealth.activeCount}
          format="number"
          metric={data.customerHealth}
          onClick={() => onNavigate("crm")}
          delay={4}
        >
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-zinc-600">{data.customerHealth.activeCount} active</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-zinc-600">{data.customerHealth.atRiskCount} at risk</span>
            </span>
          </div>
        </PulseCard>

        {/* Agent Activity */}
        <PulseCard
          icon={Cpu}
          iconColor="bg-cyan-100 text-cyan-600"
          title="Agent Activity"
          value={data.agentActivity.completedThisWeek}
          format="number"
          metric={data.agentActivity}
          onClick={() => onNavigate("team")}
          delay={5}
        >
          <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
            <span>{data.agentActivity.completedToday} today</span>
            <span>{data.agentActivity.activeNow} running</span>
          </div>
          {data.agentActivity.recentAgents.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {data.agentActivity.recentAgents.map((a) => (
                <span
                  key={a}
                  className="px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded-full text-[10px] font-medium"
                >
                  {agentLabel(a)}
                </span>
              ))}
            </div>
          )}
        </PulseCard>
      </div>
    </div>
  );
}
