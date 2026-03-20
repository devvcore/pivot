"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Target,
  MessageSquare,
  Sparkles,
  Shield,
  BarChart3,
  ArrowUpDown,
  ArrowLeft,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { authFetch } from "@/lib/auth-fetch";

// ─── Client-Side Types ───────────────────────────────────────────────────────
// These mirror the server-side types from lib/scoring/engine.ts but are safe
// for client components (no server imports).

type RoleType = "direct_revenue" | "enabler" | "support";
type ConfidenceTier = "measured" | "partial" | "estimated" | "evaluating";

interface DimensionScores {
  responsiveness: number | null;
  outputVolume: number | null;
  qualitySignal: number | null;
  collaboration: number | null;
  reliability: number | null;
  managerAssessment: number | null;
}

interface EmployeeScore {
  employeeId: string;
  hardValue: number;
  totalCost: number;
  netValue: number;
  intangibleScore: number;
  dimensions: DimensionScores;
  roleType: RoleType;
  confidence: ConfidenceTier;
  dataSources: string[];
  rank: number;
  rankChange: number;
  scoredAt?: string;
}

interface Employee {
  id: string;
  orgId: string;
  name: string;
  roleTitle?: string;
  department?: string;
  salary?: number;
  startDate?: string;
  status: string;
}

interface EmployeeGoal {
  id: string;
  employee_id: string;
  dimension: string;
  title: string;
  description?: string;
  metric: string;
  current: number;
  target: number;
  projected_impact: number;
  status: string;
}

interface EmployeeDashboardProps {
  orgId: string;
  totalRevenue?: number;
  employeeCount?: number;
  industry?: string;
  onBack?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  return currencyFmt.format(n);
}

const ROLE_LABELS: Record<RoleType, string> = {
  direct_revenue: "Revenue",
  enabler: "Enabler",
  support: "Support",
};

