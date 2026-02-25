"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, Download, AlertCircle, TrendingUp, DollarSign, Users, Target,
  ShieldAlert, Sparkles, ChevronRight, Loader2, ShieldCheck, Globe, Zap,
  BarChart3, GitBranch, Trophy, FileText, Clock, ArrowRight, Server,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import type { Job, MVPDeliverables } from "@/lib/types";
import { ExecutionView } from "./ExecutionView";
import { AgentChatButton } from "./AgentChat";

interface ResultsViewProps {
  runId: string;
  onBack: () => void;
  onNewRun: () => void;
}

const TABS = [
  { id: 0,  label: "Health Score",    icon: TrendingUp,  dataKey: null           },
  { id: 1,  label: "Cash",            icon: DollarSign,  dataKey: null           },
  { id: 2,  label: "Revenue Leaks",   icon: AlertCircle, dataKey: null           },
  { id: 3,  label: "Issues",          icon: ShieldAlert, dataKey: null           },
  { id: 4,  label: "At-Risk Clients", icon: Users,       dataKey: null           },
  { id: 5,  label: "Decision Brief",  icon: Target,      dataKey: null           },
  { id: 6,  label: "Action Plan",     icon: Sparkles,    dataKey: null           },
  { id: 7,  label: "Growth Intel",    icon: Globe,       dataKey: "marketIntelligence"    },
  { id: 8,  label: "Website",         icon: BarChart3,   dataKey: "websiteAnalysis"       },
  { id: 9,  label: "Competitors",     icon: Trophy,      dataKey: "competitorAnalysis"    },
  { id: 10, label: "Tech Savings",    icon: Server,      dataKey: "techOptimization"      },
  { id: 11, label: "Pricing",         icon: DollarSign,  dataKey: "pricingIntelligence"   },
];

const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  A: { text: "text-emerald-700", bg: "bg-emerald-50" },
  B: { text: "text-green-700",   bg: "bg-green-50"   },
  C: { text: "text-yellow-700",  bg: "bg-yellow-50"  },
  D: { text: "text-orange-700",  bg: "bg-orange-50"  },
  F: { text: "text-red-700",     bg: "bg-red-50"     },
};

const SEVERITY_COLORS: Record<string, string> = {
  HIGH:     "text-red-700 bg-red-50 border-red-200",
  MED:      "text-amber-700 bg-amber-50 border-amber-200",
  LOW:      "text-blue-700 bg-blue-50 border-blue-200",
  Critical: "text-red-700 bg-red-50 border-red-200",
  High:     "text-orange-700 bg-orange-50 border-orange-200",
  Medium:   "text-yellow-700 bg-yellow-50 border-yellow-200",
  Low:      "text-zinc-600 bg-zinc-50 border-zinc-200",
};

function fmt(n: number) {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
      {children}
    </h3>
  );
}

