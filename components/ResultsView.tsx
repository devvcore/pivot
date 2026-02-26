"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, Download, AlertCircle, TrendingUp, DollarSign, Users, Target,
  ShieldAlert, Sparkles, ChevronRight, Loader2, ShieldCheck, Globe, Zap,
  BarChart3, GitBranch, Trophy, FileText, Clock, ArrowRight, Server, Megaphone,
  Presentation, Gauge, Calendar, ClipboardCheck, UserSearch, CheckCircle2,
  XCircle, MinusCircle, HelpCircle, Crosshair, Calculator, PieChart,
  Swords, Briefcase, UserPlus, LineChart, ShieldOff, BookOpen, Flag,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import type { Job, MVPDeliverables } from "@/lib/types";
import { ExecutionView } from "./ExecutionView";
import { AgentChatButton } from "./AgentChat";
import { CoachChatButton } from "./CoachChat";
import { RevenueLeakChart } from "./charts/RevenueLeakChart";
import { CashFlowChart } from "./charts/CashFlowChart";
import { CustomerRiskScatter } from "./charts/CustomerRiskScatter";
import { MarketingChannelChart } from "./charts/MarketingChannelChart";
import { IssuesSeverityChart } from "./charts/IssuesSeverityChart";
import { TechSavingsChart } from "./charts/TechSavingsChart";
import { PricingComparisonChart } from "./charts/PricingComparisonChart";
import { CompetitorRadarChart } from "./charts/CompetitorRadarChart";
import { ChartInteraction } from "./charts/ChartInteraction";

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
  { id: 12, label: "Marketing",       icon: Megaphone,   dataKey: "marketingStrategy"     },
  { id: 13, label: "Pitch Deck",      icon: Presentation, dataKey: "pitchDeckAnalysis"    },
  { id: 14, label: "KPIs",            icon: Gauge,        dataKey: "kpiReport"             },
  { id: 15, label: "30-Day Roadmap",  icon: Calendar,     dataKey: "roadmap"               },
  { id: 16, label: "Health Check",    icon: ClipboardCheck, dataKey: "healthChecklist"      },
  { id: 17, label: "Lead Gen",        icon: UserSearch,   dataKey: "leadReport"            },
  { id: 18, label: "SWOT",            icon: Crosshair,    dataKey: "swotAnalysis"          },
  { id: 19, label: "Unit Economics",  icon: Calculator,   dataKey: "unitEconomics"         },
  { id: 20, label: "Segments",        icon: PieChart,     dataKey: "customerSegmentation"  },
  { id: 21, label: "Win/Loss",        icon: Swords,       dataKey: "competitiveWinLoss"    },
  { id: 22, label: "Investor Brief",  icon: Briefcase,    dataKey: "investorOnePager"      },
  { id: 23, label: "Hiring Plan",     icon: UserPlus,     dataKey: "hiringPlan"            },
  { id: 24, label: "Forecast",        icon: LineChart,    dataKey: "revenueForecast"       },
  { id: 25, label: "Churn Playbook",  icon: ShieldOff,    dataKey: "churnPlaybook"         },
  { id: 26, label: "Sales Playbook",  icon: BookOpen,     dataKey: "salesPlaybook"         },
  { id: 27, label: "Goals & OKRs",    icon: Flag,         dataKey: "goalTracker"           },
  { id: 28, label: "Exec Summary",    icon: FileText,     dataKey: "executiveSummary"      },
  { id: 30, label: "Milestones",      icon: Flag,         dataKey: "milestoneTracker"      },
  { id: 31, label: "Risk Register",   icon: ShieldAlert,  dataKey: "riskRegister"          },
  { id: 32, label: "Partnerships",    icon: GitBranch,    dataKey: "partnershipOpportunities" },
  { id: 33, label: "Funding Ready",   icon: DollarSign,   dataKey: "fundingReadiness"      },
  { id: 34, label: "Market Sizing",   icon: PieChart,     dataKey: "marketSizing"          },
  { id: 35, label: "Scenarios",       icon: Sparkles,     dataKey: "scenarioPlanner"       },
  { id: 36, label: "Ops Efficiency",  icon: Zap,          dataKey: "operationalEfficiency" },
  { id: 37, label: "CLV Analysis",    icon: Users,        dataKey: "clvAnalysis"           },
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