const ROLE_COLORS: Record<RoleType, { text: string; bg: string; border: string }> = {
  direct_revenue: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  enabler: { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  support: { text: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
};

const CONFIDENCE_COLORS: Record<ConfidenceTier, { text: string; bg: string; border: string }> = {
  measured: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  partial: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  estimated: { text: "text-zinc-600", bg: "bg-zinc-50", border: "border-zinc-200" },
  evaluating: { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
};

const DIMENSION_LABELS: Record<string, string> = {
  responsiveness: "Responsiveness",
  outputVolume: "Output Volume",
  qualitySignal: "Quality",
  collaboration: "Collaboration",
  reliability: "Reliability",
  managerAssessment: "Manager",
};

type SortField = "rank" | "name" | "roleType" | "intangibleScore" | "netValue" | "confidence" | "dataSources";
type SortDir = "asc" | "desc";

// ─── Merged Employee + Score Record ──────────────────────────────────────────

interface MergedEmployee {
  employee: Employee;
  score: EmployeeScore | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EmployeeDashboard({
  orgId,
  totalRevenue,
  employeeCount: _employeeCount,
  industry,
  onBack,
}: EmployeeDashboardProps) {
  // Data state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scores, setScores] = useState<EmployeeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterRole, setFilterRole] = useState<RoleType | "all">("all");
  const [filterConfidence, setFilterConfidence] = useState<ConfidenceTier | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, scoreRes] = await Promise.all([
        fetch(`/api/employees?orgId=${encodeURIComponent(orgId)}`),
        authFetch(`/api/employees/scores?orgId=${encodeURIComponent(orgId)}`),
      ]);

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(Array.isArray(empData) ? empData : []);
      }

      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        setScores(scoreData.scores ?? []);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Scoring Cycle ───────────────────────────────────────────────────────

  const runScoringCycle = useCallback(async () => {
    setScoring(true);
    try {
      const res = await authFetch("/api/employees/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      if (res.ok) {
        // Refresh data after scoring
        await fetchData();
      }
    } catch {
      // silent fail
    } finally {
      setScoring(false);
    }
  }, [orgId, fetchData]);

  // ─── Merge Employees + Scores ────────────────────────────────────────────

  const scoreMap = useMemo(() => {
    const m = new Map<string, EmployeeScore>();
    for (const s of scores) m.set(s.employeeId, s);
    return m;
  }, [scores]);

  const merged: MergedEmployee[] = useMemo(() => {
    return employees.map((emp) => ({
      employee: emp,
      score: scoreMap.get(emp.id) ?? null,
    }));
  }, [employees, scoreMap]);

  // ─── Filtering ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return merged.filter((m) => {
      // Search by name
      if (searchQuery && !m.employee.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Filter by role
      if (filterRole !== "all" && m.score?.roleType !== filterRole) {
        return false;
      }
      // Filter by confidence
      if (filterConfidence !== "all" && m.score?.confidence !== filterConfidence) {
        return false;
      }
      return true;
    });
  }, [merged, searchQuery, filterRole, filterConfidence]);

  // ─── Sorting ─────────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "rank":
          cmp = (a.score?.rank ?? 999) - (b.score?.rank ?? 999);
          break;
        case "name":
          cmp = a.employee.name.localeCompare(b.employee.name);
          break;
        case "roleType":
          cmp = (a.score?.roleType ?? "").localeCompare(b.score?.roleType ?? "");
          break;
        case "intangibleScore":
          cmp = (a.score?.intangibleScore ?? 0) - (b.score?.intangibleScore ?? 0);
          break;
        case "netValue":
          cmp = (a.score?.netValue ?? 0) - (b.score?.netValue ?? 0);
          break;
        case "confidence":
          cmp = (a.score?.confidence ?? "").localeCompare(b.score?.confidence ?? "");
          break;
        case "dataSources":
          cmp = (a.score?.dataSources.length ?? 0) - (b.score?.dataSources.length ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [filtered, sortField, sortDir]);

  // ─── Header Stats ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalEmps = employees.length;
    const scoredEmps = scores.filter((s) => s.intangibleScore > 0);
    const avgScore =
      scoredEmps.length > 0
        ? Math.round(scoredEmps.reduce((sum, s) => sum + s.intangibleScore, 0) / scoredEmps.length)
        : 0;

    const topPerformer =
      scores.length > 0
        ? scores.reduce((best, s) => (s.netValue > best.netValue ? s : best), scores[0])
        : null;
    const topPerformerName = topPerformer
      ? employees.find((e) => e.id === topPerformer.employeeId)?.name ?? "N/A"
      : "N/A";

    const measuredCount = scores.filter((s) => s.confidence === "measured").length;
    const dataCoverage = totalEmps > 0 ? Math.round((measuredCount / totalEmps) * 100) : 0;

    return { totalEmps, avgScore, topPerformerName, dataCoverage };
  }, [employees, scores]);

  // ─── Toggle Sort ─────────────────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 p-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-zinc-900"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 bg-zinc-900 flex items-center justify-center rounded-xl shadow-lg shadow-zinc-900/10">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-xl text-zinc-900 leading-none">
              Employee Value Engine
            </div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mt-1">
              Team Performance Dashboard
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={runScoringCycle}
            disabled={scoring}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 transition-colors active:scale-95 group font-bold rounded-lg"
          >
            {scoring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scoring...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Run Scoring Cycle
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-8 lg:p-12">
        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
        >
          <StatCard
            label="Total Employees"
            value={String(stats.totalEmps)}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            label="Avg Intangible Score"
            value={stats.avgScore > 0 ? `${stats.avgScore}/100` : "--"}
            icon={<BarChart3 className="w-5 h-5" />}
            accent="emerald"
          />
          <StatCard
            label="Top Performer"
            value={stats.topPerformerName}
            icon={<TrendingUp className="w-5 h-5" />}
            accent="amber"
          />
          <StatCard
            label="Data Coverage"
            value={`${stats.dataCoverage}%`}
            icon={<Shield className="w-5 h-5" />}
            accent={stats.dataCoverage >= 50 ? "emerald" : "rose"}
          />
        </motion.div>

        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all bg-white"
            />
          </div>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as RoleType | "all")}
            className="px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="direct_revenue">Revenue</option>
            <option value="enabler">Enabler</option>
            <option value="support">Support</option>
          </select>

          <select
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value as ConfidenceTier | "all")}
            className="px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer"
          >
            <option value="all">All Confidence</option>
            <option value="measured">Measured</option>
            <option value="partial">Partial</option>
            <option value="estimated">Estimated</option>
            <option value="evaluating">Evaluating</option>
          </select>

          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest ml-auto">
            {sorted.length} of {employees.length} shown
          </div>
        </motion.div>

        {/* Leaderboard Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm"
        >
          {/* Table Header */}
          <div className="grid grid-cols-[60px_1fr_100px_140px_120px_100px_80px] gap-2 px-6 py-3 border-b border-zinc-100 bg-zinc-50/50 text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">
            <SortHeader field="rank" current={sortField} dir={sortDir} onClick={toggleSort}>
              Rank
            </SortHeader>
            <SortHeader field="name" current={sortField} dir={sortDir} onClick={toggleSort}>
              Name
            </SortHeader>
            <SortHeader field="roleType" current={sortField} dir={sortDir} onClick={toggleSort}>
              Role
            </SortHeader>
            <SortHeader field="intangibleScore" current={sortField} dir={sortDir} onClick={toggleSort}>
              Intangible
            </SortHeader>
            <SortHeader field="netValue" current={sortField} dir={sortDir} onClick={toggleSort}>
              Net Value
            </SortHeader>
            <SortHeader field="confidence" current={sortField} dir={sortDir} onClick={toggleSort}>
              Confidence
            </SortHeader>
            <SortHeader field="dataSources" current={sortField} dir={sortDir} onClick={toggleSort}>
              Sources
            </SortHeader>
          </div>

          {loading ? (
            <div className="p-20 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 border-2 border-zinc-100 border-t-zinc-900 rounded-full mx-auto mb-4"
              />
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                Loading scores...
              </div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-100">
                <Users className="w-7 h-7 text-zinc-200" />
              </div>
              <h3 className="text-lg font-light text-zinc-900 mb-2">No scored employees</h3>
              <p className="text-zinc-500 text-sm mb-6 max-w-xs mx-auto">
                Add employees and run a scoring cycle to see rankings here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {sorted.map((m, i) => (
                <LeaderboardRow
                  key={m.employee.id}
                  merged={m}
                  index={i}
                  isExpanded={expandedId === m.employee.id}
                  onToggle={() =>
                    setExpandedId(expandedId === m.employee.id ? null : m.employee.id)
                  }
                  orgId={orgId}
                />
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "emerald" | "amber" | "rose";
}) {
  const borderColor = accent === "emerald"
    ? "border-emerald-200"
    : accent === "amber"
      ? "border-amber-200"
      : accent === "rose"
        ? "border-rose-200"
        : "border-zinc-200";

  return (
    <div className={`bg-white border ${borderColor} p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group`}>
      <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-colors text-zinc-400">
        {icon}
      </div>
      <div className="text-2xl font-light text-zinc-900 mb-1 truncate">{value}</div>
      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">{label}</div>
    </div>
  );
}

function SortHeader({
  field,
  current,
  dir,
  onClick,
  children,
}: {
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (field: SortField) => void;
  children: React.ReactNode;
}) {
  const isActive = current === field;
  return (
    <button
      onClick={() => onClick(field)}
      className={`flex items-center gap-1 text-left hover:text-zinc-900 transition-colors ${isActive ? "text-zinc-900 font-bold" : ""}`}
    >
      {children}
      {isActive ? (
        dir === "asc" ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-30" />
      )}
    </button>
  );
}

function RankChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="text-emerald-600 flex items-center gap-0.5 text-[10px] font-mono">
        <TrendingUp className="w-3 h-3" />
        {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="text-rose-600 flex items-center gap-0.5 text-[10px] font-mono">
        <TrendingDown className="w-3 h-3" />
        {Math.abs(change)}
      </span>
    );
  }
  return (
    <span className="text-zinc-300 flex items-center">
      <Minus className="w-3 h-3" />
    </span>
  );
}

function IntangibleBar({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-emerald-500"
      : score >= 40
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden max-w-[80px]">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums text-zinc-900 w-8 text-right">
        {Math.round(score)}
      </span>
    </div>
  );
}

function LeaderboardRow({
  merged,
  index,
  isExpanded,
  onToggle,
  orgId,
}: {
  merged: MergedEmployee;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  orgId: string;
}) {
  const { employee, score } = merged;
  const roleColors = score ? ROLE_COLORS[score.roleType] : null;
  const confColors = score ? CONFIDENCE_COLORS[score.confidence] : null;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.02 }}
        onClick={onToggle}
        className="grid grid-cols-[60px_1fr_100px_140px_120px_100px_80px] gap-2 px-6 py-4 hover:bg-zinc-50/50 transition-all cursor-pointer items-center"
      >
        {/* Rank */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold tabular-nums text-zinc-900">
            #{score?.rank ?? "--"}
          </span>
          {score && <RankChangeIndicator change={score.rankChange} />}
        </div>

        {/* Name */}
        <div className="min-w-0">
          <div className="text-sm font-bold text-zinc-900 truncate">{employee.name}</div>
          {employee.roleTitle && (
            <div className="text-[11px] text-zinc-400 truncate">{employee.roleTitle}</div>
          )}
        </div>

        {/* Role Type */}
        <div>
          {score && roleColors ? (
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${roleColors.text} ${roleColors.bg} ${roleColors.border}`}
            >
              {ROLE_LABELS[score.roleType]}
            </span>
          ) : (
            <span className="text-zinc-300 text-xs">--</span>
          )}
        </div>

        {/* Intangible Score */}
        <div>
          {score ? (
            <IntangibleBar score={score.intangibleScore} />
          ) : (
            <span className="text-zinc-300 text-xs">No score</span>
          )}
        </div>

        {/* Net Value */}
        <div>
          {score ? (
            <span
              className={`text-sm font-medium tabular-nums ${score.netValue >= 0 ? "text-zinc-900" : "text-rose-600"}`}
            >
              {formatCurrency(score.netValue)}
            </span>
          ) : (
            <span className="text-zinc-300 text-xs">--</span>
          )}
        </div>

        {/* Confidence */}
        <div>
          {score && confColors ? (
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${confColors.text} ${confColors.bg} ${confColors.border}`}
            >
              {score.confidence}
            </span>
          ) : (
            <span className="text-zinc-300 text-xs">--</span>
          )}
        </div>

        {/* Data Sources */}
        <div className="text-sm tabular-nums text-zinc-600 text-center">
          {score ? score.dataSources.length : 0}
        </div>
      </motion.div>

      {/* Expanded Detail Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <ExpandedDetail employee={employee} score={score} orgId={orgId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Expanded Detail Panel ───────────────────────────────────────────────────

function ExpandedDetail({
  employee,
  score,
  orgId,
}: {
  employee: Employee;
  score: EmployeeScore | null;
  orgId: string;
}) {
  const [history, setHistory] = useState<EmployeeScore[]>([]);
  const [goals, setGoals] = useState<EmployeeGoal[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [generatingGoals, setGeneratingGoals] = useState(false);

  // Manager assessment form
  const [mgrScore, setMgrScore] = useState(50);
  const [mgrNote, setMgrNote] = useState("");
  const [submittingAssessment, setSubmittingAssessment] = useState(false);
  const [assessmentDone, setAssessmentDone] = useState(false);

  useEffect(() => {
    // Fetch score history
    authFetch(`/api/employees/scores/${employee.id}?limit=30`)
      .then((r) => r.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));

    // Fetch goals
    authFetch(`/api/employees/goals?employeeId=${employee.id}`)
      .then((r) => r.json())
      .then((data) => setGoals(data.goals ?? []))
      .catch(() => {})
      .finally(() => setLoadingGoals(false));
  }, [employee.id]);

  const generateGoals = async () => {
    setGeneratingGoals(true);
    try {
      const res = await authFetch("/api/employees/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id, orgId }),
      });
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals ?? []);
      }
    } catch {
      // silent
    } finally {
      setGeneratingGoals(false);
    }
  };

  const submitAssessment = async () => {
    setSubmittingAssessment(true);
    try {
      const res = await authFetch("/api/employees/manager-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          managerId: "current-manager", // placeholder
          score: mgrScore,
          note: mgrNote || undefined,
        }),
      });
      if (res.ok) {
        setAssessmentDone(true);
      }
    } catch {
      // silent
    } finally {
      setSubmittingAssessment(false);
    }
  };

  // Radar chart data
  const radarData = score
    ? [
        { dimension: "Responsive", value: score.dimensions.responsiveness ?? 0, fullMark: 100 },
        { dimension: "Output", value: score.dimensions.outputVolume ?? 0, fullMark: 100 },
        { dimension: "Quality", value: score.dimensions.qualitySignal ?? 0, fullMark: 100 },
        { dimension: "Collab", value: score.dimensions.collaboration ?? 0, fullMark: 100 },
        { dimension: "Reliability", value: score.dimensions.reliability ?? 0, fullMark: 100 },
        { dimension: "Manager", value: score.dimensions.managerAssessment ?? 0, fullMark: 100 },
      ]
    : [];

  // Line chart data (reversed to show oldest first)
  const lineData = [...history].reverse().map((h, i) => ({
    entry: i + 1,
    intangible: h.intangibleScore,
    netValue: h.netValue,
    date: h.scoredAt ? new Date(h.scoredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : `#${i + 1}`,
  }));

  const activeGoals = goals.filter((g) => g.status === "active");

  return (
    <div className="px-6 pb-6 border-t border-zinc-100 bg-zinc-50/30">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Radar Chart */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" />
            Intangible Dimensions
          </h4>
          {score && radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e4e4e7" />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-zinc-300 text-sm">
              No dimension data
            </div>
          )}
        </div>

        {/* Score History Line Chart */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Score History
          </h4>
          {loadingHistory ? (
            <div className="h-[250px] flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
            </div>
          ) : lineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lineData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#a1a1aa" }}
                  axisLine={{ stroke: "#e4e4e7" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#a1a1aa" }}
                  axisLine={{ stroke: "#e4e4e7" }}
                  tickLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e4e4e7",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="intangible"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#10b981" }}
                  name="Intangible Score"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-zinc-300 text-sm">
              No history yet
            </div>
          )}
        </div>

        {/* Active Goals */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Target className="w-3.5 h-3.5" />
              Active Goals
            </h4>
            <button
              onClick={generateGoals}
              disabled={generatingGoals}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 rounded-lg transition-all"
            >
              {generatingGoals ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  Generate Goals
                </>
              )}
            </button>
          </div>

          {loadingGoals ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
            </div>
          ) : activeGoals.length > 0 ? (
            <div className="space-y-3">
              {activeGoals.map((goal) => {
                const progress =
                  goal.target > 0
                    ? Math.min(100, Math.round(((goal.current - 0) / (goal.target - 0)) * 100))
                    : 0;

                return (
                  <div key={goal.id} className="border border-zinc-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-zinc-900">{goal.title}</span>
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                        {DIMENSION_LABELS[goal.dimension] ?? goal.dimension}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                        {goal.current}/{goal.target}
                      </span>
                    </div>
                    {goal.projected_impact > 0 && (
                      <div className="mt-1 text-[10px] text-emerald-600 font-mono">
                        +{goal.projected_impact.toFixed(1)} pts potential impact
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-300 text-sm">
              No active goals. Click &quot;Generate Goals&quot; to create them.
            </div>
          )}
        </div>

        {/* Manager Assessment */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            Manager Assessment
          </h4>

          {assessmentDone ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-200">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-sm font-medium text-zinc-900 mb-1">Assessment Submitted</div>
              <div className="text-xs text-zinc-500">
                It will be reflected in the next scoring cycle.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                    Score
                  </label>
                  <span className="text-sm font-bold tabular-nums text-zinc-900">{mgrScore}/100</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mgrScore}
                  onChange={(e) => setMgrScore(parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-100 rounded-full appearance-none cursor-pointer accent-zinc-900"
                />
                <div className="flex justify-between text-[9px] font-mono text-zinc-300 mt-1">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5 block">
                  Note (optional)
                </label>
                <textarea
                  value={mgrNote}
                  onChange={(e) => setMgrNote(e.target.value)}
                  placeholder="Performance observations, context..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all resize-none"
                />
              </div>

              <button
                onClick={submitAssessment}
                disabled={submittingAssessment}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 disabled:opacity-50 rounded-lg transition-all"
              >
                {submittingAssessment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Assessment"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
