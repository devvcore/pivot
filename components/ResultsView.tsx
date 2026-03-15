"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Download, AlertCircle, TrendingUp, DollarSign, Users, Target,
  ShieldAlert, Sparkles, ChevronRight, BarChart3, Check, Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import type { Job, MVPDeliverables } from "@/lib/types";
import { formatLabel } from "@/lib/utils";
import { CHAPTERS, getPopulatedChapters } from "@/lib/chapters";
import ChapterView from "./ChapterView";
import { AgentChatButton, type NavigateAction } from "./AgentChat";
import { CoachChatButton } from "./CoachChat";
import { ReuploadDrawer } from "./ReuploadDrawer";
import { ShareModal } from "./ShareModal";
import { RevenueLeakChart } from "./charts/RevenueLeakChart";
import { CashFlowChart } from "./charts/CashFlowChart";
import { CustomerRiskScatter } from "./charts/CustomerRiskScatter";
import { IssuesSeverityChart } from "./charts/IssuesSeverityChart";
import { ChartInteraction } from "./charts/ChartInteraction";

// ── Dashboard sub-tabs (core sections with premium custom rendering) ──
const CORE_TABS = [
  { id: 0, label: "Health Score",    icon: TrendingUp  },
  { id: 1, label: "Cash",           icon: DollarSign   },
  { id: 2, label: "Revenue Leaks",  icon: AlertCircle  },
  { id: 3, label: "Issues",         icon: ShieldAlert  },
  { id: 4, label: "At-Risk Clients",icon: Users        },
  { id: 5, label: "Decision Brief", icon: Target       },
  { id: 6, label: "Action Plan",    icon: Sparkles     },
];

interface ResultsViewProps {
  runId: string;
  onBack: () => void;
  onNewRun: () => void;
  onReprocess?: () => void;
  onExecute?: () => void;
}

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