export function ResultsView({ runId, onBack, onNewRun }: ResultsViewProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [phase, setPhase] = useState<string>("PLAN");
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState<"report" | "execute">("report");
  const [chartOverlays, setChartOverlays] = useState<Record<string, any>>({});

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

  const isExecutePhase = phase === "EXECUTE";

  if (isExecutePhase && viewMode === "execute") {
    return (
      <div className="relative">
        {/* Floating toggle to switch back to report */}
        <button
          onClick={() => setViewMode("report")}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 text-xs font-mono uppercase tracking-wider rounded-xl shadow-2xl border border-zinc-200 hover:bg-zinc-50 transition-all"
        >
          <FileText className="w-3.5 h-3.5" />
          View Report
        </button>
        <ExecutionView job={job} onBack={onBack} />
      </div>
    );
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
  const chartOrgId = job.questionnaire.orgId ?? "default-org";

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
          {isExecutePhase ? (
            <button onClick={() => setViewMode("execute")}
              className="px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-all rounded-lg shadow-md active:scale-95 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Execution Center
            </button>
          ) : (
            <button onClick={handleApprove} disabled={approving}
              className="px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-all rounded-lg shadow-md active:scale-95 flex items-center gap-2">
              {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Approve & Execute
            </button>
          )}
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

            {/* Data confidence indicator */}
            {d.dataProvenance && activeTab === 0 && (
              <ConfidenceBanner provenance={d.dataProvenance} />
            )}

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

                {/* Cash flow charts */}
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

                {/* Revenue leak charts */}
                <RevenueLeakChart items={rl.items || []} overlay={chartOverlays.revenue} onDismissOverlay={clearOverlay("revenue")} />
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

                {/* Issues charts */}
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

                {/* Customer risk scatter chart */}
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

                  {/* Competitor radar chart */}
                  <CompetitorRadarChart
                    competitors={[...ca.competitors, ...ca.industryLeaders]}
                    yourGrade={d.websiteAnalysis?.grade}
                    overlay={chartOverlays.competitors}
                    onDismissOverlay={clearOverlay("competitors")}
                  />
                  <ChartInteraction
                    section="competitors"
                    orgId={chartOrgId}
                    prompts={[
                      "How do I differentiate from my top competitor?",
                      "What are competitors doing that I should copy?",
                      "Where am I strongest vs weakest against competition?",
                    ]}
                    onProjection={handleProjection("competitors")}
                    onDismiss={clearOverlay("competitors")}
                  />

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

                  {/* Tech savings chart */}
                  {to.recommendations?.length > 0 && (
                    <>
                      <TechSavingsChart recommendations={to.recommendations} overlay={chartOverlays.tech} onDismissOverlay={clearOverlay("tech")} />
                      <ChartInteraction
                        section="tech"
                        orgId={chartOrgId}
                        prompts={[
                          "Which migration gives the best ROI?",
                          "What's my total possible savings if I do all?",
                          "Which tools are critical vs nice-to-have?",
                        ]}
                        projectionConfig={{
                          type: "growth_scenario",
                          scenario: "Implement all tech cost optimizations over 10 weeks, saving estimated monthly amounts",
                          months: 3,
                        }}
                        onProjection={handleProjection("tech")}
                        onDismiss={clearOverlay("tech")}
                      />
                    </>
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

                  {/* Pricing chart */}
                  {pi.suggestedPricing?.length > 0 && (
                    <>
                      <PricingComparisonChart tiers={pi.suggestedPricing} overlay={chartOverlays.pricing} onDismissOverlay={clearOverlay("pricing")} />
                      <ChartInteraction
                        section="pricing"
                        orgId={chartOrgId}
                        prompts={[
                          "What if I raise prices by 15%?",
                          "Which tier has the highest margin potential?",
                          "How does my pricing compare to competitors?",
                        ]}
                        projectionConfig={{
                          type: "revenue_recovery",
                          scenario: "Implement recommended pricing tiers over the next 10 weeks with gradual customer migration",
                          months: 3,
                        }}
                        onProjection={handleProjection("pricing")}
                        onDismiss={clearOverlay("pricing")}
                      />
                    </>
                  )}

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

            {/* ── Tab 12: Marketing Intelligence ─────────────────────────── */}
            {activeTab === 12 && d.marketingStrategy && (() => {
              const ms = d.marketingStrategy!;
              const effortColor = (e: string) =>
                e === "Low" ? "bg-green-50 text-green-700 border-green-200"
                : e === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-200";
              return (
                <div className="space-y-8">
                  {/* Executive summary */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Megaphone className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Marketing Intelligence Report</p>
                    </div>
                    {ms.summary && <p className="text-lg leading-relaxed">{ms.summary}</p>}
                    {ms.currentChannels.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {ms.currentChannels.map((ch) => (
                          <span key={ch} className="text-[9px] font-mono bg-white/10 text-zinc-300 px-2 py-1 rounded-lg border border-white/10 uppercase">{ch}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Marketing charts */}
                  <MarketingChannelChart
                    channels={ms.channelRecommendations ?? []}
                    socialStrategy={ms.socialMediaStrategy ?? []}
                    overlay={chartOverlays.marketing}
                    onDismissOverlay={clearOverlay("marketing")}
                  />
                  <ChartInteraction
                    section="marketing"
                    orgId={chartOrgId}
                    prompts={[
                      "What's my best marketing channel right now?",
                      "How should I split my ad budget?",
                      "What content should I post this week?",
                    ]}
                    projectionConfig={{
                      type: "growth_scenario",
                      scenario: "Execute top 3 recommended marketing channels for 10 weeks with consistent effort",
                      months: 3,
                    }}
                    onProjection={handleProjection("marketing")}
                    onDismiss={clearOverlay("marketing")}
                  />

                  {/* Channel recommendations */}
                  {ms.channelRecommendations?.length > 0 && (
                    <div>
                      <SectionHeader><Megaphone className="w-3 h-3" /> Top Channel Recommendations</SectionHeader>
                      <div className="space-y-4">
                        {ms.channelRecommendations.map((rec) => (
                          <div key={rec.rank} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-start gap-4">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{rec.rank}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 flex-wrap mb-2">
                                  <p className="font-semibold text-zinc-900 text-lg">{rec.channel}</p>
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-lg border uppercase ${effortColor(rec.effort)}`}>
                                    {rec.effort} effort
                                  </span>
                                </div>
                                <p className="text-sm text-zinc-600 mb-3">{rec.why}</p>
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                                    <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Expected Impact (3 Mo)</p>
                                    <p className="text-xs text-green-800 font-medium">{rec.expectedImpact}</p>
                                  </div>
                                  <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                                    <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">How to Start</p>
                                    <p className="text-xs text-zinc-700">{rec.howToStart}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Social media audit — user profiles vs competitor profiles */}
                  {ms.socialMediaStrategy?.length > 0 && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Social Media Audit</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {ms.socialMediaStrategy.map((s, i) => {
                          const gc = s.currentGrade ? (GRADE_COLORS[s.currentGrade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" }) : null;
                          const cgc = s.vsCompetitorGrade ? (GRADE_COLORS[s.vsCompetitorGrade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" }) : null;
                          return (
                            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <p className="font-semibold text-zinc-900 uppercase tracking-tight">{s.platform}</p>
                                <div className="flex items-center gap-2">
                                  {gc && (
                                    <div className="text-center">
                                      <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${gc.text} ${gc.bg}`}>{s.currentGrade}</span>
                                      <p className="text-[8px] font-mono text-zinc-400 mt-0.5">You</p>
                                    </div>
                                  )}
                                  {cgc && (
                                    <div className="text-center">
                                      <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${cgc.text} ${cgc.bg}`}>{s.vsCompetitorGrade}</span>
                                      <p className="text-[8px] font-mono text-zinc-400 mt-0.5">Best Comp</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Post {s.postingFrequency}</p>
                              {s.improvements?.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-1">Improvements Needed</p>
                                  <ul className="space-y-1">
                                    {s.improvements.map((imp, ii) => (
                                      <li key={ii} className="text-xs text-zinc-700 flex gap-1.5">
                                        <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />{imp}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {s.contentSuggestions?.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Content Ideas</p>
                                  <ul className="space-y-1">
                                    {s.contentSuggestions.map((cs2, ci3) => (
                                      <li key={ci3} className="text-xs text-zinc-700 flex gap-1.5">
                                        <Sparkles className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />{cs2}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Scraped social profiles detail cards */}
                  {(ms.socialProfiles?.length > 0 || ms.competitorSocialProfiles?.length > 0) && (
                    <div>
                      <SectionHeader><Globe className="w-3 h-3" /> Profile Analysis — You vs Competitors</SectionHeader>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...(ms.socialProfiles ?? []), ...(ms.competitorSocialProfiles ?? [])].map((p, i) => {
                          const gc = p.profileGrade && p.profileGrade !== "N/A" ? (GRADE_COLORS[p.profileGrade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" }) : null;
                          return (
                            <div key={i} className={`border rounded-2xl p-5 shadow-sm ${p.isCompetitor ? "bg-zinc-50 border-zinc-200" : "bg-white border-zinc-900/20"}`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">{p.platform}</p>
                                  <p className="font-semibold text-zinc-900">@{p.handle}</p>
                                  {p.companyName && <p className="text-[10px] text-zinc-500">{p.companyName}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {p.isCompetitor && (
                                    <span className="text-[9px] font-mono bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full uppercase">Competitor</span>
                                  )}
                                  {gc && (
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${gc.text} ${gc.bg}`}>{p.profileGrade}</span>
                                  )}
                                </div>
                              </div>
                              {p.followerCount && p.followerCount !== "Unknown" && (
                                <p className="text-xs text-zinc-500 mb-1">{p.followerCount} followers · {p.engagementLevel} engagement</p>
                              )}
                              {p.bioSummary && <p className="text-xs text-zinc-600 italic mb-2">{p.bioSummary}</p>}
                              {p.contentThemes?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {p.contentThemes.map((t, ti) => (
                                    <span key={ti} className="text-[9px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Website copy recommendations */}
                  {ms.websiteCopyRecommendations?.length > 0 && (
                    <div>
                      <SectionHeader><FileText className="w-3 h-3" /> Website Copy Changes</SectionHeader>
                      <div className="space-y-4">
                        {ms.websiteCopyRecommendations.map((rec, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-3">{rec.section}</p>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                                <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-1">Current</p>
                                <p className="text-sm text-red-900">{rec.current}</p>
                              </div>
                              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                                <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Suggested</p>
                                <p className="text-sm text-green-900 font-medium">{rec.suggested}</p>
                              </div>
                            </div>
                            <p className="text-xs text-zinc-500 mt-3 italic">{rec.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offer positioning */}
                  {ms.offerPositioning && (
                    <div className="bg-zinc-900 text-white rounded-2xl p-8">
                      <SectionHeader><Target className="w-3 h-3 text-zinc-400" /> <span className="text-zinc-400">Offer Positioning</span></SectionHeader>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">How You Currently Position</p>
                          <p className="text-zinc-300">{ms.offerPositioning.currentPositioning}</p>
                        </div>
                        {ms.offerPositioning.competitorPositioning?.length > 0 && (
                          <div>
                            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">How Competitors Position</p>
                            {ms.offerPositioning.competitorPositioning.map((cp, i) => (
                              <p key={i} className="text-zinc-400 text-sm">- {cp}</p>
                            ))}
                          </div>
                        )}
                        <div className="bg-white/10 border border-white/20 rounded-xl p-4 mt-2">
                          <p className="text-[9px] font-mono text-green-400 uppercase tracking-widest mb-1">Recommended Repositioning</p>
                          <p className="text-white font-medium">{ms.offerPositioning.suggestedRepositioning}</p>
                        </div>
                        {ms.offerPositioning.keyMessages?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {ms.offerPositioning.keyMessages.map((msg, i) => (
                              <span key={i} className="text-xs bg-white/10 text-zinc-300 px-3 py-1.5 rounded-lg border border-white/10">{msg}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Content strategy */}
                  {ms.contentStrategy && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><FileText className="w-3 h-3" /> Content Strategy</SectionHeader>
                      <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{ms.contentStrategy}</p>
                    </div>
                  )}

                  {/* Ad spend recommendation */}
                  {ms.adSpendRecommendation && (
                    <div className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><DollarSign className="w-3 h-3" /> Ad Spend Recommendation</SectionHeader>
                      <p className="text-sm text-zinc-600 leading-relaxed">{ms.adSpendRecommendation}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 14: KPIs ──────────────────────────────────────────── */}
            {activeTab === 14 && d.kpiReport && (() => {
              const kpi = d.kpiReport!;
              const northStars = kpi.kpis.filter(k => k.isNorthStar);
              const others = kpi.kpis.filter(k => !k.isNorthStar);
              const statusIcon = (s: string) => {
                if (s === "on_track") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
                if (s === "at_risk") return <AlertCircle className="w-4 h-4 text-amber-500" />;
                if (s === "behind") return <XCircle className="w-4 h-4 text-red-500" />;
                return <HelpCircle className="w-4 h-4 text-zinc-400" />;
              };
              const statusColor = (s: string) =>
                s === "on_track" ? "bg-green-50 border-green-200" :
                s === "at_risk" ? "bg-amber-50 border-amber-200" :
                s === "behind" ? "bg-red-50 border-red-200" :
                "bg-zinc-50 border-zinc-200";
              const sourceTag = (s: string) =>
                s === "from_documents" ? "text-green-700 bg-green-50 border-green-200" :
                s === "estimated" ? "text-amber-700 bg-amber-50 border-amber-200" :
                "text-zinc-500 bg-zinc-50 border-zinc-200";
              return (
                <div className="space-y-6">
                  {/* Hero */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Key Performance Indicators</p>
                      <span className="text-[9px] font-mono bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full border border-white/10 ml-auto">{kpi.businessType}</span>
                    </div>
                    <p className="text-lg leading-relaxed">{kpi.summary}</p>
                    {kpi.missingDataWarning && (
                      <div className="mt-4 bg-amber-600/20 border border-amber-500/30 rounded-xl p-3">
                        <p className="text-amber-200 text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" />{kpi.missingDataWarning}</p>
                      </div>
                    )}
                  </div>

                  {/* North Star KPIs */}
                  {northStars.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> North Star Metrics</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {northStars.map((k, i) => (
                          <div key={i} className={`border-2 border-zinc-900 rounded-2xl p-6 shadow-sm ${statusColor(k.status)}`}>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-semibold text-zinc-900 text-lg">{k.name}</p>
                                <p className="text-[10px] font-mono text-zinc-500">{k.abbreviation} · {k.frequency}</p>
                              </div>
                              {statusIcon(k.status)}
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Current</p>
                                <p className="text-2xl font-light text-zinc-900">{k.currentValue || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Target</p>
                                <p className="text-2xl font-light text-zinc-900">{k.targetValue || "—"}</p>
                              </div>
                            </div>
                            {k.benchmark && <p className="text-xs text-zinc-500 mt-3 italic">{k.benchmark}</p>}
                            <div className="flex items-center gap-2 mt-3">
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase ${sourceTag(k.sourceData)}`}>
                                {k.sourceData === "from_documents" ? "Verified" : k.sourceData === "estimated" ? "Estimated" : "Unknown"}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-400 uppercase">{k.category}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other KPIs */}
                  {others.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> All KPIs</SectionHeader>
                      <div className="space-y-3">
                        {others.map((k, i) => (
                          <div key={i} className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center ${statusColor(k.status)}`}>
                            <div className="flex items-center gap-3 shrink-0">
                              {statusIcon(k.status)}
                              <div>
                                <p className="font-semibold text-zinc-900">{k.name}</p>
                                <p className="text-[10px] font-mono text-zinc-400">{k.abbreviation} · {k.frequency} · {k.category}</p>
                              </div>
                            </div>
                            <div className="flex-1 flex items-center gap-6 ml-auto">
                              <div className="text-right">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Current</p>
                                <p className="font-semibold text-zinc-900">{k.currentValue || "—"}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Target</p>
                                <p className="font-semibold text-zinc-900">{k.targetValue || "—"}</p>
                              </div>
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase ${sourceTag(k.sourceData)}`}>
                                {k.sourceData === "from_documents" ? "Verified" : k.sourceData === "estimated" ? "Estimated" : "Unknown"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 15: 30-Day Roadmap ────────────────────────────────────── */}
            {activeTab === 15 && d.roadmap && (() => {
              const rm = d.roadmap!;
              const catColors: Record<string, string> = {
                "Revenue Recovery": "bg-green-100 text-green-800 border-green-200",
                "Marketing": "bg-purple-100 text-purple-800 border-purple-200",
                "Operations": "bg-blue-100 text-blue-800 border-blue-200",
                "Sales": "bg-amber-100 text-amber-800 border-amber-200",
                "Finance": "bg-emerald-100 text-emerald-800 border-emerald-200",
                "HR": "bg-pink-100 text-pink-800 border-pink-200",
              };
              const priColors: Record<string, string> = {
                critical: "bg-red-600 text-white",
                high: "bg-orange-500 text-white",
                medium: "bg-amber-400 text-zinc-900",
                low: "bg-zinc-200 text-zinc-700",
              };
              return (
                <div className="space-y-6">
                  {/* Hero */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">30-Day Action Roadmap</p>
                    </div>
                    <p className="text-lg leading-relaxed">{rm.summary}</p>
                  </div>

                  {/* Weekly themes */}
                  {rm.weeklyThemes?.length > 0 && (
                    <div className="grid md:grid-cols-4 gap-3">
                      {rm.weeklyThemes.map((wt) => (
                        <div key={wt.week} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm text-center">
                          <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Week {wt.week}</p>
                          <p className="font-semibold text-zinc-900 text-sm">{wt.theme}</p>
                          <p className="text-xs text-zinc-500 mt-1">{wt.focus}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Daily action items timeline */}
                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-[15px] before:w-[1px] before:bg-zinc-200 before:z-0">
                    {rm.items.map((item, i) => (
                      <div key={i} className="relative z-10 pl-10 flex items-start gap-4">
                        <div className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                          item.priority === "critical" ? "bg-red-50 border-red-500 text-red-700" :
                          item.priority === "high" ? "bg-orange-50 border-orange-400 text-orange-700" :
                          "bg-white border-zinc-300 text-zinc-600"
                        }`}>
                          {item.day}
                        </div>
                        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex-1">
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-zinc-900 text-sm">{item.action}</p>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${priColors[item.priority] || priColors.medium}`}>
                                {item.priority}
                              </span>
                            </div>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${catColors[item.category] || "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                              {item.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-zinc-500">
                            <span>{item.owner}</span>
                            {item.expectedImpact && <span className="text-green-600 font-medium">{item.expectedImpact}</span>}
                            {item.source && <span className="italic">{item.source}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 16: Health Checklist ─────────────────────────────────── */}
            {activeTab === 16 && d.healthChecklist && (() => {
              const hc = d.healthChecklist!;
              const gc = GRADE_COLORS[hc.grade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" };
              const statusIcons: Record<string, React.ReactNode> = {
                present: <CheckCircle2 className="w-4 h-4 text-green-500" />,
                absent: <XCircle className="w-4 h-4 text-red-500" />,
                partial: <MinusCircle className="w-4 h-4 text-amber-500" />,
                unknown: <HelpCircle className="w-4 h-4 text-zinc-400" />,
              };
              const statusBg: Record<string, string> = {
                present: "bg-green-50 border-green-200",
                absent: "bg-red-50 border-red-200",
                partial: "bg-amber-50 border-amber-200",
                unknown: "bg-zinc-50 border-zinc-200",
              };
              // Group by category
              const categories = Array.from(new Set(hc.items.map(i => i.category)));
              return (
                <div className="space-y-6">
                  {/* Score hero */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8 flex flex-col md:flex-row gap-6 items-start">
                    <div className="text-center shrink-0">
                      <div className={`text-6xl font-bold px-6 py-4 rounded-2xl ${gc.text} ${gc.bg}`}>{hc.grade}</div>
                      <div className="text-zinc-400 text-sm mt-2">{hc.score}/100</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <ClipboardCheck className="w-4 h-4 text-zinc-400" />
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Business Health Checklist</p>
                      </div>
                      <p className="text-lg text-white leading-relaxed">{hc.summary}</p>
                      {hc.topGap && (
                        <div className="mt-4 bg-red-600/20 border border-red-500/30 rounded-xl p-3">
                          <p className="text-red-200 text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" />{hc.topGap}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Operational Readiness</span>
                      <span className="text-sm font-bold text-zinc-900">{hc.score}%</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${hc.score}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={`h-full rounded-full ${hc.score >= 70 ? "bg-green-500" : hc.score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[9px] font-mono text-zinc-400">
                      <span>{hc.items.filter(i => i.status === "present").length} present</span>
                      <span>{hc.items.filter(i => i.status === "partial").length} partial</span>
                      <span>{hc.items.filter(i => i.status === "absent").length} missing</span>
                    </div>
                  </div>

                  {/* Items by category */}
                  {categories.map((cat) => (
                    <div key={cat}>
                      <SectionHeader><ClipboardCheck className="w-3 h-3" /> {cat}</SectionHeader>
                      <div className="space-y-2">
                        {hc.items.filter(i => i.category === cat).map((item, i) => (
                          <div key={i} className={`border rounded-xl p-4 shadow-sm flex items-start gap-3 ${statusBg[item.status] || statusBg.unknown}`}>
                            {statusIcons[item.status] || statusIcons.unknown}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-zinc-900 text-sm">{item.item}</p>
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase ${
                                  item.status === "present" ? "bg-green-100 text-green-700" :
                                  item.status === "absent" ? "bg-red-100 text-red-700" :
                                  item.status === "partial" ? "bg-amber-100 text-amber-700" :
                                  "bg-zinc-100 text-zinc-500"
                                }`}>{item.status}</span>
                              </div>
                              <p className="text-xs text-zinc-500 mt-1">{item.description}</p>
                              {item.evidence && <p className="text-xs text-zinc-600 mt-1 italic">Evidence: {item.evidence}</p>}
                              {item.recommendation && item.status !== "present" && (
                                <p className="text-xs text-zinc-700 mt-2 font-medium flex gap-1">
                                  <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />{item.recommendation}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── Tab 17: Lead Generation ──────────────────────────────────── */}
            {activeTab === 17 && d.leadReport && (() => {
              const lr = d.leadReport!;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <UserSearch className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Lead Generation Report</p>
                      <span className="text-[9px] font-mono bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full border border-white/10 ml-auto">
                        {lr.leads.length} leads · {lr.creditsUsed} credits used
                      </span>
                    </div>
                    <p className="text-lg leading-relaxed">
                      {lr.leads.length} potential leads found
                      {lr.searchCriteria.industry ? ` in ${lr.searchCriteria.industry}` : ""}
                      {lr.searchCriteria.location ? ` near ${lr.searchCriteria.location}` : ""}
                    </p>
                  </div>

                  {/* Export CSV button */}
                  <div className="flex justify-end">
                    <a
                      href={`/api/leads/export?runId=${runId}`}
                      download
                      className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </a>
                  </div>

                  {/* Lead cards */}
                  <div className="space-y-3">
                    {lr.leads.map((lead, i) => (
                      <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                          <div>
                            <p className="font-semibold text-zinc-900 text-lg">{lead.name}</p>
                            <div className="flex items-center gap-2 text-sm text-zinc-500 mt-0.5">
                              {lead.title && <span>{lead.title}</span>}
                              {lead.title && lead.company && <span>at</span>}
                              {lead.company && <span className="font-medium text-zinc-700">{lead.company}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {lead.isDecisionMaker && (
                              <span className="text-[9px] font-mono bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full uppercase">Decision Maker</span>
                            )}
                            {lead.relevanceScore != null && (
                              <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${
                                lead.relevanceScore >= 70 ? "bg-green-50 text-green-700" :
                                lead.relevanceScore >= 40 ? "bg-amber-50 text-amber-700" :
                                "bg-zinc-50 text-zinc-500"
                              }`}>{lead.relevanceScore}%</span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          {lead.industry && (
                            <div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">Industry</p>
                              <p className="text-zinc-700">{lead.industry}</p>
                            </div>
                          )}
                          {lead.location && (
                            <div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">Location</p>
                              <p className="text-zinc-700">{lead.location}</p>
                            </div>
                          )}
                          {lead.estimatedCompanySize && (
                            <div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">Company Size</p>
                              <p className="text-zinc-700">{lead.estimatedCompanySize}</p>
                            </div>
                          )}
                          {lead.email && (
                            <div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">Email</p>
                              <p className="text-zinc-700">{lead.email}</p>
                            </div>
                          )}
                        </div>
                        {lead.headline && <p className="text-xs text-zinc-500 mt-3 italic">{lead.headline}</p>}
                        {lead.linkedinUrl && (
                          <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-block underline underline-offset-2">
                            View LinkedIn Profile
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 18: SWOT Analysis ──────────────────────────────────── */}
            {activeTab === 18 && d.swotAnalysis && (() => {
              const sw = d.swotAnalysis!;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Crosshair className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">SWOT Analysis</p>
                    </div>
                    <p className="text-lg leading-relaxed">{sw.summary}</p>
                  </div>

                  {/* 2x2 Grid */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                      <SectionHeader><CheckCircle2 className="w-3 h-3 text-green-600" /> Strengths</SectionHeader>
                      <div className="space-y-3">
                        {sw.strengths.map((s, i) => (
                          <div key={i} className="bg-white/70 rounded-xl p-3">
                            <p className="font-medium text-green-900 text-sm">{s.point}</p>
                            <p className="text-xs text-green-700 mt-1">{s.evidence}</p>
                            <p className="text-xs text-green-800 font-medium mt-1">Leverage: {s.leverage}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Weaknesses */}
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                      <SectionHeader><XCircle className="w-3 h-3 text-red-500" /> Weaknesses</SectionHeader>
                      <div className="space-y-3">
                        {sw.weaknesses.map((w, i) => (
                          <div key={i} className="bg-white/70 rounded-xl p-3">
                            <p className="font-medium text-red-900 text-sm">{w.point}</p>
                            <p className="text-xs text-red-700 mt-1">{w.evidence}</p>
                            <p className="text-xs text-red-800 font-medium mt-1">Mitigation: {w.mitigation}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Opportunities */}
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                      <SectionHeader><Zap className="w-3 h-3 text-blue-600" /> Opportunities</SectionHeader>
                      <div className="space-y-3">
                        {sw.opportunities.map((o, i) => (
                          <div key={i} className="bg-white/70 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-blue-900 text-sm">{o.point}</p>
                              <span className="text-[9px] font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{o.timeframe}</span>
                            </div>
                            <p className="text-xs text-blue-700">{o.potentialImpact}</p>
                            <p className="text-xs text-blue-800 font-medium mt-1">Action: {o.actionRequired}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Threats */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                      <SectionHeader><ShieldAlert className="w-3 h-3 text-amber-600" /> Threats</SectionHeader>
                      <div className="space-y-3">
                        {sw.threats.map((t, i) => (
                          <div key={i} className="bg-white/70 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-amber-900 text-sm">{t.point}</p>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                t.likelihood === "high" ? "bg-red-100 text-red-700" :
                                t.likelihood === "medium" ? "bg-amber-100 text-amber-700" :
                                "bg-zinc-100 text-zinc-600"
                              }`}>{t.likelihood} likelihood</span>
                            </div>
                            <p className="text-xs text-amber-700">{t.severity}</p>
                            <p className="text-xs text-amber-800 font-medium mt-1">Contingency: {t.contingency}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Strategic Priorities */}
                  {sw.strategicPriorities?.length > 0 && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Strategic Priorities</SectionHeader>
                      <div className="space-y-3">
                        {sw.strategicPriorities.map((p, i) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div>
                                <p className="font-semibold text-zinc-900">{p.priority}</p>
                                <p className="text-sm text-zinc-500 mt-1">{p.rationale}</p>
                                <span className="text-[9px] font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded mt-2 inline-block">{p.timeline}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 19: Unit Economics ────────────────────────────────────── */}
            {activeTab === 19 && d.unitEconomics && (() => {
              const ue = d.unitEconomics!;
              const sourceTag = (s: string) =>
                s === "from_documents" ? "text-green-700 bg-green-50 border-green-200" :
                s === "estimated" ? "text-amber-700 bg-amber-50 border-amber-200" :
                "text-zinc-500 bg-zinc-50 border-zinc-200";
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Unit Economics</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ue.summary}</p>
                    {ue.dataQualityNote && (
                      <div className="mt-4 bg-amber-600/20 border border-amber-500/30 rounded-xl p-3">
                        <p className="text-amber-200 text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" />{ue.dataQualityNote}</p>
                      </div>
                    )}
                  </div>

                  {/* Key metrics cards */}
                  <div className="grid md:grid-cols-4 gap-4">
                    {[
                      { label: "CAC", ...ue.cac },
                      { label: "LTV", ...ue.ltv },
                      { label: "LTV:CAC Ratio", value: ue.ltvCacRatio.value, source: "estimated" as const, benchmark: ue.ltvCacRatio.benchmark },
                      { label: "Payback Period", value: ue.paybackPeriodMonths.value, source: ue.paybackPeriodMonths.source },
                    ].map((m, i) => (
                      <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">{m.label}</p>
                        <p className="text-2xl font-light text-zinc-900">{m.value}</p>
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded border mt-2 inline-block ${sourceTag(m.source)}`}>
                          {m.source === "from_documents" ? "Verified" : "Estimated"}
                        </span>
                        {m.benchmark && <p className="text-[10px] text-zinc-400 mt-1">{m.benchmark}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      { label: "Gross Margin", ...ue.grossMargin },
                      { label: "Net Margin", ...ue.netMargin },
                      { label: "Revenue/Customer", ...ue.revenuePerCustomer },
                    ].map((m, i) => (
                      <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">{m.label}</p>
                        <p className="text-xl font-light text-zinc-900">{m.value}</p>
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded border mt-2 inline-block ${sourceTag(m.source)}`}>
                          {m.source === "from_documents" ? "Verified" : "Estimated"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Burn multiple */}
                  <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Burn Multiple</p>
                        <p className="text-3xl font-light text-zinc-900">{ue.burnMultiple.value}</p>
                      </div>
                      <p className="text-sm text-zinc-600 max-w-sm text-right">{ue.burnMultiple.assessment}</p>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {ue.recommendations?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Improvement Recommendations</SectionHeader>
                      <div className="space-y-3">
                        {ue.recommendations.map((r, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-zinc-900 text-sm">{r.metric}</p>
                              <p className="text-xs text-zinc-500">Current: {r.current} | Target: {r.target}</p>
                            </div>
                            <p className="text-xs text-zinc-700 font-medium max-w-xs">{r.action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 20: Customer Segmentation ────────────────────────────── */}
            {activeTab === 20 && d.customerSegmentation && (() => {
              const cs = d.customerSegmentation!;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Customer Segmentation</p>
                    </div>
                    <p className="text-lg leading-relaxed">{cs.summary}</p>
                    {cs.concentrationRisk && (
                      <div className="mt-4 bg-red-600/20 border border-red-500/30 rounded-xl p-3">
                        <p className="text-red-200 text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" />{cs.concentrationRisk}</p>
                      </div>
                    )}
                  </div>

                  {/* Segment cards */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {cs.segments.map((seg, i) => (
                      <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">{seg.tier}</p>
                            <p className="text-lg font-semibold text-zinc-900">{seg.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-zinc-900">{seg.revenueShare}</p>
                            <p className="text-[10px] text-zinc-400">{seg.customerCount}</p>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500 mb-3">Avg deal: {seg.avgDealSize}</p>
                        <div className="flex gap-2 mb-3">
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                            seg.churnRisk === "low" ? "bg-green-50 text-green-700 border-green-200" :
                            seg.churnRisk === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-red-50 text-red-700 border-red-200"
                          }`}>Churn: {seg.churnRisk}</span>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                            seg.growthPotential === "high" ? "bg-green-50 text-green-700 border-green-200" :
                            seg.growthPotential === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-zinc-50 text-zinc-500 border-zinc-200"
                          }`}>Growth: {seg.growthPotential}</span>
                        </div>
                        <p className="text-xs text-zinc-600 italic">{seg.idealProfile}</p>
                        <div className="mt-3 pt-3 border-t border-zinc-100">
                          <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Engagement Strategy</p>
                          <p className="text-xs text-zinc-700">{seg.engagementStrategy}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ICP */}
                  {cs.idealCustomerProfile?.length > 0 && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6">
                      <SectionHeader><Target className="w-3 h-3" /> Ideal Customer Profile</SectionHeader>
                      <div className="space-y-2">
                        {cs.idealCustomerProfile.map((c, i) => (
                          <div key={i} className="flex items-center gap-4 text-sm">
                            <span className="font-medium text-zinc-900 w-40 shrink-0">{c.characteristic}</span>
                            <span className="text-zinc-500">{c.importance}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expansion targets */}
                  {cs.expansionTargets?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3" /> Expansion Opportunities</SectionHeader>
                      <div className="space-y-3">
                        {cs.expansionTargets.map((et, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                            <span className="text-[9px] font-mono bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded">{et.segment}</span>
                            <p className="flex-1 text-sm text-zinc-700">{et.opportunity}</p>
                            <p className="text-sm font-bold text-green-600 shrink-0">{et.estimatedRevenue}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 21: Competitive Win/Loss ─────────────────────────────── */}
            {activeTab === 21 && d.competitiveWinLoss && (() => {
              const wl = d.competitiveWinLoss!;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Swords className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Competitive Win/Loss Analysis</p>
                    </div>
                    <p className="text-lg leading-relaxed">{wl.summary}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Win Reasons */}
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                      <SectionHeader><CheckCircle2 className="w-3 h-3 text-green-600" /> Why You Win</SectionHeader>
                      <div className="space-y-3">
                        {wl.winReasons.map((w, i) => (
                          <div key={i} className="bg-white/70 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-green-900 text-sm">{w.reason}</p>
                              <span className="text-[9px] font-mono bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{w.frequency}</span>
                            </div>
                            <p className="text-xs text-green-700">{w.evidence}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Loss Reasons */}
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                      <SectionHeader><XCircle className="w-3 h-3 text-red-500" /> Why You Lose</SectionHeader>
                      <div className="space-y-3">
                        {wl.lossReasons.map((l, i) => (
                          <div key={i} className="bg-white/70 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-red-900 text-sm">{l.reason}</p>
                              <span className="text-[9px] font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{l.frequency}</span>
                            </div>
                            <p className="text-xs text-red-800 font-medium">Fix: {l.remediation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Battle Cards */}
                  {wl.battleCards?.length > 0 && (
                    <div>
                      <SectionHeader><Swords className="w-3 h-3" /> Battle Cards</SectionHeader>
                      <div className="space-y-4">
                        {wl.battleCards.map((bc, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                            <p className="font-semibold text-zinc-900 text-lg mb-3">vs. {bc.competitor}</p>
                            <div className="grid md:grid-cols-3 gap-4">
                              <div className="bg-red-50 rounded-xl p-3">
                                <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-1">Their Strength</p>
                                <p className="text-xs text-red-900">{bc.theirStrength}</p>
                              </div>
                              <div className="bg-green-50 rounded-xl p-3">
                                <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Your Counter</p>
                                <p className="text-xs text-green-900">{bc.yourCounter}</p>
                              </div>
                              <div className="bg-zinc-50 rounded-xl p-3">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Talk Track</p>
                                <p className="text-xs text-zinc-700 italic">&quot;{bc.talkTrack}&quot;</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Advantages/Disadvantages */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {wl.competitiveAdvantages?.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <SectionHeader><CheckCircle2 className="w-3 h-3" /> Competitive Advantages</SectionHeader>
                        <div className="space-y-2">
                          {wl.competitiveAdvantages.map((a, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <p className="text-sm text-zinc-900 flex-1">{a.advantage}</p>
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                a.sustainability === "durable" ? "bg-green-50 text-green-700 border-green-200" :
                                a.sustainability === "temporary" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-red-50 text-red-700 border-red-200"
                              }`}>{a.sustainability}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {wl.competitiveDisadvantages?.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <SectionHeader><AlertCircle className="w-3 h-3" /> Disadvantages to Fix</SectionHeader>
                        <div className="space-y-2">
                          {wl.competitiveDisadvantages.map((d2, i) => (
                            <div key={i}>
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-zinc-900">{d2.disadvantage}</p>
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                  d2.urgency === "immediate" ? "bg-red-100 text-red-700" :
                                  d2.urgency === "medium_term" ? "bg-amber-100 text-amber-700" :
                                  "bg-zinc-100 text-zinc-500"
                                }`}>{d2.urgency}</span>
                              </div>
                              <p className="text-xs text-zinc-500 mt-0.5">{d2.fix}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 22: Investor One-Pager ───────────────────────────────── */}
            {activeTab === 22 && d.investorOnePager && (() => {
              const io = d.investorOnePager!;
              return (
                <div className="space-y-6">
                  {/* Hero */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <p className="text-3xl font-light mb-2">{io.companyName}</p>
                    <p className="text-xl text-zinc-300 italic">{io.tagline}</p>
                  </div>

                  {/* Core sections */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-2">The Problem</p>
                      <p className="text-sm text-zinc-700">{io.problem}</p>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-2">Our Solution</p>
                      <p className="text-sm text-zinc-700">{io.solution}</p>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Market Size</p>
                      <p className="text-sm text-zinc-700">{io.marketSize}</p>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Business Model</p>
                      <p className="text-sm text-zinc-700">{io.businessModel}</p>
                    </div>
                  </div>

                  {/* Traction + Team */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Traction & Proof Points</p>
                      <p className="text-sm text-zinc-700">{io.traction}</p>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Team</p>
                      <p className="text-sm text-zinc-700">{io.team}</p>
                    </div>
                  </div>

                  {/* Competitive Edge */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-6">
                    <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Competitive Edge</p>
                    <p className="text-lg leading-relaxed">{io.competitiveEdge}</p>
                  </div>

                  {/* Financial Highlights */}
                  {io.financialHighlights?.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {io.financialHighlights.map((fh, i) => (
                        <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 text-center shadow-sm">
                          <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">{fh.metric}</p>
                          <p className="text-xl font-light text-zinc-900">{fh.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Why Now */}
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                    <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-2">Why Now?</p>
                    <p className="text-sm text-green-900 font-medium">{io.whyNow}</p>
                  </div>

                  {/* Key Risks */}
                  {io.keyRisks?.length > 0 && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><AlertCircle className="w-3 h-3" /> Key Risks (Transparency)</SectionHeader>
                      <ul className="space-y-2">
                        {io.keyRisks.map((r, i) => (
                          <li key={i} className="text-sm text-zinc-700 flex gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 23: Hiring Plan ──────────────────────────────────────── */}
            {activeTab === 23 && d.hiringPlan && (() => {
              const hp = d.hiringPlan!;
              const urgencyColors: Record<string, string> = {
                immediate: "bg-red-50 text-red-700 border-red-200",
                next_quarter: "bg-amber-50 text-amber-700 border-amber-200",
                next_half: "bg-zinc-50 text-zinc-600 border-zinc-200",
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <UserPlus className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Hiring Plan</p>
                    </div>
                    <p className="text-lg leading-relaxed">{hp.summary}</p>
                    <div className="flex items-center gap-4 mt-4 text-sm">
                      <div>
                        <p className="text-zinc-500 text-[9px] font-mono uppercase">Est. Budget</p>
                        <p className="text-white font-medium">{hp.totalBudgetNeeded}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[9px] font-mono uppercase">Priority Order</p>
                        <p className="text-zinc-300 text-xs">{hp.priorityOrder}</p>
                      </div>
                    </div>
                  </div>

                  {/* Current gaps */}
                  {hp.currentTeamGaps?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Current Team Gaps</SectionHeader>
                      <div className="space-y-2">
                        {hp.currentTeamGaps.map((g, i) => (
                          <div key={i} className="flex items-start gap-3 bg-white/70 rounded-xl p-3">
                            <span className="text-[9px] font-mono bg-red-100 text-red-700 px-2 py-0.5 rounded shrink-0">{g.area}</span>
                            <div>
                              <p className="text-sm text-zinc-900 font-medium">{g.gap}</p>
                              <p className="text-xs text-zinc-500">{g.impact}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hire recommendations */}
                  {hp.recommendations.map((rec) => (
                    <div key={rec.rank} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-start gap-4">
                        <span className="w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">{rec.rank}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <p className="text-xl font-medium text-zinc-900">{rec.role}</p>
                            <span className="text-[9px] font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">{rec.department}</span>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${urgencyColors[rec.urgency] || urgencyColors.next_half}`}>
                              {rec.urgency.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-600 mb-3">{rec.rationale}</p>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                              <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Expected ROI</p>
                              <p className="text-xs text-green-800 font-medium">{rec.expectedROI}</p>
                            </div>
                            <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                              <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Est. Salary</p>
                              <p className="text-xs text-zinc-700">{rec.estimatedSalary}</p>
                            </div>
                          </div>
                          {rec.alternativeToHiring && (
                            <div className="mt-3 bg-amber-50 rounded-xl p-3 border border-amber-100">
                              <p className="text-[9px] font-mono text-amber-600 uppercase tracking-widest mb-1">Alternative</p>
                              <p className="text-xs text-amber-800">{rec.alternativeToHiring}</p>
                            </div>
                          )}
                          {rec.keyResponsibilities?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {rec.keyResponsibilities.map((kr, ki) => (
                                <span key={ki} className="text-[9px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">{kr}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── Tab 24: Revenue Forecast ─────────────────────────────────── */}
            {activeTab === 24 && d.revenueForecast && (() => {
              const rf = d.revenueForecast!;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <LineChart className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Revenue Forecast Model</p>
                    </div>
                    <p className="text-lg leading-relaxed">{rf.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      <div>
                        <p className="text-zinc-500 text-[9px] font-mono uppercase">Current MRR</p>
                        <p className="text-white text-xl font-light">{rf.currentMRR}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[9px] font-mono uppercase">Current ARR</p>
                        <p className="text-white text-xl font-light">{rf.currentARR}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[9px] font-mono uppercase">Growth Rate</p>
                        <p className="text-white text-xl font-light">{rf.growthRate}</p>
                      </div>
                    </div>
                    {rf.dataQualityNote && (
                      <div className="mt-4 bg-amber-600/20 border border-amber-500/30 rounded-xl p-3">
                        <p className="text-amber-200 text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" />{rf.dataQualityNote}</p>
                      </div>
                    )}
                  </div>

                  {/* Scenario cards */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {rf.scenarios.map((sc, i) => {
                      const colors = sc.name.toLowerCase().includes("optimist") ? "border-green-300 bg-green-50" :
                        sc.name.toLowerCase().includes("conserv") ? "border-amber-300 bg-amber-50" :
                        "border-blue-300 bg-blue-50";
                      return (
                        <div key={i} className={`border-2 rounded-2xl p-6 ${colors}`}>
                          <p className="text-sm font-bold text-zinc-900 mb-2">{sc.name}</p>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">12Mo Revenue</p>
                              <p className="text-lg font-light text-zinc-900">{fmt(sc.totalRevenue12Mo)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">12Mo Profit</p>
                              <p className={`text-lg font-light ${sc.totalProfit12Mo >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(sc.totalProfit12Mo)}</p>
                            </div>
                          </div>
                          {sc.breakEvenMonth && <p className="text-xs text-zinc-600">Break-even: {sc.breakEvenMonth}</p>}
                          {sc.assumptions?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-200">
                              <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Assumptions</p>
                              {sc.assumptions.map((a, ai) => (
                                <p key={ai} className="text-[10px] text-zinc-600">- {a}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Key drivers */}
                  {rf.keyDrivers?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3" /> Key Growth Drivers</SectionHeader>
                      <div className="space-y-2">
                        {rf.keyDrivers.map((d2, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                            <p className="flex-1 text-sm text-zinc-900 font-medium">{d2.driver}</p>
                            <p className="text-xs text-zinc-500">{d2.impact}</p>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                              d2.confidence === "high" ? "bg-green-50 text-green-700 border-green-200" :
                              d2.confidence === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-red-50 text-red-700 border-red-200"
                            }`}>{d2.confidence}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risks */}
                  {rf.risks?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3" /> Revenue Risks</SectionHeader>
                      <div className="space-y-2">
                        {rf.risks.map((r, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm text-zinc-900 font-medium">{r.risk}</p>
                              <p className="text-sm text-red-600 font-medium">{r.revenueImpact}</p>
                            </div>
                            <p className="text-xs text-zinc-500">{r.mitigant}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 25: Churn Playbook ───────────────────────────────────── */}
            {activeTab === 25 && d.churnPlaybook && (() => {
              const cp = d.churnPlaybook!;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldOff className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Churn Prevention Playbook</p>
                    </div>
                    <p className="text-lg leading-relaxed">{cp.summary}</p>
                    <div className="mt-4 bg-red-600/20 border border-red-500/30 rounded-xl p-3">
                      <p className="text-red-200 text-sm font-medium">Total Revenue at Risk: {cp.totalRevenueAtRisk}</p>
                    </div>
                  </div>

                  {/* Overall retention tactics */}
                  {cp.retentionTactics?.length > 0 && (
                    <div className="grid md:grid-cols-3 gap-3">
                      {cp.retentionTactics.map((t, i) => (
                        <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                          <p className="font-medium text-zinc-900 text-sm mb-1">{t.tactic}</p>
                          <div className="flex gap-2">
                            <span className="text-[9px] font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{t.effort} effort</span>
                            <span className="text-[9px] font-mono bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{t.impact} impact</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Per-customer playbook */}
                  {cp.entries.map((entry, i) => (
                    <div key={i} className={`bg-white border-2 rounded-2xl p-6 shadow-sm ${
                      entry.riskLevel === "critical" ? "border-red-400" :
                      entry.riskLevel === "high" ? "border-orange-300" :
                      "border-amber-200"
                    }`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                        <div>
                          <p className="text-xl font-medium text-zinc-900">{entry.customerName}</p>
                          <p className="text-sm text-zinc-500">Revenue at risk: <span className="text-red-600 font-medium">{entry.revenueAtRisk}</span></p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono font-bold px-2 py-1 rounded border uppercase ${
                            entry.riskLevel === "critical" ? "bg-red-50 text-red-700 border-red-200" :
                            entry.riskLevel === "high" ? "bg-orange-50 text-orange-700 border-orange-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>{entry.riskLevel}</span>
                          <span className="text-[9px] font-mono bg-zinc-100 text-zinc-600 px-2 py-1 rounded">{entry.predictedChurnWindow}</span>
                        </div>
                      </div>

                      {/* Warning signals */}
                      {entry.warningSignals?.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Warning Signals</p>
                          <div className="flex flex-wrap gap-2">
                            {entry.warningSignals.map((ws, wi) => (
                              <span key={wi} className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded">{ws}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Intervention plan */}
                      <div className="bg-zinc-50 rounded-xl p-4 mb-3">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Intervention Plan</p>
                        <div className="space-y-2">
                          {entry.interventionPlan.map((step) => (
                            <div key={step.step} className="flex items-center gap-3 text-xs">
                              <span className="w-5 h-5 bg-zinc-900 text-white rounded-full flex items-center justify-center text-[10px] shrink-0">{step.step}</span>
                              <p className="flex-1 text-zinc-700">{step.action}</p>
                              <span className="text-zinc-400 shrink-0">{step.owner}</span>
                              <span className="text-zinc-400 shrink-0">{step.deadline}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Talking points */}
                      {entry.talkingPoints?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">What to Say on the Call</p>
                          <ul className="space-y-1">
                            {entry.talkingPoints.map((tp, ti) => (
                              <li key={ti} className="text-xs text-zinc-700 italic">&quot;{tp}&quot;</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {entry.offerToMake && (
                        <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                          <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Offer to Make</p>
                          <p className="text-xs text-green-800 font-medium">{entry.offerToMake}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── Tab 26: Sales Playbook ───────────────────────────────────── */}
            {activeTab === 26 && d.salesPlaybook && (() => {
              const sp = d.salesPlaybook!;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Sales Playbook</p>
                    </div>
                    <p className="text-lg leading-relaxed">{sp.summary}</p>
                  </div>

                  {/* Buyer Personas */}
                  {sp.idealBuyerPersona?.length > 0 && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Ideal Buyer Personas</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {sp.idealBuyerPersona.map((bp, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                            <p className="font-semibold text-zinc-900 text-lg mb-3">{bp.title}</p>
                            <div className="space-y-3">
                              <div>
                                <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-1">Pain Points</p>
                                {bp.painPoints.map((pp, pi) => <p key={pi} className="text-xs text-zinc-700">- {pp}</p>)}
                              </div>
                              <div>
                                <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Motivations</p>
                                {bp.motivations.map((m, mi) => <p key={mi} className="text-xs text-zinc-700">- {m}</p>)}
                              </div>
                              <div>
                                <p className="text-[9px] font-mono text-amber-600 uppercase tracking-widest mb-1">Common Objections</p>
                                {bp.objections.map((o, oi) => <p key={oi} className="text-xs text-zinc-700">- {o}</p>)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sales Process */}
                  {sp.salesProcess?.length > 0 && (
                    <div>
                      <SectionHeader><ArrowRight className="w-3 h-3" /> Sales Process</SectionHeader>
                      <div className="flex flex-col gap-3">
                        {sp.salesProcess.map((stage, i) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-xl p-5 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                              <p className="font-semibold text-zinc-900">{stage.stage}</p>
                              <span className="text-[9px] font-mono bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded ml-auto">{stage.avgDuration}</span>
                            </div>
                            <div className="ml-9 space-y-1">
                              {stage.actions.map((a, ai) => <p key={ai} className="text-xs text-zinc-700">- {a}</p>)}
                              <p className="text-xs text-zinc-500 italic mt-2">Exit criteria: {stage.exitCriteria}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Objection Handling */}
                  {sp.objectionHandling?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldAlert className="w-3 h-3" /> Objection Handling</SectionHeader>
                      <div className="space-y-3">
                        {sp.objectionHandling.map((oh, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                            <p className="text-sm font-medium text-red-700 mb-2">&quot;{oh.objection}&quot;</p>
                            <p className="text-sm text-zinc-700 mb-1"><span className="font-medium text-green-700">Response:</span> {oh.response}</p>
                            <p className="text-xs text-zinc-500 italic">Proof: {oh.proof}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email Templates */}
                  {sp.emailTemplates?.length > 0 && (
                    <div>
                      <SectionHeader><FileText className="w-3 h-3" /> Email Templates</SectionHeader>
                      <div className="space-y-4">
                        {sp.emailTemplates.map((et, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                            <span className="text-[9px] font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded mb-2 inline-block">{et.purpose}</span>
                            <p className="font-semibold text-zinc-900 mt-1">Subject: {et.subject}</p>
                            <pre className="text-xs text-zinc-700 whitespace-pre-wrap mt-3 bg-zinc-50 rounded-xl p-4 border border-zinc-100 font-sans leading-relaxed">{et.body}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cold Call Script */}
                  {sp.coldCallScript && (
                    <div className="bg-zinc-900 text-white rounded-2xl p-8">
                      <SectionHeader><Megaphone className="w-3 h-3 text-zinc-400" /> <span className="text-zinc-400">Cold Call Script</span></SectionHeader>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Opening</p>
                          <p className="text-zinc-300 text-sm italic">&quot;{sp.coldCallScript.opening}&quot;</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Qualifying Questions</p>
                          {sp.coldCallScript.qualifyingQuestions.map((q, qi) => (
                            <p key={qi} className="text-zinc-300 text-sm">- {q}</p>
                          ))}
                        </div>
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Key Pitch Points</p>
                          {sp.coldCallScript.pitchPoints.map((p, pi) => (
                            <p key={pi} className="text-zinc-300 text-sm">- {p}</p>
                          ))}
                        </div>
                        <div>
                          <p className="text-[9px] font-mono text-green-400 uppercase tracking-widest mb-1">Closing Ask</p>
                          <p className="text-white text-sm font-medium">&quot;{sp.coldCallScript.closingAsk}&quot;</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Closing Techniques */}
                  {sp.closingTechniques?.length > 0 && (
                    <div>
                      <SectionHeader><Trophy className="w-3 h-3" /> Closing Techniques</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-3">
                        {sp.closingTechniques.map((ct, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <p className="font-medium text-zinc-900 text-sm">{ct.technique}</p>
                            <p className="text-xs text-zinc-500 mt-1">{ct.whenToUse}</p>
                            <p className="text-xs text-zinc-700 mt-2 italic">&quot;{ct.example}&quot;</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 27: Goals & OKRs ─────────────────────────────────────── */}
            {activeTab === 27 && d.goalTracker && (() => {
              const gt = d.goalTracker!;
              const statusColors: Record<string, string> = {
                on_track: "bg-green-50 text-green-700 border-green-200",
                at_risk: "bg-amber-50 text-amber-700 border-amber-200",
                behind: "bg-red-50 text-red-700 border-red-200",
                completed: "bg-blue-50 text-blue-700 border-blue-200",
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Flag className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Goals & OKRs</p>
                    </div>
                    <p className="text-2xl font-light mb-2">{gt.quarterlyTheme}</p>
                    <p className="text-zinc-400 text-sm">{gt.summary}</p>
                  </div>

                  {/* Active objectives */}
                  {gt.objectives.map((obj, i) => (
                    <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <span className="text-[9px] font-mono bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">{obj.category}</span>
                          <p className="text-lg font-semibold text-zinc-900 mt-1">{obj.objective}</p>
                          <p className="text-xs text-zinc-400">{obj.timeframe}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-light text-zinc-900">{obj.overallProgress}%</div>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${statusColors[obj.status] || statusColors.on_track}`}>
                            {obj.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden mb-4">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${obj.overallProgress}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }}
                          className={`h-full rounded-full ${
                            obj.status === "on_track" ? "bg-green-500" :
                            obj.status === "at_risk" ? "bg-amber-500" :
                            obj.status === "behind" ? "bg-red-500" :
                            "bg-blue-500"
                          }`}
                        />
                      </div>
                      {/* Key Results */}
                      <div className="space-y-3">
                        {obj.keyResults.map((kr, ki) => (
                          <div key={ki} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-600 shrink-0">
                              {kr.progress}%
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-zinc-900">{kr.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-zinc-400">Current: {kr.current}{kr.unit !== "#" && kr.unit !== "$" && kr.unit !== "%" ? "" : ""}</span>
                                <span className="text-[10px] text-zinc-400">/</span>
                                <span className="text-[10px] text-zinc-400">Target: {kr.target}</span>
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${statusColors[kr.status] || statusColors.on_track}`}>
                                  {kr.status.replace("_", " ")}
                                </span>
                              </div>
                            </div>
                            <div className="w-20 h-1.5 bg-zinc-100 rounded-full overflow-hidden shrink-0">
                              <div className={`h-full rounded-full ${
                                kr.status === "on_track" ? "bg-green-500" :
                                kr.status === "at_risk" ? "bg-amber-500" :
                                kr.status === "behind" ? "bg-red-500" :
                                "bg-blue-500"
                              }`} style={{ width: `${kr.progress}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Suggested objectives */}
                  {gt.suggestedObjectives?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Suggested Additional Objectives</SectionHeader>
                      <div className="space-y-3">
                        {gt.suggestedObjectives.map((so, i) => (
                          <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[9px] font-mono bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded">{so.category}</span>
                              <p className="font-medium text-zinc-900 text-sm">{so.objective}</p>
                            </div>
                            <p className="text-xs text-zinc-500 mb-2">{so.rationale}</p>
                            <div className="flex flex-wrap gap-1">
                              {so.keyResults.map((kr, ki) => (
                                <span key={ki} className="text-[9px] bg-white text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded">{kr}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 13: Pitch Deck Analysis ─────────────────────────── */}
            {activeTab === 13 && d.pitchDeckAnalysis && (() => {
              const pd = d.pitchDeckAnalysis!;
              const gc = GRADE_COLORS[pd.overallGrade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" };
              return (
                <div className="space-y-6">
                  {/* Score hero */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8 flex flex-col md:flex-row gap-6 items-start">
                    <div className="text-center shrink-0">
                      <div className={`text-6xl font-bold px-6 py-4 rounded-2xl ${gc.text} ${gc.bg}`}>{pd.overallGrade}</div>
                      <div className="text-zinc-400 text-sm mt-2">{pd.overallScore}/100</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Presentation className="w-4 h-4 text-zinc-400" />
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Pitch Deck Review</p>
                      </div>
                      <p className="text-lg text-white leading-relaxed">{pd.headline}</p>
                      <div className="flex gap-3 mt-3 text-[10px] font-mono text-zinc-500">
                        <span>{pd.fileName}</span>
                        {pd.slideCount && <span>{pd.slideCount} slides</span>}
                      </div>
                    </div>
                  </div>

                  {/* Extracted content */}
                  {pd.extractedContent && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {Object.entries(pd.extractedContent)
                        .filter(([, v]) => v)
                        .map(([key, value]) => (
                          <div key={key} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </p>
                            <p className="text-sm text-zinc-700">{value}</p>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Strengths + Weaknesses */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {pd.strengths?.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                        <SectionHeader><Sparkles className="w-3 h-3 text-green-600" /> Strengths</SectionHeader>
                        <ul className="space-y-2">
                          {pd.strengths.map((s, i) => (
                            <li key={i} className="text-sm text-green-800 flex gap-2">
                              <span className="text-green-500 font-bold shrink-0">+</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {pd.weaknesses?.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                        <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Weaknesses</SectionHeader>
                        <ul className="space-y-2">
                          {pd.weaknesses.map((w, i) => (
                            <li key={i} className="text-sm text-red-800 flex gap-2">
                              <span className="text-red-500 font-bold shrink-0">-</span>{w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Missing slides */}
                  {pd.missingSlides?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                      <SectionHeader><AlertCircle className="w-3 h-3 text-amber-500" /> Missing Essential Slides</SectionHeader>
                      <div className="flex flex-wrap gap-2">
                        {pd.missingSlides.map((s, i) => (
                          <span key={i} className="text-xs font-mono bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {pd.recommendations?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Improvement Recommendations</SectionHeader>
                      <div className="space-y-4">
                        {pd.recommendations.map((rec) => (
                          <div key={rec.rank} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-start gap-4">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{rec.rank}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900 mb-2">{rec.area}</p>
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                    <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-1">Current</p>
                                    <p className="text-xs text-red-900">{rec.current}</p>
                                  </div>
                                  <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                                    <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Suggested</p>
                                    <p className="text-xs text-green-900 font-medium">{rec.suggested}</p>
                                  </div>
                                </div>
                                <p className="text-xs text-zinc-500 mt-2 italic">{rec.rationale}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested infographics */}
                  {pd.suggestedInfographics?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Suggested Visuals & Infographics</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {pd.suggestedInfographics.map((info, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[9px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded uppercase">
                                {info.type}
                              </span>
                              <span className="text-[10px] text-zinc-400">{info.slide}</span>
                            </div>
                            <p className="text-sm text-zinc-700">{info.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Positioning advice */}
                  {pd.positioningAdvice && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6">
                      <SectionHeader><Target className="w-3 h-3" /> Positioning Strategy</SectionHeader>
                      <p className="text-sm text-zinc-700 leading-relaxed">{pd.positioningAdvice}</p>
                    </div>
                  )}

                  {/* Generate new deck CTA */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 text-center">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-3">Need a New Pitch Deck?</p>
                    <p className="text-sm text-zinc-600 mb-4">Ask Pivvy to generate an investor-ready pitch deck based on your report data.</p>
                    <p className="text-xs text-zinc-500 italic">Try: &quot;Generate a pitch deck for me&quot; in the Pivvy chat</p>
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 28: Executive Summary ──────────────────────────────── */}
            {activeTab === 28 && d.executiveSummary && (() => {
              const es = d.executiveSummary!;
              return (
                <div className="space-y-6">
                  {/* Email header */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Executive Summary</p>
                      <span className="text-[9px] font-mono bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full border border-white/10 ml-auto">
                        {es.outlook}
                      </span>
                    </div>
                    <p className="text-lg leading-relaxed">{es.subject}</p>
                  </div>

                  {/* Copy to clipboard button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        const text = [
                          `Subject: ${es.subject}`,
                          "",
                          es.greeting,
                          "",
                          "KEY FINDINGS:",
                          ...es.keyFindings.map(f => `  - ${f}`),
                          "",
                          "CRITICAL ACTIONS:",
                          ...es.criticalActions.map((a, i) => `  ${i + 1}. ${a}`),
                          "",
                          "FINANCIAL SUMMARY:",
                          es.financialSummary,
                          "",
                          `OUTLOOK: ${es.outlook}`,
                          "",
                          es.fullSummary,
                        ].join("\n");
                        navigator.clipboard.writeText(text);
                        // Brief visual feedback via the button text
                        const btn = document.getElementById("exec-copy-btn");
                        if (btn) {
                          btn.textContent = "Copied!";
                          setTimeout(() => { btn.textContent = "Copy to Clipboard"; }, 2000);
                        }
                      }}
                      id="exec-copy-btn"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      Copy to Clipboard
                    </button>
                  </div>

                  {/* Email-style card */}
                  <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                    {/* Subject line */}
                    <div className="border-b border-zinc-100 px-8 py-4">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Subject</p>
                      <p className="text-base font-semibold text-zinc-900">{es.subject}</p>
                    </div>

                    <div className="px-8 py-6 space-y-6">
                      {/* Greeting */}
                      <p className="text-sm text-zinc-700">{es.greeting}</p>

                      {/* Key findings */}
                      <div>
                        <SectionHeader><TrendingUp className="w-3 h-3" /> Key Findings</SectionHeader>
                        <ul className="space-y-2">
                          {es.keyFindings.map((finding, i) => (
                            <li key={i} className="flex gap-3 text-sm text-zinc-700">
                              <span className="w-5 h-5 bg-zinc-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                              {finding}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Critical actions */}
                      <div>
                        <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Critical Actions This Week</SectionHeader>
                        <div className="space-y-3">
                          {es.criticalActions.map((action, i) => (
                            <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                              <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <p className="text-sm text-red-900">{action}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Financial summary */}
                      <div>
                        <SectionHeader><DollarSign className="w-3 h-3" /> Financial Summary</SectionHeader>
                        <p className="text-sm text-zinc-700 leading-relaxed bg-zinc-50 border border-zinc-100 rounded-xl p-4">{es.financialSummary}</p>
                      </div>

                      {/* Outlook badge */}
                      <div className="flex items-center gap-3">
                        <SectionHeader><Sparkles className="w-3 h-3" /> Outlook</SectionHeader>
                        <span className={`text-xs font-mono px-3 py-1 rounded-full border ${
                          es.outlook.toLowerCase().includes("optimistic") || es.outlook.toLowerCase().includes("strong")
                            ? "bg-green-50 text-green-700 border-green-200"
                            : es.outlook.toLowerCase().includes("critical") || es.outlook.toLowerCase().includes("urgent")
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {es.outlook}
                        </span>
                      </div>

                      {/* Full summary */}
                      <div className="border-t border-zinc-100 pt-6">
                        <SectionHeader><FileText className="w-3 h-3" /> Full Summary</SectionHeader>
                        <div className="prose prose-sm prose-zinc max-w-none">
                          {es.fullSummary.split("\n").filter(Boolean).map((para, i) => (
                            <p key={i} className="text-sm text-zinc-700 leading-relaxed mb-4">{para}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 30: Milestone Tracker ─────────────────────────────────── */}
            {activeTab === 30 && d.milestoneTracker && (() => {
              const mt = d.milestoneTracker!;
              const msStatusColors: Record<string, string> = {
                completed: "bg-green-50 text-green-700 border-green-200",
                in_progress: "bg-blue-50 text-blue-700 border-blue-200",
                at_risk: "bg-amber-50 text-amber-700 border-amber-200",
                blocked: "bg-red-50 text-red-700 border-red-200",
                not_started: "bg-zinc-50 text-zinc-600 border-zinc-200",
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Flag className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Milestone Tracker</p>
                    </div>
                    <p className="text-lg leading-relaxed">{mt.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      <div>
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Completion Rate</p>
                        <p className="text-2xl font-light">{mt.completionRate}%</p>
                      </div>
                      {mt.criticalPath && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Critical Path</p>
                          <p className="text-sm text-zinc-300">{mt.criticalPath}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Milestone cards */}
                  <div className="space-y-4">
                    {mt.milestones.map((ms: any, i: number) => (
                      <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${msStatusColors[ms.status] || msStatusColors.not_started}`}>
                                {ms.status.replace("_", " ")}
                              </span>
                              {ms.category && (
                                <span className="text-[9px] font-mono bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">{ms.category}</span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-zinc-900">{ms.title}</p>
                            {ms.description && <p className="text-xs text-zinc-500 mt-1">{ms.description}</p>}
                          </div>
                          {ms.dueDate && (
                            <div className="text-right shrink-0">
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">Due</p>
                              <p className="text-xs text-zinc-700">{ms.dueDate}</p>
                            </div>
                          )}
                        </div>
                        {ms.progress !== undefined && (
                          <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                ms.status === "completed" ? "bg-green-500" :
                                ms.status === "in_progress" ? "bg-blue-500" :
                                ms.status === "at_risk" ? "bg-amber-500" :
                                ms.status === "blocked" ? "bg-red-500" :
                                "bg-zinc-300"
                              }`}
                              style={{ width: `${ms.progress}%` }}
                            />
                          </div>
                        )}
                        {ms.dependencies?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {ms.dependencies.map((dep: string, di: number) => (
                              <span key={di} className="text-[9px] bg-zinc-50 text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded">{dep}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 31: Risk Register ─────────────────────────────────────── */}
            {activeTab === 31 && d.riskRegister && (() => {
              const rr = d.riskRegister!;
              const riskLevelColors: Record<string, string> = {
                low: "bg-green-50 text-green-700 border-green-200",
                medium: "bg-amber-50 text-amber-700 border-amber-200",
                high: "bg-orange-50 text-orange-700 border-orange-200",
                critical: "bg-red-50 text-red-700 border-red-200",
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Risk Register</p>
                      {rr.overallRiskLevel && (
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ml-auto ${
                          rr.overallRiskLevel === "low" ? "bg-green-900/30 text-green-300 border-green-700" :
                          rr.overallRiskLevel === "moderate" ? "bg-amber-900/30 text-amber-300 border-amber-700" :
                          rr.overallRiskLevel === "high" ? "bg-orange-900/30 text-orange-300 border-orange-700" :
                          "bg-red-900/30 text-red-300 border-red-700"
                        }`}>
                          {rr.overallRiskLevel} risk
                        </span>
                      )}
                    </div>
                    <p className="text-lg leading-relaxed">{rr.summary}</p>
                  </div>

                  {/* Top risks summary */}
                  {rr.topRisks?.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {rr.topRisks.map((risk, i) => (
                        <div key={i} className="rounded-2xl p-4 text-center border bg-red-50 text-red-700 border-red-200">
                          <p className="text-sm font-medium">{risk}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Risk cards */}
                  <div className="space-y-4">
                    {rr.risks.map((risk: any, i: number) => (
                      <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${riskLevelColors[risk.severity] || riskLevelColors.medium}`}>
                                {risk.severity}
                              </span>
                              {risk.category && (
                                <span className="text-[9px] font-mono bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">{risk.category}</span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-zinc-900">{risk.title}</p>
                            {risk.description && <p className="text-xs text-zinc-500 mt-1">{risk.description}</p>}
                          </div>
                          <div className="flex gap-4 shrink-0 text-center">
                            <div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">Likelihood</p>
                              <p className="text-lg font-light text-zinc-900">{risk.likelihood}/5</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">Impact</p>
                              <p className="text-lg font-light text-zinc-900">{risk.impact}/5</p>
                            </div>
                          </div>
                        </div>
                        {risk.mitigation && (
                          <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 mt-2">
                            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Mitigation Strategy</p>
                            <p className="text-xs text-zinc-700">{risk.mitigation}</p>
                          </div>
                        )}
                        {risk.owner && (
                          <p className="text-[9px] text-zinc-400 mt-2">Owner: <span className="text-zinc-600">{risk.owner}</span></p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 32: Partnership Opportunities ─────────────────────────── */}
            {activeTab === 32 && d.partnershipOpportunities && (() => {
              const po = d.partnershipOpportunities!;
              const priorityColors: Record<string, string> = {
                high: "bg-red-50 text-red-700 border-red-200",
                medium: "bg-amber-50 text-amber-700 border-amber-200",
                low: "bg-blue-50 text-blue-700 border-blue-200",
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <GitBranch className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Partnership Opportunities</p>
                    </div>
                    <p className="text-lg leading-relaxed">{po.partnershipStrategy}</p>
                  </div>

                  {/* Partner cards */}
                  <div className="space-y-4">
                    {po.partners.map((partner: any, i: number) => (
                      <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {partner.type && (
                                <span className="text-[9px] font-mono bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">{partner.type}</span>
                              )}
                              {partner.priority && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${priorityColors[partner.priority] || priorityColors.medium}`}>
                                  {partner.priority} priority
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-zinc-900">{partner.name}</p>
                            {partner.synergy && <p className="text-xs text-zinc-500 mt-1">{partner.synergy}</p>}
                          </div>
                        </div>
                        {partner.approach && (
                          <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 mt-2">
                            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Approach</p>
                            <p className="text-xs text-zinc-700">{partner.approach}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Quick wins */}
                  {po.quickWins?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3" /> Quick Wins</SectionHeader>
                      <div className="space-y-2">
                        {po.quickWins.map((qw: string, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-green-50 border border-green-100 rounded-xl p-4">
                            <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <p className="text-sm text-green-900">{qw}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Long-term plays */}
                  {po.longTermPlays?.length > 0 && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Long-Term Plays</SectionHeader>
                      <div className="space-y-2">
                        {po.longTermPlays.map((lt: string, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-blue-50 border border-blue-100 rounded-xl p-4">
                            <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <p className="text-sm text-blue-900">{lt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 33: Funding Readiness ─────────────────────────────────── */}
            {activeTab === 33 && d.fundingReadiness && (() => {
              const fr = d.fundingReadiness!;
              const gradeColor = (grade: string) => {
                if (grade === "A" || grade === "A+") return "bg-emerald-50 text-emerald-700 border-emerald-200";
                if (grade === "B" || grade === "B+") return "bg-green-50 text-green-700 border-green-200";
                if (grade === "C" || grade === "C+") return "bg-yellow-50 text-yellow-700 border-yellow-200";
                if (grade === "D" || grade === "D+") return "bg-orange-50 text-orange-700 border-orange-200";
                return "bg-red-50 text-red-700 border-red-200";
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Funding Readiness</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-4xl font-light">{fr.overallScore}<span className="text-lg text-zinc-400">/100</span></p>
                        {fr.grade && (
                          <span className={`text-xs font-mono px-3 py-1 rounded border mt-2 inline-block ${gradeColor(fr.grade)}`}>
                            Grade: {fr.grade}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        {fr.readinessLevel && <p className="text-sm text-zinc-300">{fr.readinessLevel}</p>}
                        {fr.summary && <p className="text-lg text-white mt-1">{fr.summary}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Strengths */}
                  {fr.strengths?.length > 0 && (
                    <div>
                      <SectionHeader><CheckCircle2 className="w-3 h-3 text-green-600" /> Strengths</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-3">
                        {fr.strengths.map((s: string, i: number) => (
                          <div key={i} className="flex gap-2 items-start bg-green-50 border border-green-100 rounded-xl p-4">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-green-900">{s}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gaps table */}
                  {fr.gaps?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-amber-500" /> Gaps to Address</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left p-3 text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Area</th>
                              <th className="text-left p-3 text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Current</th>
                              <th className="text-left p-3 text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Needed</th>
                              <th className="text-left p-3 text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fr.gaps.map((gap: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="p-3 font-medium text-zinc-900">{gap.area}</td>
                                <td className="p-3 text-zinc-500">{gap.current}</td>
                                <td className="p-3 text-zinc-500">{gap.needed}</td>
                                <td className="p-3 text-zinc-700">{gap.action}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Pitch readiness scores */}
                  {fr.pitchReadiness && (
                    <div>
                      <SectionHeader><Presentation className="w-3 h-3" /> Pitch Readiness</SectionHeader>
                      <div className="grid md:grid-cols-3 gap-3">
                        {fr.pitchReadiness.map((pr, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm text-center">
                            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">{pr.section}</p>
                            <p className="text-2xl font-light text-zinc-900">{pr.score}<span className="text-sm text-zinc-400">/10</span></p>
                            {pr.feedback && <p className="text-[10px] text-zinc-500 mt-1">{pr.feedback}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested raise + valuation */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {fr.suggestedRaise && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Suggested Raise</p>
                        <p className="text-2xl font-light text-zinc-900">{fr.suggestedRaise}</p>
                      </div>
                    )}
                    {fr.valuationRange && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Valuation Range</p>
                        <p className="text-2xl font-light text-zinc-900">{fr.valuationRange}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 34: Market Sizing ─────────────────────────────────────── */}
            {activeTab === 34 && d.marketSizing && (() => {
              const ms = d.marketSizing!;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Market Sizing</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ms.summary}</p>
                    {ms.growthRate && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Annual Growth Rate</p>
                        <p className="text-xl font-light">{ms.growthRate}</p>
                      </div>
                    )}
                  </div>

                  {/* TAM / SAM / SOM funnel */}
                  <div className="space-y-4">
                    {[
                      { label: "TAM — Total Addressable Market", value: ms.tam, size: "text-4xl", pad: "p-8", border: "border-2 border-zinc-900" },
                      { label: "SAM — Serviceable Addressable Market", value: ms.sam, size: "text-3xl", pad: "p-6", border: "border border-zinc-300" },
                      { label: "SOM — Serviceable Obtainable Market", value: ms.som, size: "text-2xl", pad: "p-5", border: "border border-zinc-200" },
                    ].map((tier, i) => (
                      <div key={i} className={`bg-white ${tier.border} rounded-2xl ${tier.pad} shadow-sm text-center mx-auto`} style={{ maxWidth: `${100 - i * 15}%` }}>
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">{tier.label}</p>
                        <p className={`${tier.size} font-light text-zinc-900`}>{typeof tier.value === "object" ? tier.value.value : tier.value}</p>
                        {typeof tier.value === "object" && tier.value.methodology && <p className="text-xs text-zinc-500 mt-2">{tier.value.methodology}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Market trends */}
                  {ms.marketTrends?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3" /> Market Trends</SectionHeader>
                      <div className="space-y-2">
                        {ms.marketTrends.map((trend: string, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <span className="w-5 h-5 bg-zinc-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <p className="text-sm text-zinc-700">{trend}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Entry barriers */}
                  {ms.entryBarriers?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldAlert className="w-3 h-3" /> Entry Barriers</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-3">
                        {ms.entryBarriers.map((barrier: string, i: number) => (
                          <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <p className="text-sm text-amber-900">{barrier}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitive intensity */}
                  {ms.competitiveIntensity && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Competitive Intensity</p>
                      <p className="text-xl font-light text-zinc-900">{ms.competitiveIntensity}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 35: Scenario Planner ──────────────────────────────────── */}
            {activeTab === 35 && d.scenarioPlanner && (() => {
              const sp = d.scenarioPlanner!;
              const scenarioColors: Record<string, string> = {
                base: "bg-blue-50 text-blue-700 border-blue-200",
                best: "bg-green-50 text-green-700 border-green-200",
                worst: "bg-red-50 text-red-700 border-red-200",
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Scenario Planner</p>
                    </div>
                    <p className="text-lg leading-relaxed">{sp.summary}</p>
                    <div className="flex gap-3 mt-4">
                      {["base", "best", "worst"].map((s) => (
                        <span key={s} className={`text-[9px] font-mono px-3 py-1 rounded border ${scenarioColors[s]}`}>
                          {s} case
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Scenario cards */}
                  <div className="space-y-4">
                    {sp.scenarios.map((scenario: any, i: number) => {
                      const colorKey = scenario.type?.toLowerCase() || "base";
                      return (
                        <div key={i} className={`bg-white border rounded-2xl p-6 shadow-sm ${
                          colorKey === "best" ? "border-green-200" :
                          colorKey === "worst" ? "border-red-200" :
                          "border-blue-200"
                        }`}>
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${scenarioColors[colorKey] || scenarioColors.base}`}>
                                {scenario.type || "Base"} case
                              </span>
                              <p className="text-lg font-semibold text-zinc-900 mt-2">{scenario.title || scenario.name}</p>
                              {scenario.description && <p className="text-xs text-zinc-500 mt-1">{scenario.description}</p>}
                            </div>
                            {scenario.probability !== undefined && (
                              <div className="text-right shrink-0">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Probability</p>
                                <p className="text-xl font-light text-zinc-900">{scenario.probability}%</p>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3 mb-4">
                            {scenario.revenueImpact !== undefined && (
                              <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Revenue Impact</p>
                                <p className="text-lg font-light text-zinc-900">{scenario.revenueImpact}</p>
                              </div>
                            )}
                            {scenario.costImpact !== undefined && (
                              <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Cost Impact</p>
                                <p className="text-lg font-light text-zinc-900">{scenario.costImpact}</p>
                              </div>
                            )}
                            {scenario.netOutcome !== undefined && (
                              <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Net Outcome</p>
                                <p className="text-lg font-light text-zinc-900">{scenario.netOutcome}</p>
                              </div>
                            )}
                          </div>

                          {/* Triggers */}
                          {scenario.triggers?.length > 0 && (
                            <div className="mb-3">
                              <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Triggers</p>
                              <div className="flex flex-wrap gap-1">
                                {scenario.triggers.map((t: string, ti: number) => (
                                  <span key={ti} className="text-[9px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">{t}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          {scenario.actions?.length > 0 && (
                            <div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Recommended Actions</p>
                              <div className="space-y-1">
                                {scenario.actions.map((a: string, ai: number) => (
                                  <div key={ai} className="flex gap-2 items-start">
                                    <ArrowRight className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-zinc-700">{a}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Recommended strategy */}
                  {sp.recommendedStrategy && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><Target className="w-3 h-3" /> Recommended Strategy</SectionHeader>
                      <p className="text-sm text-zinc-700 leading-relaxed">{sp.recommendedStrategy}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 36: Operational Efficiency ────────────────────────────── */}
            {activeTab === 36 && d.operationalEfficiency && (() => {
              const oe = d.operationalEfficiency!;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Operational Efficiency</p>
                    </div>
                    <p className="text-lg leading-relaxed">{oe.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      <div>
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                        <p className="text-3xl font-light">{oe.overallScore}<span className="text-lg text-zinc-400">/100</span></p>
                      </div>
                      {oe.estimatedTotalSavings && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Estimated Total Savings</p>
                          <p className="text-xl font-light">{oe.estimatedTotalSavings}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrics cards with progress bars */}
                  {oe.metrics?.length > 0 && (
                    <div>
                      <SectionHeader><Gauge className="w-3 h-3" /> Efficiency Metrics</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {oe.metrics.map((m: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{m.name}</p>
                              <span className="text-[9px] font-mono bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">{m.category || "General"}</span>
                            </div>
                            <div className="flex items-center gap-4 mb-3">
                              <div className="text-center">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Current</p>
                                <p className="text-xl font-light text-zinc-900">{m.currentScore}</p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-zinc-300" />
                              <div className="text-center">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Benchmark</p>
                                <p className="text-xl font-light text-zinc-500">{m.industryBenchmark}</p>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden relative">
                              <div
                                className={`h-full rounded-full ${
                                  m.currentScore >= m.industryBenchmark ? "bg-green-500" :
                                  m.currentScore >= m.industryBenchmark * 0.7 ? "bg-amber-500" :
                                  "bg-red-500"
                                }`}
                                style={{ width: `${Math.min(100, (m.currentScore / (m.industryBenchmark || 1)) * 100)}%` }}
                              />
                              {/* Benchmark marker */}
                              <div className="absolute top-0 h-full w-0.5 bg-zinc-900" style={{ left: "100%" }} />
                            </div>
                            {m.insight && <p className="text-xs text-zinc-500 mt-2">{m.insight}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick wins */}
                  {oe.quickWins?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3 text-green-600" /> Quick Wins</SectionHeader>
                      <div className="space-y-2">
                        {oe.quickWins.map((qw: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-green-50 border border-green-100 rounded-xl p-4">
                            <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <div className="flex-1">
                              <p className="text-sm text-green-900 font-medium">{typeof qw === "string" ? qw : qw.action}</p>
                              {typeof qw !== "string" && qw.savings && <p className="text-xs text-green-700 mt-1">Estimated savings: {qw.savings}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Major initiatives */}
                  {oe.majorInitiatives?.length > 0 && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Major Initiatives</SectionHeader>
                      <div className="space-y-3">
                        {oe.majorInitiatives.map((mi: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof mi === "string" ? mi : mi.initiative}</p>
                                {typeof mi !== "string" && (
                                  <>
                                    {mi.timeline && <p className="text-xs text-zinc-500 mt-1">Timeline: {mi.timeline}</p>}
                                    {mi.impact && <p className="text-xs text-zinc-700 mt-1">Impact: {mi.impact}</p>}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 37: CLV Analysis ──────────────────────────────────────── */}
            {activeTab === 37 && d.clvAnalysis && (() => {
              const clv = d.clvAnalysis!;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Customer Lifetime Value Analysis</p>
                    </div>
                    <p className="text-lg leading-relaxed">{clv.summary}</p>
                  </div>

                  {/* Overall CLV + CAC ratio cards */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {clv.overallCLV && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Overall CLV</p>
                        <p className="text-3xl font-light text-zinc-900">{clv.overallCLV}</p>
                      </div>
                    )}
                    {clv.overallCACRatio != null && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">CLV:CAC Ratio</p>
                        <p className={`text-3xl font-light ${
                          clv.overallCACRatio >= 3 ? "text-green-700" :
                          clv.overallCACRatio >= 1 ? "text-amber-700" :
                          "text-red-700"
                        }`}>{clv.overallCACRatio}x</p>
                      </div>
                    )}
                  </div>

                  {/* Segment cards */}
                  {clv.segments?.length > 0 && (
                    <div>
                      <SectionHeader><PieChart className="w-3 h-3" /> Customer Segments</SectionHeader>
                      <div className="space-y-4">
                        {clv.segments.map((seg: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{seg.name}</p>
                              {seg.tier && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                  seg.tier === "high" || seg.tier === "premium" ? "bg-green-50 text-green-700 border-green-200" :
                                  seg.tier === "medium" || seg.tier === "standard" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                  "bg-zinc-50 text-zinc-600 border-zinc-200"
                                }`}>{seg.tier}</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                              {seg.clv !== undefined && (
                                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">CLV</p>
                                  <p className="text-lg font-light text-zinc-900">{seg.clv}</p>
                                </div>
                              )}
                              {seg.acquisitionCost !== undefined && (
                                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Acq. Cost</p>
                                  <p className="text-lg font-light text-zinc-900">{seg.acquisitionCost}</p>
                                </div>
                              )}
                              {seg.ratio !== undefined && (
                                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Ratio</p>
                                  <p className="text-lg font-light text-zinc-900">{seg.ratio}x</p>
                                </div>
                              )}
                              {seg.retentionRate !== undefined && (
                                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Retention</p>
                                  <p className="text-lg font-light text-zinc-900">{seg.retentionRate}%</p>
                                </div>
                              )}
                              {seg.avgLifespan !== undefined && (
                                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Lifespan</p>
                                  <p className="text-lg font-light text-zinc-900">{seg.avgLifespan}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* High value drivers */}
                  {clv.highValueDrivers?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3 text-green-600" /> High Value Drivers</SectionHeader>
                      <div className="space-y-2">
                        {clv.highValueDrivers.map((d: string, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-green-50 border border-green-100 rounded-xl p-4">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-green-900">{d}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Churn risk factors */}
                  {clv.churnRiskFactors?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Churn Risk Factors</SectionHeader>
                      <div className="space-y-2">
                        {clv.churnRiskFactors.map((r: string, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{r}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Optimization strategies */}
                  {clv.optimizationStrategies?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Optimization Strategies</SectionHeader>
                      <div className="space-y-3">
                        {clv.optimizationStrategies.map((s: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof s === "string" ? s : s.strategy}</p>
                                {typeof s !== "string" && s.impact && <p className="text-xs text-zinc-500 mt-1">Expected impact: {s.impact}</p>}
                                {typeof s !== "string" && s.effort && <p className="text-xs text-zinc-400 mt-0.5">Effort: {s.effort}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Floating Chat Buttons ──────────────────────────────────────────── */}
      <CoachChatButton
        orgId={job.questionnaire.orgId ?? "default-org"}
        runId={runId}
      />
      <AgentChatButton
        orgId={job.questionnaire.orgId ?? "default-org"}
        orgName={job.questionnaire.organizationName}
      />
    </div>
  );
}
