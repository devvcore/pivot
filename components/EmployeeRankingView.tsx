"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, DollarSign, TrendingUp, ShieldAlert, ChevronDown,
  ChevronRight, ArrowUpDown, Loader2, AlertCircle, BarChart3,
  Filter, Building2, Award, Target, Zap,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

interface EmployeeRanking {
  id: string;
  name: string;
  department: string;
  title: string;
  salary: number;
  revenueContribution: number;
  netValue: number;
  roi: number;
  performanceScore: number;
  riskLevel: "Low" | "Medium" | "High";
  recommendation: "Keep" | "Develop" | "Monitor" | "Review";
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  engagementScore?: number;
  tenureMonths?: number;
}

interface DepartmentBreakdown {
  department: string;
  headcount: number;
  avgPerformance: number;
  totalPayroll: number;
  totalRevenue: number;
  avgROI: number;
}

interface PayrollRecommendation {
  type: "increase" | "decrease" | "restructure" | "bonus";
  target: string;
  description: string;
  estimatedImpact: string;
  priority: "high" | "medium" | "low";
}

interface EmployeeRankingViewProps {
  orgId: string;
  jobId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function scoreColor(score: number): { text: string; bg: string; border: string } {
  if (score >= 80) return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (score >= 60) return { text: "text-green-700", bg: "bg-green-50", border: "border-green-200" };
  if (score >= 40) return { text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" };
  if (score >= 20) return { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" };
  return { text: "text-red-700", bg: "bg-red-50", border: "border-red-200" };
}

const RISK_BADGE: Record<string, { text: string; bg: string; border: string }> = {
  Low: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  Medium: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  High: { text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
};

const REC_BADGE: Record<string, { text: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  Keep:    { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: Award },
  Develop: { text: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    icon: TrendingUp },
  Monitor: { text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: Target },
  Review:  { text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     icon: ShieldAlert },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-700 bg-red-50 border-red-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  low: "text-zinc-600 bg-zinc-50 border-zinc-200",
};

type SortKey = "rank" | "name" | "netValue" | "roi" | "performanceScore" | "riskLevel" | "recommendation";

// ── Main Component ───────────────────────────────────────────────────────────

export function EmployeeRankingView({ orgId, jobId }: EmployeeRankingViewProps) {
  const [rankings, setRankings] = useState<EmployeeRanking[]>([]);
  const [departments, setDepartments] = useState<DepartmentBreakdown[]>([]);
  const [payrollRecs, setPayrollRecs] = useState<PayrollRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("netValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterDept, setFilterDept] = useState<string>("All");
  const [filterTier, setFilterTier] = useState<string>("All");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hrRes, insightRes] = await Promise.all([
        fetch(`/api/integrations/hr/analytics?orgId=${encodeURIComponent(orgId)}`),
        fetch(`/api/integrations/insights?orgId=${encodeURIComponent(orgId)}`),
      ]);

      if (hrRes.ok) {
        const hrData = await hrRes.json();
        setRankings(hrData.rankings ?? []);
        setDepartments(hrData.departments ?? []);
        setPayrollRecs(hrData.payrollRecommendations ?? []);
      } else {
        // If HR endpoint not available, try insights only
        if (insightRes.ok) {
          const insightData = await insightRes.json();
          if (insightData.employeeRankings) {
            setRankings(insightData.employeeRankings);
          }
        }
      }

      if (!hrRes.ok && !insightRes.ok) {
        setError("Unable to load employee analytics. Connect HR integrations to get started.");
      }
    } catch {
      setError("Failed to fetch employee data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived data
  const allDepts = useMemo(() => {
    const depts = new Set(rankings.map(r => r.department));
    return ["All", ...Array.from(depts).sort()];
  }, [rankings]);

  const tiers = ["All", "Top Performers", "Average", "Underperformers"];

  const filtered = useMemo(() => {
    let data = [...rankings];
    if (filterDept !== "All") {
      data = data.filter(r => r.department === filterDept);
    }
    if (filterTier === "Top Performers") {
      data = data.filter(r => r.performanceScore >= 75);
    } else if (filterTier === "Average") {
      data = data.filter(r => r.performanceScore >= 40 && r.performanceScore < 75);
    } else if (filterTier === "Underperformers") {
      data = data.filter(r => r.performanceScore < 40);
    }
    return data;
  }, [rankings, filterDept, filterTier]);

  const sorted = useMemo(() => {
    const d = [...filtered];
    d.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case "rank": av = b.netValue; bv = a.netValue; break; // rank by net value
        case "name": return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case "netValue": av = a.netValue; bv = b.netValue; break;
        case "roi": av = a.roi; bv = b.roi; break;
        case "performanceScore": av = a.performanceScore; bv = b.performanceScore; break;
        case "riskLevel": av = { Low: 0, Medium: 1, High: 2 }[a.riskLevel]; bv = { Low: 0, Medium: 1, High: 2 }[b.riskLevel]; break;
        case "recommendation": av = { Keep: 0, Develop: 1, Monitor: 2, Review: 3 }[a.recommendation]; bv = { Keep: 0, Develop: 1, Monitor: 2, Review: 3 }[b.recommendation]; break;
        default: av = a.netValue; bv = b.netValue;
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return d;
  }, [filtered, sortKey, sortDir]);

  // Summary stats
  const totalHeadcount = rankings.length;
  const avgPerformance = rankings.length > 0
    ? Math.round(rankings.reduce((s, r) => s + r.performanceScore, 0) / rankings.length)
    : 0;
  const totalPayroll = rankings.reduce((s, r) => s + r.salary, 0);
  const totalRevenue = rankings.reduce((s, r) => s + r.revenueContribution, 0);
  const teamROI = totalPayroll > 0 ? ((totalRevenue - totalPayroll) / totalPayroll * 100) : 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Department chart data
  const deptChartData = departments.map(d => ({
    name: d.department.length > 12 ? d.department.slice(0, 12) + "..." : d.department,
    performance: d.avgPerformance,
    roi: d.avgROI,
    fill: d.avgPerformance >= 70 ? "#10b981" : d.avgPerformance >= 50 ? "#eab308" : "#ef4444",
  }));

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Loading team analytics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && rankings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
        <Users className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-zinc-700 mb-2">No Employee Data Available</h3>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">Team Analytics</h2>
          <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mt-0.5">
            HR data + communication insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2 text-xs border border-zinc-200 rounded-xl bg-white text-zinc-700 font-mono focus:outline-none focus:border-zinc-400"
            >
              {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
          <div className="relative">
            <Target className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2 text-xs border border-zinc-200 rounded-xl bg-white text-zinc-700 font-mono focus:outline-none focus:border-zinc-400"
            >
              {tiers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Headcount", value: totalHeadcount.toString(), icon: Users, sub: `${allDepts.length - 1} departments` },
          { label: "Avg Performance", value: avgPerformance.toString(), icon: TrendingUp, sub: `/100 score` },
          { label: "Total Payroll", value: formatCurrency(totalPayroll), icon: DollarSign, sub: "Annual cost" },
          { label: "Team ROI", value: `${teamROI.toFixed(0)}%`, icon: BarChart3, sub: totalRevenue > totalPayroll ? "Value positive" : "Below target" },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-zinc-400" />
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">
                  {card.label}
                </span>
              </div>
              <div className="text-2xl font-light tabular-nums text-zinc-900">{card.value}</div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1">{card.sub}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Employee Ranking Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Award className="w-3.5 h-3.5" />
            Employee Rankings
          </h3>
          <span className="text-[10px] font-mono text-zinc-400">
            {sorted.length} of {rankings.length} employees
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                {[
                  { key: "rank" as SortKey, label: "#", width: "w-10" },
                  { key: "name" as SortKey, label: "Employee", width: "" },
                  { key: "netValue" as SortKey, label: "Net Value", width: "w-28" },
                  { key: "roi" as SortKey, label: "ROI", width: "w-24" },
                  { key: "performanceScore" as SortKey, label: "Performance", width: "w-28" },
                  { key: "riskLevel" as SortKey, label: "Risk", width: "w-20" },
                  { key: "recommendation" as SortKey, label: "Action", width: "w-24" },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-3 text-left text-[10px] font-mono text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-zinc-700 select-none whitespace-nowrap ${col.width}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        <span className="text-zinc-600">{sortDir === "desc" ? "\u2193" : "\u2191"}</span>
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((emp, idx) => {
                const isExpanded = expandedRows.has(emp.id);
                const sc = scoreColor(emp.performanceScore);
                const risk = RISK_BADGE[emp.riskLevel] ?? RISK_BADGE.Medium;
                const rec = REC_BADGE[emp.recommendation] ?? REC_BADGE.Monitor;
                const RecIcon = rec.icon;
                const netColor = emp.netValue >= 0 ? "text-emerald-700" : "text-red-700";

                return (
                  <motion.tr
                    key={emp.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors cursor-pointer ${isExpanded ? "bg-zinc-50/50" : ""}`}
                    onClick={() => toggleRow(emp.id)}
                  >
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-zinc-900">{emp.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-zinc-500">{emp.title}</span>
                          <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                            {emp.department}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-sm font-semibold tabular-nums ${netColor}`}>
                        {emp.netValue >= 0 ? "+" : ""}{formatCurrency(emp.netValue)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              emp.roi >= 2 ? "bg-emerald-500" : emp.roi >= 1 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(emp.roi * 33, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-zinc-600 tabular-nums">{emp.roi.toFixed(1)}x</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border tabular-nums ${sc.text} ${sc.bg} ${sc.border}`}>
                        {emp.performanceScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${risk.text} ${risk.bg} ${risk.border}`}>
                        {emp.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${rec.text} ${rec.bg} ${rec.border}`}>
                        <RecIcon className="w-3 h-3" />
                        {emp.recommendation}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          {/* Expanded Details */}
          <AnimatePresence>
            {sorted.map(emp => {
              if (!expandedRows.has(emp.id)) return null;
              return (
                <motion.div
                  key={`detail-${emp.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-zinc-100 bg-zinc-50/30"
                >
                  <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Strengths */}
                    <div>
                      <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
                        <Award className="w-3 h-3 text-emerald-500" /> Strengths
                      </h4>
                      <ul className="space-y-1.5">
                        {emp.strengths.map((s, i) => (
                          <li key={i} className="text-xs text-zinc-700 flex items-start gap-2">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Weaknesses */}
                    <div>
                      <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-500" /> Development Areas
                      </h4>
                      <ul className="space-y-1.5">
                        {emp.weaknesses.map((w, i) => (
                          <li key={i} className="text-xs text-zinc-700 flex items-start gap-2">
                            <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Recommendations */}
                    <div>
                      <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-blue-500" /> Recommendations
                      </h4>
                      <ul className="space-y-1.5">
                        {emp.recommendations.map((r, i) => (
                          <li key={i} className="text-xs text-zinc-700 flex items-start gap-2">
                            <span className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Department Breakdown */}
      {deptChartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm"
        >
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            Department Performance Comparison
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptChartData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => `${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={75}
                />
                <Tooltip
                  formatter={(value) => [`${value}/100`, "Avg Performance"]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e4e4e7",
                    borderRadius: "12px",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                  }}
                />
                <Bar dataKey="performance" radius={[0, 6, 6, 0]} barSize={22}>
                  {deptChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Department stats table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-3 py-2 text-left text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Department</th>
                  <th className="px-3 py-2 text-right text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Headcount</th>
                  <th className="px-3 py-2 text-right text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Avg Score</th>
                  <th className="px-3 py-2 text-right text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Payroll</th>
                  <th className="px-3 py-2 text-right text-[9px] font-mono text-zinc-400 uppercase tracking-wider">Revenue</th>
                  <th className="px-3 py-2 text-right text-[9px] font-mono text-zinc-400 uppercase tracking-wider">ROI</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept, i) => (
                  <tr key={i} className="border-b border-zinc-50">
                    <td className="px-3 py-2 font-medium text-zinc-700">{dept.department}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{dept.headcount}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`tabular-nums font-mono ${scoreColor(dept.avgPerformance).text}`}>
                        {dept.avgPerformance}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{formatCurrency(dept.totalPayroll)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{formatCurrency(dept.totalRevenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-mono">
                      <span className={dept.avgROI >= 1 ? "text-emerald-700" : "text-red-700"}>
                        {dept.avgROI.toFixed(1)}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Payroll Optimization Recommendations */}
      {payrollRecs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm"
        >
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5" />
            Payroll Optimization
          </h3>
          <div className="space-y-3">
            {payrollRecs.map((rec, i) => {
              const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
                increase: TrendingUp,
                decrease: ShieldAlert,
                restructure: Building2,
                bonus: Award,
              };
              const TypeIcon = typeIcons[rec.type] ?? Zap;

              return (
                <div key={i} className={`rounded-xl border p-4 ${PRIORITY_COLORS[rec.priority]}`}>
                  <div className="flex items-start gap-3">
                    <TypeIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm capitalize">{rec.type}: {rec.target}</span>
                        <span className="text-[9px] font-mono uppercase tracking-wider font-bold shrink-0">
                          {rec.priority} priority
                        </span>
                      </div>
                      <p className="text-xs mt-1 leading-relaxed opacity-90">{rec.description}</p>
                      <p className="text-[10px] font-mono mt-2 opacity-70">
                        Est. Impact: {rec.estimatedImpact}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default EmployeeRankingView;