function ConfidenceBanner({ provenance }: { provenance: NonNullable<MVPDeliverables["dataProvenance"]> }) {
  const hasWarnings = provenance.warnings.length > 0;
  const hasGaps = provenance.coverageGaps.length > 0;
  if (!hasWarnings && !hasGaps) return null;

  const severity = provenance.warnings.length > 2 ? "high" : hasWarnings ? "medium" : "low";
  const colors = severity === "high"
    ? "bg-red-50 border-red-200 text-red-800"
    : severity === "medium"
    ? "bg-amber-50 border-amber-200 text-amber-800"
    : "bg-zinc-50 border-zinc-200 text-zinc-600";

  return (
    <div className={`border rounded-xl p-4 mb-6 ${colors}`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-widest font-bold">
          {severity === "high" ? "Treat numbers as rough estimates only"
            : severity === "medium" ? "Some figures are AI estimates"
            : "Data coverage notes"}
        </span>
        <span className="text-[9px] font-mono opacity-60 ml-auto">
          {provenance.financialFactCount} verified facts from {provenance.documentSources.length} documents
        </span>
      </div>
      {hasWarnings && (
        <ul className="text-xs space-y-1 ml-6">
          {provenance.warnings.slice(0, 3).map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {hasGaps && (
        <div className="text-[10px] opacity-70 mt-2 ml-6">
          Coverage gaps: {provenance.coverageGaps.join(", ")}
        </div>
      )}
    </div>
  );
}

export function ResultsView({ runId, onBack, onNewRun, onReprocess, onExecute }: ResultsViewProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState("dashboard");
  const [coreTab, setCoreTab] = useState(0);
  const [chartOverlays, setChartOverlays] = useState<Record<string, any>>({});
  const [shareOpen, setShareOpen] = useState(false);

  // Action plan task completion (persisted per run)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`pivot_tasks_${runId}`);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const toggleTask = (taskId: string) => {
    setCompletedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      try { localStorage.setItem(`pivot_tasks_${runId}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Issues register expand/collapse
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const toggleIssue = (idx: number) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleProjection = (section: string) => (data: { projection: any; insight: string | null }) => {
    setChartOverlays(prev => ({ ...prev, [section]: data.projection }));
  };

  const clearOverlay = (section: string) => () => {
    setChartOverlays(prev => {
      const next = { ...prev };
      delete next[section];
      return next;
    });
  };

  // Navigation handler for Pivvy/Coach chat agents
  const handleAgentNavigate = (action: NavigateAction) => {
    setActiveChapter(action.chapter);
    if (action.chapter === "dashboard" && action.coreTab != null) {
      setCoreTab(action.coreTab);
    }
    // Scroll to top of content area
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  // Populated chapters based on deliverables + AI selection
  const chapters = useMemo(() => {
    const d = job?.deliverables as MVPDeliverables | undefined;
    if (!d) return CHAPTERS;
    return getPopulatedChapters(
      d as unknown as Record<string, unknown>,
      d.selectedSections,
    );
  }, [job?.deliverables]);

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

  // ── Data helpers (safe defaults prevent null crashes) ────────────────────────
  const hs = d.healthScore ?? {} as any;
  const ci = d.cashIntelligence ?? {} as any;
  const rl = d.revenueLeakAnalysis ?? {} as any;
  const ir = d.issuesRegister ?? {} as any;
  const arc = d.atRiskCustomers ?? {} as any;
  const db2 = d.decisionBrief ?? {} as any;
  const ap = d.actionPlan ?? {} as any;
  const chartOrgId = job.questionnaire.orgId ?? "default-org";

  const radarData = (hs?.dimensions || []).map((dim) => ({
    dimension: dim.name.split(" ")[0],
    score: dim.score,
  }));

  const rawWeeklyModel = (ci as any)?.weeklyProjections || (ci as any)?.weekly_model || [];
  // Normalize weekly projections: ensure numeric values, consistent field names, handle "null" strings
  const weeklyModel = (rawWeeklyModel as any[]).map((entry: any) => ({
    week: typeof entry.week === "string" ? parseInt(entry.week, 10) : (entry.week ?? 0),
    label: entry.label ?? `Week ${entry.week ?? 0}`,
    openingBalance: parseFloat(entry.openingBalance ?? entry.opening_balance ?? 0) || 0,
    inflows: parseFloat(entry.inflows ?? 0) || 0,
    outflows: parseFloat(entry.outflows ?? 0) || 0,
    closingBalance: parseFloat(entry.closingBalance ?? entry.closing_balance ?? 0) || 0,
    riskFlag: (() => {
      const flag = entry.riskFlag ?? entry.risk_flag ?? null;
      return (flag === "null" || flag === null || flag === undefined || flag === "") ? null : flag;
    })(),
    action: entry.action ?? null,
  }));

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
          {onExecute && (
            <button
              onClick={onExecute}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-xs font-mono uppercase tracking-wider hover:bg-indigo-700 transition-all rounded-lg shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" /> Execute
            </button>
          )}
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 text-zinc-600 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-all rounded-lg"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
          <a href={`${base}?runId=${encodeURIComponent(runId)}&format=pdf`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 text-zinc-600 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-all rounded-lg">
            <Download className="w-3.5 h-3.5" /> PDF
          </a>
        </div>
      </header>

      {/* ── Score Hero ────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8 items-center">
          <div className="text-center md:text-left flex-1">
            <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-2">Business Health Score</p>
            <div className="flex items-end gap-3 justify-center md:justify-start">
              <span className="text-7xl font-light tabular-nums">{hs?.score ?? "—"}</span>
              <span className="text-xl text-zinc-500 mb-2">/100</span>
              {hs?.grade && (
                <span className={`text-2xl font-bold mb-2 px-3 py-1 rounded-lg ${GRADE_COLORS[hs.grade]?.text ?? "text-zinc-300"} ${GRADE_COLORS[hs.grade]?.bg ?? "bg-zinc-800"}`}>
                  {formatLabel(hs.grade)}
                </span>
              )}
            </div>
            {hs?.headline && <p className="text-lg font-medium mt-2 text-zinc-100">{hs.headline}</p>}
            {hs?.summary && <p className="text-zinc-400 text-sm mt-1 max-w-lg leading-relaxed">{hs.summary}</p>}
          </div>
          {radarData.length > 0 && (
            <div className="w-72 h-72 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="60%">
                  <PolarGrid stroke="#3f3f46" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "#71717a", fontSize: 9 }} tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 12) + "…" : v} />
                  <Radar name="Score" dataKey="score" stroke="#e4e4e7" fill="#e4e4e7" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Chapter Navigation ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-zinc-200 sticky top-[61px] z-20">
        <div className="max-w-5xl mx-auto px-4 flex gap-0 overflow-x-auto scrollbar-none">
          {chapters.map((ch) => {
            const Icon = ch.icon;
            const isActive = activeChapter === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChapter(ch.id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-mono whitespace-nowrap border-b-2 transition-all uppercase tracking-widest ${
                  isActive
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-400 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                <Icon className="w-3 h-3" />
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Dashboard Sub-Tabs (only when Dashboard chapter is active) ──── */}
      {activeChapter === "dashboard" && (
        <div className="bg-zinc-50/50 border-b border-zinc-100">
          <div className="max-w-5xl mx-auto px-4 flex gap-0 overflow-x-auto scrollbar-none">
            {CORE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = coreTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCoreTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono whitespace-nowrap border-b-2 transition-all uppercase tracking-widest ${
                    isActive
                      ? "border-zinc-700 text-zinc-700"
                      : "border-transparent text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto w-full px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeChapter === "dashboard" ? `dashboard-${coreTab}` : activeChapter}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >

            {/* Data confidence indicator */}
            {d.dataProvenance && (
              <ConfidenceBanner provenance={d.dataProvenance} />
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ── DASHBOARD CHAPTER: Core sections with custom rendering ── */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeChapter === "dashboard" && (
              <>
                {/* ── Health Score ─────────────────────────────────────── */}
                {coreTab === 0 && (
                  <div className="space-y-4">
                    {(hs.dimensions || []).map((dim, i) => (
                      <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col md:flex-row gap-5 items-start md:items-center shadow-sm">
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-center w-16">
                            <div className="text-3xl font-light text-zinc-900 tabular-nums">{dim.score}</div>
                            {dim.grade && (
                              <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded ${GRADE_COLORS[dim.grade]?.text ?? ""} ${GRADE_COLORS[dim.grade]?.bg ?? ""}`}>
                                {formatLabel(dim.grade)}
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
                    {hs?.summary && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <SectionHeader><Sparkles className="w-3 h-3" /> Summary</SectionHeader>
                        <p className="text-sm text-zinc-600 leading-relaxed">{hs.summary}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Cash Intelligence ────────────────────────────────── */}
                {coreTab === 1 && (
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

                    <CashFlowChart projections={(ci as any).weeklyProjections ?? []} overlay={chartOverlays.cash} />
                    <ChartInteraction
                      section="cash"
                      orgId={chartOrgId}
                      prompts={[
                        "What weeks are most dangerous for cash?",
                        "How can I extend my runway by 4 weeks?",
                        "What expenses should I cut first?",
                      ]}
                      projectionConfig={{
                        type: "cash_forecast",
                        scenario: "Continue current burn rate with no changes to revenue or expenses",
                        months: 3,
                      }}
                      onProjection={handleProjection("cash")}
                      onDismiss={clearOverlay("cash")}
                    />

                    {weeklyModel.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <SectionHeader><BarChart3 className="w-3 h-3" /> 13-Week Cash Forecast</SectionHeader>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={weeklyModel}>
                            <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#71717a" }} tickFormatter={(v) => `W${v}`} />
                            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} width={65} />
                            <Tooltip formatter={(v) => fmt(v as number)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                            <Bar dataKey="closingBalance" radius={[4, 4, 0, 0]}>
                              {weeklyModel.map((entry: any, i: number) => (
                                <Cell key={i} fill={entry.riskFlag ? "#ef4444" : "#18181b"} />
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

                {/* ── Revenue Leaks ────────────────────────────────────── */}
                {coreTab === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 text-center shadow-sm">
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Total Recoverable</p>
                        <p className="text-3xl font-light text-zinc-900">{fmt(rl?.totalIdentified || 0)}</p>
                      </div>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-sm">
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">90-Day Projection</p>
                        <p className="text-2xl font-light text-zinc-900">{fmt(Number((rl as any)?.day90RecoveryProjection ?? (rl as any)?.day90_recovery_projection ?? 0))}</p>
                      </div>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-sm">
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Priority Action</p>
                        <p className="text-xs text-zinc-700 font-medium leading-snug">{(rl as any)?.priorityAction ?? (rl as any)?.priority_action ?? "—"}</p>
                      </div>
                    </div>

                    {rl?.summary && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-zinc-600 italic border-l-2 border-zinc-200 pl-4">{rl.summary}</p>
                      </div>
                    )}

                    <RevenueLeakChart items={rl?.items || []} overlay={chartOverlays.revenue} onDismissOverlay={clearOverlay("revenue")} />
                    <ChartInteraction
                      section="revenue"
                      orgId={chartOrgId}
                      prompts={[
                        "Which leak should I fix first for fastest ROI?",
                        "What if I recovered the top 3 leaks?",
                        "Break down the root causes of my biggest leak",
                      ]}
                      projectionConfig={{
                        type: "revenue_recovery",
                        scenario: "Fix the top 3 revenue leaks over the next 10 weeks",
                        months: 3,
                      }}
                      onProjection={handleProjection("revenue")}
                      onDismiss={clearOverlay("revenue")}
                    />

                    {(rl?.items || []).map((item, i) => (
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

                {/* ── Issues Register ──────────────────────────────────── */}
                {coreTab === 3 && (
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

                    <IssuesSeverityChart issues={ir.issues || []} overlay={chartOverlays.issues} onDismissOverlay={clearOverlay("issues")} />
                    <ChartInteraction
                      section="issues"
                      orgId={chartOrgId}
                      prompts={[
                        "What's the total financial exposure from critical issues?",
                        "Which issue should I tackle this week?",
                        "How do these issues affect my cash runway?",
                      ]}
                      onProjection={handleProjection("issues")}
                      onDismiss={clearOverlay("issues")}
                      projectionConfig={{
                        type: "growth_scenario",
                        scenario: "Resolve all critical and high-severity issues over the next 10 weeks",
                        months: 3,
                      }}
                    />

                    {(ir.issues || []).map((issue, i) => {
                      const isExpanded = expandedIssues.has(i);
                      const issueAny = issue as any;
                      const hasSolution = issue.solution || issue.solutionSteps?.length || issue.expectedROI || issue.implementationCost || issue.implementationTimeline || issue.alternativeSolutions?.length;
                      const hasLegacyDetails = issueAny.recommendation || issueAny.mitigation || issueAny.owner || issueAny.timeline || issueAny.recoveryActions;
                      const hasDetails = hasSolution || hasLegacyDetails;
                      return (
                        <div
                          key={i}
                          onClick={() => hasDetails && toggleIssue(i)}
                          className={`bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm transition-all ${hasDetails ? "cursor-pointer hover:border-zinc-300" : ""}`}
                        >
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
                              {hasDetails && (
                                <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              )}
                            </div>
                          </div>
                          <p className="font-semibold text-zinc-900 mb-1 break-words">{issue.description}</p>

                          {/* Solution preview — always visible */}
                          {issue.solution && (
                            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-widest">Recommended Solution</span>
                              </div>
                              <p className="text-sm text-emerald-900 leading-relaxed break-words">{issue.solution}</p>
                              {/* ROI / Cost / Timeline badges */}
                              <div className="flex flex-wrap gap-2 mt-3">
                                {issue.expectedROI && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    ROI: {issue.expectedROI}
                                  </span>
                                )}
                                {issue.implementationCost && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded-full border border-zinc-200">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Cost: {issue.implementationCost}
                                  </span>
                                )}
                                {issue.implementationTimeline && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {issue.implementationTimeline}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 pt-3 border-t border-zinc-100 space-y-3">
                                  {/* Implementation Steps */}
                                  {issue.solutionSteps && issue.solutionSteps.length > 0 && (
                                    <div className="bg-zinc-50 rounded-xl p-4">
                                      <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Implementation Steps</span>
                                      <ol className="mt-2 space-y-2">
                                        {issue.solutionSteps.map((step: string, si: number) => (
                                          <li key={si} className="text-sm text-zinc-700 flex items-start gap-3">
                                            <span className="flex-shrink-0 w-5 h-5 bg-zinc-900 text-white text-[10px] font-mono rounded-full flex items-center justify-center mt-0.5">{si + 1}</span>
                                            <span className="break-words">{step}</span>
                                          </li>
                                        ))}
                                      </ol>
                                    </div>
                                  )}
                                  {/* Alternative Solutions */}
                                  {issue.alternativeSolutions && issue.alternativeSolutions.length > 0 && (
                                    <div>
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Alternative Approaches</span>
                                      <ul className="mt-1.5 space-y-1.5">
                                        {issue.alternativeSolutions.map((alt: string, ai: number) => (
                                          <li key={ai} className="text-sm text-zinc-600 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                            <span className="text-amber-500 mt-0.5 flex-shrink-0">&#x25C6;</span>
                                            <span className="break-words">{alt}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {/* Legacy detail fields */}
                                  {issueAny.recommendation && (
                                    <div>
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Recommendation</span>
                                      <p className="text-sm text-zinc-700 mt-0.5 break-words">{issueAny.recommendation}</p>
                                    </div>
                                  )}
                                  {issueAny.mitigation && (
                                    <div>
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Mitigation</span>
                                      <p className="text-sm text-zinc-700 mt-0.5 break-words">{issueAny.mitigation}</p>
                                    </div>
                                  )}
                                  {issueAny.owner && (
                                    <div>
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Owner</span>
                                      <p className="text-sm text-zinc-700 mt-0.5">{issueAny.owner}</p>
                                    </div>
                                  )}
                                  {issueAny.timeline && (
                                    <div>
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Timeline</span>
                                      <p className="text-sm text-zinc-700 mt-0.5">{issueAny.timeline}</p>
                                    </div>
                                  )}
                                  {issueAny.recoveryActions && Array.isArray(issueAny.recoveryActions) && (
                                    <div>
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Recovery Actions</span>
                                      <ul className="mt-1 space-y-1">
                                        {issueAny.recoveryActions.map((a: string, ai: number) => (
                                          <li key={ai} className="text-sm text-zinc-700 flex items-start gap-2">
                                            <span className="text-zinc-400 mt-1">-</span>
                                            <span className="break-words">{a}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── At-Risk Customers ────────────────────────────────── */}
                {coreTab === 4 && (
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

                    <CustomerRiskScatter customers={arc.customers || []} overlay={chartOverlays.customers} onDismissOverlay={clearOverlay("customers")} />
                    <ChartInteraction
                      section="customers"
                      orgId={chartOrgId}
                      prompts={[
                        "What happens if I lose my highest-risk customer?",
                        "Which customer should I call first and what do I say?",
                        "What's my total revenue exposure from at-risk clients?",
                      ]}
                      projectionConfig={{
                        type: "customer_churn",
                        scenario: "Lose the highest-risk customer within 4 weeks with no replacement revenue",
                        months: 3,
                      }}
                      onProjection={handleProjection("customers")}
                      onDismiss={clearOverlay("customers")}
                    />

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

                {/* ── Decision Brief ───────────────────────────────────── */}
                {coreTab === 5 && (
                  <div className="space-y-4">
                    <div className="bg-zinc-900 text-white rounded-2xl p-8">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Decision Required</p>
                      <p className="text-2xl font-light mb-3">{db2?.decision ?? "—"}</p>
                      {db2?.context && <p className="text-zinc-400 text-sm leading-relaxed">{db2.context}</p>}
                    </div>

                    {(db2?.options || []).length > 0 && (
                      <div className="grid md:grid-cols-2 gap-4">
                        {(db2?.options || []).map((opt, i) => (
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

                {/* ── Action Plan ──────────────────────────────────────── */}
                {coreTab === 6 && (
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
                            {day.tasks.map((task, j) => {
                              const taskKey = `${i}-${j}`;
                              const isChecked = completedTasks.has(taskKey);
                              return (
                                <div
                                  key={j}
                                  onClick={() => toggleTask(taskKey)}
                                  className={`bg-white border p-4 rounded-xl flex items-start gap-3 shadow-sm cursor-pointer transition-all ${isChecked ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-100 hover:border-zinc-300"}`}
                                >
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isChecked ? "bg-emerald-600 border-emerald-600" : "bg-zinc-50 border border-zinc-200"}`}>
                                    {isChecked && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-sm leading-snug break-words ${isChecked ? "line-through text-zinc-400" : "text-zinc-800"}`}>{task.description}</div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase">{task.owner}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ── ALL OTHER CHAPTERS: Rendered via ChapterView ──────────── */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeChapter !== "dashboard" && (() => {
              const chapter = CHAPTERS.find(ch => ch.id === activeChapter);
              if (!chapter) return null;
              return (
                <ChapterView
                  chapterId={chapter.id}
                  sections={chapter.sections}
                  deliverables={d as unknown as Record<string, unknown>}
                  title={chapter.label}
                  description={chapter.description}
                  claimValidations={d.claimValidations}
                />
              );
            })()}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Share Modal ──────────────────────────────────────────────────── */}
      <ShareModal
        runId={runId}
        orgId={job.questionnaire.orgId ?? "default-org"}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      {/* ── Floating Chat Buttons ──────────────────────────────────────────── */}
      {onReprocess && (
        <ReuploadDrawer runId={runId} onReprocess={onReprocess} />
      )}
      <CoachChatButton
        orgId={job.questionnaire.orgId ?? "default-org"}
        runId={runId}
        onNavigate={handleAgentNavigate}
      />
      <AgentChatButton
        orgId={job.questionnaire.orgId ?? "default-org"}
        orgName={job.questionnaire.organizationName}
        onNavigate={handleAgentNavigate}
      />
    </div>
  );
}
