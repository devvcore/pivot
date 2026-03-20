"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Loader2,
  RefreshCw,
  BarChart3,
  DollarSign,
  Lightbulb,
  PieChart as PieChartIcon,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { authFetch } from "@/lib/auth-fetch";

// ─── Client-Side Types ───────────────────────────────────────────────────────

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

interface FTEBenchmark {
  engineering: number;
  sales: number;
  marketing: number;
  operations: number;
  support: number;
  management: number;
  total: number;
}

interface LeanDashboardProps {
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

const PIE_COLORS: Record<RoleType, string> = {
  direct_revenue: "#10b981",
  enabler: "#3b82f6",
  support: "#8b5cf6",
};

// Industry benchmark ratios for role type distribution (as percentage of total)
const INDUSTRY_ROLE_BENCHMARKS: Record<string, Record<RoleType, number>> = {
  saas: { direct_revenue: 0.30, enabler: 0.45, support: 0.25 },
  agency: { direct_revenue: 0.40, enabler: 0.35, support: 0.25 },
  ecommerce: { direct_revenue: 0.30, enabler: 0.35, support: 0.35 },
  consulting: { direct_revenue: 0.50, enabler: 0.25, support: 0.25 },
  general: { direct_revenue: 0.30, enabler: 0.40, support: 0.30 },
};

// Revenue per employee benchmarks by industry (annual, USD)
const REVENUE_PER_EMPLOYEE_BENCHMARK: Record<string, number> = {
  saas: 200_000,
  agency: 150_000,
  ecommerce: 180_000,
  consulting: 175_000,
  general: 160_000,
};

// FTE department distribution ratios by industry
const FTE_RATIOS: Record<string, Record<string, number>> = {
  saas: { engineering: 0.40, sales: 0.20, marketing: 0.10, operations: 0.10, support: 0.10, management: 0.10 },
  agency: { engineering: 0.35, sales: 0.15, marketing: 0.10, operations: 0.10, support: 0.10, management: 0.20 },
  ecommerce: { engineering: 0.20, sales: 0.15, marketing: 0.20, operations: 0.20, support: 0.15, management: 0.10 },
  consulting: { engineering: 0.10, sales: 0.20, marketing: 0.10, operations: 0.10, support: 0.15, management: 0.35 },
  general: { engineering: 0.25, sales: 0.15, marketing: 0.15, operations: 0.15, support: 0.15, management: 0.15 },
};

// Department classification from role titles
function classifyDepartment(roleTitle?: string, department?: string): string {
  if (department) {
    const d = department.toLowerCase();
    if (d.includes("engineer") || d.includes("dev") || d.includes("tech")) return "engineering";
    if (d.includes("sales") || d.includes("revenue") || d.includes("business dev")) return "sales";
    if (d.includes("market")) return "marketing";
    if (d.includes("ops") || d.includes("operation")) return "operations";
    if (d.includes("support") || d.includes("success") || d.includes("service")) return "support";
    if (d.includes("manage") || d.includes("exec") || d.includes("lead")) return "management";
  }

  if (roleTitle) {
    const t = roleTitle.toLowerCase();
    if (t.includes("engineer") || t.includes("developer") || t.includes("dev ") || t.includes("devops") || t.includes("programmer")) return "engineering";
    if (t.includes("sales") || t.includes("account exec") || t.includes("bdr") || t.includes("sdr")) return "sales";
    if (t.includes("market") || t.includes("content") || t.includes("seo") || t.includes("growth")) return "marketing";
    if (t.includes("ops") || t.includes("operation") || t.includes("logistics")) return "operations";
    if (t.includes("support") || t.includes("success") || t.includes("help")) return "support";
    if (t.includes("manager") || t.includes("director") || t.includes("vp") || t.includes("lead") || t.includes("head of") || t.includes("chief")) return "management";
  }

  return "operations"; // default
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LeanDashboard({
  orgId,
  totalRevenue,
  employeeCount: _employeeCount,
  industry,
  onBack,
}: LeanDashboardProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scores, setScores] = useState<EmployeeScore[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveIndustry = (industry?.toLowerCase() || "general") as string;
  const normalizedIndustry = FTE_RATIOS[effectiveIndustry] ? effectiveIndustry : "general";

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
      // silent
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Score Map ───────────────────────────────────────────────────────────

  const scoreMap = useMemo(() => {
    const m = new Map<string, EmployeeScore>();
    for (const s of scores) m.set(s.employeeId, s);
    return m;
  }, [scores]);

  // ─── FTE Benchmark Comparison Data ───────────────────────────────────────

  const fteBenchmarkData = useMemo(() => {
    const deptCounts: Record<string, number> = {
      engineering: 0,
      sales: 0,
      marketing: 0,
      operations: 0,
      support: 0,
      management: 0,
    };

    for (const emp of employees) {
      const dept = classifyDepartment(emp.roleTitle, emp.department);
      if (deptCounts[dept] !== undefined) {
        deptCounts[dept]++;
      }
    }

    // Calculate benchmark headcount
    const ratios = FTE_RATIOS[normalizedIndustry];
    const annualRev = totalRevenue ?? 0;
    const revPerEmp = REVENUE_PER_EMPLOYEE_BENCHMARK[normalizedIndustry] ?? 160_000;
    const idealTotal = annualRev > 0 ? Math.max(1, Math.round(annualRev / revPerEmp)) : employees.length;

    return Object.keys(deptCounts).map((dept) => ({
      department: dept.charAt(0).toUpperCase() + dept.slice(1),
      actual: deptCounts[dept],
      benchmark: Math.round(idealTotal * (ratios[dept] ?? 0.15)),
    }));
  }, [employees, normalizedIndustry, totalRevenue]);

  // ─── Role Type Distribution ──────────────────────────────────────────────

  const roleDistribution = useMemo(() => {
    const counts: Record<RoleType, number> = { direct_revenue: 0, enabler: 0, support: 0 };
    for (const s of scores) {
      counts[s.roleType]++;
    }
    // Also count unscored employees as support
    const scoredIds = new Set(scores.map((s) => s.employeeId));
    for (const emp of employees) {
      if (!scoredIds.has(emp.id)) {
        counts.support++;
      }
    }

    const total = counts.direct_revenue + counts.enabler + counts.support;

    return (Object.keys(counts) as RoleType[]).map((role) => ({
      name: ROLE_LABELS[role],
      value: counts[role],
      percentage: total > 0 ? Math.round((counts[role] / total) * 100) : 0,
      color: PIE_COLORS[role],
    }));
  }, [employees, scores]);

  const benchmarkDistribution = useMemo(() => {
    const benchmarks = INDUSTRY_ROLE_BENCHMARKS[normalizedIndustry] ?? INDUSTRY_ROLE_BENCHMARKS.general;
    return (Object.keys(benchmarks) as RoleType[]).map((role) => ({
      name: ROLE_LABELS[role],
      value: Math.round(benchmarks[role] * 100),
    }));
  }, [normalizedIndustry]);

  // ─── Cost Efficiency Metrics ─────────────────────────────────────────────

  const costMetrics = useMemo(() => {
    const total = employees.length;
    const annualRev = totalRevenue ?? 0;
    const revenuePerEmployee = total > 0 && annualRev > 0 ? annualRev / total : 0;
    const benchmarkRevenuePerEmp = REVENUE_PER_EMPLOYEE_BENCHMARK[normalizedIndustry] ?? 160_000;

    // Average net value by role type
    const netByRole: Record<RoleType, { sum: number; count: number }> = {
      direct_revenue: { sum: 0, count: 0 },
      enabler: { sum: 0, count: 0 },
      support: { sum: 0, count: 0 },
    };

    const negativeValue: Array<{ name: string; netValue: number }> = [];

    for (const s of scores) {
      netByRole[s.roleType].sum += s.netValue;
      netByRole[s.roleType].count++;

      if (s.netValue < 0) {
        const emp = employees.find((e) => e.id === s.employeeId);
        negativeValue.push({
          name: emp?.name ?? "Unknown",
          netValue: s.netValue,
        });
      }
    }

    const avgNetByRole = (Object.keys(netByRole) as RoleType[]).map((role) => ({
      role,
      label: ROLE_LABELS[role],
      avg: netByRole[role].count > 0 ? Math.round(netByRole[role].sum / netByRole[role].count) : 0,
      count: netByRole[role].count,
    }));

    return {
      revenuePerEmployee: Math.round(revenuePerEmployee),
      benchmarkRevenuePerEmp,
      avgNetByRole,
      negativeValue: negativeValue.sort((a, b) => a.netValue - b.netValue),
    };
  }, [employees, scores, totalRevenue, normalizedIndustry]);

  // ─── Optimization Recommendations ────────────────────────────────────────

  const recommendations = useMemo(() => {
    const recs: string[] = [];

    // Benchmark comparison recommendations
    for (const d of fteBenchmarkData) {
      const diff = d.actual - d.benchmark;
      if (diff > 1) {
        recs.push(
          `You have ${diff} more ${d.department.toLowerCase()} staff than the benchmark suggests for a ${normalizedIndustry} company your size. Consider evaluating role efficiency in this department.`
        );
      } else if (diff < -2) {
        recs.push(
          `Your ${d.department.toLowerCase()} team is ${Math.abs(diff)} people understaffed compared to ${normalizedIndustry} companies your size. This gap could be limiting throughput.`
        );
      }
    }

    // Role type imbalance
    const roleBenchmarks = INDUSTRY_ROLE_BENCHMARKS[normalizedIndustry] ?? INDUSTRY_ROLE_BENCHMARKS.general;
    const total = employees.length;
    if (total > 0) {
      const revenueCount = scores.filter((s) => s.roleType === "direct_revenue").length;
      const revenueRatio = revenueCount / total;
      const benchRatio = roleBenchmarks.direct_revenue;

      if (revenueRatio < benchRatio - 0.1) {
        recs.push(
          `Only ${Math.round(revenueRatio * 100)}% of your team is in revenue-generating roles, compared to the ${Math.round(benchRatio * 100)}% industry benchmark. Consider shifting capable team members to revenue-facing positions.`
        );
      }
    }

    // Negative value employees
    if (costMetrics.negativeValue.length > 0) {
      const names = costMetrics.negativeValue.slice(0, 3).map((n) => n.name).join(", ");
      recs.push(
        `${costMetrics.negativeValue.length} employee(s) currently show negative net value (${names}). Review their role fit, data coverage, or consider additional training investment.`
      );
    }

    // Revenue per employee vs benchmark
    if (costMetrics.revenuePerEmployee > 0 && costMetrics.revenuePerEmployee < costMetrics.benchmarkRevenuePerEmp * 0.8) {
      const gap = Math.round(((costMetrics.benchmarkRevenuePerEmp - costMetrics.revenuePerEmployee) / costMetrics.benchmarkRevenuePerEmp) * 100);
      recs.push(
        `Revenue per employee (${formatCurrency(costMetrics.revenuePerEmployee)}/yr) is ${gap}% below the ${normalizedIndustry} benchmark of ${formatCurrency(costMetrics.benchmarkRevenuePerEmp)}/yr. Focus on productivity improvements or headcount optimization.`
      );
    }

    // Top opportunity: best support role that could be revenue-facing
    const supportScores = scores
      .filter((s) => s.roleType === "support" && s.intangibleScore > 60)
      .sort((a, b) => b.intangibleScore - a.intangibleScore);

    if (supportScores.length > 0) {
      const top = supportScores[0];
      const emp = employees.find((e) => e.id === top.employeeId);
      if (emp) {
        recs.push(
          `Top opportunity: ${emp.name} scores ${Math.round(top.intangibleScore)} on intangibles but is classified as support. Moving them to a revenue-facing role could increase team value.`
        );
      }
    }

    if (recs.length === 0) {
      recs.push("Your team composition is well-aligned with industry benchmarks. Continue monitoring dimension scores for optimization opportunities.");
    }

    return recs;
  }, [employees, scores, fteBenchmarkData, normalizedIndustry, costMetrics]);

  // ─── Cost Breakdown Chart Data ───────────────────────────────────────────

  const costBreakdownData = useMemo(() => {
    return scores
      .map((s) => {
        const emp = employees.find((e) => e.id === s.employeeId);
        return {
          name: emp?.name ?? "Unknown",
          cost: Math.round(s.totalCost),
          value: Math.round(s.hardValue + s.intangibleScore * 50), // approximate value
          netValue: Math.round(s.netValue),
        };
      })
      .sort((a, b) => b.netValue - a.netValue)
      .slice(0, 15); // top 15 for readability
  }, [employees, scores]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-2 border-zinc-100 border-t-zinc-900 rounded-full mx-auto mb-4"
          />
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
            Loading lean analysis...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 p-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-900 flex items-center justify-center rounded-xl shadow-lg shadow-zinc-900/10">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-xl text-zinc-900 leading-none">
              Lean Optimization
            </div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mt-1">
              Headcount & Efficiency Analysis
            </div>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="p-2.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <main className="max-w-7xl mx-auto w-full p-8 lg:p-12">
        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
        >
          <StatCard
            label="Total Headcount"
            value={String(employees.length)}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            label="Revenue / Employee"
            value={costMetrics.revenuePerEmployee > 0 ? formatCurrency(costMetrics.revenuePerEmployee) + "/yr" : "--"}
            subtext={`Benchmark: ${formatCurrency(costMetrics.benchmarkRevenuePerEmp)}/yr`}
            icon={<DollarSign className="w-5 h-5" />}
            accent={costMetrics.revenuePerEmployee >= costMetrics.benchmarkRevenuePerEmp * 0.9 ? "emerald" : "amber"}
          />
          <StatCard
            label="Negative Net Value"
            value={String(costMetrics.negativeValue.length)}
            subtext={costMetrics.negativeValue.length > 0 ? "employees flagged" : "looking good"}
            icon={<AlertTriangle className="w-5 h-5" />}
            accent={costMetrics.negativeValue.length === 0 ? "emerald" : "rose"}
          />
          <StatCard
            label="Recommendations"
            value={String(recommendations.length)}
            icon={<Lightbulb className="w-5 h-5" />}
            accent="amber"
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* FTE Benchmark Comparison */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm"
          >
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              FTE Benchmark Comparison
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Actual headcount vs. recommended for {normalizedIndustry} industry
            </p>

            {fteBenchmarkData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={fteBenchmarkData} barGap={4}>
                  <XAxis
                    dataKey="department"
                    tick={{ fontSize: 11, fill: "#71717a" }}
                    axisLine={{ stroke: "#e4e4e7" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#a1a1aa" }}
                    axisLine={{ stroke: "#e4e4e7" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e4e4e7",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                  <Bar dataKey="actual" fill="#18181b" name="Actual" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="benchmark" fill="#d4d4d8" name="Benchmark" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-zinc-300 text-sm">
                No employee data
              </div>
            )}
          </motion.div>

          {/* Role Type Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm"
          >
            <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
              <PieChartIcon className="w-3.5 h-3.5" />
              Role Type Distribution
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Your team vs. industry benchmark
            </p>

            <div className="flex items-start gap-6">
              {roleDistribution.some((r) => r.value > 0) ? (
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie
                      data={roleDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={45}
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {roleDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e4e4e7",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-[55%] h-[220px] flex items-center justify-center text-zinc-300 text-sm">
                  No data
                </div>
              )}

              <div className="flex-1 space-y-4 pt-4">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">
                  Your Team
                </div>
                {roleDistribution.map((r) => (
                  <div key={r.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: r.color }} />
                    <span className="text-xs text-zinc-600 flex-1">{r.name}</span>
                    <span className="text-xs font-bold tabular-nums text-zinc-900">{r.percentage}%</span>
                  </div>
                ))}

                <div className="border-t border-zinc-100 pt-3 mt-3">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">
                    {normalizedIndustry.charAt(0).toUpperCase() + normalizedIndustry.slice(1)} Benchmark
                  </div>
                  {benchmarkDistribution.map((b) => (
                    <div key={b.name} className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-zinc-500 flex-1">{b.name}</span>
                      <span className="text-xs tabular-nums text-zinc-500">{b.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Cost Efficiency Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm mb-8"
        >
          <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5" />
            Cost Efficiency Metrics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Revenue per Employee */}
            <div className="border border-zinc-100 rounded-xl p-4">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">
                Revenue / Employee
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-light text-zinc-900">
                  {costMetrics.revenuePerEmployee > 0 ? formatCurrency(costMetrics.revenuePerEmployee) : "--"}
                </span>
                <span className="text-xs text-zinc-400">/yr</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      costMetrics.revenuePerEmployee >= costMetrics.benchmarkRevenuePerEmp
                        ? "bg-emerald-500"
                        : costMetrics.revenuePerEmployee >= costMetrics.benchmarkRevenuePerEmp * 0.8
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                    style={{
                      width: `${Math.min(100, costMetrics.benchmarkRevenuePerEmp > 0 ? (costMetrics.revenuePerEmployee / costMetrics.benchmarkRevenuePerEmp) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  {formatCurrency(costMetrics.benchmarkRevenuePerEmp)}
                </span>
              </div>
            </div>

            {/* Avg Net Value by Role */}
            <div className="border border-zinc-100 rounded-xl p-4">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-3">
                Avg Net Value by Role
              </div>
              <div className="space-y-2">
                {costMetrics.avgNetByRole.map((r) => (
                  <div key={r.role} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600">{r.label}</span>
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        r.avg >= 0 ? "text-zinc-900" : "text-rose-600"
                      }`}
                    >
                      {formatCurrency(r.avg)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Negative Value Employees */}
            <div className="border border-zinc-100 rounded-xl p-4">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Negative Net Value
              </div>
              {costMetrics.negativeValue.length > 0 ? (
                <div className="space-y-2">
                  {costMetrics.negativeValue.slice(0, 5).map((nv, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-600 truncate max-w-[120px]">{nv.name}</span>
                      <span className="text-sm font-medium tabular-nums text-rose-600">
                        {formatCurrency(nv.netValue)}
                      </span>
                    </div>
                  ))}
                  {costMetrics.negativeValue.length > 5 && (
                    <div className="text-[10px] font-mono text-zinc-400 text-center pt-1">
                      +{costMetrics.negativeValue.length - 5} more
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center text-emerald-600 text-sm">
                  All employees are net positive
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Cost Breakdown Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm mb-8"
        >
          <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" />
            Cost vs Value Breakdown
          </h3>
          <p className="text-xs text-zinc-400 mb-4">
            Salary cost versus estimated value per employee (top 15 by net value)
          </p>

          {costBreakdownData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={costBreakdownData} barGap={2}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  axisLine={{ stroke: "#e4e4e7" }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#a1a1aa" }}
                  axisLine={{ stroke: "#e4e4e7" }}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e4e4e7",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="cost" fill="#f43f5e" name="Cost" radius={[4, 4, 0, 0]} stackId="stack" />
                <Bar dataKey="value" fill="#10b981" name="Est. Value" radius={[4, 4, 0, 0]} stackId="stack2" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-zinc-300 text-sm">
              No score data to display
            </div>
          )}
        </motion.div>

        {/* Optimization Recommendations */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm"
        >
          <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5" />
            Optimization Recommendations
          </h3>

          <div className="space-y-4">
            {recommendations.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-start gap-3 p-4 border border-zinc-100 rounded-xl hover:border-zinc-200 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">{rec}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>

      <footer className="p-10 text-center border-t border-zinc-100 bg-white mt-8">
        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.4em]">
          Pivot Intelligence Platform
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subtext,
  icon,
  accent,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  accent?: "emerald" | "amber" | "rose";
}) {
  const borderColor =
    accent === "emerald"
      ? "border-emerald-200"
      : accent === "amber"
        ? "border-amber-200"
        : accent === "rose"
          ? "border-rose-200"
          : "border-zinc-200";

  return (
    <div
      className={`bg-white border ${borderColor} p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group`}
    >
      <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-colors text-zinc-400">
        {icon}
      </div>
      <div className="text-2xl font-light text-zinc-900 mb-1 truncate">{value}</div>
      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">{label}</div>
      {subtext && (
        <div className="text-[10px] text-zinc-400 mt-1">{subtext}</div>
      )}
    </div>
  );
}
