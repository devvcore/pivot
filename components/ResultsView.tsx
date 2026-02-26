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
  { id: 38, label: "Retention",       icon: ShieldCheck,  dataKey: "retentionPlaybook"     },
  { id: 39, label: "Attribution",     icon: BarChart3,    dataKey: "revenueAttribution"    },
  { id: 40, label: "Board Deck",      icon: Presentation, dataKey: "boardDeck"             },
  { id: 41, label: "Moat Analysis",   icon: Trophy,       dataKey: "competitiveMoat"       },
  { id: 42, label: "GTM Score",       icon: Target,       dataKey: "gtmScorecard"          },
  { id: 43, label: "Cash Optimize",   icon: DollarSign,   dataKey: "cashOptimization"      },
  { id: 44, label: "Talent Gaps",     icon: Users,        dataKey: "talentGapAnalysis"     },
  { id: 45, label: "Diversification", icon: PieChart,     dataKey: "revenueDiversification"},
  { id: 46, label: "Customer Journey",icon: GitBranch,    dataKey: "customerJourneyMap"    },
  { id: 47, label: "Compliance",      icon: ShieldCheck,  dataKey: "complianceChecklist"   },
  { id: 48, label: "Expansion",       icon: Target,       dataKey: "expansionPlaybook"     },
  { id: 49, label: "Vendors",         icon: DollarSign,   dataKey: "vendorScorecard"       },
  { id: 50, label: "PMF Score",       icon: Target,       dataKey: "productMarketFit"      },
  { id: 51, label: "Brand Health",    icon: Trophy,       dataKey: "brandHealth"           },
  { id: 52, label: "Price Elasticity",icon: DollarSign,   dataKey: "pricingElasticity"     },
  { id: 53, label: "Initiatives",     icon: Flag,         dataKey: "strategicInitiatives"  },
  { id: 54, label: "Cash Cycle",      icon: Calculator,   dataKey: "cashConversionCycle"   },
  { id: 55, label: "Innovation",      icon: Sparkles,     dataKey: "innovationPipeline"    },
  { id: 56, label: "Stakeholders",   icon: Users,        dataKey: "stakeholderMap"        },
  { id: 57, label: "Decision Log",   icon: ClipboardCheck, dataKey: "decisionLog"         },
  { id: 58, label: "Culture",        icon: Users,        dataKey: "cultureAssessment"     },
  { id: 59, label: "IP Portfolio",   icon: ShieldCheck,  dataKey: "ipPortfolio"           },
  { id: 60, label: "Exit Ready",     icon: Target,       dataKey: "exitReadiness"         },
  { id: 61, label: "Sustainability", icon: Globe,        dataKey: "sustainabilityScore"   },
  { id: 62, label: "Acquisitions",   icon: Target,       dataKey: "acquisitionTargets"    },
  { id: 63, label: "Fin. Ratios",    icon: Calculator,   dataKey: "financialRatios"       },
  { id: 64, label: "Channel Mix",    icon: BarChart3,    dataKey: "channelMixModel"       },
  { id: 65, label: "Supply Chain",   icon: GitBranch,    dataKey: "supplyChainRisk"       },
  { id: 66, label: "Regulatory",     icon: ShieldCheck,  dataKey: "regulatoryLandscape"   },
  { id: 67, label: "Crisis Plan",    icon: ShieldAlert,  dataKey: "crisisPlaybook"        },
  { id: 68, label: "AI Ready",       icon: Sparkles,     dataKey: "aiReadiness"           },
  { id: 69, label: "Network FX",     icon: Globe,        dataKey: "networkEffects"         },
  { id: 70, label: "Data Value",     icon: Server,       dataKey: "dataMonetization"       },
  { id: 71, label: "SaaS Metrics",   icon: LineChart,    dataKey: "subscriptionMetrics"    },
  { id: 72, label: "Mkt Timing",     icon: Calendar,     dataKey: "marketTiming"           },
  { id: 73, label: "Stress Test",    icon: Zap,          dataKey: "scenarioStressTest"     },
  { id: 74, label: "Price Matrix",   icon: DollarSign,   dataKey: "pricingStrategyMatrix" },
  { id: 75, label: "Cust Health",    icon: Users,        dataKey: "customerHealthScore"   },
  { id: 76, label: "Rev Waterfall",  icon: BarChart3,    dataKey: "revenueWaterfall"      },
  { id: 77, label: "Tech Debt",      icon: Server,       dataKey: "techDebtAssessment"    },
  { id: 78, label: "Team Perf",      icon: Users,        dataKey: "teamPerformance"       },
  { id: 79, label: "Market Entry",   icon: Globe,        dataKey: "marketEntryStrategy"   },
  { id: 80, label: "Comp Intel",     icon: Trophy,       dataKey: "competitiveIntelFeed"  },
  { id: 81, label: "Cash Sense",     icon: DollarSign,   dataKey: "cashFlowSensitivity"   },
  { id: 82, label: "Digital Score",  icon: Sparkles,     dataKey: "digitalMaturity"       },
  { id: 83, label: "Acq Funnel",     icon: Target,       dataKey: "acquisitionFunnel"     },
  { id: 84, label: "Alignment",      icon: Flag,         dataKey: "strategicAlignment"    },
  { id: 85, label: "Budget Opt",     icon: Calculator,   dataKey: "budgetOptimizer"       },
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

            {/* ── Tab 38: Retention Playbook ─────────────────────────────────── */}
            {activeTab === 38 && (d as any).retentionPlaybook && (() => {
              const rp = (d as any).retentionPlaybook;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Retention Playbook</p>
                    </div>
                    <p className="text-lg leading-relaxed">{rp.summary}</p>
                    {rp.overallRetentionRate != null && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Retention Rate</p>
                        <p className="text-3xl font-light">{rp.overallRetentionRate}%</p>
                      </div>
                    )}
                  </div>

                  {/* Strategy cards by segment */}
                  {rp.strategies?.length > 0 && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Retention Strategies</SectionHeader>
                      <div className="space-y-4">
                        {rp.strategies.map((s: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{s.segment || s.name}</p>
                              {s.churnRisk && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                  s.churnRisk === "high" ? "bg-red-50 text-red-700 border-red-200" :
                                  s.churnRisk === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  "bg-green-50 text-green-700 border-green-200"
                                }`}>{s.churnRisk} risk</span>
                              )}
                            </div>
                            {s.triggers?.length > 0 && (
                              <div className="mb-3">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Churn Triggers</p>
                                <div className="flex flex-wrap gap-1">
                                  {s.triggers.map((t: string, ti: number) => (
                                    <span key={ti} className="text-[9px] bg-red-50 text-red-700 px-2 py-0.5 rounded">{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {s.interventions?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Interventions</p>
                                <div className="space-y-1">
                                  {s.interventions.map((iv: string, ivi: number) => (
                                    <div key={ivi} className="flex gap-2 items-start">
                                      <ArrowRight className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                                      <p className="text-xs text-zinc-700">{iv}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Engagement metrics table */}
                  {rp.engagementMetrics?.length > 0 && (
                    <div>
                      <SectionHeader><Gauge className="w-3 h-3" /> Engagement Metrics</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Metric</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Current</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Target</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rp.engagementMetrics.map((m: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{m.metric || m.name}</td>
                                <td className="px-4 py-3 text-zinc-700">{m.current}</td>
                                <td className="px-4 py-3 text-zinc-500">{m.target}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                                    m.status === "good" || m.status === "on-track" ? "bg-green-50 text-green-700" :
                                    m.status === "warning" || m.status === "at-risk" ? "bg-amber-50 text-amber-700" :
                                    "bg-zinc-50 text-zinc-600"
                                  }`}>{m.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Quick wins */}
                  {rp.quickWins?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3 text-green-600" /> Quick Wins</SectionHeader>
                      <div className="space-y-2">
                        {rp.quickWins.map((qw: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-green-50 border border-green-100 rounded-xl p-4">
                            <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <p className="text-sm text-green-900 font-medium">{typeof qw === "string" ? qw : qw.action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 39: Revenue Attribution ────────────────────────────────── */}
            {activeTab === 39 && (d as any).revenueAttribution && (() => {
              const ra = (d as any).revenueAttribution;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Revenue Attribution</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ra.summary}</p>
                  </div>

                  {/* Channel cards */}
                  {ra.channels?.length > 0 && (
                    <div>
                      <SectionHeader><PieChart className="w-3 h-3" /> Channel Attribution</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {ra.channels.map((ch: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{ch.name || ch.channel}</p>
                              {ch.trend && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                  ch.trend === "growing" ? "bg-green-50 text-green-700 border-green-200" :
                                  ch.trend === "stable" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                  "bg-red-50 text-red-700 border-red-200"
                                }`}>{ch.trend}</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {ch.contribution != null && (
                                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Contribution</p>
                                  <p className="text-lg font-light text-zinc-900">{ch.contribution}%</p>
                                </div>
                              )}
                              {ch.revenue != null && (
                                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Revenue</p>
                                  <p className="text-lg font-light text-zinc-900">{ch.revenue}</p>
                                </div>
                              )}
                              {ch.cost != null && (
                                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Cost</p>
                                  <p className="text-lg font-light text-zinc-900">{ch.cost}</p>
                                </div>
                              )}
                              {ch.roi != null && (
                                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">ROI</p>
                                  <p className={`text-lg font-light ${
                                    parseFloat(String(ch.roi)) > 0 ? "text-green-700" : "text-red-700"
                                  }`}>{ch.roi}x</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top performers */}
                  {ra.topPerformers?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3 text-green-600" /> Top Performers</SectionHeader>
                      <div className="space-y-2">
                        {ra.topPerformers.map((tp: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-green-50 border border-green-100 rounded-xl p-4">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-green-900">{typeof tp === "string" ? tp : tp.channel || tp.name}: {typeof tp !== "string" && tp.reason ? tp.reason : ""}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Under performers */}
                  {ra.underPerformers?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Under Performers</SectionHeader>
                      <div className="space-y-2">
                        {ra.underPerformers.map((up: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof up === "string" ? up : up.channel || up.name}: {typeof up !== "string" && up.reason ? up.reason : ""}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 40: Board Deck ─────────────────────────────────────────── */}
            {activeTab === 40 && (d as any).boardDeck && (() => {
              const bd = (d as any).boardDeck;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Presentation className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Board Deck</p>
                    </div>
                    {bd.period && <p className="text-sm text-zinc-400 mb-2">Period: {bd.period}</p>}
                    <p className="text-lg leading-relaxed">{bd.summary}</p>
                  </div>

                  {/* Highlights */}
                  {bd.highlights?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3 text-green-600" /> Key Highlights</SectionHeader>
                      <div className="space-y-2">
                        {bd.highlights.map((h: string, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-green-50 border border-green-100 rounded-xl p-4">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-green-900">{h}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial overview table */}
                  {bd.financialOverview?.length > 0 && (
                    <div>
                      <SectionHeader><DollarSign className="w-3 h-3" /> Financial Overview</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Metric</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Value</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Change</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bd.financialOverview.map((f: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{f.metric}</td>
                                <td className="px-4 py-3 text-zinc-700">{f.value}</td>
                                <td className="px-4 py-3">
                                  <span className={
                                    String(f.change).startsWith("+") || String(f.change).startsWith("up") ? "text-green-700" :
                                    String(f.change).startsWith("-") || String(f.change).startsWith("down") ? "text-red-700" :
                                    "text-zinc-500"
                                  }>
                                    {String(f.change).startsWith("+") ? "\u2191 " : String(f.change).startsWith("-") ? "\u2193 " : ""}{f.change}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {f.status && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                                      f.status === "good" || f.status === "positive" ? "bg-green-50 text-green-700" :
                                      f.status === "warning" || f.status === "caution" ? "bg-amber-50 text-amber-700" :
                                      f.status === "critical" || f.status === "negative" ? "bg-red-50 text-red-700" :
                                      "bg-zinc-50 text-zinc-600"
                                    }`}>{f.status}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Key metrics with status badges */}
                  {bd.keyMetrics?.length > 0 && (
                    <div>
                      <SectionHeader><Gauge className="w-3 h-3" /> Key Metrics</SectionHeader>
                      <div className="grid md:grid-cols-3 gap-4">
                        {bd.keyMetrics.map((km: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm text-center">
                            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">{km.metric || km.name}</p>
                            <p className="text-2xl font-light text-zinc-900 mb-1">{km.value}</p>
                            {km.status && (
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                                km.status === "good" || km.status === "on-track" ? "bg-green-50 text-green-700" :
                                km.status === "warning" ? "bg-amber-50 text-amber-700" :
                                km.status === "critical" ? "bg-red-50 text-red-700" :
                                "bg-zinc-50 text-zinc-600"
                              }`}>{km.status}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strategic updates */}
                  {bd.strategicUpdates?.length > 0 && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Strategic Updates</SectionHeader>
                      <div className="space-y-3">
                        {bd.strategicUpdates.map((su: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <p className="font-semibold text-zinc-900">{typeof su === "string" ? su : su.title || su.update}</p>
                            {typeof su !== "string" && su.detail && <p className="text-xs text-zinc-500 mt-1">{su.detail}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risks */}
                  {bd.risks?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldAlert className="w-3 h-3 text-red-500" /> Key Risks</SectionHeader>
                      <div className="space-y-2">
                        {bd.risks.map((r: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof r === "string" ? r : r.risk || r.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Asks */}
                  {bd.asks?.length > 0 && (
                    <div>
                      <SectionHeader><Flag className="w-3 h-3" /> Board Asks</SectionHeader>
                      <div className="space-y-3">
                        {bd.asks.map((a: any, i: number) => (
                          <div key={i} className="bg-white border-2 border-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof a === "string" ? a : a.ask || a.request}</p>
                                {typeof a !== "string" && a.rationale && <p className="text-xs text-zinc-500 mt-1">{a.rationale}</p>}
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

            {/* ── Tab 41: Competitive Moat ───────────────────────────────────── */}
            {activeTab === 41 && (d as any).competitiveMoat && (() => {
              const moat = (d as any).competitiveMoat;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Competitive Moat Analysis</p>
                    </div>
                    <p className="text-lg leading-relaxed">{moat.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {moat.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Moat Score</p>
                          <p className="text-3xl font-light">
                            {moat.overallScore}<span className="text-lg text-zinc-400">/10</span>
                          </p>
                        </div>
                      )}
                      {moat.moatType && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Moat Type</p>
                          <p className="text-xl font-light">{moat.moatType}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dimension cards */}
                  {moat.dimensions?.length > 0 && (
                    <div>
                      <SectionHeader><Gauge className="w-3 h-3" /> Moat Dimensions</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {moat.dimensions.map((dim: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{dim.name || dim.dimension}</p>
                              <span className="text-sm font-mono text-zinc-500">{dim.score}/10</span>
                            </div>
                            {/* Score bar */}
                            <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden mb-2">
                              <div
                                className={`h-full rounded-full ${
                                  dim.score >= 7 ? "bg-green-500" :
                                  dim.score >= 4 ? "bg-amber-500" :
                                  "bg-red-500"
                                }`}
                                style={{ width: `${(dim.score / 10) * 100}%` }}
                              />
                            </div>
                            {dim.description && <p className="text-xs text-zinc-500">{dim.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vulnerabilities */}
                  {moat.vulnerabilities?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Vulnerabilities</SectionHeader>
                      <div className="space-y-2">
                        {moat.vulnerabilities.map((v: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof v === "string" ? v : v.vulnerability || v.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reinforcement recommendations */}
                  {moat.reinforcements?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldCheck className="w-3 h-3 text-green-600" /> Reinforcement Recommendations</SectionHeader>
                      <div className="space-y-3">
                        {moat.reinforcements.map((r: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-green-600 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof r === "string" ? r : r.recommendation || r.action}</p>
                                {typeof r !== "string" && r.impact && <p className="text-xs text-zinc-500 mt-1">Impact: {r.impact}</p>}
                                {typeof r !== "string" && r.timeline && <p className="text-xs text-zinc-400 mt-0.5">Timeline: {r.timeline}</p>}
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

            {/* ── Tab 42: GTM Scorecard ──────────────────────────────────────── */}
            {activeTab === 42 && (d as any).gtmScorecard && (() => {
              const gtm = (d as any).gtmScorecard;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">GTM Scorecard</p>
                    </div>
                    <p className="text-lg leading-relaxed">{gtm.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {gtm.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-3xl font-light">{gtm.overallScore}<span className="text-lg text-zinc-400">/100</span></p>
                        </div>
                      )}
                      {gtm.grade && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Grade</p>
                          <p className="text-3xl font-light">{gtm.grade}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dimension cards */}
                  {gtm.dimensions?.length > 0 && (
                    <div>
                      <SectionHeader><Gauge className="w-3 h-3" /> GTM Dimensions</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {gtm.dimensions.map((dim: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{dim.name || dim.dimension}</p>
                              {dim.status && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                  dim.status === "strong" ? "bg-green-50 text-green-700 border-green-200" :
                                  dim.status === "developing" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  "bg-red-50 text-red-700 border-red-200"
                                }`}>{dim.status}</span>
                              )}
                            </div>
                            {dim.score != null && (
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex-1 h-3 bg-zinc-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      dim.status === "strong" ? "bg-green-500" :
                                      dim.status === "developing" ? "bg-amber-500" :
                                      "bg-red-500"
                                    }`}
                                    style={{ width: `${Math.min(100, dim.score)}%` }}
                                  />
                                </div>
                                <span className="text-sm font-mono text-zinc-500 w-12 text-right">{dim.score}</span>
                              </div>
                            )}
                            {dim.description && <p className="text-xs text-zinc-500">{dim.description}</p>}
                            {dim.insight && <p className="text-xs text-zinc-500">{dim.insight}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prioritized actions */}
                  {gtm.prioritizedActions?.length > 0 && (
                    <div>
                      <SectionHeader><Flag className="w-3 h-3" /> Prioritized Actions</SectionHeader>
                      <div className="space-y-3">
                        {gtm.prioritizedActions.map((a: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof a === "string" ? a : a.action || a.title}</p>
                                {typeof a !== "string" && a.impact && <p className="text-xs text-zinc-500 mt-1">Impact: {a.impact}</p>}
                                {typeof a !== "string" && a.effort && <p className="text-xs text-zinc-400 mt-0.5">Effort: {a.effort}</p>}
                                {typeof a !== "string" && a.timeline && <p className="text-xs text-zinc-400 mt-0.5">Timeline: {a.timeline}</p>}
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

            {/* ── Tab 43: Cash Optimization ──────────────────────────────────── */}
            {activeTab === 43 && (d as any).cashOptimization && (() => {
              const co = (d as any).cashOptimization;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Cash Optimization</p>
                    </div>
                    <p className="text-lg leading-relaxed">{co.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {co.currentBurnRate && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Current Burn Rate</p>
                          <p className="text-xl font-light">{co.currentBurnRate}</p>
                        </div>
                      )}
                      {co.optimizedBurnRate && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Optimized Burn Rate</p>
                          <p className="text-xl font-light text-green-400">{co.optimizedBurnRate}</p>
                        </div>
                      )}
                      {co.potentialSavings && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Potential Savings</p>
                          <p className="text-xl font-light text-green-400">{co.potentialSavings}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recommendations table */}
                  {co.recommendations?.length > 0 && (
                    <div>
                      <SectionHeader><Calculator className="w-3 h-3" /> Optimization Recommendations</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Area</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Current</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Optimized</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Saving</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Effort</th>
                            </tr>
                          </thead>
                          <tbody>
                            {co.recommendations.map((r: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{r.area || r.name}</td>
                                <td className="px-4 py-3 text-zinc-700">{r.current}</td>
                                <td className="px-4 py-3 text-green-700">{r.optimized}</td>
                                <td className="px-4 py-3 text-green-700 font-medium">{r.saving}</td>
                                <td className="px-4 py-3">
                                  {r.effort && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                                      r.effort === "low" ? "bg-green-50 text-green-700" :
                                      r.effort === "medium" ? "bg-amber-50 text-amber-700" :
                                      "bg-red-50 text-red-700"
                                    }`}>{r.effort}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Quick wins */}
                  {co.quickWins?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3 text-green-600" /> Quick Wins</SectionHeader>
                      <div className="space-y-2">
                        {co.quickWins.map((qw: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-green-50 border border-green-100 rounded-xl p-4">
                            <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <p className="text-sm text-green-900 font-medium">{typeof qw === "string" ? qw : qw.action || qw.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Revenue acceleration */}
                  {co.revenueAcceleration?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3" /> Revenue Acceleration</SectionHeader>
                      <div className="space-y-3">
                        {co.revenueAcceleration.map((ra: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof ra === "string" ? ra : ra.initiative || ra.action}</p>
                                {typeof ra !== "string" && ra.impact && <p className="text-xs text-zinc-500 mt-1">Impact: {ra.impact}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extended runway */}
                  {co.extendedRunway && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Extended Runway</p>
                      <p className="text-3xl font-light text-zinc-900">{co.extendedRunway}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 44: Talent Gap Analysis ─────────────────────────────────── */}
            {activeTab === 44 && (d as any).talentGapAnalysis && (() => {
              const tga = (d as any).talentGapAnalysis;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Talent Gap Analysis</p>
                    </div>
                    <p className="text-lg leading-relaxed">{tga.summary}</p>
                  </div>

                  {/* Skill gaps table */}
                  {tga.skillGaps?.length > 0 && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Skill Gaps</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Skill</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Current</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Required</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Priority</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Recommendation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tga.skillGaps.map((sg: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{sg.skill || sg.name}</td>
                                <td className="px-4 py-3 text-zinc-700">{sg.current || sg.currentLevel}</td>
                                <td className="px-4 py-3 text-zinc-700">{sg.required || sg.requiredLevel}</td>
                                <td className="px-4 py-3">
                                  {sg.priority && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                      sg.priority === "high" || sg.priority === "High" ? "bg-red-50 text-red-700 border-red-200" :
                                      sg.priority === "medium" || sg.priority === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                      "bg-blue-50 text-blue-700 border-blue-200"
                                    }`}>{sg.priority}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-500">{sg.recommendation}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Role recommendations */}
                  {tga.roleRecommendations?.length > 0 && (
                    <div>
                      <SectionHeader><UserPlus className="w-3 h-3" /> Role Recommendations</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {tga.roleRecommendations.map((role: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{role.title}</p>
                              {role.urgency && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                  role.urgency === "immediate" || role.urgency === "high" ? "bg-red-50 text-red-700 border-red-200" :
                                  role.urgency === "short-term" || role.urgency === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  "bg-blue-50 text-blue-700 border-blue-200"
                                }`}>{role.urgency}</span>
                              )}
                            </div>
                            {role.department && <p className="text-[9px] font-mono text-zinc-400 uppercase mb-2">{role.department}</p>}
                            {role.salaryRange && <p className="text-xs text-zinc-500 mb-1">Salary: {role.salaryRange}</p>}
                            {role.rationale && <p className="text-xs text-zinc-500 mb-1">{role.rationale}</p>}
                            {role.impact && <p className="text-xs text-green-700 font-medium">Impact: {role.impact}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Training recommendations */}
                  {tga.trainingRecommendations?.length > 0 && (
                    <div>
                      <SectionHeader><BookOpen className="w-3 h-3" /> Training Recommendations</SectionHeader>
                      <div className="space-y-2">
                        {tga.trainingRecommendations.map((tr: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <span className="w-5 h-5 bg-zinc-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-zinc-900">{typeof tr === "string" ? tr : tr.program || tr.title || tr.recommendation}</p>
                              {typeof tr !== "string" && tr.description && <p className="text-xs text-zinc-500 mt-1">{tr.description}</p>}
                              {typeof tr !== "string" && tr.duration && <p className="text-xs text-zinc-400 mt-0.5">Duration: {tr.duration}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 45: Revenue Diversification ─────────────────────────────── */}
            {activeTab === 45 && (d as any).revenueDiversification && (() => {
              const rd = (d as any).revenueDiversification;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Revenue Diversification</p>
                    </div>
                    <p className="text-lg leading-relaxed">{rd.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {rd.concentrationRisk && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Concentration Risk</p>
                          <span className={`text-sm font-mono px-3 py-1 rounded ${
                            rd.concentrationRisk === "high" || rd.concentrationRisk === "High" ? "bg-red-500/20 text-red-300" :
                            rd.concentrationRisk === "medium" || rd.concentrationRisk === "Medium" ? "bg-amber-500/20 text-amber-300" :
                            "bg-green-500/20 text-green-300"
                          }`}>{rd.concentrationRisk}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Current revenue streams table */}
                  {rd.currentStreams?.length > 0 && (
                    <div>
                      <SectionHeader><DollarSign className="w-3 h-3" /> Current Revenue Streams</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Stream</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Revenue</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Share</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Growth</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Risk</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rd.currentStreams.map((s: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{s.name || s.stream}</td>
                                <td className="px-4 py-3 text-zinc-700">{s.revenue}</td>
                                <td className="px-4 py-3 text-zinc-700">{s.share || s.percentage}</td>
                                <td className="px-4 py-3">
                                  <span className={
                                    String(s.growth).startsWith("+") || String(s.growth).startsWith("up") ? "text-green-700" :
                                    String(s.growth).startsWith("-") || String(s.growth).startsWith("down") ? "text-red-700" :
                                    "text-zinc-500"
                                  }>{s.growth}</span>
                                </td>
                                <td className="px-4 py-3">
                                  {s.risk && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                      s.risk === "high" || s.risk === "High" ? "bg-red-50 text-red-700 border-red-200" :
                                      s.risk === "medium" || s.risk === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                      "bg-green-50 text-green-700 border-green-200"
                                    }`}>{s.risk}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Diversification opportunities */}
                  {rd.opportunities?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3" /> Diversification Opportunities</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {rd.opportunities.map((opp: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <p className="text-sm font-semibold text-zinc-900 mb-2">{opp.stream || opp.name || opp.opportunity}</p>
                            {opp.estimatedRevenue && <p className="text-xs text-zinc-500 mb-1">Est. Revenue: <span className="font-medium text-green-700">{opp.estimatedRevenue}</span></p>}
                            {opp.timeToRevenue && <p className="text-xs text-zinc-500 mb-1">Time to Revenue: {opp.timeToRevenue}</p>}
                            {opp.investment && <p className="text-xs text-zinc-500 mb-1">Investment: {opp.investment}</p>}
                            {opp.feasibility && (
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                opp.feasibility === "high" || opp.feasibility === "High" ? "bg-green-50 text-green-700 border-green-200" :
                                opp.feasibility === "medium" || opp.feasibility === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-red-50 text-red-700 border-red-200"
                              }`}>Feasibility: {opp.feasibility}</span>
                            )}
                            {opp.rationale && <p className="text-xs text-zinc-500 mt-2">{opp.rationale}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Target mix */}
                  {rd.targetMix && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Target Revenue Mix</p>
                      <p className="text-xl font-light text-zinc-900">{typeof rd.targetMix === "string" ? rd.targetMix : JSON.stringify(rd.targetMix)}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 46: Customer Journey Map ────────────────────────────────── */}
            {activeTab === 46 && (d as any).customerJourneyMap && (() => {
              const cjm = (d as any).customerJourneyMap;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <GitBranch className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Customer Journey Map</p>
                    </div>
                    <p className="text-lg leading-relaxed">{cjm.summary}</p>
                  </div>

                  {/* Journey stages as horizontal flow */}
                  {cjm.stages?.length > 0 && (
                    <div>
                      <SectionHeader><ArrowRight className="w-3 h-3" /> Journey Stages</SectionHeader>
                      <div className="flex flex-col md:flex-row gap-3 overflow-x-auto pb-2">
                        {cjm.stages.map((stage: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 flex-shrink-0">
                            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm min-w-[220px]">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                                <p className="text-sm font-semibold text-zinc-900">{stage.name || stage.stage}</p>
                              </div>
                              {stage.description && <p className="text-xs text-zinc-500 mb-2">{stage.description}</p>}
                              {stage.touchpoints?.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Touchpoints</p>
                                  <div className="flex flex-wrap gap-1">
                                    {stage.touchpoints.map((tp: any, j: number) => (
                                      <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{typeof tp === "string" ? tp : tp.name}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {stage.frictionPoints?.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Friction Points</p>
                                  <div className="flex flex-wrap gap-1">
                                    {stage.frictionPoints.map((fp: any, j: number) => (
                                      <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{typeof fp === "string" ? fp : fp.name || fp.description}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {stage.conversionRate && (
                                <p className="text-xs text-zinc-500">Conversion: <span className="font-medium text-zinc-900">{stage.conversionRate}</span></p>
                              )}
                              {stage.improvements?.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Improvements</p>
                                  {stage.improvements.map((imp: any, j: number) => (
                                    <p key={j} className="text-xs text-green-700">{typeof imp === "string" ? imp : imp.action || imp.description}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                            {i < cjm.stages.length - 1 && (
                              <ChevronRight className="w-5 h-5 text-zinc-300 shrink-0 hidden md:block" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Critical friction points */}
                  {cjm.criticalFrictionPoints?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Critical Friction Points</SectionHeader>
                      <div className="space-y-2">
                        {cjm.criticalFrictionPoints.map((fp: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-200 rounded-xl p-4">
                            <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-900">{typeof fp === "string" ? fp : fp.point || fp.description || fp.name}</p>
                              {typeof fp !== "string" && fp.impact && <p className="text-xs text-red-700 mt-1">Impact: {fp.impact}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick wins */}
                  {cjm.quickWins?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3 text-green-600" /> Quick Wins</SectionHeader>
                      <div className="space-y-2">
                        {cjm.quickWins.map((qw: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-green-50 border border-green-200 rounded-xl p-4">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-green-900">{typeof qw === "string" ? qw : qw.action || qw.description || qw.name}</p>
                              {typeof qw !== "string" && qw.impact && <p className="text-xs text-green-700 mt-1">Impact: {qw.impact}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 47: Compliance Checklist ─────────────────────────────────── */}
            {activeTab === 47 && (d as any).complianceChecklist && (() => {
              const cc = (d as any).complianceChecklist;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Compliance Checklist</p>
                    </div>
                    <p className="text-lg leading-relaxed">{cc.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {cc.readinessLevel && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Readiness</p>
                          <span className={`text-sm font-mono px-3 py-1 rounded ${
                            cc.readinessLevel === "high" || cc.readinessLevel === "High" || cc.readinessLevel === "strong" ? "bg-green-500/20 text-green-300" :
                            cc.readinessLevel === "medium" || cc.readinessLevel === "Medium" || cc.readinessLevel === "moderate" ? "bg-amber-500/20 text-amber-300" :
                            "bg-red-500/20 text-red-300"
                          }`}>{cc.readinessLevel}</span>
                        </div>
                      )}
                      {cc.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Compliance Score</p>
                          <p className="text-3xl font-light">{cc.overallScore}<span className="text-lg text-zinc-400">%</span></p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Compliance items table */}
                  {cc.items?.length > 0 && (
                    <div>
                      <SectionHeader><ClipboardCheck className="w-3 h-3" /> Compliance Items</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Item</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Category</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Status</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cc.items.map((item: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{item.name || item.item || item.requirement}</td>
                                <td className="px-4 py-3 text-zinc-700">{item.category || item.framework}</td>
                                <td className="px-4 py-3">
                                  {item.status && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                      item.status === "compliant" || item.status === "Compliant" ? "bg-green-50 text-green-700 border-green-200" :
                                      item.status === "partial" || item.status === "Partial" || item.status === "partially_compliant" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                      item.status === "non_compliant" || item.status === "Non-Compliant" || item.status === "non-compliant" ? "bg-red-50 text-red-700 border-red-200" :
                                      "bg-zinc-50 text-zinc-600 border-zinc-200"
                                    }`}>{item.status}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-500">{item.notes || item.detail || item.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Immediate actions */}
                  {cc.immediateActions?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Immediate Actions</SectionHeader>
                      <div className="space-y-2">
                        {cc.immediateActions.map((a: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <span className="w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                            <p className="text-sm text-red-900 font-medium">{typeof a === "string" ? a : a.action || a.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming deadlines */}
                  {cc.upcomingDeadlines?.length > 0 && (
                    <div>
                      <SectionHeader><Calendar className="w-3 h-3" /> Upcoming Deadlines</SectionHeader>
                      <div className="space-y-3">
                        {cc.upcomingDeadlines.map((dl: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-amber-500 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof dl === "string" ? dl : dl.requirement || dl.name || dl.deadline}</p>
                                {typeof dl !== "string" && dl.date && <p className="text-xs text-amber-700 mt-1">Due: {dl.date}</p>}
                                {typeof dl !== "string" && dl.description && <p className="text-xs text-zinc-500 mt-0.5">{dl.description}</p>}
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

            {/* ── Tab 48: Expansion Playbook ───────────────────────────────────── */}
            {activeTab === 48 && (d as any).expansionPlaybook && (() => {
              const ep = (d as any).expansionPlaybook;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Expansion Playbook</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ep.summary}</p>
                    {ep.currentPosition && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Current Position</p>
                        <p className="text-xl font-light">{ep.currentPosition}</p>
                      </div>
                    )}
                  </div>

                  {/* Expansion markets */}
                  {ep.markets?.length > 0 && (
                    <div>
                      <SectionHeader><Globe className="w-3 h-3" /> Expansion Markets</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {ep.markets.map((mkt: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <p className="text-sm font-semibold text-zinc-900 mb-3">{mkt.name || mkt.market}</p>
                            {mkt.attractiveness != null && (
                              <div className="mb-2">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Attractiveness</p>
                                  <span className="text-xs font-mono text-zinc-500">{mkt.attractiveness}/10</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${mkt.attractiveness >= 7 ? "bg-green-500" : mkt.attractiveness >= 4 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${(mkt.attractiveness / 10) * 100}%` }} />
                                </div>
                              </div>
                            )}
                            {mkt.readiness != null && (
                              <div className="mb-2">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Readiness</p>
                                  <span className="text-xs font-mono text-zinc-500">{mkt.readiness}/10</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${mkt.readiness >= 7 ? "bg-green-500" : mkt.readiness >= 4 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${(mkt.readiness / 10) * 100}%` }} />
                                </div>
                              </div>
                            )}
                            {mkt.estimatedRevenue && <p className="text-xs text-zinc-500 mb-1">Est. Revenue: <span className="font-medium text-green-700">{mkt.estimatedRevenue}</span></p>}
                            {mkt.timeToEntry && <p className="text-xs text-zinc-500 mb-1">Time to Entry: {mkt.timeToEntry}</p>}
                            {mkt.keyBarriers?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Key Barriers</p>
                                <div className="flex flex-wrap gap-1">
                                  {mkt.keyBarriers.map((b: any, j: number) => (
                                    <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{typeof b === "string" ? b : b.name || b.barrier}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {mkt.entryStrategy && <p className="text-xs text-zinc-500">Strategy: {mkt.entryStrategy}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prioritized sequence */}
                  {ep.prioritizedSequence?.length > 0 && (
                    <div>
                      <SectionHeader><Flag className="w-3 h-3" /> Prioritized Expansion Sequence</SectionHeader>
                      <div className="space-y-3">
                        {ep.prioritizedSequence.map((step: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof step === "string" ? step : step.market || step.name || step.action}</p>
                                {typeof step !== "string" && step.rationale && <p className="text-xs text-zinc-500 mt-1">{step.rationale}</p>}
                                {typeof step !== "string" && step.timeline && <p className="text-xs text-zinc-400 mt-0.5">Timeline: {step.timeline}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risk factors */}
                  {ep.riskFactors?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldAlert className="w-3 h-3 text-red-500" /> Risk Factors</SectionHeader>
                      <div className="space-y-2">
                        {ep.riskFactors.map((rf: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof rf === "string" ? rf : rf.risk || rf.factor || rf.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 49: Vendor Scorecard ─────────────────────────────────────── */}
            {activeTab === 49 && (d as any).vendorScorecard && (() => {
              const vs = (d as any).vendorScorecard;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Vendor Scorecard</p>
                    </div>
                    <p className="text-lg leading-relaxed">{vs.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {vs.totalSpend && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Total Spend</p>
                          <p className="text-xl font-light">{vs.totalSpend}</p>
                        </div>
                      )}
                      {vs.vendorCount != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Vendor Count</p>
                          <p className="text-xl font-light">{vs.vendorCount}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vendor assessments table */}
                  {vs.assessments?.length > 0 && (
                    <div>
                      <SectionHeader><ClipboardCheck className="w-3 h-3" /> Vendor Assessments</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Vendor</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Category</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Cost</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Satisfaction</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Recommendation</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Potential Saving</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vs.assessments.map((v: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{v.vendor || v.name}</td>
                                <td className="px-4 py-3 text-zinc-700">{v.category}</td>
                                <td className="px-4 py-3 text-zinc-700">{v.cost || v.annualCost}</td>
                                <td className="px-4 py-3 text-zinc-700">{v.satisfaction}</td>
                                <td className="px-4 py-3">
                                  {v.recommendation && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                      v.recommendation === "keep" || v.recommendation === "Keep" ? "bg-green-50 text-green-700 border-green-200" :
                                      v.recommendation === "renegotiate" || v.recommendation === "Renegotiate" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                      v.recommendation === "replace" || v.recommendation === "Replace" ? "bg-red-50 text-red-700 border-red-200" :
                                      "bg-zinc-50 text-zinc-600 border-zinc-200"
                                    }`}>{v.recommendation}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-green-700 font-medium">{v.potentialSaving || v.saving}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Consolidation opportunities */}
                  {vs.consolidationOpportunities?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3" /> Consolidation Opportunities</SectionHeader>
                      <div className="space-y-3">
                        {vs.consolidationOpportunities.map((co: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof co === "string" ? co : co.opportunity || co.description || co.name}</p>
                                {typeof co !== "string" && co.saving && <p className="text-xs text-green-700 mt-1">Potential Saving: {co.saving}</p>}
                                {typeof co !== "string" && co.vendors && <p className="text-xs text-zinc-500 mt-0.5">Vendors: {Array.isArray(co.vendors) ? co.vendors.join(", ") : co.vendors}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Renegotiation targets */}
                  {vs.renegotiationTargets?.length > 0 && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3 text-amber-500" /> Renegotiation Targets</SectionHeader>
                      <div className="space-y-2">
                        {vs.renegotiationTargets.map((rt: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <DollarSign className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-amber-900">{typeof rt === "string" ? rt : rt.vendor || rt.name}</p>
                              {typeof rt !== "string" && rt.currentCost && <p className="text-xs text-amber-700 mt-1">Current: {rt.currentCost}</p>}
                              {typeof rt !== "string" && rt.targetCost && <p className="text-xs text-green-700">Target: {rt.targetCost}</p>}
                              {typeof rt !== "string" && rt.strategy && <p className="text-xs text-zinc-500 mt-0.5">{rt.strategy}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total potential savings callout */}
                  {vs.totalPotentialSavings && (
                    <div className="bg-white border-2 border-green-600 rounded-2xl p-6 shadow-sm text-center">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Total Potential Savings</p>
                      <p className="text-3xl font-light text-green-700">{vs.totalPotentialSavings}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 50: PMF Score ──────────────────────────────────────────────── */}
            {activeTab === 50 && (d as any).productMarketFit && (() => {
              const pmf = (d as any).productMarketFit;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Product-Market Fit</p>
                    </div>
                    <p className="text-lg leading-relaxed">{pmf.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {pmf.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-3xl font-light">{pmf.overallScore}<span className="text-base text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {pmf.grade && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Grade</p>
                          <span className={`inline-block mt-1 text-lg font-bold px-3 py-1 rounded-lg ${
                            pmf.grade === "A" ? "bg-emerald-900/40 text-emerald-300" :
                            pmf.grade === "B" ? "bg-green-900/40 text-green-300" :
                            pmf.grade === "C" ? "bg-yellow-900/40 text-yellow-300" :
                            pmf.grade === "D" ? "bg-orange-900/40 text-orange-300" :
                            "bg-red-900/40 text-red-300"
                          }`}>{pmf.grade}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PMF Indicators table */}
                  {pmf.indicators?.length > 0 && (
                    <div>
                      <SectionHeader><Crosshair className="w-3 h-3" /> PMF Indicators</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Indicator</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Status</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Evidence</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Weight</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pmf.indicators.map((ind: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{ind.indicator || ind.name}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                    ind.status === "strong" || ind.status === "Strong" ? "bg-green-50 text-green-700 border-green-200" :
                                    ind.status === "moderate" || ind.status === "Moderate" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    ind.status === "weak" || ind.status === "Weak" ? "bg-red-50 text-red-700 border-red-200" :
                                    "bg-zinc-50 text-zinc-600 border-zinc-200"
                                  }`}>{ind.status}</span>
                                </td>
                                <td className="px-4 py-3 text-zinc-700">{ind.evidence}</td>
                                <td className="px-4 py-3 text-zinc-500">{ind.weight}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Key strengths */}
                  {pmf.keyStrengths?.length > 0 && (
                    <div>
                      <SectionHeader><CheckCircle2 className="w-3 h-3 text-green-500" /> Key Strengths</SectionHeader>
                      <div className="space-y-2">
                        {pmf.keyStrengths.map((s: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-green-50 border border-green-100 rounded-xl p-4">
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-green-900">{typeof s === "string" ? s : s.strength || s.description || s.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key gaps */}
                  {pmf.keyGaps?.length > 0 && (
                    <div>
                      <SectionHeader><XCircle className="w-3 h-3 text-red-500" /> Key Gaps</SectionHeader>
                      <div className="space-y-2">
                        {pmf.keyGaps.map((g: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof g === "string" ? g : g.gap || g.description || g.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sean Ellis score */}
                  {pmf.seanEllisScore != null && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Sean Ellis Score</p>
                      <p className="text-3xl font-light text-zinc-900">{pmf.seanEllisScore}%</p>
                      <p className="text-xs text-zinc-500 mt-1">{Number(pmf.seanEllisScore) >= 40 ? "Above PMF threshold (40%)" : "Below PMF threshold (40%)"}</p>
                    </div>
                  )}

                  {/* Improvement actions */}
                  {pmf.improvementActions?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3" /> Improvement Actions</SectionHeader>
                      <div className="space-y-3">
                        {pmf.improvementActions.map((a: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof a === "string" ? a : a.action || a.description || a.name}</p>
                                {typeof a !== "string" && a.impact && <p className="text-xs text-zinc-500 mt-1">Impact: {a.impact}</p>}
                                {typeof a !== "string" && a.timeline && <p className="text-xs text-zinc-400 mt-0.5">Timeline: {a.timeline}</p>}
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

            {/* ── Tab 51: Brand Health ───────────────────────────────────────────── */}
            {activeTab === 51 && (d as any).brandHealth && (() => {
              const bh = (d as any).brandHealth;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Brand Health</p>
                    </div>
                    <p className="text-lg leading-relaxed">{bh.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {bh.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-3xl font-light">{bh.overallScore}<span className="text-base text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {bh.brandStrength && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Brand Strength</p>
                          <span className={`inline-block mt-1 text-sm font-mono px-3 py-1 rounded-lg ${
                            bh.brandStrength === "strong" || bh.brandStrength === "Strong" ? "bg-emerald-900/40 text-emerald-300" :
                            bh.brandStrength === "moderate" || bh.brandStrength === "Moderate" ? "bg-amber-900/40 text-amber-300" :
                            "bg-red-900/40 text-red-300"
                          }`}>{bh.brandStrength}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Brand dimensions */}
                  {bh.dimensions?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Brand Dimensions</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {bh.dimensions.map((dim: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{dim.dimension || dim.name}</p>
                              <span className="text-xs font-mono text-zinc-500">{dim.score}/10</span>
                            </div>
                            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden mb-2">
                              <div className={`h-full rounded-full ${Number(dim.score) >= 7 ? "bg-green-500" : Number(dim.score) >= 4 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${(Number(dim.score) / 10) * 100}%` }} />
                            </div>
                            {dim.description && <p className="text-xs text-zinc-500">{dim.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitive differentiators */}
                  {bh.competitiveDifferentiators?.length > 0 && (
                    <div>
                      <SectionHeader><Swords className="w-3 h-3" /> Competitive Differentiators</SectionHeader>
                      <div className="space-y-2">
                        {bh.competitiveDifferentiators.map((cd: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                            <p className="text-sm text-zinc-900">{typeof cd === "string" ? cd : cd.differentiator || cd.description || cd.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Brand risks */}
                  {bh.brandRisks?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldAlert className="w-3 h-3 text-red-500" /> Brand Risks</SectionHeader>
                      <div className="space-y-2">
                        {bh.brandRisks.map((r: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof r === "string" ? r : r.risk || r.description || r.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Messaging guidelines */}
                  {bh.messagingGuidelines?.length > 0 && (
                    <div>
                      <SectionHeader><Megaphone className="w-3 h-3" /> Messaging Guidelines</SectionHeader>
                      <div className="space-y-3">
                        {bh.messagingGuidelines.map((mg: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof mg === "string" ? mg : mg.guideline || mg.description || mg.name}</p>
                                {typeof mg !== "string" && mg.example && <p className="text-xs text-zinc-500 mt-1 italic">&ldquo;{mg.example}&rdquo;</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {bh.recommendations?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Recommendations</SectionHeader>
                      <div className="space-y-3">
                        {bh.recommendations.map((rec: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof rec === "string" ? rec : rec.recommendation || rec.description || rec.name}</p>
                                {typeof rec !== "string" && rec.impact && <p className="text-xs text-zinc-500 mt-1">Impact: {rec.impact}</p>}
                                {typeof rec !== "string" && rec.priority && <p className="text-xs text-zinc-400 mt-0.5">Priority: {rec.priority}</p>}
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

            {/* ── Tab 52: Price Elasticity ───────────────────────────────────────── */}
            {activeTab === 52 && (d as any).pricingElasticity && (() => {
              const pe = (d as any).pricingElasticity;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Pricing Elasticity</p>
                    </div>
                    <p className="text-lg leading-relaxed">{pe.summary}</p>
                    {pe.sensitivity && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Price Sensitivity</p>
                        <span className={`inline-block mt-1 text-sm font-mono px-3 py-1 rounded-lg ${
                          pe.sensitivity === "low" || pe.sensitivity === "Low" ? "bg-green-900/40 text-green-300" :
                          pe.sensitivity === "moderate" || pe.sensitivity === "Moderate" ? "bg-amber-900/40 text-amber-300" :
                          "bg-red-900/40 text-red-300"
                        }`}>{pe.sensitivity}</span>
                      </div>
                    )}
                  </div>

                  {/* Price tiers table */}
                  {pe.priceTiers?.length > 0 && (
                    <div>
                      <SectionHeader><DollarSign className="w-3 h-3" /> Price Tiers</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Tier</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Current Price</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Suggested Price</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Elasticity</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Revenue Impact</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pe.priceTiers.map((tier: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{tier.name || tier.tier}</td>
                                <td className="px-4 py-3 text-zinc-700">{tier.currentPrice || tier.current}</td>
                                <td className="px-4 py-3 text-zinc-700">{tier.suggestedPrice || tier.suggested}</td>
                                <td className="px-4 py-3">
                                  {tier.elasticity && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                      tier.elasticity === "inelastic" || tier.elasticity === "Inelastic" ? "bg-green-50 text-green-700 border-green-200" :
                                      tier.elasticity === "unit_elastic" || tier.elasticity === "Unit Elastic" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                      tier.elasticity === "elastic" || tier.elasticity === "Elastic" ? "bg-red-50 text-red-700 border-red-200" :
                                      "bg-zinc-50 text-zinc-600 border-zinc-200"
                                    }`}>{tier.elasticity}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-green-700 font-medium">{tier.revenueImpact || tier.impact}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Price increase capacity */}
                  {pe.priceIncreaseCapacity && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Price Increase Capacity</p>
                      <p className="text-3xl font-light text-zinc-900">{pe.priceIncreaseCapacity}</p>
                    </div>
                  )}

                  {/* Competitive position */}
                  {pe.competitivePosition && (
                    <div>
                      <SectionHeader><Swords className="w-3 h-3" /> Competitive Price Position</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-zinc-700">{typeof pe.competitivePosition === "string" ? pe.competitivePosition : pe.competitivePosition.description || pe.competitivePosition.summary}</p>
                      </div>
                    </div>
                  )}

                  {/* Bundling opportunities */}
                  {pe.bundlingOpportunities?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3" /> Bundling Opportunities</SectionHeader>
                      <div className="space-y-3">
                        {pe.bundlingOpportunities.map((bo: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof bo === "string" ? bo : bo.bundle || bo.name || bo.description}</p>
                                {typeof bo !== "string" && bo.revenueUplift && <p className="text-xs text-green-700 mt-1">Revenue Uplift: {bo.revenueUplift}</p>}
                                {typeof bo !== "string" && bo.products && <p className="text-xs text-zinc-500 mt-0.5">Products: {Array.isArray(bo.products) ? bo.products.join(", ") : bo.products}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Psychological price points */}
                  {pe.psychologicalPricePoints?.length > 0 && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Psychological Price Points</SectionHeader>
                      <div className="space-y-2">
                        {pe.psychologicalPricePoints.map((pp: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <DollarSign className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-zinc-900">{typeof pp === "string" ? pp : pp.pricePoint || pp.name || pp.description}</p>
                              {typeof pp !== "string" && pp.rationale && <p className="text-xs text-zinc-500 mt-1">{pp.rationale}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 53: Strategic Initiatives ──────────────────────────────────── */}
            {activeTab === 53 && (d as any).strategicInitiatives && (() => {
              const si = (d as any).strategicInitiatives;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Flag className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Strategic Initiatives</p>
                    </div>
                    <p className="text-lg leading-relaxed">{si.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {si.totalInvestment && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Total Investment</p>
                          <p className="text-xl font-light">{si.totalInvestment}</p>
                        </div>
                      )}
                      {si.expectedROI && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Expected ROI</p>
                          <p className="text-xl font-light">{si.expectedROI}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Initiative cards */}
                  {si.initiatives?.length > 0 && (
                    <div>
                      <SectionHeader><Flag className="w-3 h-3" /> Initiatives</SectionHeader>
                      <div className="space-y-4">
                        {si.initiatives.map((init: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{init.name || init.initiative || init.title}</p>
                              <div className="flex items-center gap-2">
                                {init.status && (
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                    init.status === "planning" || init.status === "Planning" ? "bg-zinc-50 text-zinc-600 border-zinc-200" :
                                    init.status === "in_progress" || init.status === "In Progress" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                    init.status === "completed" || init.status === "Completed" ? "bg-green-50 text-green-700 border-green-200" :
                                    init.status === "on_hold" || init.status === "On Hold" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    init.status === "at_risk" || init.status === "At Risk" ? "bg-red-50 text-red-700 border-red-200" :
                                    "bg-zinc-50 text-zinc-600 border-zinc-200"
                                  }`}>{init.status}</span>
                                )}
                                {init.priority && (
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                    init.priority === "high" || init.priority === "High" ? "bg-red-50 text-red-700 border-red-200" :
                                    init.priority === "medium" || init.priority === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-zinc-50 text-zinc-600 border-zinc-200"
                                  }`}>{init.priority}</span>
                                )}
                              </div>
                            </div>
                            {init.description && <p className="text-xs text-zinc-600 mb-3">{init.description}</p>}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              {init.timeline && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Timeline</p>
                                  <p className="text-zinc-700 font-medium">{init.timeline}</p>
                                </div>
                              )}
                              {init.investment && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Investment</p>
                                  <p className="text-zinc-700 font-medium">{init.investment}</p>
                                </div>
                              )}
                              {init.expectedROI && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Expected ROI</p>
                                  <p className="text-green-700 font-medium">{init.expectedROI}</p>
                                </div>
                              )}
                            </div>
                            {init.risks?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Risks</p>
                                <div className="flex flex-wrap gap-1">
                                  {init.risks.map((r: any, j: number) => (
                                    <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{typeof r === "string" ? r : r.risk || r.name}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {init.milestones?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Milestones</p>
                                <div className="space-y-1">
                                  {init.milestones.map((m: any, j: number) => (
                                    <div key={j} className="flex items-center gap-2">
                                      <CheckCircle2 className="w-3 h-3 text-zinc-400" />
                                      <p className="text-xs text-zinc-600">{typeof m === "string" ? m : m.milestone || m.name || m.description}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resource constraints */}
                  {si.resourceConstraints?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-amber-500" /> Resource Constraints</SectionHeader>
                      <div className="space-y-2">
                        {si.resourceConstraints.map((rc: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-900">{typeof rc === "string" ? rc : rc.constraint || rc.description || rc.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prioritization framework */}
                  {si.prioritizationFramework && (
                    <div>
                      <SectionHeader><Gauge className="w-3 h-3" /> Prioritization Framework</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-zinc-700">{typeof si.prioritizationFramework === "string" ? si.prioritizationFramework : si.prioritizationFramework.description || si.prioritizationFramework.summary}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 54: Cash Conversion Cycle ──────────────────────────────────── */}
            {activeTab === 54 && (d as any).cashConversionCycle && (() => {
              const ccc = (d as any).cashConversionCycle;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Cash Conversion Cycle</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ccc.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {ccc.cycleDays != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Cycle Days</p>
                          <p className="text-3xl font-light">{ccc.cycleDays}<span className="text-base text-zinc-500"> days</span></p>
                        </div>
                      )}
                      {ccc.industryAverage != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Industry Average</p>
                          <p className="text-xl font-light">{ccc.industryAverage}<span className="text-base text-zinc-500"> days</span></p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrics table */}
                  {ccc.metrics?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Cycle Metrics</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Metric</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Current</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Benchmark</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Status</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Improvement Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ccc.metrics.map((m: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{m.metric || m.name}</td>
                                <td className="px-4 py-3 text-zinc-700">{m.current || m.currentValue}</td>
                                <td className="px-4 py-3 text-zinc-700">{m.benchmark}</td>
                                <td className="px-4 py-3">
                                  {m.status && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                      m.status === "good" || m.status === "Good" || m.status === "on_track" ? "bg-green-50 text-green-700 border-green-200" :
                                      m.status === "warning" || m.status === "Warning" || m.status === "needs_improvement" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                      m.status === "critical" || m.status === "Critical" || m.status === "off_track" ? "bg-red-50 text-red-700 border-red-200" :
                                      "bg-zinc-50 text-zinc-600 border-zinc-200"
                                    }`}>{m.status}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-zinc-600 text-xs">{m.improvementAction || m.action}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Working capital efficiency */}
                  {ccc.workingCapitalEfficiency && (
                    <div>
                      <SectionHeader><Calculator className="w-3 h-3" /> Working Capital Efficiency</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-zinc-700">{typeof ccc.workingCapitalEfficiency === "string" ? ccc.workingCapitalEfficiency : ccc.workingCapitalEfficiency.description || ccc.workingCapitalEfficiency.summary}</p>
                      </div>
                    </div>
                  )}

                  {/* Cash flow impact highlight */}
                  {ccc.cashFlowImpact && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Cash Flow Impact</p>
                      <p className="text-xl font-light text-zinc-900">{typeof ccc.cashFlowImpact === "string" ? ccc.cashFlowImpact : ccc.cashFlowImpact.description || ccc.cashFlowImpact.summary}</p>
                    </div>
                  )}

                  {/* Improvement opportunities */}
                  {ccc.improvementOpportunities?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3" /> Improvement Opportunities</SectionHeader>
                      <div className="space-y-3">
                        {ccc.improvementOpportunities.map((opp: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof opp === "string" ? opp : opp.opportunity || opp.description || opp.name}</p>
                                {typeof opp !== "string" && opp.impact && <p className="text-xs text-green-700 mt-1">Impact: {opp.impact}</p>}
                                {typeof opp !== "string" && opp.timeline && <p className="text-xs text-zinc-400 mt-0.5">Timeline: {opp.timeline}</p>}
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

            {/* ── Tab 55: Innovation Pipeline ────────────────────────────────────── */}
            {activeTab === 55 && (d as any).innovationPipeline && (() => {
              const ip = (d as any).innovationPipeline;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Innovation Pipeline</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ip.summary}</p>
                    {ip.innovationScore != null && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Innovation Score</p>
                        <p className="text-3xl font-light">{ip.innovationScore}<span className="text-base text-zinc-500">/100</span></p>
                      </div>
                    )}
                  </div>

                  {/* Projects cards */}
                  {ip.projects?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Innovation Projects</SectionHeader>
                      <div className="space-y-4">
                        {ip.projects.map((proj: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{proj.name || proj.project || proj.title}</p>
                              {proj.stage && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                  proj.stage === "ideation" || proj.stage === "Ideation" ? "bg-zinc-50 text-zinc-600 border-zinc-200" :
                                  proj.stage === "validation" || proj.stage === "Validation" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                  proj.stage === "development" || proj.stage === "Development" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  proj.stage === "launch" || proj.stage === "Launch" ? "bg-green-50 text-green-700 border-green-200" :
                                  proj.stage === "scaling" || proj.stage === "Scaling" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                  "bg-zinc-50 text-zinc-600 border-zinc-200"
                                }`}>{proj.stage}</span>
                              )}
                            </div>
                            {proj.description && <p className="text-xs text-zinc-600 mb-3">{proj.description}</p>}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              {proj.investment && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Investment</p>
                                  <p className="text-zinc-700 font-medium">{proj.investment}</p>
                                </div>
                              )}
                              {proj.projectedRevenue && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Projected Revenue</p>
                                  <p className="text-green-700 font-medium">{proj.projectedRevenue}</p>
                                </div>
                              )}
                              {proj.timeToMarket && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Time to Market</p>
                                  <p className="text-zinc-700 font-medium">{proj.timeToMarket}</p>
                                </div>
                              )}
                              {proj.riskLevel && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Risk Level</p>
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                    proj.riskLevel === "low" || proj.riskLevel === "Low" ? "bg-green-50 text-green-700 border-green-200" :
                                    proj.riskLevel === "medium" || proj.riskLevel === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-red-50 text-red-700 border-red-200"
                                  }`}>{proj.riskLevel}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Portfolio balance */}
                  {ip.portfolioBalance && (
                    <div>
                      <SectionHeader><PieChart className="w-3 h-3" /> Portfolio Balance</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-zinc-700">{typeof ip.portfolioBalance === "string" ? ip.portfolioBalance : ip.portfolioBalance.description || ip.portfolioBalance.summary}</p>
                      </div>
                    </div>
                  )}

                  {/* Gap areas */}
                  {ip.gapAreas?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-amber-500" /> Gap Areas</SectionHeader>
                      <div className="space-y-2">
                        {ip.gapAreas.map((gap: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-900">{typeof gap === "string" ? gap : gap.area || gap.description || gap.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Innovation culture assessment */}
                  {ip.cultureAssessment && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Innovation Culture Assessment</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-zinc-700">{typeof ip.cultureAssessment === "string" ? ip.cultureAssessment : ip.cultureAssessment.description || ip.cultureAssessment.summary}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 56: Stakeholder Map ────────────────────────────────────── */}
            {activeTab === 56 && (d as any).stakeholderMap && (() => {
              const sm = (d as any).stakeholderMap;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Stakeholder Map</p>
                    </div>
                    <p className="text-lg leading-relaxed">{sm.summary}</p>
                  </div>

                  {/* Stakeholder cards */}
                  {sm.stakeholders?.length > 0 && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Key Stakeholders</SectionHeader>
                      <div className="space-y-4">
                        {sm.stakeholders.map((s: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="text-sm font-semibold text-zinc-900">{s.name}</p>
                                {s.role && <p className="text-xs text-zinc-500 mt-0.5">{s.role}</p>}
                              </div>
                              <div className="flex gap-2">
                                {s.influenceLevel && (
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                    s.influenceLevel === "high" || s.influenceLevel === "High" ? "bg-red-50 text-red-700 border-red-200" :
                                    s.influenceLevel === "medium" || s.influenceLevel === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-green-50 text-green-700 border-green-200"
                                  }`}>{s.influenceLevel} influence</span>
                                )}
                                {s.supportLevel && (
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                    s.supportLevel === "champion" || s.supportLevel === "Champion" ? "bg-green-50 text-green-700 border-green-200" :
                                    s.supportLevel === "supporter" || s.supportLevel === "Supporter" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                    s.supportLevel === "neutral" || s.supportLevel === "Neutral" ? "bg-zinc-50 text-zinc-600 border-zinc-200" :
                                    s.supportLevel === "skeptic" || s.supportLevel === "Skeptic" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-red-50 text-red-700 border-red-200"
                                  }`}>{s.supportLevel}</span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              {s.interests && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Interests</p>
                                  <p className="text-zinc-700">{typeof s.interests === "string" ? s.interests : Array.isArray(s.interests) ? s.interests.join(", ") : ""}</p>
                                </div>
                              )}
                              {s.communicationStyle && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Communication Style</p>
                                  <p className="text-zinc-700">{s.communicationStyle}</p>
                                </div>
                              )}
                              {s.engagementStrategy && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Engagement Strategy</p>
                                  <p className="text-zinc-700">{s.engagementStrategy}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Power dynamics */}
                  {sm.powerDynamics && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Power Dynamics</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-zinc-700">{typeof sm.powerDynamics === "string" ? sm.powerDynamics : sm.powerDynamics.description || sm.powerDynamics.summary}</p>
                      </div>
                    </div>
                  )}

                  {/* Communication plan */}
                  {sm.communicationPlan && (
                    <div>
                      <SectionHeader><ClipboardCheck className="w-3 h-3" /> Communication Plan</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-zinc-700">{typeof sm.communicationPlan === "string" ? sm.communicationPlan : sm.communicationPlan.description || sm.communicationPlan.summary}</p>
                      </div>
                    </div>
                  )}

                  {/* Key relationships */}
                  {sm.keyRelationships?.length > 0 && (
                    <div>
                      <SectionHeader><GitBranch className="w-3 h-3" /> Key Relationships</SectionHeader>
                      <div className="space-y-2">
                        {sm.keyRelationships.map((rel: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <GitBranch className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-zinc-700">{typeof rel === "string" ? rel : rel.description || rel.relationship || rel.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 57: Decision Log ────────────────────────────────────────── */}
            {activeTab === 57 && (d as any).decisionLog && (() => {
              const dl = (d as any).decisionLog;
              const pendingCount = dl.decisions?.filter((dec: any) => dec.status === "pending" || dec.status === "Pending").length ?? 0;
              const criticalCount = dl.decisions?.filter((dec: any) => dec.urgency === "critical" || dec.urgency === "Critical" || dec.urgency === "high" || dec.urgency === "High").length ?? 0;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <ClipboardCheck className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Decision Log</p>
                    </div>
                    <p className="text-lg leading-relaxed">{dl.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      <div>
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Pending</p>
                        <p className="text-3xl font-light">{pendingCount}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Critical</p>
                        <p className="text-3xl font-light text-red-400">{criticalCount}</p>
                      </div>
                    </div>
                  </div>

                  {/* Decision cards */}
                  {dl.decisions?.length > 0 && (
                    <div>
                      <SectionHeader><ClipboardCheck className="w-3 h-3" /> Decisions</SectionHeader>
                      <div className="space-y-4">
                        {dl.decisions.map((dec: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{dec.title || dec.decision || dec.name}</p>
                              <div className="flex gap-2">
                                {dec.status && (
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                    dec.status === "pending" || dec.status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    dec.status === "made" || dec.status === "Made" || dec.status === "approved" || dec.status === "Approved" ? "bg-green-50 text-green-700 border-green-200" :
                                    dec.status === "deferred" || dec.status === "Deferred" ? "bg-zinc-50 text-zinc-600 border-zinc-200" :
                                    dec.status === "reversed" || dec.status === "Reversed" ? "bg-red-50 text-red-700 border-red-200" :
                                    "bg-zinc-50 text-zinc-600 border-zinc-200"
                                  }`}>{dec.status}</span>
                                )}
                                {dec.urgency && (
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                    dec.urgency === "critical" || dec.urgency === "Critical" || dec.urgency === "high" || dec.urgency === "High" ? "bg-red-50 text-red-700 border-red-200" :
                                    dec.urgency === "medium" || dec.urgency === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-green-50 text-green-700 border-green-200"
                                  }`}>{dec.urgency}</span>
                                )}
                              </div>
                            </div>
                            {dec.category && (
                              <span className="inline-block text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200 mb-3">{dec.category}</span>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              {dec.rationale && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Rationale</p>
                                  <p className="text-zinc-700">{dec.rationale}</p>
                                </div>
                              )}
                              {dec.alternatives && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Alternatives</p>
                                  <p className="text-zinc-700">{typeof dec.alternatives === "string" ? dec.alternatives : Array.isArray(dec.alternatives) ? dec.alternatives.join(", ") : ""}</p>
                                </div>
                              )}
                              {dec.expectedOutcome && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Expected Outcome</p>
                                  <p className="text-zinc-700">{dec.expectedOutcome}</p>
                                </div>
                              )}
                              {dec.risks && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Risks</p>
                                  <p className="text-zinc-700">{typeof dec.risks === "string" ? dec.risks : Array.isArray(dec.risks) ? dec.risks.join(", ") : ""}</p>
                                </div>
                              )}
                              {dec.owner && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Owner</p>
                                  <p className="text-zinc-700 font-medium">{dec.owner}</p>
                                </div>
                              )}
                              {dec.deadline && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Deadline</p>
                                  <p className="text-zinc-700 font-medium">{dec.deadline}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Decision framework */}
                  {dl.decisionFramework && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Decision Framework</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-zinc-700">{typeof dl.decisionFramework === "string" ? dl.decisionFramework : dl.decisionFramework.description || dl.decisionFramework.summary}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 58: Culture Assessment ──────────────────────────────────── */}
            {activeTab === 58 && (d as any).cultureAssessment && (() => {
              const ca = (d as any).cultureAssessment;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Culture Assessment</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ca.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {ca.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-3xl font-light">{ca.overallScore}<span className="text-base text-zinc-500">/10</span></p>
                        </div>
                      )}
                      {ca.cultureType && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Culture Type</p>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">{ca.cultureType}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Culture dimensions */}
                  {ca.dimensions?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Culture Dimensions</SectionHeader>
                      <div className="space-y-4">
                        {ca.dimensions.map((dim: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{dim.name || dim.dimension}</p>
                              <span className="text-xs font-mono text-zinc-500">{dim.score}/10</span>
                            </div>
                            <div className="w-full bg-zinc-100 rounded-full h-2 mb-2">
                              <div className="bg-zinc-900 h-2 rounded-full transition-all" style={{ width: `${(dim.score / 10) * 100}%` }} />
                            </div>
                            {dim.description && <p className="text-xs text-zinc-600">{dim.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Core values */}
                  {ca.coreValues?.length > 0 && (
                    <div>
                      <SectionHeader><Flag className="w-3 h-3" /> Core Values</SectionHeader>
                      <div className="flex flex-wrap gap-2">
                        {ca.coreValues.map((v: any, i: number) => (
                          <span key={i} className="text-xs font-mono px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">{typeof v === "string" ? v : v.name || v.value}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alignment gaps */}
                  {ca.alignmentGaps?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-amber-500" /> Alignment Gaps</SectionHeader>
                      <div className="space-y-2">
                        {ca.alignmentGaps.map((gap: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-900">{typeof gap === "string" ? gap : gap.gap || gap.description || gap.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Retention risks */}
                  {ca.retentionRisks?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldAlert className="w-3 h-3 text-red-500" /> Retention Risks</SectionHeader>
                      <div className="space-y-2">
                        {ca.retentionRisks.map((risk: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof risk === "string" ? risk : risk.risk || risk.description || risk.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {ca.recommendations?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Recommendations</SectionHeader>
                      <div className="space-y-3">
                        {ca.recommendations.map((rec: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <p className="text-sm text-zinc-700">{typeof rec === "string" ? rec : rec.recommendation || rec.description || rec.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 59: IP Portfolio ────────────────────────────────────────── */}
            {activeTab === 59 && (d as any).ipPortfolio && (() => {
              const ipp = (d as any).ipPortfolio;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">IP Portfolio</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ipp.summary}</p>
                    {ipp.totalEstimatedValue && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Total Estimated Value</p>
                        <p className="text-3xl font-light">{ipp.totalEstimatedValue}</p>
                      </div>
                    )}
                  </div>

                  {/* IP assets table */}
                  {ipp.assets?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldCheck className="w-3 h-3" /> IP Assets</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50">
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Name</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Type</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Status</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Value</th>
                              <th className="text-left px-4 py-3 text-[9px] font-mono text-zinc-400 uppercase">Protection Strategy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ipp.assets.map((a: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-50">
                                <td className="px-4 py-3 font-medium text-zinc-900">{a.name || a.asset}</td>
                                <td className="px-4 py-3">
                                  {a.type && (
                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{a.type}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {a.status && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                      a.status === "registered" || a.status === "Registered" || a.status === "granted" || a.status === "Granted" ? "bg-green-50 text-green-700 border-green-200" :
                                      a.status === "pending" || a.status === "Pending" || a.status === "filed" || a.status === "Filed" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                      a.status === "unprotected" || a.status === "Unprotected" ? "bg-red-50 text-red-700 border-red-200" :
                                      "bg-zinc-50 text-zinc-600 border-zinc-200"
                                    }`}>{a.status}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-zinc-700">{a.value || a.estimatedValue}</td>
                                <td className="px-4 py-3 text-zinc-600 text-xs">{a.protectionStrategy || a.strategy}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Protection gaps */}
                  {ipp.protectionGaps?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-amber-500" /> Protection Gaps</SectionHeader>
                      <div className="space-y-2">
                        {ipp.protectionGaps.map((gap: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-900">{typeof gap === "string" ? gap : gap.gap || gap.description || gap.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Filing recommendations */}
                  {ipp.filingRecommendations?.length > 0 && (
                    <div>
                      <SectionHeader><FileText className="w-3 h-3" /> Filing Recommendations</SectionHeader>
                      <div className="space-y-3">
                        {ipp.filingRecommendations.map((rec: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <p className="text-sm text-zinc-700">{typeof rec === "string" ? rec : rec.recommendation || rec.description || rec.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitive advantage */}
                  {ipp.competitiveAdvantage && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Competitive Advantage</p>
                      <p className="text-xl font-light text-zinc-900">{typeof ipp.competitiveAdvantage === "string" ? ipp.competitiveAdvantage : ipp.competitiveAdvantage.description || ipp.competitiveAdvantage.summary}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 60: Exit Readiness ──────────────────────────────────────── */}
            {activeTab === 60 && (d as any).exitReadiness && (() => {
              const er = (d as any).exitReadiness;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Exit Readiness</p>
                    </div>
                    <p className="text-lg leading-relaxed">{er.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {er.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-3xl font-light">{er.overallScore}<span className="text-base text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {er.timeline && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Timeline</p>
                          <p className="text-xl font-light">{er.timeline}</p>
                        </div>
                      )}
                      {er.valuationRange && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Valuation Range</p>
                          <p className="text-xl font-light">{er.valuationRange}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Exit dimensions */}
                  {er.dimensions?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Exit Dimensions</SectionHeader>
                      <div className="space-y-4">
                        {er.dimensions.map((dim: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-zinc-900">{dim.name || dim.dimension}</p>
                                {dim.status && (
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                    dim.status === "ready" || dim.status === "Ready" || dim.status === "strong" || dim.status === "Strong" ? "bg-green-50 text-green-700 border-green-200" :
                                    dim.status === "needs_work" || dim.status === "Needs Work" || dim.status === "moderate" || dim.status === "Moderate" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-red-50 text-red-700 border-red-200"
                                  }`}>{dim.status}</span>
                                )}
                              </div>
                              <span className="text-xs font-mono text-zinc-500">{dim.score}/100</span>
                            </div>
                            <div className="w-full bg-zinc-100 rounded-full h-2 mb-2">
                              <div className="bg-zinc-900 h-2 rounded-full transition-all" style={{ width: `${dim.score}%` }} />
                            </div>
                            {dim.description && <p className="text-xs text-zinc-600">{dim.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Valuation drivers vs detractors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {er.valuationDrivers?.length > 0 && (
                      <div>
                        <SectionHeader><TrendingUp className="w-3 h-3 text-green-600" /> Valuation Drivers</SectionHeader>
                        <div className="space-y-2">
                          {er.valuationDrivers.map((d: any, i: number) => (
                            <div key={i} className="flex gap-3 items-start bg-green-50 border border-green-100 rounded-xl p-4">
                              <TrendingUp className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                              <p className="text-sm text-green-900">{typeof d === "string" ? d : d.driver || d.description || d.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {er.valuationDetractors?.length > 0 && (
                      <div>
                        <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Valuation Detractors</SectionHeader>
                        <div className="space-y-2">
                          {er.valuationDetractors.map((d: any, i: number) => (
                            <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                              <p className="text-sm text-red-900">{typeof d === "string" ? d : d.detractor || d.description || d.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Buyer profiles */}
                  {er.buyerProfiles?.length > 0 && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Potential Buyer Profiles</SectionHeader>
                      <div className="space-y-4">
                        {er.buyerProfiles.map((bp: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <p className="text-sm font-semibold text-zinc-900 mb-1">{bp.name || bp.type || bp.profile}</p>
                            {bp.rationale && <p className="text-xs text-zinc-600 mb-1">{bp.rationale}</p>}
                            {bp.likelihood && <p className="text-xs text-zinc-400">Likelihood: {bp.likelihood}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preparation steps */}
                  {er.preparationSteps?.length > 0 && (
                    <div>
                      <SectionHeader><Flag className="w-3 h-3" /> Preparation Steps</SectionHeader>
                      <div className="space-y-3">
                        {er.preparationSteps.map((step: any, i: number) => (
                          <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{typeof step === "string" ? step : step.step || step.description || step.name}</p>
                                {typeof step !== "string" && step.timeline && <p className="text-xs text-zinc-400 mt-0.5">Timeline: {step.timeline}</p>}
                                {typeof step !== "string" && step.impact && <p className="text-xs text-green-700 mt-0.5">Impact: {step.impact}</p>}
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

            {/* ── Tab 61: Sustainability Score ────────────────────────────────── */}
            {activeTab === 61 && (d as any).sustainabilityScore && (() => {
              const ss = (d as any).sustainabilityScore;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Sustainability Score</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ss.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {ss.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-3xl font-light">{ss.overallScore}<span className="text-base text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {ss.grade && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Grade</p>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">{ss.grade}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ESG dimensions */}
                  {ss.dimensions?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> ESG Dimensions</SectionHeader>
                      <div className="space-y-4">
                        {ss.dimensions.map((dim: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{dim.name || dim.dimension}</p>
                              <span className="text-xs font-mono text-zinc-500">{dim.score}/100</span>
                            </div>
                            <div className="w-full bg-zinc-100 rounded-full h-2 mb-3">
                              <div className="bg-zinc-900 h-2 rounded-full transition-all" style={{ width: `${dim.score}%` }} />
                            </div>
                            {dim.initiatives?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Initiatives</p>
                                <div className="flex flex-wrap gap-1">
                                  {dim.initiatives.map((init: any, j: number) => (
                                    <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">{typeof init === "string" ? init : init.name || init.initiative}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {dim.gaps?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Gaps</p>
                                <div className="flex flex-wrap gap-1">
                                  {dim.gaps.map((gap: any, j: number) => (
                                    <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{typeof gap === "string" ? gap : gap.name || gap.gap}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {dim.quickWins?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Quick Wins</p>
                                <div className="flex flex-wrap gap-1">
                                  {dim.quickWins.map((qw: any, j: number) => (
                                    <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{typeof qw === "string" ? qw : qw.name || qw.quickWin}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Material issues */}
                  {ss.materialIssues?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-amber-500" /> Material Issues</SectionHeader>
                      <div className="space-y-2">
                        {ss.materialIssues.map((issue: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-900">{typeof issue === "string" ? issue : issue.issue || issue.description || issue.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stakeholder expectations */}
                  {ss.stakeholderExpectations?.length > 0 && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Stakeholder Expectations</SectionHeader>
                      <div className="space-y-2">
                        {ss.stakeholderExpectations.map((exp: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <p className="text-sm text-zinc-700">{typeof exp === "string" ? exp : exp.expectation || exp.description || exp.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Regulatory requirements */}
                  {ss.regulatoryRequirements?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldCheck className="w-3 h-3" /> Regulatory Requirements</SectionHeader>
                      <div className="space-y-2">
                        {ss.regulatoryRequirements.map((req: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <p className="text-sm text-zinc-700">{typeof req === "string" ? req : req.requirement || req.description || req.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitive advantage */}
                  {ss.competitiveAdvantage && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Competitive Advantage</p>
                      <p className="text-xl font-light text-zinc-900">{typeof ss.competitiveAdvantage === "string" ? ss.competitiveAdvantage : ss.competitiveAdvantage.description || ss.competitiveAdvantage.summary}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 62: Acquisition Targets ──────────────────────────────────── */}
            {activeTab === 62 && (d as any).acquisitionTargets && (() => {
              const at = (d as any).acquisitionTargets;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Acquisition Targets</p>
                    </div>
                    <p className="text-lg leading-relaxed">{at.summary || at.strategy}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {at.budgetRange && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Budget Range</p>
                          <p className="text-xl font-light">{at.budgetRange}</p>
                        </div>
                      )}
                      {at.timeline && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Timeline</p>
                          <p className="text-xl font-light">{at.timeline}</p>
                        </div>
                      )}
                      {at.strategy && at.summary && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Strategy</p>
                          <p className="text-sm text-zinc-300">{at.strategy}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Target cards */}
                  {at.targets?.length > 0 && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Target Companies</SectionHeader>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {at.targets.map((t: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{t.companyName || t.name}</p>
                              {t.industry && (
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">{t.industry}</span>
                              )}
                            </div>
                            {t.rationale && <p className="text-xs text-zinc-600 mb-3">{t.rationale}</p>}
                            {t.fitScore != null && (
                              <div className="mb-3">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Fit Score</p>
                                  <span className="text-xs font-mono text-zinc-500">{t.fitScore}/100</span>
                                </div>
                                <div className="w-full bg-zinc-100 rounded-full h-2">
                                  <div className="bg-zinc-900 h-2 rounded-full transition-all" style={{ width: `${t.fitScore}%` }} />
                                </div>
                              </div>
                            )}
                            {t.synergies?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Synergies</p>
                                <div className="flex flex-wrap gap-1">
                                  {t.synergies.map((s: any, j: number) => (
                                    <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">{typeof s === "string" ? s : s.name || s.description}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {t.risks?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Risks</p>
                                <div className="flex flex-wrap gap-1">
                                  {t.risks.map((r: any, j: number) => (
                                    <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{typeof r === "string" ? r : r.name || r.description}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Due diligence checklist */}
                  {at.dueDiligenceChecklist?.length > 0 && (
                    <div>
                      <SectionHeader><ClipboardCheck className="w-3 h-3" /> Due Diligence Checklist</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <div className="space-y-2">
                          {at.dueDiligenceChecklist.map((item: any, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                              <p className="text-sm text-zinc-700">{typeof item === "string" ? item : item.item || item.description || item.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Integration plan */}
                  {at.integrationPlan && (
                    <div>
                      <SectionHeader><ArrowRight className="w-3 h-3" /> Integration Plan</SectionHeader>
                      {typeof at.integrationPlan === "string" ? (
                        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                          <p className="text-sm text-zinc-700">{at.integrationPlan}</p>
                        </div>
                      ) : at.integrationPlan.phases?.length > 0 ? (
                        <div className="space-y-3">
                          {at.integrationPlan.phases.map((phase: any, i: number) => (
                            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-white">{i + 1}</span>
                                <p className="text-sm font-semibold text-zinc-900">{phase.name || phase.phase}</p>
                                {phase.timeline && <span className="text-[9px] font-mono text-zinc-500">{phase.timeline}</span>}
                              </div>
                              {phase.description && <p className="text-xs text-zinc-600">{phase.description}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                          <p className="text-sm text-zinc-700">{at.integrationPlan.summary || at.integrationPlan.description || JSON.stringify(at.integrationPlan)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 63: Financial Ratios ──────────────────────────────────────── */}
            {activeTab === 63 && (d as any).financialRatios && (() => {
              const fr = (d as any).financialRatios;
              const healthColor = fr.overallHealth === "strong" || fr.overallHealth === "Strong" || fr.overallHealth === "healthy" || fr.overallHealth === "Healthy"
                ? "bg-green-50 text-green-700 border-green-200"
                : fr.overallHealth === "moderate" || fr.overallHealth === "Moderate" || fr.overallHealth === "fair" || fr.overallHealth === "Fair"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : fr.overallHealth === "weak" || fr.overallHealth === "Weak" || fr.overallHealth === "poor" || fr.overallHealth === "Poor"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200";
              const ratioGroups = [
                { key: "liquidity", label: "Liquidity Ratios", icon: <DollarSign className="w-3 h-3" /> },
                { key: "profitability", label: "Profitability Ratios", icon: <TrendingUp className="w-3 h-3" /> },
                { key: "leverage", label: "Leverage Ratios", icon: <BarChart3 className="w-3 h-3" /> },
                { key: "efficiency", label: "Efficiency Ratios", icon: <Zap className="w-3 h-3" /> },
              ];
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Financial Ratios</p>
                    </div>
                    <p className="text-lg leading-relaxed">{fr.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {fr.overallHealth && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Health</p>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${healthColor}`}>{fr.overallHealth}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ratio groups */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {ratioGroups.map((group) => {
                      const ratios = fr[group.key];
                      if (!ratios || (Array.isArray(ratios) && ratios.length === 0)) return null;
                      const ratioList = Array.isArray(ratios) ? ratios : ratios.ratios || [ratios];
                      return (
                        <div key={group.key} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            {group.icon}
                            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{group.label}</p>
                          </div>
                          <div className="space-y-3">
                            {ratioList.map((ratio: any, i: number) => {
                              const statusColor = ratio.status === "above" || ratio.status === "Above" || ratio.status === "good" || ratio.status === "Good" || ratio.status === "strong" || ratio.status === "Strong"
                                ? "text-green-700 bg-green-50 border-green-200"
                                : ratio.status === "at" || ratio.status === "At" || ratio.status === "average" || ratio.status === "Average" || ratio.status === "moderate" || ratio.status === "Moderate"
                                  ? "text-amber-700 bg-amber-50 border-amber-200"
                                  : ratio.status === "below" || ratio.status === "Below" || ratio.status === "weak" || ratio.status === "Weak" || ratio.status === "poor" || ratio.status === "Poor"
                                    ? "text-red-700 bg-red-50 border-red-200"
                                    : "text-zinc-600 bg-zinc-50 border-zinc-200";
                              return (
                                <div key={i} className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm text-zinc-900 font-medium">{ratio.name || ratio.ratio}</p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                      <span className="text-xs font-mono text-zinc-800">{ratio.value}</span>
                                      {ratio.industryAvg != null && (
                                        <span className="text-[9px] font-mono text-zinc-400">vs {ratio.industryAvg} avg</span>
                                      )}
                                    </div>
                                  </div>
                                  {ratio.status && (
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${statusColor}`}>{ratio.status}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Trend insights */}
                  {fr.trendInsights?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3" /> Trend Insights</SectionHeader>
                      <div className="space-y-2">
                        {fr.trendInsights.map((insight: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <p className="text-sm text-zinc-700">{typeof insight === "string" ? insight : insight.insight || insight.description || insight.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {fr.recommendations?.length > 0 && (
                    <div>
                      <SectionHeader><ChevronRight className="w-3 h-3" /> Recommendations</SectionHeader>
                      <div className="space-y-2">
                        {fr.recommendations.map((rec: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-blue-50 border border-blue-100 rounded-xl p-4">
                            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-900">{typeof rec === "string" ? rec : rec.recommendation || rec.description || rec.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 64: Channel Mix Model ─────────────────────────────────────── */}
            {activeTab === 64 && (d as any).channelMixModel && (() => {
              const cm = (d as any).channelMixModel;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Channel Mix Model</p>
                    </div>
                    <p className="text-lg leading-relaxed">{cm.summary}</p>
                    {cm.topPerformingChannel && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Top Performing Channel</p>
                        <p className="text-2xl font-light">{typeof cm.topPerformingChannel === "string" ? cm.topPerformingChannel : cm.topPerformingChannel.name || cm.topPerformingChannel.channel}</p>
                      </div>
                    )}
                  </div>

                  {/* Channel cards */}
                  {cm.channels?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Channel Performance</SectionHeader>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cm.channels.map((ch: any, i: number) => {
                          const trendColor = ch.trend === "growing" || ch.trend === "Growing" || ch.trend === "up" || ch.trend === "Up"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : ch.trend === "declining" || ch.trend === "Declining" || ch.trend === "down" || ch.trend === "Down"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-zinc-100 text-zinc-600 border-zinc-200";
                          return (
                            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-zinc-900">{ch.name || ch.channel}</p>
                                {ch.trend && (
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${trendColor}`}>{ch.trend}</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                {ch.attributedRevenue != null && (
                                  <div>
                                    <p className="text-[9px] font-mono text-zinc-400 uppercase">Revenue</p>
                                    <p className="text-sm font-mono text-zinc-900">{typeof ch.attributedRevenue === "number" ? `$${ch.attributedRevenue.toLocaleString()}` : ch.attributedRevenue}</p>
                                  </div>
                                )}
                                {ch.cpa != null && (
                                  <div>
                                    <p className="text-[9px] font-mono text-zinc-400 uppercase">CPA</p>
                                    <p className="text-sm font-mono text-zinc-900">{typeof ch.cpa === "number" ? `$${ch.cpa.toLocaleString()}` : ch.cpa}</p>
                                  </div>
                                )}
                                {ch.roi != null && (
                                  <div>
                                    <p className="text-[9px] font-mono text-zinc-400 uppercase">ROI</p>
                                    <p className="text-sm font-mono text-zinc-900">{typeof ch.roi === "number" ? `${ch.roi}x` : ch.roi}</p>
                                  </div>
                                )}
                                {ch.contribution != null && (
                                  <div>
                                    <p className="text-[9px] font-mono text-zinc-400 uppercase">Contribution</p>
                                    <p className="text-sm font-mono text-zinc-900">{typeof ch.contribution === "number" ? `${ch.contribution}%` : ch.contribution}</p>
                                  </div>
                                )}
                              </div>
                              {ch.contribution != null && typeof ch.contribution === "number" && (
                                <div className="w-full bg-zinc-100 rounded-full h-2">
                                  <div className="bg-zinc-900 h-2 rounded-full transition-all" style={{ width: `${Math.min(ch.contribution, 100)}%` }} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Budget allocation */}
                  {cm.budgetAllocation && (
                    <div>
                      <SectionHeader><DollarSign className="w-3 h-3" /> Budget Allocation</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        {(Array.isArray(cm.budgetAllocation) ? cm.budgetAllocation : cm.budgetAllocation.channels || []).length > 0 ? (
                          <div className="space-y-3">
                            {(Array.isArray(cm.budgetAllocation) ? cm.budgetAllocation : cm.budgetAllocation.channels || []).map((alloc: any, i: number) => (
                              <div key={i} className="flex items-center justify-between">
                                <p className="text-sm text-zinc-900">{alloc.channel || alloc.name}</p>
                                <div className="flex items-center gap-4">
                                  {alloc.current != null && (
                                    <div className="text-right">
                                      <p className="text-[9px] font-mono text-zinc-400 uppercase">Current</p>
                                      <p className="text-xs font-mono text-zinc-600">{typeof alloc.current === "number" ? `${alloc.current}%` : alloc.current}</p>
                                    </div>
                                  )}
                                  {alloc.recommended != null && (
                                    <div className="text-right">
                                      <p className="text-[9px] font-mono text-zinc-400 uppercase">Recommended</p>
                                      <p className="text-xs font-mono text-zinc-900 font-semibold">{typeof alloc.recommended === "number" ? `${alloc.recommended}%` : alloc.recommended}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-700">{typeof cm.budgetAllocation === "string" ? cm.budgetAllocation : cm.budgetAllocation.summary || cm.budgetAllocation.description}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Seasonal insights */}
                  {cm.seasonalInsights?.length > 0 && (
                    <div>
                      <SectionHeader><Calendar className="w-3 h-3" /> Seasonal Insights</SectionHeader>
                      <div className="space-y-2">
                        {cm.seasonalInsights.map((insight: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <p className="text-sm text-zinc-700">{typeof insight === "string" ? insight : insight.insight || insight.description || insight.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 65: Supply Chain Risk ──────────────────────────────────────── */}
            {activeTab === 65 && (d as any).supplyChainRisk && (() => {
              const sc = (d as any).supplyChainRisk;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <GitBranch className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Supply Chain Risk</p>
                    </div>
                    <p className="text-lg leading-relaxed">{sc.summary}</p>
                    {sc.overallRiskScore != null && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Risk Score</p>
                        <p className="text-3xl font-light">{sc.overallRiskScore}<span className="text-base text-zinc-500">/100</span></p>
                      </div>
                    )}
                  </div>

                  {/* Node cards */}
                  {sc.nodes?.length > 0 && (
                    <div>
                      <SectionHeader><GitBranch className="w-3 h-3" /> Supply Chain Nodes</SectionHeader>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sc.nodes.map((node: any, i: number) => {
                          const riskColor = node.riskLevel === "high" || node.riskLevel === "High" || node.riskLevel === "critical" || node.riskLevel === "Critical"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : node.riskLevel === "medium" || node.riskLevel === "Medium" || node.riskLevel === "moderate" || node.riskLevel === "Moderate"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-green-50 text-green-700 border-green-200";
                          return (
                            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-semibold text-zinc-900">{node.vendor || node.name || node.supplier}</p>
                                {node.riskLevel && (
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${riskColor}`}>{node.riskLevel}</span>
                                )}
                              </div>
                              {node.category && (
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">{node.category}</span>
                              )}
                              {node.dependencyScore != null && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[9px] font-mono text-zinc-400 uppercase">Dependency Score</p>
                                    <span className="text-xs font-mono text-zinc-500">{node.dependencyScore}/100</span>
                                  </div>
                                  <div className="w-full bg-zinc-100 rounded-full h-2">
                                    <div className="bg-zinc-900 h-2 rounded-full transition-all" style={{ width: `${node.dependencyScore}%` }} />
                                  </div>
                                </div>
                              )}
                              {node.alternativesAvailable != null && (
                                <div className="mt-2">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Alternatives Available</p>
                                  <p className="text-sm font-mono text-zinc-900">{node.alternativesAvailable}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Single points of failure */}
                  {sc.singlePointsOfFailure?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Single Points of Failure</SectionHeader>
                      <div className="space-y-2">
                        {sc.singlePointsOfFailure.map((spof: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof spof === "string" ? spof : spof.description || spof.name || spof.node}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Geographic concentration */}
                  {sc.geographicConcentration?.length > 0 && (
                    <div>
                      <SectionHeader><Globe className="w-3 h-3" /> Geographic Concentration</SectionHeader>
                      <div className="space-y-2">
                        {sc.geographicConcentration.map((gc: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <p className="text-sm text-zinc-700">{typeof gc === "string" ? gc : gc.region || gc.description || gc.name}</p>
                            {gc.percentage != null && (
                              <div className="mt-2">
                                <div className="w-full bg-zinc-100 rounded-full h-1.5">
                                  <div className="bg-zinc-900 h-1.5 rounded-full transition-all" style={{ width: `${gc.percentage}%` }} />
                                </div>
                                <p className="text-[9px] font-mono text-zinc-400 mt-1">{gc.percentage}% of supply chain</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contingency plans */}
                  {sc.contingencyPlans?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldCheck className="w-3 h-3" /> Contingency Plans</SectionHeader>
                      <div className="space-y-2">
                        {sc.contingencyPlans.map((plan: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            {(plan.trigger || plan.name) && <p className="text-sm font-semibold text-zinc-900 mb-1">{plan.trigger || plan.name}</p>}
                            <p className="text-sm text-zinc-700">{typeof plan === "string" ? plan : plan.action || plan.description || plan.plan}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 66: Regulatory Landscape ──────────────────────────────────── */}
            {activeTab === 66 && (d as any).regulatoryLandscape && (() => {
              const rl = (d as any).regulatoryLandscape;
              const statusBadge = (status: string) => {
                const s = status?.toLowerCase();
                if (s === "compliant" || s === "met" || s === "complete") return "bg-green-50 text-green-700 border-green-200";
                if (s === "partial" || s === "in_progress" || s === "in progress" || s === "pending") return "bg-amber-50 text-amber-700 border-amber-200";
                if (s === "non_compliant" || s === "non-compliant" || s === "not_met" || s === "overdue") return "bg-red-50 text-red-700 border-red-200";
                return "bg-zinc-100 text-zinc-600 border-zinc-200";
              };
              const impactBadge = (impact: string) => {
                const imp = impact?.toLowerCase();
                if (imp === "high" || imp === "critical") return "bg-red-50 text-red-700 border-red-200";
                if (imp === "medium" || imp === "moderate") return "bg-amber-50 text-amber-700 border-amber-200";
                return "bg-zinc-100 text-zinc-600 border-zinc-200";
              };
              const renderRegCard = (reg: any, i: number) => (
                <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-zinc-900">{reg.name || reg.regulation}</p>
                    <div className="flex gap-2">
                      {reg.status && <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${statusBadge(reg.status)}`}>{reg.status}</span>}
                      {reg.impactLevel && <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${impactBadge(reg.impactLevel)}`}>{reg.impactLevel}</span>}
                    </div>
                  </div>
                  {reg.jurisdiction && (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">{reg.jurisdiction}</span>
                  )}
                  {reg.deadline && (
                    <div className="mt-2">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase">Deadline</p>
                      <p className="text-xs text-zinc-700">{reg.deadline}</p>
                    </div>
                  )}
                  {reg.actionRequired && (
                    <div className="mt-2">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase">Action Required</p>
                      <p className="text-xs text-zinc-700">{reg.actionRequired}</p>
                    </div>
                  )}
                  {reg.description && (
                    <p className="text-xs text-zinc-600 mt-2">{reg.description}</p>
                  )}
                </div>
              );
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Regulatory Landscape</p>
                    </div>
                    <p className="text-lg leading-relaxed">{rl.summary}</p>
                    {rl.complianceScore != null && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Compliance Score</p>
                        <p className="text-3xl font-light">{rl.complianceScore}<span className="text-base text-zinc-500">/100</span></p>
                      </div>
                    )}
                  </div>

                  {/* Current regulations */}
                  {rl.currentRegulations?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldCheck className="w-3 h-3" /> Current Regulations</SectionHeader>
                      <div className="space-y-4">
                        {rl.currentRegulations.map((reg: any, i: number) => renderRegCard(reg, i))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming regulations */}
                  {rl.upcomingRegulations?.length > 0 && (
                    <div>
                      <SectionHeader><Clock className="w-3 h-3" /> Upcoming Regulations</SectionHeader>
                      <div className="space-y-4">
                        {rl.upcomingRegulations.map((reg: any, i: number) => renderRegCard(reg, i))}
                      </div>
                    </div>
                  )}

                  {/* Industry risks */}
                  {rl.industryRisks?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-amber-500" /> Industry Risks</SectionHeader>
                      <div className="space-y-2">
                        {rl.industryRisks.map((risk: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-900">{typeof risk === "string" ? risk : risk.risk || risk.description || risk.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {rl.recommendations?.length > 0 && (
                    <div>
                      <SectionHeader><ChevronRight className="w-3 h-3" /> Recommendations</SectionHeader>
                      <div className="space-y-2">
                        {rl.recommendations.map((rec: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-blue-50 border border-blue-100 rounded-xl p-4">
                            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-900">{typeof rec === "string" ? rec : rec.recommendation || rec.description || rec.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 67: Crisis Playbook ────────────────────────────────────────── */}
            {activeTab === 67 && (d as any).crisisPlaybook && (() => {
              const cp = (d as any).crisisPlaybook;
              const severityBadge = (severity: string) => {
                const s = severity?.toLowerCase();
                if (s === "critical" || s === "high" || s === "severe") return "bg-red-50 text-red-700 border-red-200";
                if (s === "medium" || s === "moderate") return "bg-amber-50 text-amber-700 border-amber-200";
                return "bg-green-50 text-green-700 border-green-200";
              };
              const probBadge = (prob: string) => {
                const p = prob?.toLowerCase();
                if (p === "high" || p === "likely" || p === "very likely") return "bg-red-50 text-red-700 border-red-200";
                if (p === "medium" || p === "moderate" || p === "possible") return "bg-amber-50 text-amber-700 border-amber-200";
                return "bg-green-50 text-green-700 border-green-200";
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Crisis Playbook</p>
                    </div>
                    <p className="text-lg leading-relaxed">{cp.summary}</p>
                  </div>

                  {/* Scenario cards */}
                  {cp.scenarios?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldAlert className="w-3 h-3" /> Crisis Scenarios</SectionHeader>
                      <div className="space-y-4">
                        {cp.scenarios.map((scenario: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{scenario.name || scenario.scenario || scenario.title}</p>
                              <div className="flex gap-2">
                                {scenario.probability && <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${probBadge(scenario.probability)}`}>P: {scenario.probability}</span>}
                                {scenario.severity && <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${severityBadge(scenario.severity)}`}>S: {scenario.severity}</span>}
                              </div>
                            </div>
                            {scenario.description && <p className="text-xs text-zinc-600 mb-3">{scenario.description}</p>}

                            {/* Response steps */}
                            {scenario.responseSteps?.length > 0 && (
                              <div className="mb-3">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-2">Response Steps</p>
                                <div className="space-y-2">
                                  {scenario.responseSteps.map((step: any, j: number) => (
                                    <div key={j} className="flex items-start gap-3">
                                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-white shrink-0">{j + 1}</span>
                                      <p className="text-xs text-zinc-700">{typeof step === "string" ? step : step.action || step.description || step.step}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Communication plan */}
                            {scenario.communicationPlan && (
                              <div className="mb-3">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Communication Plan</p>
                                <p className="text-xs text-zinc-700">{typeof scenario.communicationPlan === "string" ? scenario.communicationPlan : scenario.communicationPlan.description || scenario.communicationPlan.summary}</p>
                              </div>
                            )}

                            {/* Recovery timeline */}
                            {scenario.recoveryTimeline && (
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Recovery Timeline</p>
                                <p className="text-xs text-zinc-700">{typeof scenario.recoveryTimeline === "string" ? scenario.recoveryTimeline : scenario.recoveryTimeline.estimate || scenario.recoveryTimeline.description}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Emergency contacts */}
                  {cp.emergencyContacts?.length > 0 && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Emergency Contacts</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <div className="space-y-3">
                          {cp.emergencyContacts.map((contact: any, i: number) => (
                            <div key={i} className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-zinc-900">{contact.role || contact.name || contact.title}</p>
                                {contact.responsibility && <p className="text-xs text-zinc-500">{contact.responsibility}</p>}
                              </div>
                              {(contact.contact || contact.phone || contact.email) && (
                                <span className="text-xs font-mono text-zinc-500">{contact.contact || contact.phone || contact.email}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Communication templates */}
                  {cp.communicationTemplates?.length > 0 && (
                    <div>
                      <SectionHeader><FileText className="w-3 h-3" /> Communication Templates</SectionHeader>
                      <div className="space-y-3">
                        {cp.communicationTemplates.map((tmpl: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <p className="text-sm font-semibold text-zinc-900 mb-2">{tmpl.name || tmpl.type || tmpl.title || `Template ${i + 1}`}</p>
                            {tmpl.audience && <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200 mr-2">{tmpl.audience}</span>}
                            {tmpl.channel && <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">{tmpl.channel}</span>}
                            {(tmpl.template || tmpl.content || tmpl.body) && (
                              <p className="text-xs text-zinc-600 mt-2 whitespace-pre-wrap">{tmpl.template || tmpl.content || tmpl.body}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Business continuity plan */}
                  {cp.businessContinuityPlan && (
                    <div>
                      <SectionHeader><ShieldCheck className="w-3 h-3" /> Business Continuity Plan</SectionHeader>
                      {typeof cp.businessContinuityPlan === "string" ? (
                        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                          <p className="text-sm text-zinc-700">{cp.businessContinuityPlan}</p>
                        </div>
                      ) : cp.businessContinuityPlan.phases?.length > 0 ? (
                        <div className="space-y-3">
                          {cp.businessContinuityPlan.phases.map((phase: any, i: number) => (
                            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-white">{i + 1}</span>
                                <p className="text-sm font-semibold text-zinc-900">{phase.name || phase.phase}</p>
                              </div>
                              {phase.description && <p className="text-xs text-zinc-600">{phase.description}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                          <p className="text-sm text-zinc-700">{cp.businessContinuityPlan.summary || cp.businessContinuityPlan.description || JSON.stringify(cp.businessContinuityPlan)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Insurance recommendations */}
                  {cp.insuranceRecommendations?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldCheck className="w-3 h-3" /> Insurance Recommendations</SectionHeader>
                      <div className="space-y-2">
                        {cp.insuranceRecommendations.map((rec: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            {(rec.type || rec.name) && <p className="text-sm font-semibold text-zinc-900 mb-1">{rec.type || rec.name}</p>}
                            <p className="text-sm text-zinc-700">{typeof rec === "string" ? rec : rec.description || rec.recommendation || rec.coverage}</p>
                            {rec.estimatedCost && (
                              <p className="text-[9px] font-mono text-zinc-400 mt-1">Est. cost: {rec.estimatedCost}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 68: AI Readiness ──────────────────────────────────────── */}
            {activeTab === 68 && (d as any).aiReadiness && (() => {
              const ar = (d as any).aiReadiness;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">AI Readiness Assessment</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ar.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {ar.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-3xl font-light">{ar.overallScore}<span className="text-base text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {ar.dataReadiness != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Data</p>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-zinc-800 rounded-full h-2">
                              <div className="bg-emerald-400 h-2 rounded-full transition-all" style={{ width: `${ar.dataReadiness}%` }} />
                            </div>
                            <span className="text-xs font-mono text-zinc-400">{ar.dataReadiness}</span>
                          </div>
                        </div>
                      )}
                      {ar.teamReadiness != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Team</p>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-zinc-800 rounded-full h-2">
                              <div className="bg-blue-400 h-2 rounded-full transition-all" style={{ width: `${ar.teamReadiness}%` }} />
                            </div>
                            <span className="text-xs font-mono text-zinc-400">{ar.teamReadiness}</span>
                          </div>
                        </div>
                      )}
                      {ar.infrastructureReadiness != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Infrastructure</p>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-zinc-800 rounded-full h-2">
                              <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${ar.infrastructureReadiness}%` }} />
                            </div>
                            <span className="text-xs font-mono text-zinc-400">{ar.infrastructureReadiness}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Capabilities */}
                  {ar.capabilities?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> AI Capabilities</SectionHeader>
                      <div className="space-y-4">
                        {ar.capabilities.map((cap: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{cap.area || cap.name}</p>
                              {cap.maturity && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                                  cap.maturity === "advanced" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  cap.maturity === "intermediate" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                  "bg-zinc-50 text-zinc-600 border-zinc-200"
                                }`}>{cap.maturity}</span>
                              )}
                            </div>
                            {cap.opportunity && <p className="text-sm text-zinc-600 mb-2">{cap.opportunity}</p>}
                            <div className="flex flex-wrap gap-3 mt-2">
                              {cap.estimatedImpact && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Impact</p>
                                  <p className="text-xs font-medium text-zinc-700">{cap.estimatedImpact}</p>
                                </div>
                              )}
                              {cap.effortLevel && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Effort</p>
                                  <p className="text-xs font-medium text-zinc-700">{cap.effortLevel}</p>
                                </div>
                              )}
                            </div>
                            {cap.recommendedTools?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Tools</p>
                                <div className="flex flex-wrap gap-1">
                                  {cap.recommendedTools.map((tool: string, j: number) => (
                                    <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{tool}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick wins */}
                  {ar.quickWins?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3 text-amber-500" /> Quick Wins</SectionHeader>
                      <div className="space-y-2">
                        {ar.quickWins.map((qw: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-900">{typeof qw === "string" ? qw : qw.action || qw.description || qw.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Investment & roadmap */}
                  <div className="grid grid-cols-2 gap-4">
                    {ar.investmentRequired && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Investment Required</p>
                        <p className="text-xl font-light text-zinc-900">{ar.investmentRequired}</p>
                      </div>
                    )}
                    {ar.roadmapTimeline && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Roadmap Timeline</p>
                        <p className="text-xl font-light text-zinc-900">{ar.roadmapTimeline}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 69: Network Effects ───────────────────────────────────── */}
            {activeTab === 69 && (d as any).networkEffects && (() => {
              const ne = (d as any).networkEffects;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Network Effects</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ne.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {ne.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-3xl font-light">{ne.overallScore}<span className="text-base text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {ne.hasNetworkEffects != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Network Effects</p>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                            ne.hasNetworkEffects ? "bg-emerald-900/30 text-emerald-300 border-emerald-700" : "bg-red-900/30 text-red-300 border-red-700"
                          }`}>{ne.hasNetworkEffects ? "Present" : "Absent"}</span>
                        </div>
                      )}
                      {ne.moatStrength && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Moat Strength</p>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                            ne.moatStrength === "strong" ? "bg-emerald-900/30 text-emerald-300 border-emerald-700" :
                            ne.moatStrength === "moderate" ? "bg-amber-900/30 text-amber-300 border-amber-700" :
                            "bg-zinc-800 text-zinc-300 border-zinc-700"
                          }`}>{ne.moatStrength}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Effect types */}
                  {ne.effects?.length > 0 && (
                    <div>
                      <SectionHeader><Globe className="w-3 h-3" /> Effect Types</SectionHeader>
                      <div className="space-y-4">
                        {ne.effects.map((eff: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{eff.type || eff.name}</p>
                              {eff.strength && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                                  eff.strength === "strong" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  eff.strength === "moderate" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                  "bg-zinc-50 text-zinc-600 border-zinc-200"
                                }`}>{eff.strength}</span>
                              )}
                            </div>
                            {eff.description && <p className="text-sm text-zinc-600 mb-3">{eff.description}</p>}
                            <div className="flex flex-wrap gap-4">
                              {eff.growthMultiplier != null && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Growth Multiplier</p>
                                  <p className="text-lg font-light text-zinc-900">{eff.growthMultiplier}x</p>
                                </div>
                              )}
                              {eff.defensibility && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Defensibility</p>
                                  <p className="text-xs font-medium text-zinc-700">{eff.defensibility}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    {ne.viralCoefficient != null && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Viral Coefficient</p>
                        <p className="text-2xl font-light text-zinc-900">{ne.viralCoefficient}</p>
                      </div>
                    )}
                    {ne.criticalMass && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Critical Mass</p>
                        <p className="text-2xl font-light text-zinc-900">{ne.criticalMass}</p>
                      </div>
                    )}
                  </div>

                  {/* Growth strategies */}
                  {ne.growthStrategies?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3" /> Growth Strategies</SectionHeader>
                      <div className="space-y-2">
                        {ne.growthStrategies.map((gs: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <p className="text-sm text-zinc-700">{typeof gs === "string" ? gs : gs.strategy || gs.description || gs.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 70: Data Monetization ─────────────────────────────────── */}
            {activeTab === 70 && (d as any).dataMonetization && (() => {
              const dm = (d as any).dataMonetization;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Server className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Data Monetization</p>
                    </div>
                    <p className="text-lg leading-relaxed">{dm.summary}</p>
                    {dm.totalOpportunityValue && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Total Opportunity Value</p>
                        <p className="text-4xl font-light">{dm.totalOpportunityValue}</p>
                      </div>
                    )}
                  </div>

                  {/* Data assets */}
                  {dm.dataAssets?.length > 0 && (
                    <div>
                      <SectionHeader><Server className="w-3 h-3" /> Data Assets</SectionHeader>
                      <div className="space-y-4">
                        {dm.dataAssets.map((asset: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{asset.name || asset.asset}</p>
                              {asset.effort && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                                  asset.effort === "low" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  asset.effort === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  "bg-red-50 text-red-700 border-red-200"
                                }`}>{asset.effort} effort</span>
                              )}
                            </div>
                            {asset.monetizationMethod && <p className="text-sm text-zinc-600 mb-2">{asset.monetizationMethod}</p>}
                            <div className="flex flex-wrap gap-4 mt-2">
                              {asset.estimatedValue && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Est. Value</p>
                                  <p className="text-lg font-light text-zinc-900">{asset.estimatedValue}</p>
                                </div>
                              )}
                              {asset.timeToRevenue && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Time to Revenue</p>
                                  <p className="text-xs font-medium text-zinc-700">{asset.timeToRevenue}</p>
                                </div>
                              )}
                            </div>
                            {asset.privacyConsiderations && (
                              <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-blue-800">{asset.privacyConsiderations}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Privacy compliance */}
                  {dm.privacyCompliance && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                        <p className="text-[10px] font-mono text-blue-600 uppercase tracking-widest">Privacy Compliance</p>
                      </div>
                      <p className="text-sm text-blue-900">{typeof dm.privacyCompliance === "string" ? dm.privacyCompliance : dm.privacyCompliance.description || dm.privacyCompliance.summary}</p>
                    </div>
                  )}

                  {/* Implementation roadmap */}
                  {dm.implementationRoadmap?.length > 0 && (
                    <div>
                      <SectionHeader><Clock className="w-3 h-3" /> Implementation Roadmap</SectionHeader>
                      <div className="space-y-2">
                        {dm.implementationRoadmap.map((step: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-mono bg-zinc-900 text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0">{i + 1}</span>
                            <p className="text-sm text-zinc-700">{typeof step === "string" ? step : step.action || step.description || step.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 71: Subscription Metrics ─────────────────────────────── */}
            {activeTab === 71 && (d as any).subscriptionMetrics && (() => {
              const sm = (d as any).subscriptionMetrics;
              const statusColor = (status: string) => {
                switch (status) {
                  case "excellent": return "bg-emerald-50 text-emerald-700 border-emerald-200";
                  case "good": return "bg-blue-50 text-blue-700 border-blue-200";
                  case "needs_improvement": return "bg-amber-50 text-amber-700 border-amber-200";
                  case "critical": return "bg-red-50 text-red-700 border-red-200";
                  default: return "bg-zinc-50 text-zinc-600 border-zinc-200";
                }
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <LineChart className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Subscription / SaaS Metrics</p>
                    </div>
                    <p className="text-lg leading-relaxed">{sm.summary}</p>
                    {sm.overallHealth && (
                      <div className="mt-4">
                        <span className={`text-[9px] font-mono px-3 py-1 rounded border ${
                          sm.overallHealth === "excellent" ? "bg-emerald-900/30 text-emerald-300 border-emerald-700" :
                          sm.overallHealth === "good" ? "bg-blue-900/30 text-blue-300 border-blue-700" :
                          sm.overallHealth === "needs_improvement" ? "bg-amber-900/30 text-amber-300 border-amber-700" :
                          "bg-red-900/30 text-red-300 border-red-700"
                        }`}>{sm.overallHealth.replace(/_/g, " ").toUpperCase()}</span>
                      </div>
                    )}
                  </div>

                  {/* Metric cards */}
                  {sm.metrics?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Key Metrics</SectionHeader>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {sm.metrics.map((m: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">{m.name || m.metric}</p>
                              {m.status && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${statusColor(m.status)}`}>{m.status.replace(/_/g, " ")}</span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-2">
                              <p className="text-2xl font-light text-zinc-900">{m.currentValue ?? m.value}</p>
                              {m.trend && (
                                <span className={`text-xs ${m.trend === "up" ? "text-emerald-600" : m.trend === "down" ? "text-red-600" : "text-zinc-400"}`}>
                                  {m.trend === "up" ? "\u2191" : m.trend === "down" ? "\u2193" : "\u2192"}
                                </span>
                              )}
                            </div>
                            {m.benchmark && (
                              <p className="text-[9px] font-mono text-zinc-400 mt-1">Benchmark: {m.benchmark}</p>
                            )}
                            {m.insight && (
                              <p className="text-xs text-zinc-500 mt-2">{m.insight}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cohort, expansion, NRR, payback */}
                  <div className="grid grid-cols-2 gap-4">
                    {sm.nrr != null && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Net Revenue Retention</p>
                        <p className="text-2xl font-light text-zinc-900">{sm.nrr}%</p>
                      </div>
                    )}
                    {sm.paybackPeriod && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Payback Period</p>
                        <p className="text-2xl font-light text-zinc-900">{sm.paybackPeriod}</p>
                      </div>
                    )}
                    {sm.expansionRevenue && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Expansion Revenue</p>
                        <p className="text-2xl font-light text-zinc-900">{sm.expansionRevenue}</p>
                      </div>
                    )}
                  </div>

                  {/* Cohort analysis */}
                  {sm.cohortAnalysis?.length > 0 && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Cohort Analysis</SectionHeader>
                      <div className="space-y-2">
                        {sm.cohortAnalysis.map((c: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <p className="text-sm text-zinc-700">{typeof c === "string" ? c : c.insight || c.description || c.cohort}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 72: Market Timing ─────────────────────────────────────── */}
            {activeTab === 72 && (d as any).marketTiming && (() => {
              const mt = (d as any).marketTiming;
              const timingColor = (timing: string) => {
                switch (timing) {
                  case "favorable": return "bg-emerald-50 text-emerald-700 border-emerald-200";
                  case "neutral": return "bg-amber-50 text-amber-700 border-amber-200";
                  case "unfavorable": return "bg-red-50 text-red-700 border-red-200";
                  default: return "bg-zinc-50 text-zinc-600 border-zinc-200";
                }
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Market Timing</p>
                    </div>
                    <p className="text-lg leading-relaxed">{mt.summary}</p>
                    {mt.overallTiming && (
                      <div className="mt-4">
                        <span className={`text-[9px] font-mono px-3 py-1 rounded border ${
                          mt.overallTiming === "excellent" ? "bg-emerald-900/30 text-emerald-300 border-emerald-700" :
                          mt.overallTiming === "good" ? "bg-blue-900/30 text-blue-300 border-blue-700" :
                          mt.overallTiming === "fair" ? "bg-amber-900/30 text-amber-300 border-amber-700" :
                          "bg-red-900/30 text-red-300 border-red-700"
                        }`}>{mt.overallTiming.toUpperCase()} TIMING</span>
                      </div>
                    )}
                  </div>

                  {/* Factors */}
                  {mt.factors?.length > 0 && (
                    <div>
                      <SectionHeader><Calendar className="w-3 h-3" /> Timing Factors</SectionHeader>
                      <div className="space-y-4">
                        {mt.factors.map((f: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{f.factor || f.name}</p>
                              {f.timing && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${timingColor(f.timing)}`}>{f.timing}</span>
                              )}
                            </div>
                            {f.rationale && <p className="text-sm text-zinc-600 mb-2">{f.rationale}</p>}
                            <div className="flex flex-wrap gap-4">
                              {f.window && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Window</p>
                                  <p className="text-xs font-medium text-zinc-700">{f.window}</p>
                                </div>
                              )}
                              {f.confidence != null && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Confidence</p>
                                  <p className="text-xs font-medium text-zinc-700">{f.confidence}%</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    {mt.windowOfOpportunity && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Window of Opportunity</p>
                        <p className="text-xl font-light text-zinc-900">{mt.windowOfOpportunity}</p>
                      </div>
                    )}
                    {mt.firstMoverAdvantage && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">First Mover Advantage</p>
                        <p className="text-xl font-light text-zinc-900">{typeof mt.firstMoverAdvantage === "string" ? mt.firstMoverAdvantage : mt.firstMoverAdvantage ? "Yes" : "No"}</p>
                      </div>
                    )}
                  </div>

                  {mt.marketCyclePosition && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Market Cycle Position</p>
                      <p className="text-sm text-zinc-700">{mt.marketCyclePosition}</p>
                    </div>
                  )}

                  {/* Urgent actions */}
                  {mt.urgentActions?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3 text-red-500" /> Urgent Actions</SectionHeader>
                      <div className="space-y-2">
                        {mt.urgentActions.map((ua: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <Zap className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof ua === "string" ? ua : ua.action || ua.description || ua.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 73: Scenario Stress Test ──────────────────────────────── */}
            {activeTab === 73 && (d as any).scenarioStressTest && (() => {
              const st = (d as any).scenarioStressTest;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Scenario Stress Test</p>
                    </div>
                    <p className="text-lg leading-relaxed">{st.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {st.baselineCashRunway && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Baseline Cash Runway</p>
                          <p className="text-3xl font-light">{st.baselineCashRunway}</p>
                        </div>
                      )}
                      {st.resilience && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Resilience</p>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                            st.resilience === "high" ? "bg-emerald-900/30 text-emerald-300 border-emerald-700" :
                            st.resilience === "moderate" ? "bg-amber-900/30 text-amber-300 border-amber-700" :
                            "bg-red-900/30 text-red-300 border-red-700"
                          }`}>{st.resilience.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scenarios */}
                  {st.scenarios?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldAlert className="w-3 h-3" /> Stress Scenarios</SectionHeader>
                      <div className="space-y-4">
                        {st.scenarios.map((sc: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <p className="text-sm font-semibold text-zinc-900 mb-1">{sc.name || sc.scenario}</p>
                            {sc.description && <p className="text-sm text-zinc-600 mb-3">{sc.description}</p>}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                              {sc.revenueImpact && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Revenue Impact</p>
                                  <p className="text-sm font-medium text-zinc-900">{sc.revenueImpact}</p>
                                </div>
                              )}
                              {sc.cashRunway && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Cash Runway</p>
                                  <p className="text-sm font-medium text-zinc-900">{sc.cashRunway}</p>
                                </div>
                              )}
                              {sc.breakEvenShift && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Break-Even Shift</p>
                                  <p className="text-sm font-medium text-zinc-900">{sc.breakEvenShift}</p>
                                </div>
                              )}
                              {sc.survivalProbability != null && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Survival</p>
                                  <div className="flex items-center gap-2">
                                    <div className="w-full bg-zinc-100 rounded-full h-2">
                                      <div className={`h-2 rounded-full transition-all ${
                                        sc.survivalProbability >= 70 ? "bg-emerald-500" :
                                        sc.survivalProbability >= 40 ? "bg-amber-500" :
                                        "bg-red-500"
                                      }`} style={{ width: `${sc.survivalProbability}%` }} />
                                    </div>
                                    <span className="text-xs font-mono text-zinc-500">{sc.survivalProbability}%</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            {sc.mitigationActions?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-2">Mitigation Actions</p>
                                <div className="space-y-1.5">
                                  {sc.mitigationActions.map((ma: any, j: number) => (
                                    <div key={j} className="flex gap-2 items-start">
                                      <span className="text-[9px] font-mono bg-zinc-900 text-white w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">{j + 1}</span>
                                      <p className="text-xs text-zinc-600">{typeof ma === "string" ? ma : ma.action || ma.description || ma.name}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    {st.worstCaseSurvival && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Worst Case Survival</p>
                        <p className="text-xl font-light text-zinc-900">{st.worstCaseSurvival}</p>
                      </div>
                    )}
                    {st.capitalBuffer && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Capital Buffer</p>
                        <p className="text-xl font-light text-zinc-900">{st.capitalBuffer}</p>
                      </div>
                    )}
                  </div>

                  {/* Trigger points */}
                  {st.triggerPoints?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Trigger Points</SectionHeader>
                      <div className="space-y-2">
                        {st.triggerPoints.map((tp: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof tp === "string" ? tp : tp.trigger || tp.description || tp.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 74: Pricing Strategy Matrix ──────────────────────────── */}
            {activeTab === 74 && (d as any).pricingStrategyMatrix && (() => {
              const ps = (d as any).pricingStrategyMatrix;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Pricing Strategy Matrix</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ps.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {ps.currentStrategy && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Current Strategy</p>
                          <p className="text-xl font-light">{ps.currentStrategy}</p>
                        </div>
                      )}
                      {ps.recommendedStrategy && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Recommended Strategy</p>
                          <p className="text-xl font-light text-emerald-300">{ps.recommendedStrategy}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing Tiers */}
                  {ps.tiers?.length > 0 && (
                    <div>
                      <SectionHeader><DollarSign className="w-3 h-3" /> Pricing Tiers</SectionHeader>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {ps.tiers.map((tier: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <p className="text-sm font-semibold text-zinc-900 mb-2">{tier.tierName}</p>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              {tier.priceRange && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Price Range</p>
                                  <p className="text-sm font-medium text-zinc-900">{tier.priceRange}</p>
                                </div>
                              )}
                              {tier.targetSegment && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Target Segment</p>
                                  <p className="text-sm text-zinc-600">{tier.targetSegment}</p>
                                </div>
                              )}
                              {tier.marginEstimate && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Margin</p>
                                  <p className="text-sm font-medium text-zinc-900">{tier.marginEstimate}</p>
                                </div>
                              )}
                              {tier.competitorComparison && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">vs Competitors</p>
                                  <p className="text-sm text-zinc-600">{tier.competitorComparison}</p>
                                </div>
                              )}
                            </div>
                            {tier.valueProposition && (
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Value Proposition</p>
                                <p className="text-xs text-zinc-600">{tier.valueProposition}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Psychological Pricing Tips */}
                  {ps.psychologicalPricingTips?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Psychological Pricing Tips</SectionHeader>
                      <div className="space-y-2">
                        {ps.psychologicalPricingTips.map((tip: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-mono bg-zinc-900 text-white w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <p className="text-sm text-zinc-700">{typeof tip === "string" ? tip : tip.tip || tip.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bundling Opportunities */}
                  {ps.bundlingOpportunities?.length > 0 && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Bundling Opportunities</SectionHeader>
                      <div className="space-y-2">
                        {ps.bundlingOpportunities.map((b: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-mono bg-zinc-900 text-white w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <p className="text-sm text-zinc-700">{typeof b === "string" ? b : b.opportunity || b.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Discount Policy */}
                  {ps.discountPolicy && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Discount Policy</p>
                      <p className="text-sm text-zinc-700">{ps.discountPolicy}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 75: Customer Health Score ────────────────────────────────── */}
            {activeTab === 75 && (d as any).customerHealthScore && (() => {
              const ch = (d as any).customerHealthScore;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Customer Health Score</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ch.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {ch.overallPortfolioHealth != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Portfolio Health</p>
                          <p className="text-3xl font-light">{ch.overallPortfolioHealth}<span className="text-lg text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {ch.atRiskCount != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">At Risk</p>
                          <p className="text-xl font-light text-red-300">{ch.atRiskCount}</p>
                        </div>
                      )}
                      {ch.healthyCount != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Healthy</p>
                          <p className="text-xl font-light text-emerald-300">{ch.healthyCount}</p>
                        </div>
                      )}
                      {ch.championCount != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Champions</p>
                          <p className="text-xl font-light text-blue-300">{ch.championCount}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer Cards */}
                  {ch.customers?.length > 0 && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Customer Health Indicators</SectionHeader>
                      <div className="space-y-4">
                        {ch.customers.map((cust: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{cust.customer}</p>
                              {cust.engagementLevel && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                  cust.engagementLevel === "high" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  cust.engagementLevel === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  "bg-red-50 text-red-700 border-red-200"
                                }`}>{cust.engagementLevel.toUpperCase()}</span>
                              )}
                            </div>
                            {cust.healthScore != null && (
                              <div className="mb-3">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Health Score</p>
                                  <span className="text-xs font-mono text-zinc-500">{cust.healthScore}/100</span>
                                </div>
                                <div className="w-full bg-zinc-100 rounded-full h-2">
                                  <div className={`h-2 rounded-full transition-all ${
                                    cust.healthScore >= 70 ? "bg-emerald-500" :
                                    cust.healthScore >= 40 ? "bg-amber-500" :
                                    "bg-red-500"
                                  }`} style={{ width: `${cust.healthScore}%` }} />
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              {cust.revenueContribution && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Revenue Contribution</p>
                                  <p className="text-sm font-medium text-zinc-900">{cust.revenueContribution}</p>
                                </div>
                              )}
                              {cust.growthPotential && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Growth Potential</p>
                                  <p className="text-sm text-zinc-600">{cust.growthPotential}</p>
                                </div>
                              )}
                            </div>
                            {cust.riskFactors?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {cust.riskFactors.map((rf: any, j: number) => (
                                  <span key={j} className="text-[9px] font-mono px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                                    {typeof rf === "string" ? rf : rf.factor || rf.description}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Churn Predictors */}
                  {ch.churnPredictors?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Churn Predictors</SectionHeader>
                      <div className="space-y-2">
                        {ch.churnPredictors.map((cp: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof cp === "string" ? cp : cp.predictor || cp.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 76: Revenue Waterfall ────────────────────────────────────── */}
            {activeTab === 76 && (d as any).revenueWaterfall && (() => {
              const rw = (d as any).revenueWaterfall;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Revenue Waterfall</p>
                    </div>
                    <p className="text-lg leading-relaxed">{rw.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {rw.period && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Period</p>
                          <p className="text-xl font-light">{rw.period}</p>
                        </div>
                      )}
                      {rw.netRevenueRetention && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">NRR</p>
                          <p className="text-xl font-light text-emerald-300">{rw.netRevenueRetention}</p>
                        </div>
                      )}
                      {rw.grossRevenueRetention && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">GRR</p>
                          <p className="text-xl font-light">{rw.grossRevenueRetention}</p>
                        </div>
                      )}
                      {rw.expansionRate && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Expansion</p>
                          <p className="text-xl font-light text-blue-300">{rw.expansionRate}</p>
                        </div>
                      )}
                      {rw.contractionRate && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Contraction</p>
                          <p className="text-xl font-light text-red-300">{rw.contractionRate}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Waterfall Items */}
                  {rw.items?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Waterfall Breakdown</SectionHeader>
                      <div className="space-y-3">
                        {rw.items.map((item: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{item.category}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-zinc-900">{item.amount}</span>
                                {item.percentage && (
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                    item.trend === "positive" ? "bg-emerald-50 text-emerald-700" :
                                    item.trend === "negative" ? "bg-red-50 text-red-700" :
                                    "bg-zinc-100 text-zinc-500"
                                  }`}>{item.percentage}</span>
                                )}
                              </div>
                            </div>
                            <div className="w-full bg-zinc-100 rounded-full h-2">
                              <div className={`h-2 rounded-full transition-all ${
                                item.trend === "positive" ? "bg-emerald-500" :
                                item.trend === "negative" ? "bg-red-500" :
                                "bg-zinc-400"
                              }`} style={{ width: `${Math.min(Math.abs(parseFloat(item.percentage) || 50), 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 77: Tech Debt Assessment ─────────────────────────────────── */}
            {activeTab === 77 && (d as any).techDebtAssessment && (() => {
              const td = (d as any).techDebtAssessment;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Server className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Tech Debt Assessment</p>
                    </div>
                    <p className="text-lg leading-relaxed">{td.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {td.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-3xl font-light">{td.overallScore}<span className="text-lg text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {td.totalEstimatedCost && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Total Estimated Cost</p>
                          <p className="text-xl font-light text-red-300">{td.totalEstimatedCost}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Debt Items */}
                  {td.items?.length > 0 && (
                    <div>
                      <SectionHeader><Server className="w-3 h-3" /> Debt Items</SectionHeader>
                      <div className="space-y-4">
                        {td.items.map((item: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{item.area}</p>
                              {item.severity && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                  item.severity === "critical" ? "bg-red-50 text-red-700 border-red-200" :
                                  item.severity === "high" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  item.severity === "medium" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                  "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}>{item.severity.toUpperCase()}</span>
                              )}
                            </div>
                            {item.description && <p className="text-sm text-zinc-600 mb-3">{item.description}</p>}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              {item.businessImpact && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Business Impact</p>
                                  <p className="text-sm text-zinc-700">{item.businessImpact}</p>
                                </div>
                              )}
                              {item.estimatedEffort && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Effort Estimate</p>
                                  <p className="text-sm text-zinc-700">{item.estimatedEffort}</p>
                                </div>
                              )}
                            </div>
                            {item.priority != null && (
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Priority</p>
                                <div className="flex items-center gap-2">
                                  <div className="w-full bg-zinc-100 rounded-full h-2">
                                    <div className="h-2 rounded-full bg-zinc-900 transition-all" style={{ width: `${item.priority * 10}%` }} />
                                  </div>
                                  <span className="text-xs font-mono text-zinc-500">{item.priority}/10</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Wins */}
                  {td.quickWins?.length > 0 && (
                    <div>
                      <SectionHeader><Zap className="w-3 h-3 text-emerald-500" /> Quick Wins</SectionHeader>
                      <div className="space-y-2">
                        {td.quickWins.map((qw: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                            <span className="text-[9px] font-mono bg-emerald-700 text-white w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <p className="text-sm text-emerald-900">{typeof qw === "string" ? qw : qw.action || qw.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Long-Term Investments */}
                  {td.longTermInvestments?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3" /> Long-Term Investments</SectionHeader>
                      <div className="space-y-2">
                        {td.longTermInvestments.map((lt: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-mono bg-zinc-900 text-white w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <p className="text-sm text-zinc-700">{typeof lt === "string" ? lt : lt.investment || lt.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 78: Team Performance ──────────────────────────────────────── */}
            {activeTab === 78 && (d as any).teamPerformance && (() => {
              const tp = (d as any).teamPerformance;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Team Performance</p>
                    </div>
                    <p className="text-lg leading-relaxed">{tp.summary}</p>
                    {tp.overallScore != null && (
                      <div className="mt-4">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                        <p className="text-3xl font-light">{tp.overallScore}<span className="text-lg text-zinc-500">/100</span></p>
                      </div>
                    )}
                  </div>

                  {/* Metric Cards */}
                  {tp.metrics?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Performance Metrics</SectionHeader>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {tp.metrics.map((m: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <p className="text-sm font-semibold text-zinc-900 mb-2">{m.metric}</p>
                            {m.score != null && (
                              <div className="mb-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-mono text-zinc-500">Score: {m.score}/100</span>
                                  {m.benchmark && <span className="text-xs font-mono text-zinc-400">Benchmark: {m.benchmark}</span>}
                                </div>
                                <div className="w-full bg-zinc-100 rounded-full h-2">
                                  <div className={`h-2 rounded-full transition-all ${
                                    m.score >= 70 ? "bg-emerald-500" :
                                    m.score >= 40 ? "bg-amber-500" :
                                    "bg-red-500"
                                  }`} style={{ width: `${m.score}%` }} />
                                </div>
                              </div>
                            )}
                            {m.insight && <p className="text-xs text-zinc-600">{m.insight}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths */}
                  {tp.strengths?.length > 0 && (
                    <div>
                      <SectionHeader><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Strengths</SectionHeader>
                      <div className="flex flex-wrap gap-2">
                        {tp.strengths.map((s: any, i: number) => (
                          <span key={i} className="text-[9px] font-mono px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {typeof s === "string" ? s : s.strength || s.description}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gaps */}
                  {tp.gaps?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-amber-500" /> Gaps</SectionHeader>
                      <div className="flex flex-wrap gap-2">
                        {tp.gaps.map((g: any, i: number) => (
                          <span key={i} className="text-[9px] font-mono px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {typeof g === "string" ? g : g.gap || g.description}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Training Needs */}
                  {tp.trainingNeeds?.length > 0 && (
                    <div>
                      <SectionHeader><BookOpen className="w-3 h-3" /> Training Needs</SectionHeader>
                      <div className="space-y-2">
                        {tp.trainingNeeds.map((tn: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-mono bg-zinc-900 text-white w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <p className="text-sm text-zinc-700">{typeof tn === "string" ? tn : tn.need || tn.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Culture Insights */}
                  {tp.cultureInsights?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Culture Insights</SectionHeader>
                      <div className="space-y-2">
                        {tp.cultureInsights.map((ci: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <Sparkles className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-zinc-700">{typeof ci === "string" ? ci : ci.insight || ci.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 79: Market Entry Strategy ─────────────────────────────────── */}
            {activeTab === 79 && (d as any).marketEntryStrategy && (() => {
              const me = (d as any).marketEntryStrategy;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Market Entry Strategy</p>
                    </div>
                    <p className="text-lg leading-relaxed">{me.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {me.readinessScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Readiness Score</p>
                          <p className="text-3xl font-light">{me.readinessScore}<span className="text-lg text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {me.priorityMarket && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Priority Market</p>
                          <p className="text-xl font-light text-emerald-300">{me.priorityMarket}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Market Options */}
                  {me.markets?.length > 0 && (
                    <div>
                      <SectionHeader><Globe className="w-3 h-3" /> Market Options</SectionHeader>
                      <div className="space-y-4">
                        {me.markets.map((mkt: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{mkt.market}</p>
                              {mkt.entryMode && (
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  {mkt.entryMode}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                              {mkt.marketSize && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Market Size</p>
                                  <p className="text-sm font-medium text-zinc-900">{mkt.marketSize}</p>
                                </div>
                              )}
                              {mkt.competitionLevel && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Competition</p>
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                                    mkt.competitionLevel === "high" ? "bg-red-50 text-red-700" :
                                    mkt.competitionLevel === "medium" ? "bg-amber-50 text-amber-700" :
                                    "bg-emerald-50 text-emerald-700"
                                  }`}>{mkt.competitionLevel.toUpperCase()}</span>
                                </div>
                              )}
                              {mkt.investmentRequired && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Investment</p>
                                  <p className="text-sm font-medium text-zinc-900">{mkt.investmentRequired}</p>
                                </div>
                              )}
                              {mkt.timeToRevenue && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Time to Revenue</p>
                                  <p className="text-sm text-zinc-600">{mkt.timeToRevenue}</p>
                                </div>
                              )}
                              {mkt.riskLevel && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Risk Level</p>
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                                    mkt.riskLevel === "high" ? "bg-red-50 text-red-700" :
                                    mkt.riskLevel === "medium" ? "bg-amber-50 text-amber-700" :
                                    "bg-emerald-50 text-emerald-700"
                                  }`}>{mkt.riskLevel.toUpperCase()}</span>
                                </div>
                              )}
                              {mkt.fitScore != null && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Fit Score</p>
                                  <div className="flex items-center gap-2">
                                    <div className="w-full bg-zinc-100 rounded-full h-2">
                                      <div className={`h-2 rounded-full transition-all ${
                                        mkt.fitScore >= 7 ? "bg-emerald-500" :
                                        mkt.fitScore >= 4 ? "bg-amber-500" :
                                        "bg-red-500"
                                      }`} style={{ width: `${mkt.fitScore * 10}%` }} />
                                    </div>
                                    <span className="text-xs font-mono text-zinc-500">{mkt.fitScore}/10</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Go-to-Market Approach */}
                  {me.goToMarketApproach && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Go-to-Market Approach</p>
                      <p className="text-sm text-zinc-700">{me.goToMarketApproach}</p>
                    </div>
                  )}

                  {/* Resource Requirements */}
                  {me.resourceRequirements?.length > 0 && (
                    <div>
                      <SectionHeader><Briefcase className="w-3 h-3" /> Resource Requirements</SectionHeader>
                      <div className="space-y-2">
                        {me.resourceRequirements.map((rr: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                            <span className="text-[9px] font-mono bg-zinc-900 text-white w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <p className="text-sm text-zinc-700">{typeof rr === "string" ? rr : rr.requirement || rr.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Barriers */}
                  {me.barriers?.length > 0 && (
                    <div>
                      <SectionHeader><ShieldAlert className="w-3 h-3 text-red-500" /> Barriers</SectionHeader>
                      <div className="space-y-2">
                        {me.barriers.map((b: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof b === "string" ? b : b.barrier || b.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 80: Competitive Intel Feed ────────────────────────────── */}
            {activeTab === 80 && (d as any).competitiveIntelFeed && (() => {
              const ci = (d as any).competitiveIntelFeed;
              const urgencyColor = (u: string) => {
                switch (u) {
                  case "immediate": return "bg-red-50 text-red-700 border-red-200";
                  case "soon": return "bg-amber-50 text-amber-700 border-amber-200";
                  case "monitor": return "bg-emerald-50 text-emerald-700 border-emerald-200";
                  default: return "bg-zinc-50 text-zinc-600 border-zinc-200";
                }
              };
              const impactColor = (imp: string) => {
                switch (imp) {
                  case "high": return "bg-red-50 text-red-700 border-red-200";
                  case "medium": return "bg-amber-50 text-amber-700 border-amber-200";
                  case "low": return "bg-emerald-50 text-emerald-700 border-emerald-200";
                  default: return "bg-zinc-50 text-zinc-600 border-zinc-200";
                }
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Competitive Intel Feed</p>
                    </div>
                    <p className="text-lg leading-relaxed">{ci.summary}</p>
                    {ci.threatLevel && (
                      <div className="mt-4">
                        <span className={`text-[9px] font-mono px-3 py-1 rounded border ${
                          ci.threatLevel === "high" ? "bg-red-900/30 text-red-300 border-red-700" :
                          ci.threatLevel === "moderate" ? "bg-amber-900/30 text-amber-300 border-amber-700" :
                          "bg-emerald-900/30 text-emerald-300 border-emerald-700"
                        }`}>THREAT LEVEL: {ci.threatLevel.toUpperCase()}</span>
                      </div>
                    )}
                  </div>

                  {/* Signals */}
                  {ci.signals?.length > 0 && (
                    <div>
                      <SectionHeader><Trophy className="w-3 h-3" /> Competitor Signals</SectionHeader>
                      <div className="space-y-4">
                        {ci.signals.map((s: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{s.competitor}</p>
                              <div className="flex items-center gap-2">
                                {s.signalType && (
                                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border bg-zinc-50 text-zinc-600 border-zinc-200">{s.signalType}</span>
                                )}
                                {s.urgency && (
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${urgencyColor(s.urgency)}`}>{s.urgency.toUpperCase()}</span>
                                )}
                              </div>
                            </div>
                            {s.description && <p className="text-sm text-zinc-600 mb-3">{s.description}</p>}
                            <div className="flex flex-wrap gap-4">
                              {s.impact && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Impact</p>
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${impactColor(s.impact)}`}>{s.impact.toUpperCase()}</span>
                                </div>
                              )}
                              {s.responseNeeded && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Response Needed</p>
                                  <p className="text-xs font-medium text-zinc-700">{s.responseNeeded}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Market shift indicators */}
                  {ci.marketShiftIndicators?.length > 0 && (
                    <div>
                      <SectionHeader><TrendingUp className="w-3 h-3" /> Market Shift Indicators</SectionHeader>
                      <div className="space-y-2">
                        {ci.marketShiftIndicators.map((ms: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-blue-50 border border-blue-100 rounded-xl p-4">
                            <TrendingUp className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-900">{typeof ms === "string" ? ms : ms.indicator || ms.description || ms.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Opportunity windows */}
                  {ci.opportunityWindows?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3 text-emerald-500" /> Opportunity Windows</SectionHeader>
                      <div className="space-y-2">
                        {ci.opportunityWindows.map((ow: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-900">{typeof ow === "string" ? ow : ow.opportunity || ow.description || ow.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 81: Cash Flow Sensitivity ─────────────────────────────── */}
            {activeTab === 81 && (d as any).cashFlowSensitivity && (() => {
              const cf = (d as any).cashFlowSensitivity;
              const sensitivityColor = (s: string) => {
                switch (s) {
                  case "high": return "bg-red-50 text-red-700 border-red-200";
                  case "medium": return "bg-amber-50 text-amber-700 border-amber-200";
                  case "low": return "bg-emerald-50 text-emerald-700 border-emerald-200";
                  default: return "bg-zinc-50 text-zinc-600 border-zinc-200";
                }
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Cash Flow Sensitivity</p>
                    </div>
                    <p className="text-lg leading-relaxed">{cf.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {cf.mostSensitiveVariable && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Most Sensitive Variable</p>
                          <p className="text-2xl font-light">{cf.mostSensitiveVariable}</p>
                        </div>
                      )}
                      {cf.safetyMargin && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Safety Margin</p>
                          <p className="text-2xl font-light">{cf.safetyMargin}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Variables */}
                  {cf.variables?.length > 0 && (
                    <div>
                      <SectionHeader><DollarSign className="w-3 h-3" /> Sensitivity Variables</SectionHeader>
                      <div className="space-y-4">
                        {cf.variables.map((v: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-zinc-900">{v.variable}</p>
                              {v.sensitivity && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${sensitivityColor(v.sensitivity)}`}>{v.sensitivity.toUpperCase()}</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {v.currentValue && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Current</p>
                                  <p className="text-sm font-medium text-zinc-900">{v.currentValue}</p>
                                </div>
                              )}
                              {v.bestCase && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Best Case</p>
                                  <p className="text-sm font-medium text-emerald-700">{v.bestCase}</p>
                                </div>
                              )}
                              {v.worstCase && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Worst Case</p>
                                  <p className="text-sm font-medium text-red-700">{v.worstCase}</p>
                                </div>
                              )}
                              {v.cashImpact && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Cash Impact</p>
                                  <p className="text-sm font-medium text-zinc-900">{v.cashImpact}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scenario + break-even */}
                  <div className="grid grid-cols-2 gap-4">
                    {cf.scenarioComparison && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Scenario Comparison</p>
                        <p className="text-sm text-zinc-700">{cf.scenarioComparison}</p>
                      </div>
                    )}
                    {cf.breakEvenSensitivity && (
                      <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Break-Even Sensitivity</p>
                        <p className="text-sm text-zinc-700">{cf.breakEvenSensitivity}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 82: Digital Maturity ──────────────────────────────────── */}
            {activeTab === 82 && (d as any).digitalMaturity && (() => {
              const dm = (d as any).digitalMaturity;
              const maturityColor = (m: string) => {
                switch (m) {
                  case "leading": return "bg-emerald-50 text-emerald-700 border-emerald-200";
                  case "advanced": return "bg-blue-50 text-blue-700 border-blue-200";
                  case "intermediate": return "bg-amber-50 text-amber-700 border-amber-200";
                  case "developing": return "bg-orange-50 text-orange-700 border-orange-200";
                  case "nascent": return "bg-red-50 text-red-700 border-red-200";
                  default: return "bg-zinc-50 text-zinc-600 border-zinc-200";
                }
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Digital Maturity</p>
                    </div>
                    <p className="text-lg leading-relaxed">{dm.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {dm.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-4xl font-light">{dm.overallScore}<span className="text-lg text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {dm.industryComparison && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Industry Comparison</p>
                          <p className="text-lg font-light">{dm.industryComparison}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dimensions */}
                  {dm.dimensions?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Maturity Dimensions</SectionHeader>
                      <div className="space-y-4">
                        {dm.dimensions.map((dim: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{dim.dimension}</p>
                              {dim.maturity && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${maturityColor(dim.maturity)}`}>{dim.maturity.toUpperCase()}</span>
                              )}
                            </div>
                            {dim.score != null && (
                              <div className="mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-full bg-zinc-100 rounded-full h-2">
                                    <div className={`h-2 rounded-full transition-all ${
                                      dim.score >= 80 ? "bg-emerald-500" :
                                      dim.score >= 60 ? "bg-blue-500" :
                                      dim.score >= 40 ? "bg-amber-500" :
                                      dim.score >= 20 ? "bg-orange-500" :
                                      "bg-red-500"
                                    }`} style={{ width: `${dim.score}%` }} />
                                  </div>
                                  <span className="text-xs font-mono text-zinc-500">{dim.score}/100</span>
                                </div>
                              </div>
                            )}
                            {dim.gaps?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Gaps</p>
                                <ul className="space-y-1">
                                  {dim.gaps.map((g: any, j: number) => (
                                    <li key={j} className="text-xs text-zinc-600 flex gap-2">
                                      <span className="text-red-400 shrink-0">-</span>
                                      {typeof g === "string" ? g : g.gap || g.description || g.name}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {dim.nextSteps?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Next Steps</p>
                                <ul className="space-y-1">
                                  {dim.nextSteps.map((ns: any, j: number) => (
                                    <li key={j} className="text-xs text-zinc-600 flex gap-2">
                                      <span className="text-emerald-500 shrink-0">+</span>
                                      {typeof ns === "string" ? ns : ns.step || ns.description || ns.name}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transformation priorities + investment areas */}
                  <div className="grid grid-cols-2 gap-4">
                    {dm.transformationPriorities?.length > 0 && (
                      <div>
                        <SectionHeader><Zap className="w-3 h-3 text-blue-500" /> Transformation Priorities</SectionHeader>
                        <div className="space-y-2">
                          {dm.transformationPriorities.map((tp: any, i: number) => (
                            <div key={i} className="flex gap-3 items-start bg-blue-50 border border-blue-100 rounded-xl p-4">
                              <span className="text-[9px] font-mono bg-blue-900 text-white w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                              <p className="text-sm text-blue-900">{typeof tp === "string" ? tp : tp.priority || tp.description || tp.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {dm.investmentAreas?.length > 0 && (
                      <div>
                        <SectionHeader><DollarSign className="w-3 h-3 text-emerald-500" /> Investment Areas</SectionHeader>
                        <div className="space-y-2">
                          {dm.investmentAreas.map((ia: any, i: number) => (
                            <div key={i} className="flex gap-3 items-start bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                              <DollarSign className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <p className="text-sm text-emerald-900">{typeof ia === "string" ? ia : ia.area || ia.description || ia.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Tab 83: Acquisition Funnel ────────────────────────────────── */}
            {activeTab === 83 && (d as any).acquisitionFunnel && (() => {
              const af = (d as any).acquisitionFunnel;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Acquisition Funnel</p>
                    </div>
                    <p className="text-lg leading-relaxed">{af.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {af.overallConversionRate && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Conversion</p>
                          <p className="text-3xl font-light">{af.overallConversionRate}</p>
                        </div>
                      )}
                      {af.biggestBottleneck && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Biggest Bottleneck</p>
                          <p className="text-lg font-light">{af.biggestBottleneck}</p>
                        </div>
                      )}
                      {af.costPerAcquisition && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">CPA</p>
                          <p className="text-3xl font-light">{af.costPerAcquisition}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Funnel stages — visual funnel */}
                  {af.stages?.length > 0 && (
                    <div>
                      <SectionHeader><Target className="w-3 h-3" /> Funnel Stages</SectionHeader>
                      <div className="space-y-0">
                        {af.stages.map((s: any, i: number) => {
                          const maxWidth = 100;
                          const widthPct = Math.max(30, maxWidth - (i * (60 / Math.max(af.stages.length - 1, 1))));
                          return (
                            <div key={i} className="flex justify-center">
                              <div
                                className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm mb-1 transition-all"
                                style={{ width: `${widthPct}%` }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-semibold text-zinc-900">{s.stage}</p>
                                  {s.volume && <span className="text-xs font-mono text-zinc-500">{s.volume}</span>}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs">
                                  {s.conversionRate && (
                                    <div>
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase">Conv: </span>
                                      <span className="font-medium text-emerald-700">{s.conversionRate}</span>
                                    </div>
                                  )}
                                  {s.dropOffRate && (
                                    <div>
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase">Drop: </span>
                                      <span className="font-medium text-red-600">{s.dropOffRate}</span>
                                    </div>
                                  )}
                                  {s.avgTimeInStage && (
                                    <div>
                                      <span className="text-[9px] font-mono text-zinc-400 uppercase">Avg Time: </span>
                                      <span className="font-medium text-zinc-700">{s.avgTimeInStage}</span>
                                    </div>
                                  )}
                                </div>
                                {s.bottleneck && (
                                  <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                                    Bottleneck: {s.bottleneck}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Channel breakdown */}
                  {af.channelBreakdown?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Channel Breakdown</SectionHeader>
                      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200">
                              <th className="text-left px-4 py-3 font-mono text-[9px] uppercase text-zinc-500">Channel</th>
                              <th className="text-left px-4 py-3 font-mono text-[9px] uppercase text-zinc-500">Contribution</th>
                              <th className="text-left px-4 py-3 font-mono text-[9px] uppercase text-zinc-500">CPA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {af.channelBreakdown.map((ch: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-100 last:border-0">
                                <td className="px-4 py-3 font-medium text-zinc-900">{ch.channel}</td>
                                <td className="px-4 py-3 text-zinc-600">{ch.contribution}</td>
                                <td className="px-4 py-3 text-zinc-600">{ch.cpa}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 84: Strategic Alignment ───────────────────────────────── */}
            {activeTab === 84 && (d as any).strategicAlignment && (() => {
              const sa = (d as any).strategicAlignment;
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Flag className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Strategic Alignment</p>
                    </div>
                    <p className="text-lg leading-relaxed">{sa.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {sa.overallScore != null && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Overall Score</p>
                          <p className="text-4xl font-light">{sa.overallScore}<span className="text-lg text-zinc-500">/100</span></p>
                        </div>
                      )}
                      {sa.missionVisionClarity && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Mission/Vision Clarity</p>
                          <p className="text-lg font-light">{sa.missionVisionClarity}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alignment areas */}
                  {sa.areas?.length > 0 && (
                    <div>
                      <SectionHeader><Flag className="w-3 h-3" /> Alignment Areas</SectionHeader>
                      <div className="space-y-4">
                        {sa.areas.map((a: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{a.area}</p>
                              {a.alignmentScore != null && <span className="text-xs font-mono text-zinc-500">{a.alignmentScore}/100</span>}
                            </div>
                            {a.alignmentScore != null && (
                              <div className="mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-full bg-zinc-100 rounded-full h-2">
                                    <div className={`h-2 rounded-full transition-all ${
                                      a.alignmentScore >= 80 ? "bg-emerald-500" :
                                      a.alignmentScore >= 60 ? "bg-blue-500" :
                                      a.alignmentScore >= 40 ? "bg-amber-500" :
                                      "bg-red-500"
                                    }`} style={{ width: `${a.alignmentScore}%` }} />
                                  </div>
                                </div>
                              </div>
                            )}
                            {a.gaps?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Gaps</p>
                                <ul className="space-y-1">
                                  {a.gaps.map((g: any, j: number) => (
                                    <li key={j} className="text-xs text-zinc-600 flex gap-2">
                                      <span className="text-red-400 shrink-0">-</span>
                                      {typeof g === "string" ? g : g.gap || g.description || g.name}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {a.actions?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Actions</p>
                                <ul className="space-y-1">
                                  {a.actions.map((act: any, j: number) => (
                                    <li key={j} className="text-xs text-zinc-600 flex gap-2">
                                      <span className="text-emerald-500 shrink-0">+</span>
                                      {typeof act === "string" ? act : act.action || act.description || act.name}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resource allocation fit + execution gaps */}
                  {sa.resourceAllocationFit && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Resource Allocation Fit</p>
                      <p className="text-sm text-zinc-700">{sa.resourceAllocationFit}</p>
                    </div>
                  )}

                  {sa.executionGaps?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Execution Gaps</SectionHeader>
                      <div className="space-y-2">
                        {sa.executionGaps.map((eg: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-100 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof eg === "string" ? eg : eg.gap || eg.description || eg.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 85: Budget Optimizer ──────────────────────────────────── */}
            {activeTab === 85 && (d as any).budgetOptimizer && (() => {
              const bo = (d as any).budgetOptimizer;
              const efficiencyColor = (eff: string) => {
                switch (eff) {
                  case "optimal": return "bg-emerald-50 text-emerald-700 border-emerald-200";
                  case "over_allocated": return "bg-amber-50 text-amber-700 border-amber-200";
                  case "under_allocated": return "bg-blue-50 text-blue-700 border-blue-200";
                  default: return "bg-zinc-50 text-zinc-600 border-zinc-200";
                }
              };
              const efficiencyLabel = (eff: string) => {
                switch (eff) {
                  case "optimal": return "OPTIMAL";
                  case "over_allocated": return "OVER";
                  case "under_allocated": return "UNDER";
                  default: return eff?.toUpperCase() || "N/A";
                }
              };
              return (
                <div className="space-y-6">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Budget Optimizer</p>
                    </div>
                    <p className="text-lg leading-relaxed">{bo.summary}</p>
                    <div className="flex items-center gap-6 mt-4">
                      {bo.totalBudget && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Total Budget</p>
                          <p className="text-3xl font-light">{bo.totalBudget}</p>
                        </div>
                      )}
                      {bo.savingsOpportunity && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">Savings Opportunity</p>
                          <p className="text-2xl font-light text-emerald-300">{bo.savingsOpportunity}</p>
                        </div>
                      )}
                      {bo.roiImprovementPotential && (
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase">ROI Improvement</p>
                          <p className="text-2xl font-light">{bo.roiImprovementPotential}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category cards */}
                  {bo.categories?.length > 0 && (
                    <div>
                      <SectionHeader><Calculator className="w-3 h-3" /> Budget Categories</SectionHeader>
                      <div className="space-y-4">
                        {bo.categories.map((cat: any, i: number) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-zinc-900">{cat.category}</p>
                              {cat.efficiency && (
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${efficiencyColor(cat.efficiency)}`}>{efficiencyLabel(cat.efficiency)}</span>
                              )}
                            </div>
                            <div className="mb-3 space-y-2">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">Current: {cat.currentAllocation}</p>
                                </div>
                                <div className="w-full bg-zinc-100 rounded-full h-2.5">
                                  <div className="h-2.5 rounded-full bg-zinc-400 transition-all" style={{ width: cat.currentAllocation || "0%" }} />
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[9px] font-mono text-emerald-600 uppercase">Recommended: {cat.recommendedAllocation}</p>
                                </div>
                                <div className="w-full bg-zinc-100 rounded-full h-2.5">
                                  <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: cat.recommendedAllocation || "0%" }} />
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-4">
                              {cat.roi && (
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase">ROI</p>
                                  <p className="text-xs font-medium text-zinc-700">{cat.roi}</p>
                                </div>
                              )}
                            </div>
                            {cat.reallocationSuggestion && (
                              <p className="text-xs text-zinc-600 mt-3 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">{cat.reallocationSuggestion}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Wastage areas */}
                  {bo.wastageAreas?.length > 0 && (
                    <div>
                      <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Wastage Areas</SectionHeader>
                      <div className="space-y-2">
                        {bo.wastageAreas.map((wa: any, i: number) => (
                          <div key={i} className="flex gap-3 items-start bg-red-50 border border-red-200 rounded-xl p-4">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-900">{typeof wa === "string" ? wa : wa.area || wa.description || wa.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top reallocation */}
                  {bo.topReallocation && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm text-center">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Top Reallocation</p>
                      <p className="text-xl font-light text-zinc-900">{bo.topReallocation}</p>
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