export function ResultsView({ runId, onBack, onNewRun }: ResultsViewProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [phase, setPhase] = useState<string>("PLAN");
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (job?.phase) setPhase(job.phase);
  }, [job?.phase]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/job?runId=${encodeURIComponent(runId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Job not found");
        return res.json();
      })
      .then((data) => { if (!cancelled) setJob(data); })
      .catch((e) => { if (!cancelled) setError(e.message || "Failed to load results"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [runId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-8">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-zinc-200 border-t-zinc-900 rounded-full mb-4" />
        <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Retrieving intelligence...</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-medium text-zinc-900 mb-2">Analysis Unavailable</h2>
        <div className="text-red-600 font-mono text-sm mb-6">{error || "The requested analysis could not be located."}</div>
        <button onClick={onBack} className="px-6 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-all rounded-lg">Return to Dashboard</button>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-light text-zinc-900 mb-2">Analysis Interrupted</h2>
        <p className="text-sm text-zinc-500 mb-8">{job.error || "An unexpected error occurred during the synthesis phase."}</p>
        <div className="flex gap-4">
          <button onClick={onBack} className="px-6 py-2 border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-all rounded-lg">Dashboard</button>
          <button onClick={onNewRun} className="px-6 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-lg rounded-lg">New Analysis</button>
        </div>
      </div>
    );
  }

  const isReady = (job.status === "completed" || job.status === "formatting") && job.deliverables;
  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-8">
        <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-4">Report Generation In Progress</div>
        <div className="w-64 h-1 bg-zinc-100 rounded-full overflow-hidden">
          <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-1/2 h-full bg-zinc-900" />
        </div>
        <p className="mt-4 text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Status: {job.status}</p>
        <button onClick={onBack} className="mt-8 text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-4 transition-colors">Return to Dashboard</button>
      </div>
    );
  }

  const d = job.deliverables as MVPDeliverables;
  const base = `${typeof window !== "undefined" ? window.location.origin : ""}/api/download`;

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/job/phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, phase: "EXECUTE" }),
      });
      if (!res.ok) throw new Error("Phase transition failed");
      setPhase("EXECUTE");
    } catch (err) {
      console.error(err);
    } finally {
      setApproving(false);
    }
  };

  if (phase === "EXECUTE") {
    return <ExecutionView job={job} onBack={onBack} />;
  }

  // ── Data helpers ────────────────────────────────────────────────────────────
  const hs = d.healthScore;
  const ci = d.cashIntelligence;
  const rl = d.revenueLeakAnalysis;
  const ir = d.issuesRegister;
  const arc = d.atRiskCustomers;
  const db2 = d.decisionBrief;
  const ap = d.actionPlan;
  const mi = d.marketIntelligence;

  const radarData = (hs.dimensions || []).map((dim) => ({
    dimension: dim.name.split(" ")[0],
    score: dim.score,
  }));

  const weeklyModel = (ci as any).weeklyProjections || (ci as any).weekly_model || [];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col font-sans">

      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-50 rounded-full transition-colors text-zinc-400 hover:text-zinc-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 border-l border-zinc-200 pl-4">
            <div className="w-7 h-7 bg-zinc-900 flex items-center justify-center rounded-md shadow-sm">
              <div className="w-2.5 h-2.5 bg-white rounded-sm rotate-45" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-zinc-900 leading-none">{job.questionnaire.organizationName}</div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-0.5">Intelligence Report</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a href={`${base}?runId=${encodeURIComponent(runId)}&format=pdf`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 text-zinc-600 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-all rounded-lg">
            <Download className="w-3.5 h-3.5" /> PDF
          </a>
          <button onClick={handleApprove} disabled={approving}
            className="px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-all rounded-lg shadow-md active:scale-95 flex items-center gap-2">
            {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Approve & Execute
          </button>
        </div>
      </header>

      {/* ── Score Hero ────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8 items-center">
          <div className="text-center md:text-left flex-1">
            <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-2">Business Health Score</p>
            <div className="flex items-end gap-3 justify-center md:justify-start">
              <span className="text-7xl font-light tabular-nums">{hs.score ?? "—"}</span>
              <span className="text-xl text-zinc-500 mb-2">/100</span>
              {hs.grade && (
                <span className={`text-2xl font-bold mb-2 px-3 py-1 rounded-lg ${GRADE_COLORS[hs.grade]?.text ?? "text-zinc-300"} ${GRADE_COLORS[hs.grade]?.bg ?? "bg-zinc-800"}`}>
                  {hs.grade}
                </span>
              )}
            </div>
            {hs.headline && <p className="text-lg font-medium mt-2 text-zinc-100">{hs.headline}</p>}
            {hs.summary && <p className="text-zinc-400 text-sm mt-1 max-w-lg leading-relaxed">{hs.summary}</p>}
          </div>
          {radarData.length > 0 && (
            <div className="w-56 h-56 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#3f3f46" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "#71717a", fontSize: 10 }} />
                  <Radar name="Score" dataKey="score" stroke="#e4e4e7" fill="#e4e4e7" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Navigation ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-zinc-200 sticky top-[61px] z-20">
        <div className="max-w-5xl mx-auto px-4 flex gap-0 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            // Hide conditional tabs when data not available
            if (tab.dataKey && !(d as unknown as Record<string, unknown>)[tab.dataKey]) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-mono whitespace-nowrap border-b-2 transition-all uppercase tracking-widest ${
                  isActive
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-400 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto w-full px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >

            {/* ── Tab 0: Health Score ─────────────────────────────────────── */}
            {activeTab === 0 && (
              <div className="space-y-4">
                {(hs.dimensions || []).map((dim, i) => (
                  <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col md:flex-row gap-5 items-start md:items-center shadow-sm">
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center w-16">
                        <div className="text-3xl font-light text-zinc-900 tabular-nums">{dim.score}</div>
                        {dim.grade && (
                          <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded ${GRADE_COLORS[dim.grade]?.text ?? ""} ${GRADE_COLORS[dim.grade]?.bg ?? ""}`}>
                            {dim.grade}
                          </div>
                        )}
                      </div>
                      <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${dim.score}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }}
                          className="h-full bg-zinc-900/70 rounded-full"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-zinc-900">{dim.name}</p>
                      {dim.summary && <p className="text-sm text-zinc-500 mt-1">{dim.summary}</p>}
                      {dim.driver && <p className="text-sm text-zinc-700 mt-1 font-medium">Key driver: {dim.driver}</p>}
                      {(dim as any).key_finding && <p className="text-sm text-zinc-600 mt-1 italic">{(dim as any).key_finding}</p>}
                    </div>
                  </div>
                ))}
                {hs.summary && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><Sparkles className="w-3 h-3" /> Summary</SectionHeader>
                    <p className="text-sm text-zinc-600 leading-relaxed">{hs.summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 1: Cash Intelligence ────────────────────────────────── */}
            {activeTab === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "Current Cash Position", value: fmt(Number((ci as any).currentCashPosition ?? (ci as any).current_cash_position ?? 0)) },
                    { label: "Cash Runway", value: `${(ci as any).runwayWeeks ?? (ci as any).runway_weeks ?? "?"} weeks` },
                    { label: "Critical Weeks",
                      value: (() => {
                        const cw = (ci as any).criticalWeeks ?? (ci as any).critical_weeks;
                        return Array.isArray(cw) && cw.length ? `Week ${cw.join(", ")}` : "None flagged";
                      })()
                    },
                  ].map((m) => (
                    <div key={m.label} className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-sm">
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">{m.label}</p>
                      <p className="text-2xl font-light text-zinc-900">{m.value}</p>
                    </div>
                  ))}
                </div>

                {ci.summary && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <p className="text-sm text-zinc-600 leading-relaxed">{ci.summary}</p>
                  </div>
                )}

                {weeklyModel.length > 0 && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><BarChart3 className="w-3 h-3" /> 13-Week Cash Forecast</SectionHeader>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={weeklyModel}>
                        <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#71717a" }} tickFormatter={(v) => `W${v}`} />
                        <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(v) => fmt(v as number)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Bar dataKey="closing_balance" radius={[4, 4, 0, 0]}>
                          {weeklyModel.map((entry: any, i: number) => (
                            <Cell key={i} fill={entry.risk_flag ? "#ef4444" : "#18181b"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><AlertCircle className="w-3 h-3" /> Cash Risks</SectionHeader>
                    <ul className="space-y-3">
                      {(ci.risks || []).map((r, i) => (
                        <li key={i} className="flex gap-3 text-sm text-zinc-700 bg-red-50 p-3 rounded-xl border border-red-100">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <span>{typeof r === "string" ? r : (r as any).description || JSON.stringify(r)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><ChevronRight className="w-3 h-3" /> Recommendations</SectionHeader>
                    <ul className="space-y-3">
                      {(ci.recommendations || []).map((a, i) => (
                        <li key={i} className="flex gap-3 text-sm text-zinc-700 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                          <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                          <span>{typeof a === "string" ? a : JSON.stringify(a)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab 2: Revenue Leaks ────────────────────────────────────── */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Total Recoverable</p>
                    <p className="text-3xl font-light text-zinc-900">{fmt(rl.totalIdentified || 0)}</p>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">90-Day Projection</p>
                    <p className="text-2xl font-light text-zinc-900">{fmt(Number((rl as any).day90RecoveryProjection ?? (rl as any).day90_recovery_projection ?? 0))}</p>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Priority Action</p>
                    <p className="text-xs text-zinc-700 font-medium leading-snug">{(rl as any).priorityAction ?? (rl as any).priority_action ?? "—"}</p>
                  </div>
                </div>

                {rl.summary && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm text-zinc-600 italic border-l-2 border-zinc-200 pl-4">{rl.summary}</p>
                  </div>
                )}

                {(rl.items || []).map((item, i) => (
                  <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-bold flex items-center justify-center shrink-0">
                          #{i + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-zinc-900">{item.description}</p>
                          {(item as any).clientOrArea && <p className="text-sm text-zinc-500">{(item as any).clientOrArea}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-light text-red-600">{fmt(item.amount || 0)}</p>
                        {(item as any).confidence && <p className="text-xs text-zinc-400">{(item as any).confidence} confidence</p>}
                      </div>
                    </div>
                    {(item as any).rootCause && <p className="text-sm text-zinc-500 mt-3">{(item as any).rootCause}</p>}
                    {(item as any).recoveryAction && (
                      <p className="text-sm text-zinc-700 font-medium mt-2">
                        <ChevronRight className="w-3 h-3 inline-block mr-1 text-zinc-400" />
                        {(item as any).recoveryAction}
                        {(item as any).timeline && ` (${(item as any).timeline})`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab 3: Issues Register ──────────────────────────────────── */}
            {activeTab === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 mb-2">
                  {[
                    { label: "Total Issues",        value: String(ir.issues?.length ?? 0) },
                    { label: "Critical",            value: String(ir.issues?.filter(i => i.severity === "HIGH" || i.severity === "Critical").length ?? 0), cls: "text-red-600" },
                    { label: "Financial Exposure",  value: fmt(ir.issues?.reduce((s, i) => s + (i.financialImpact ?? 0), 0) ?? 0) },
                  ].map((m) => (
                    <div key={m.label} className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-sm">
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">{m.label}</p>
                      <p className={`text-2xl font-light ${m.cls ?? "text-zinc-900"}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {(ir.issues || []).map((issue, i) => (
                  <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-zinc-400">{issue.id}</span>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${SEVERITY_COLORS[issue.severity ?? "Low"]}`}>
                          {issue.severity}
                        </span>
                        {issue.category && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-100 rounded px-2 py-0.5 font-mono">{issue.category}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {issue.financialImpact != null && (
                          <span className="text-lg font-light text-red-600">{fmt(issue.financialImpact)}</span>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-zinc-900 mb-1">{issue.description}</p>
                    {(issue as any).recommendation && (
                      <p className="text-sm text-zinc-600 mt-2">
                        <ChevronRight className="w-3 h-3 inline-block mr-1 text-zinc-400" />
                        {(issue as any).recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab 4: At-Risk Customers ────────────────────────────────── */}
            {activeTab === 4 && (
              <div className="space-y-4">
                {arc.summary && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                    <p className="text-sm font-medium text-zinc-900">
                      Revenue at Risk: <span className="text-red-600 text-xl font-light ml-2">
                        {fmt(arc.customers?.reduce((s, c) => s + (c.revenueAtRisk ?? 0), 0) ?? 0)}
                      </span>
                    </p>
                    <p className="text-sm text-zinc-600 mt-1">{arc.summary}</p>
                  </div>
                )}

                {(arc.customers || []).map((c, i) => (
                  <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                      <div>
                        <p className="text-xl font-medium text-zinc-900 uppercase tracking-tight">{c.name}</p>
                        {c.revenueAtRisk != null && (
                          <p className="text-sm text-zinc-500">Revenue at risk: {fmt(c.revenueAtRisk)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg border uppercase ${SEVERITY_COLORS["High"]}`}>
                          {c.risk}
                        </span>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-2">
                      {(c as any).warningSignals?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Warning Signals</p>
                          <ul className="space-y-1">
                            {(c as any).warningSignals.map((s: string, si: number) => (
                              <li key={si} className="text-sm text-zinc-700 flex gap-2">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Recommended Action</p>
                        <p className="text-sm text-zinc-700 border-l-2 border-zinc-900 pl-3">{c.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab 5: Decision Brief ───────────────────────────────────── */}
            {activeTab === 5 && (
              <div className="space-y-4">
                <div className="bg-zinc-900 text-white rounded-2xl p-8">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Decision Required</p>
                  <p className="text-2xl font-light mb-3">{db2.decision}</p>
                  {db2.context && <p className="text-zinc-400 text-sm leading-relaxed">{db2.context}</p>}
                </div>

                {(db2.options || []).length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {(db2.options || []).map((opt, i) => (
                      <div key={i} className={`bg-white border rounded-2xl p-6 shadow-sm transition-all ${opt.recommendation ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200"}`}>
                        {opt.recommendation && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono bg-zinc-900 text-white px-2 py-0.5 rounded uppercase tracking-widest mb-3">
                            Recommended
                          </span>
                        )}
                        <p className="font-semibold text-zinc-900 mb-2">{opt.label}</p>
                        <p className="text-xs text-zinc-500 mb-3">{opt.expectedOutcome ?? opt.outcome}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {opt.pros && opt.pros.length > 0 && (
                            <div>
                              <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Pros</p>
                              {opt.pros.map((p, pi) => (
                                <p key={pi} className="text-xs text-zinc-700">+ {p}</p>
                              ))}
                            </div>
                          )}
                          {opt.cons && opt.cons.length > 0 && (
                            <div>
                              <p className="text-[9px] font-mono text-red-600 uppercase tracking-widest mb-1">Cons</p>
                              {opt.cons.map((c, ci2) => (
                                <p key={ci2} className="text-xs text-zinc-700">- {c}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {db2.recommendation && (
                  <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                    <SectionHeader>Pivot Recommendation</SectionHeader>
                    <p className="font-semibold text-zinc-900 mb-2">{db2.recommendation}</p>
                    {db2.rationale && <p className="text-sm text-zinc-500 leading-relaxed">{db2.rationale}</p>}
                    {db2.nextStep && (
                      <div className="mt-4 pt-4 border-t border-zinc-100">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Next Step (48 Hours)</p>
                        <p className="text-sm text-zinc-700 font-medium">{db2.nextStep}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 6: Action Plan ──────────────────────────────────────── */}
            {activeTab === 6 && (
              <div>
                <div className="space-y-10 relative before:absolute before:inset-0 before:left-[11px] before:w-[1px] before:bg-zinc-100 before:z-0">
                  {(ap.days || []).map((day, i) => (
                    <div key={i} className="relative z-10 pl-10">
                      <div className="absolute left-0 top-0 w-6 h-6 bg-white border-2 border-zinc-900 rounded-full flex items-center justify-center text-[10px] font-bold">
                        {day.day}
                      </div>
                      <div className="mb-4">
                        <h4 className="text-lg font-medium text-zinc-900">{day.title}</h4>
                        <div className="h-[1px] w-10 bg-zinc-200 mt-1" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {day.tasks.map((task, j) => (
                          <div key={j} className="bg-white border border-zinc-100 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                            <div className="w-5 h-5 bg-zinc-50 border border-zinc-200 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                              <div className="w-2 h-2 border-b border-r border-zinc-300 rotate-45" />
                            </div>
                            <div>
                              <div className="text-sm text-zinc-800 leading-snug">{task.description}</div>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[9px] font-mono text-zinc-400 uppercase">{task.owner}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {ap.summary && (
                  <div className="mt-10 pt-8 border-t border-zinc-100">
                    <SectionHeader>Strategy Summary</SectionHeader>
                    <p className="text-sm text-zinc-600 leading-relaxed italic">{ap.summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 7: Growth Intelligence ──────────────────────────────── */}
            {activeTab === 7 && mi && (
              <div className="space-y-8">
                {/* Header banner */}
                <div className="bg-zinc-900 text-white rounded-2xl p-8">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="w-4 h-4 text-zinc-400" />
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Growth Intelligence Report</p>
                        {mi.searchPowered && (
                          <span className="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded-full font-mono uppercase">Live Research</span>
                        )}
                      </div>
                      <p className="text-xl font-medium">{mi.industry ?? "Your Industry"}</p>
                      {mi.industryContext && <p className="text-zinc-400 text-sm mt-1 max-w-2xl leading-relaxed">{mi.industryContext}</p>}
                    </div>
                  </div>
                  {mi.urgentOpportunity && (
                    <div className="mt-5 bg-white/10 rounded-xl p-4 border border-white/20">
                      <p className="text-[9px] font-mono text-yellow-300 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Priority This Week
                      </p>
                      <p className="text-white font-medium text-sm">{mi.urgentOpportunity}</p>
                    </div>
                  )}
                </div>

                {/* Benchmarks */}
                {(mi.benchmarks || []).length > 0 && (
                  <div>
                    <SectionHeader><BarChart3 className="w-3 h-3" /> Industry Benchmarks</SectionHeader>
                    <div className="space-y-3">
                      {(mi.benchmarks || []).map((b, i) => {
                        const gap = (b.gapAnalysis ?? "").toLowerCase();
                        const gapColor = gap.includes("above") ? "text-green-600 bg-green-50 border-green-200"
                          : gap.includes("below") ? "text-red-600 bg-red-50 border-red-200"
                          : "text-zinc-500 bg-zinc-50 border-zinc-200";
                        return (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                              <p className="font-semibold text-zinc-900">{b.metric}</p>
                              {b.implication && <p className="text-sm text-zinc-500 mt-1">{b.implication}</p>}
                            </div>
                            <div className="flex items-center gap-6 shrink-0 text-right">
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Industry Range</p>
                                <p className="font-semibold text-zinc-900">{b.industryRange ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Your Business</p>
                                <p className="font-semibold text-zinc-900">{b.thisBusinessEstimate ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Gap</p>
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border capitalize ${gapColor}`}>
                                  {b.gapAnalysis ?? "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Wins */}
                {(mi.quickWins || []).length > 0 && (
                  <div>
                    <SectionHeader><Zap className="w-3 h-3" /> Quick Wins — Immediate Cash Actions</SectionHeader>
                    <div className="space-y-3">
                      {(mi.quickWins || []).map((w, i) => (
                        <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-6 h-6 bg-zinc-100 text-zinc-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                                <p className="font-semibold text-zinc-900">{w.action}</p>
                              </div>
                              {w.instructions && <p className="text-sm text-zinc-600 ml-8">{w.instructions}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[9px] font-mono bg-zinc-100 text-zinc-600 px-2 py-1 rounded-lg block mb-1">{w.timeline}</span>
                              <p className="text-sm font-bold text-green-600">{w.expectedCashImpact}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Low-Hanging Fruit */}
                {(mi.lowHangingFruit || []).length > 0 && (
                  <div>
                    <SectionHeader><Zap className="w-3 h-3" /> Low-Hanging Fruit Opportunities</SectionHeader>
                    <div className="grid md:grid-cols-2 gap-4">
                      {(mi.lowHangingFruit || []).map((lhf, i) => {
                        const effortColor = lhf.effort === "Low" ? "bg-green-50 text-green-700 border-green-200"
                          : lhf.effort === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-red-50 text-red-700 border-red-200";
                        return (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-zinc-900">{lhf.opportunity}</p>
                              <span className={`text-[9px] font-mono px-2 py-1 rounded-lg border shrink-0 ${effortColor}`}>{lhf.effort} effort</span>
                            </div>
                            {lhf.whyThisBusiness && <p className="text-sm text-zinc-500">{lhf.whyThisBusiness}</p>}
                            <div className="flex gap-4 text-sm">
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Revenue potential</p>
                                <p className="font-bold text-green-600">{lhf.monthlyRevenuePotential}/mo</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Time to revenue</p>
                                <p className="font-bold text-zinc-900">{lhf.timeToFirstRevenue}</p>
                              </div>
                            </div>
                            {(lhf as any).implementationSteps?.length > 0 && (
                              <div className="bg-zinc-50 rounded-xl p-3">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">How To Do It</p>
                                <ol className="space-y-1">
                                  {(lhf as any).implementationSteps.map((step: string, si: number) => (
                                    <li key={si} className="text-xs text-zinc-700 flex gap-2">
                                      <span className="text-zinc-400 shrink-0">{si + 1}.</span>{step}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pivot Opportunities */}
                {(mi.pivotOpportunities || []).length > 0 && (
                  <div>
                    <SectionHeader><GitBranch className="w-3 h-3" /> Pivot & Expansion Opportunities</SectionHeader>
                    <div className="space-y-4">
                      {(mi.pivotOpportunities || []).map((p, i) => (
                        <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                            <div>
                              <p className="text-xl font-medium text-zinc-900">{p.direction}</p>
                              {p.whySuited && <p className="text-sm text-zinc-500 mt-1">{p.whySuited}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">Startup cost</p>
                              <p className="font-semibold text-zinc-900">{p.startupCost}</p>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase mt-1">Time to revenue</p>
                              <p className="font-semibold text-zinc-700">{p.timeToFirstRevenue}</p>
                            </div>
                          </div>
                          {p.risk && (
                            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">
                              <AlertCircle className="w-3 h-3 inline-block mr-1" />Risk: {p.risk}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* What top performers do */}
                {(mi.whatTopPerformersDo || []).length > 0 && (
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <SectionHeader><Trophy className="w-3 h-3 text-yellow-400" /> <span className="text-zinc-400">What Top 10% Do Differently</span></SectionHeader>
                    <ul className="space-y-3">
                      {(mi.whatTopPerformersDo || []).map((item, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="text-yellow-400 font-bold shrink-0">{i + 1}.</span>
                          <span className="text-zinc-300 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Competitive intel */}
                {mi.competitiveIntelligence && (
                  <div className="bg-white border border-l-4 border-zinc-200 border-l-zinc-500 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><Trophy className="w-3 h-3" /> Competitive Intelligence</SectionHeader>
                    <p className="text-sm text-zinc-600 leading-relaxed">{mi.competitiveIntelligence}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 8: Website Analysis ──────────────────────────────── */}
            {activeTab === 8 && d.websiteAnalysis && (() => {
              const wa = d.websiteAnalysis!;
              const gc = GRADE_COLORS[wa.grade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" };
              return (
                <div className="space-y-6">
                  {/* Grade hero */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8 flex flex-col md:flex-row gap-6 items-start">
                    <div className="text-center shrink-0">
                      <div className={`text-6xl font-bold px-6 py-4 rounded-2xl ${gc.text} ${gc.bg}`}>{wa.grade}</div>
                      <div className="text-zinc-400 text-sm mt-2">{wa.score}/100</div>
                    </div>
                    <div className="flex-1">
                      <p className="text-zinc-400 text-[10px] font-mono uppercase tracking-widest mb-2">{wa.url}</p>
                      <p className="text-lg text-white leading-relaxed">{wa.synopsis}</p>
                      {wa.ctaAssessment && <p className="text-zinc-400 text-sm mt-3">{wa.ctaAssessment}</p>}
                    </div>
                  </div>

                  {/* Offer gap */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">What You Actually Offer</p>
                      <p className="text-sm text-zinc-700">{wa.actualOffer}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                      <p className="text-[9px] font-mono text-amber-600 uppercase tracking-widest mb-2">Offer Gap</p>
                      <p className="text-sm text-amber-900">{wa.offerGap}</p>
                    </div>
                  </div>

                  {/* Suggested headline */}
                  <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6">
                    <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Suggested Homepage Headline</p>
                    <p className="text-2xl font-medium text-zinc-900">&quot;{wa.suggestedHeadline}&quot;</p>
                  </div>

                  {/* Issues */}
                  {wa.topIssues?.length > 0 && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><AlertCircle className="w-3 h-3" /> Top Issues</SectionHeader>
                      <ul className="space-y-2">
                        {wa.topIssues.map((issue, i) => (
                          <li key={i} className="flex gap-2 text-sm text-zinc-700">
                            <span className="text-red-500 font-bold shrink-0">{i + 1}.</span>{issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Marketing direction */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><Globe className="w-3 h-3" /> Marketing Direction</SectionHeader>
                    <p className="text-sm text-zinc-600 leading-relaxed">{wa.marketingDirection}</p>
                  </div>

                  {/* Recommendations */}
                  {wa.recommendations?.length > 0 && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><Sparkles className="w-3 h-3" /> Recommendations</SectionHeader>
                      <ol className="space-y-2">
                        {wa.recommendations.map((rec, i) => (
                          <li key={i} className="flex gap-3 text-sm text-zinc-700">
                            <span className="text-zinc-400 font-bold shrink-0">{i + 1}.</span>{rec}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 9: Competitor Analysis ───────────────────────────── */}
            {activeTab === 9 && d.competitorAnalysis && (() => {
              const ca = d.competitorAnalysis!;
              return (
                <div className="space-y-6">
                  {/* Positioning statement */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Suggested Positioning</p>
                    <p className="text-xl font-medium leading-relaxed">{ca.suggestedPositioning}</p>
                    {ca.differentiationOpportunity && (
                      <p className="text-zinc-400 text-sm mt-3">{ca.differentiationOpportunity}</p>
                    )}
                  </div>

                  {/* Headline comparison */}
                  {ca.headlineComparison && (
                    <div className="grid md:grid-cols-3 gap-4">
                      {ca.headlineComparison.current && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                          <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-2">Current Headline</p>
                          <p className="text-sm font-medium text-red-900">&quot;{ca.headlineComparison.current}&quot;</p>
                        </div>
                      )}
                      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">How Leaders Do It</p>
                        <p className="text-sm text-zinc-700">{ca.headlineComparison.theirs}</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                        <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-2">Suggested Headline</p>
                        <p className="text-sm font-bold text-green-900">&quot;{ca.headlineComparison.suggested}&quot;</p>
                      </div>
                    </div>
                  )}

                  {/* Repositioning recommendations */}
                  {ca.repositioningRecommendations?.length > 0 && (
                    <div>
                      <SectionHeader><ArrowRight className="w-3 h-3" /> Repositioning Moves</SectionHeader>
                      <div className="space-y-4">
                        {ca.repositioningRecommendations.map((rec) => (
                          <div key={rec.rank} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{rec.rank}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{rec.recommendation}</p>
                                <p className="text-sm text-zinc-500 mt-1">{rec.rationale}</p>
                                {rec.implementation && (
                                  <div className="mt-3 bg-zinc-50 rounded-xl p-3">
                                    <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Implementation</p>
                                    <p className="text-xs text-zinc-700">{rec.implementation}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitor cards */}
                  {[...ca.competitors, ...ca.industryLeaders].length > 0 && (
                    <div>
                      <SectionHeader><Trophy className="w-3 h-3" /> Competitive Landscape Analysis</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {[...ca.competitors, ...ca.industryLeaders].map((c, i) => {
                          const gc = c.websiteGrade ? (GRADE_COLORS[c.websiteGrade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" }) : { text: "text-zinc-400", bg: "bg-zinc-100" };
                          return (
                            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                  <p className="font-semibold text-zinc-900">{c.name}</p>
                                  <p className="text-[10px] font-mono text-zinc-400 truncate">{c.url}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {c.isIndustryLeader && (
                                    <span className="text-[9px] font-mono bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full uppercase">Leader</span>
                                  )}
                                  {c.websiteGrade && (
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${gc.text} ${gc.bg}`}>{c.websiteGrade}</span>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-zinc-600 mb-3">{c.offer}</p>
                              <p className="text-[10px] text-zinc-500 italic">{c.marketingDirection}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 10: Tech Savings ─────────────────────────────────── */}
            {activeTab === 10 && d.techOptimization && (() => {
              const to = d.techOptimization!;
              const effortColor = (e: string) =>
                e === "Low" ? "bg-green-50 text-green-700 border-green-200"
                : e === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-200";
              return (
                <div className="space-y-6">
                  {/* Savings hero */}
                  {to.potentialSavings && (
                    <div className="bg-zinc-900 text-white rounded-2xl p-8 flex items-center gap-6">
                      <div>
                        <p className="text-zinc-400 text-[10px] font-mono uppercase tracking-widest mb-1">Potential Monthly Savings</p>
                        <p className="text-5xl font-light">{fmt(to.potentialSavings)}</p>
                      </div>
                      {to.currentEstimatedMonthlyCost && (
                        <div className="border-l border-zinc-700 pl-6">
                          <p className="text-zinc-400 text-[10px] font-mono uppercase tracking-widest mb-1">Current Tech Cost</p>
                          <p className="text-2xl text-zinc-300">{fmt(to.currentEstimatedMonthlyCost)}/mo</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary */}
                  {to.summary && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <p className="text-sm text-zinc-600 leading-relaxed">{to.summary}</p>
                    </div>
                  )}

                  {/* Recommendations */}
                  {to.recommendations?.length > 0 && (
                    <div className="space-y-4">
                      <SectionHeader><Server className="w-3 h-3" /> Cost Optimization Moves</SectionHeader>
                      {to.recommendations.map((rec) => (
                        <div key={rec.rank} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                          <div className="flex items-start gap-4">
                            <span className="w-7 h-7 bg-zinc-100 text-zinc-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{rec.rank}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 flex-wrap mb-2">
                                <span className="font-mono text-sm bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">{rec.currentTool}</span>
                                <ArrowRight className="w-4 h-4 text-zinc-400" />
                                <span className="font-mono text-sm bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">{rec.suggestedAlternative}</span>
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-lg border uppercase ${effortColor(rec.migrationEffort)}`}>
                                  {rec.migrationEffort} effort
                                </span>
                              </div>
                              <p className="text-sm text-zinc-600">{rec.rationale}</p>
                              <p className="text-sm font-bold text-green-600 mt-2">Save {rec.estimatedSaving}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 11: Pricing Intelligence ─────────────────────────── */}
            {activeTab === 11 && d.pricingIntelligence && (() => {
              const pi = d.pricingIntelligence!;
              return (
                <div className="space-y-6">
                  {/* Assessment */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-3">Current Pricing Assessment</p>
                    <p className="text-lg leading-relaxed">{pi.currentPricingAssessment}</p>
                  </div>

                  {/* Pricing tiers */}
                  {pi.suggestedPricing?.length > 0 && (
                    <div>
                      <SectionHeader><DollarSign className="w-3 h-3" /> Recommended Pricing Tiers</SectionHeader>
                      <div className="grid md:grid-cols-3 gap-4">
                        {pi.suggestedPricing.map((tier, i) => (
                          <div key={i} className={`rounded-2xl p-6 border shadow-sm ${i === 1 ? "bg-zinc-900 text-white border-zinc-700" : "bg-white border-zinc-200"}`}>
                            <p className={`text-[9px] font-mono uppercase tracking-widest mb-1 ${i === 1 ? "text-zinc-400" : "text-zinc-400"}`}>{tier.tier}</p>
                            <p className={`text-2xl font-bold mb-2 ${i === 1 ? "text-white" : "text-zinc-900"}`}>{tier.range}</p>
                            <p className={`text-xs mb-3 ${i === 1 ? "text-zinc-400" : "text-zinc-500"}`}>{tier.targetSegment}</p>
                            <p className={`text-sm ${i === 1 ? "text-zinc-300" : "text-zinc-600"}`}>{tier.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitive position + margin optimization */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {pi.competitivePosition && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <SectionHeader><Trophy className="w-3 h-3" /> Competitive Position</SectionHeader>
                        <p className="text-sm text-zinc-600 leading-relaxed">{pi.competitivePosition}</p>
                      </div>
                    )}
                    {pi.marginOptimization && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <SectionHeader><TrendingUp className="w-3 h-3" /> Margin Optimization</SectionHeader>
                        <p className="text-sm text-zinc-600 leading-relaxed">{pi.marginOptimization}</p>
                      </div>
                    )}
                  </div>

                  {pi.summary && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><Sparkles className="w-3 h-3" /> Summary</SectionHeader>
                      <p className="text-sm text-zinc-600 leading-relaxed">{pi.summary}</p>
                    </div>
                  )}
                </div>
              );
            })()}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── ARIA Floating Chat Button ──────────────────────────────────────── */}
      <AgentChatButton
        orgId={job.questionnaire.orgId ?? "default-org"}
        orgName={job.questionnaire.organizationName}
      />
    </div>
  );
}
