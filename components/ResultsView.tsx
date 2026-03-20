"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Download, AlertCircle, TrendingUp, DollarSign, Users, Target,
  ShieldAlert, Sparkles, ChevronRight, BarChart3, Check, Share2, Zap, ExternalLink, Loader2,
  Search, X, ChevronDown, Megaphone, MessageCircle, Send,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
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

// ── Category definitions for the card grid ───────────────────────────────────
interface CategoryDef {
  id: string;
  chapterId: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;        // tailwind gradient classes
  borderColor: string;
  getSummary: (d: MVPDeliverables) => string;
  /** If set, this category has a custom dashboard renderer (not ChapterView) */
  customDashboard?: boolean;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "health",
    chapterId: "dashboard",
    label: "Health & Overview",
    icon: TrendingUp,
    color: "from-emerald-500 to-teal-600",
    borderColor: "border-emerald-200 hover:border-emerald-400",
    getSummary: (d) => {
      const hs = d.healthScore as any;
      if (hs?.score != null && hs?.grade) return `Health: ${hs.score}/100 ${hs.grade}`;
      if (hs?.score != null) return `Score: ${hs.score}/100`;
      return "Business health at a glance";
    },
    customDashboard: true,
  },
  {
    id: "financial",
    chapterId: "financial",
    label: "Financial Intelligence",
    icon: DollarSign,
    color: "from-blue-500 to-indigo-600",
    borderColor: "border-blue-200 hover:border-blue-400",
    getSummary: (d) => {
      const ci = d.cashIntelligence as any;
      if (ci?.runwayWeeks || ci?.runway_weeks) return `Runway: ${ci.runwayWeeks ?? ci.runway_weeks} weeks`;
      return "Cash, revenue, and projections";
    },
  },
  {
    id: "customers",
    chapterId: "customers",
    label: "Customers & Revenue",
    icon: Users,
    color: "from-violet-500 to-purple-600",
    borderColor: "border-violet-200 hover:border-violet-400",
    getSummary: (d) => {
      const arc = d.atRiskCustomers as any;
      const count = arc?.customers?.length;
      if (count) return `${count} at-risk client${count !== 1 ? "s" : ""} flagged`;
      return "Client insights and retention";
    },
  },
  {
    id: "market",
    chapterId: "market",
    label: "Market & Competition",
    icon: Target,
    color: "from-amber-500 to-orange-600",
    borderColor: "border-amber-200 hover:border-amber-400",
    getSummary: (d) => {
      const comp = d.competitorAnalysis as any;
      const count = comp?.competitors?.length ?? comp?.items?.length;
      if (count) return `${count} competitor${count !== 1 ? "s" : ""} tracked`;
      return "Competitive landscape";
    },
  },
  {
    id: "growth",
    chapterId: "growth",
    label: "Growth & Strategy",
    icon: Sparkles,
    color: "from-rose-500 to-pink-600",
    borderColor: "border-rose-200 hover:border-rose-400",
    getSummary: (d) => {
      const ap = d.actionPlan as any;
      const dayCount = ap?.days?.length;
      if (dayCount) return `${dayCount}-phase action plan`;
      return "Strategic roadmap";
    },
  },
  {
    id: "marketing",
    chapterId: "marketing",
    label: "Marketing & Brand",
    icon: Megaphone,
    color: "from-cyan-500 to-sky-600",
    borderColor: "border-cyan-200 hover:border-cyan-400",
    getSummary: (d) => {
      const bh = d.brandHealth as any;
      if (bh?.score) return `Brand score: ${bh.score}`;
      return "Marketing strategy & brand";
    },
  },
  {
    id: "operations",
    chapterId: "operations",
    label: "Operations & Team",
    icon: Zap,
    color: "from-lime-500 to-green-600",
    borderColor: "border-lime-200 hover:border-lime-400",
    getSummary: (d) => {
      const hp = d.hiringPlan as any;
      const count = hp?.roles?.length ?? hp?.positions?.length;
      if (count) return `${count} role${count !== 1 ? "s" : ""} in hiring plan`;
      return "Ops efficiency & people";
    },
  },
  {
    id: "risk",
    chapterId: "risk",
    label: "Risk & Compliance",
    icon: ShieldAlert,
    color: "from-red-500 to-rose-600",
    borderColor: "border-red-200 hover:border-red-400",
    getSummary: (d) => {
      const ir = d.issuesRegister as any;
      const issues = ir?.issues;
      if (Array.isArray(issues)) {
        const critical = issues.filter((i: any) => i.severity === "HIGH" || i.severity === "Critical").length;
        return critical > 0 ? `${critical} critical issue${critical !== 1 ? "s" : ""}` : `${issues.length} issue${issues.length !== 1 ? "s" : ""} tracked`;
      }
      return "Risk management";
    },
  },
];

// ── Section search index ─────────────────────────────────────────────────────
interface SearchableSection {
  key: string;
  label: string;
  categoryId: string;
  categoryLabel: string;
  chapterId: string;
}

function buildSearchIndex(): SearchableSection[] {
  const index: SearchableSection[] = [];
  for (const cat of CATEGORIES) {
    const chapter = CHAPTERS.find(ch => ch.id === cat.chapterId);
    if (!chapter) continue;
    for (const sectionKey of chapter.sections) {
      index.push({
        key: sectionKey,
        label: sectionKey
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/^./, s => s.toUpperCase()),
        categoryId: cat.id,
        categoryLabel: cat.label,
        chapterId: cat.chapterId,
      });
    }
  }
  return index;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // Simple word-start matching
  const words = q.split(/\s+/);
  return words.every(w => t.includes(w));
}

// ── Shared helpers ───────────────────────────────────────────────────────────
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
  if (!n || isNaN(n)) return "$0";
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
  const hasWarnings = (provenance.warnings?.length ?? 0) > 0;
  const hasGaps = (provenance.coverageGaps?.length ?? 0) > 0;
  if (!hasWarnings && !hasGaps) return null;

  const severity = (provenance.warnings?.length ?? 0) > 2 ? "high" : hasWarnings ? "medium" : "low";
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
          {provenance.financialFactCount} verified facts from {provenance.documentSources?.length ?? 0} document{(provenance.documentSources?.length ?? 0) !== 1 ? 's' : ''}{provenance.integrationProviderCount ? ` + ${provenance.integrationProviderCount} connected integration${provenance.integrationProviderCount !== 1 ? 's' : ''}` : ''}
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

// ── Mini Pivvy Chat Overlay ──────────────────────────────────────────────────
function PivvyChatOverlay({
  open,
  onClose,
  orgId,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onNavigate: (categoryId: string, sectionKey?: string) => void;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const searchIndex = useMemo(() => buildSearchIndex(), []);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: q }]);

    // Try local section matching first
    const matches = searchIndex.filter(s => fuzzyMatch(q, s.label) || fuzzyMatch(q, s.key));
    if (matches.length > 0 && matches.length <= 5) {
      const best = matches[0];
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Found "${best.label}" in ${best.categoryLabel}. Navigating there now.`,
      }]);
      setTimeout(() => onNavigate(best.categoryId, best.key), 400);
      return;
    }

    // Fall back to Pivvy API
    setLoading(true);
    try {
      const res = await authFetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, message: q, mode: "quick" }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data.reply ?? data.message ?? data.response ?? "I could not find a specific answer.";
        setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I could not process that request." }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-24 right-6 w-96 max-h-[480px] bg-white rounded-2xl shadow-2xl border border-zinc-200 z-50 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <MessageCircle className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-zinc-900">Ask Pivvy</span>
          <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">Navigate or ask anything</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-zinc-200 rounded-lg transition-colors">
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-zinc-400">Try: &quot;show me revenue leaks&quot; or &quot;what&apos;s my cash runway?&quot;</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-800"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 rounded-xl px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-100 p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask Pivvy anything..."
            className="flex-1 text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-zinc-400 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function ResultsView({ runId, onBack, onNewRun, onReprocess, onExecute }: ResultsViewProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation: null = card grid overview, string = expanded category
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // For the "Health & Overview" custom dashboard, which sub-tab is active
  const [coreTab, setCoreTab] = useState(0);

  const [chartOverlays, setChartOverlays] = useState<Record<string, any>>({});
  const [shareOpen, setShareOpen] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchIndex = useMemo(() => buildSearchIndex(), []);

  // Pivvy mini-chat
  const [pivvyOpen, setPivvyOpen] = useState(false);

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

  // Agent dispatch state for action plan items
  const [dispatchingTasks, setDispatchingTasks] = useState<Set<string>>(new Set());
  const [dispatchedTasks, setDispatchedTasks] = useState<Record<string, string>>({});

  const isActionable = (desc: string): boolean => {
    const lower = desc.toLowerCase();
    const actionVerbs = [
      "send ", "create ", "draft ", "post ", "reach out", "contact ", "email ",
      "schedule ", "write ", "prepare ", "build ", "set up", "setup ", "launch ",
      "publish ", "generate ", "compile ", "design ", "develop ", "implement ",
      "configure ", "update ", "submit ", "file ", "register ", "negotiate ",
      "onboard ", "hire ", "recruit ", "list ", "analyze ", "calculate ",
    ];
    return actionVerbs.some(v => lower.startsWith(v) || lower.includes(v));
  };

  const dispatchTask = async (taskKey: string, description: string, dayTitle: string) => {
    const orgId = job?.questionnaire?.orgId;
    if (!orgId) return;

    setDispatchingTasks(prev => new Set(prev).add(taskKey));
    try {
      const res = await authFetch("/api/execution/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          title: description,
          description: `From action plan (${dayTitle}): ${description}`,
          agentId: "auto",
          priority: "medium",
        }),
      });
      if (!res.ok) throw new Error("Failed to dispatch task");
      const data = await res.json();
      setDispatchedTasks(prev => ({ ...prev, [taskKey]: data.task?.id ?? data.id ?? "" }));
    } catch (err) {
      console.error("Failed to dispatch action item:", err);
    } finally {
      setDispatchingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskKey);
        return next;
      });
    }
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

  // Navigation handler for Pivvy/Coach chat agents (legacy compat)
  const handleAgentNavigate = useCallback((action: NavigateAction) => {
    // Map legacy chapter navigation to category system
    const chapterToCategory: Record<string, string> = {
      dashboard: "health", financial: "financial", customers: "customers",
      market: "market", growth: "growth", marketing: "marketing",
      operations: "operations", risk: "risk",
    };
    const catId = chapterToCategory[action.chapter] ?? action.chapter;
    setActiveCategory(catId);
    if (catId === "health" && action.coreTab != null) {
      setCoreTab(action.coreTab);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Pivvy overlay navigation
  const handlePivvyNavigate = useCallback((categoryId: string, _sectionKey?: string) => {
    setActiveCategory(categoryId);
    setPivvyOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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

  // Populated chapters
  const chapters = useMemo(() => {
    const d = job?.deliverables as MVPDeliverables | undefined;
    if (!d) return CHAPTERS;
    return getPopulatedChapters(
      d as unknown as Record<string, unknown>,
      d.selectedSections,
    );
  }, [job?.deliverables]);

  // Count sections per category
  const categorySectionCounts = useMemo(() => {
    const d = job?.deliverables as Record<string, unknown> | undefined;
    if (!d) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      const chapter = CHAPTERS.find(ch => ch.id === cat.chapterId);
      if (!chapter) { counts[cat.id] = 0; continue; }
      counts[cat.id] = chapter.sections.filter(key => d[key] != null && d[key] !== "").length;
    }
    return counts;
  }, [job?.deliverables]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const d = job?.deliverables as Record<string, unknown> | undefined;
    return searchIndex
      .filter(s => {
        if (!fuzzyMatch(searchQuery, s.label) && !fuzzyMatch(searchQuery, s.key)) return false;
        // Only show sections that have data
        return d ? d[s.key] != null && d[s.key] !== "" : true;
      })
      .slice(0, 12);
  }, [searchQuery, searchIndex, job?.deliverables]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Loading / Error / In-Progress states ───────────────────────────────────

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

  // ── Data helpers ───────────────────────────────────────────────────────────
  const hs = d.healthScore ?? {} as any;
  const ci = d.cashIntelligence ?? {} as any;
  const rl = d.revenueLeakAnalysis ?? {} as any;
  const ir = d.issuesRegister ?? {} as any;
  const arc = d.atRiskCustomers ?? {} as any;
  const db2 = d.decisionBrief ?? {} as any;
  const ap = d.actionPlan ?? {} as any;
  const chartOrgId = job.questionnaire.orgId ?? "default-org";

  const radarData = (hs?.dimensions || []).map((dim: any) => ({
    dimension: (dim.name ?? "\u2014").split(" ")[0],
    score: dim.score ?? 0,
  }));

  const rawWeeklyModel = (ci as any)?.weeklyProjections || (ci as any)?.weekly_model || [];
  const weeklyModel = (rawWeeklyModel as any[]).map((entry: any) => ({
    week: typeof entry.week === "string" ? (parseInt(entry.week, 10) || 0) : (entry.week ?? 0),
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

  // ══════════════════════════════════════════════════════════════════════════════
  // ── RENDER ─────────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col font-sans">

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={activeCategory ? () => setActiveCategory(null) : onBack} className="p-2 hover:bg-zinc-50 rounded-full transition-colors text-zinc-400 hover:text-zinc-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 border-l border-zinc-200 pl-4">
            <div className="w-7 h-7 bg-zinc-900 flex items-center justify-center rounded-md shadow-sm">
              <div className="w-2.5 h-2.5 bg-white rounded-sm rotate-45" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-zinc-900 leading-none">{job.questionnaire.organizationName}</div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-0.5">
                {activeCategory
                  ? CATEGORIES.find(c => c.id === activeCategory)?.label ?? "Intelligence Report"
                  : "Intelligence Report"
                }
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search trigger */}
          <button
            onClick={() => { setSearchOpen(!searchOpen); setTimeout(() => searchInputRef.current?.focus(), 100); }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 text-zinc-500 text-xs font-mono rounded-lg hover:bg-zinc-50 transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline text-[9px] bg-zinc-100 px-1.5 py-0.5 rounded ml-1">Ctrl+K</kbd>
          </button>
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

      {/* ── Search Overlay ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sticky top-[61px] z-20 bg-white border-b border-zinc-200 shadow-lg"
          >
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sections... (e.g. revenue leaks, hiring plan, SWOT)"
                  className="w-full pl-10 pr-10 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-400 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-200 rounded-full"
                  >
                    <X className="w-3 h-3 text-zinc-400" />
                  </button>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-1 max-h-[320px] overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.key}
                      onClick={() => {
                        setActiveCategory(result.categoryId);
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors text-left group"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 truncate">{result.label}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">{result.categoryLabel}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-sm text-zinc-400 mt-3 text-center py-4">No matching sections found</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Score Hero (compact) ───────────────────────────────────────────── */}
      {!activeCategory && (
        <div className="bg-zinc-900 text-white px-6 py-6">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 items-center">
            <div className="text-center md:text-left flex-1">
              <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-1">Business Health Score</p>
              <div className="flex items-end gap-3 justify-center md:justify-start">
                <span className="text-6xl font-light tabular-nums">{hs?.score ?? "\u2014"}</span>
                <span className="text-lg text-zinc-500 mb-1">/100</span>
                {hs?.grade && (
                  <span className={`text-xl font-bold mb-1 px-3 py-1 rounded-lg ${GRADE_COLORS[hs.grade]?.text ?? "text-zinc-300"} ${GRADE_COLORS[hs.grade]?.bg ?? "bg-zinc-800"}`}>
                    {formatLabel(hs.grade)}
                  </span>
                )}
              </div>
              {hs?.headline && <p className="text-base font-medium mt-1 text-zinc-100">{hs.headline}</p>}
            </div>
            {radarData.length > 0 && (
              <div className="w-56 h-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="60%">
                    <PolarGrid stroke="#3f3f46" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fill: "#71717a", fontSize: 9 }} tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 12) + "\u2026" : v} />
                    <Radar name="Score" dataKey="score" stroke="#e4e4e7" fill="#e4e4e7" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Breadcrumb when inside a category ──────────────────────────────── */}
      {activeCategory && (
        <div className="bg-white border-b border-zinc-100 px-6 py-2">
          <div className="max-w-5xl mx-auto flex items-center gap-2 text-xs font-mono text-zinc-400">
            <button onClick={() => setActiveCategory(null)} className="hover:text-zinc-700 transition-colors">Overview</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-700">{CATEGORIES.find(c => c.id === activeCategory)?.label}</span>
          </div>
        </div>
      )}

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto w-full px-4 py-8">
        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* ── OVERVIEW: Category Card Grid ────────────────────────────── */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {!activeCategory && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {d.dataProvenance && <ConfidenceBanner provenance={d.dataProvenance} />}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {CATEGORIES.map((cat, i) => {
                  const Icon = cat.icon;
                  const count = categorySectionCounts[cat.id] ?? 0;
                  if (count === 0) return null;

                  return (
                    <motion.button
                      key={cat.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`group relative bg-white border-2 rounded-2xl p-5 text-left transition-all shadow-sm hover:shadow-md ${cat.borderColor}`}
                    >
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition-transform`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-zinc-900 mb-1">{cat.label}</h3>

                      {/* Summary stat */}
                      <p className="text-xs text-zinc-500 leading-relaxed mb-3">{cat.getSummary(d)}</p>

                      {/* Section count + arrow */}
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
                          {count} section{count !== 1 ? "s" : ""}
                        </span>
                        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Quick-glance summary cards below the grid */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Cash */}
                {(ci as any).currentCashPosition || (ci as any).current_cash_position ? (
                  <div
                    onClick={() => setActiveCategory("financial")}
                    className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-blue-300 transition-all"
                  >
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Cash Position</p>
                    <p className="text-2xl font-light text-zinc-900">{fmt(Number((ci as any).currentCashPosition ?? (ci as any).current_cash_position ?? 0))}</p>
                    <p className="text-xs text-zinc-500 mt-1">{(ci as any).runwayWeeks ?? (ci as any).runway_weeks ?? "?"} weeks runway</p>
                  </div>
                ) : null}

                {/* Revenue Leaks */}
                {rl.totalIdentified ? (
                  <div
                    onClick={() => setActiveCategory("financial")}
                    className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-red-300 transition-all"
                  >
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Revenue Leaks</p>
                    <p className="text-2xl font-light text-red-600">{fmt(rl.totalIdentified)}</p>
                    <p className="text-xs text-zinc-500 mt-1">{(rl.items || []).length} leak{(rl.items || []).length !== 1 ? "s" : ""} identified</p>
                  </div>
                ) : null}

                {/* Issues */}
                {(ir.issues || []).length > 0 && (
                  <div
                    onClick={() => setActiveCategory("risk")}
                    className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-red-300 transition-all"
                  >
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Open Issues</p>
                    <p className="text-2xl font-light text-zinc-900">{(ir.issues || []).length}</p>
                    <p className="text-xs text-red-500 mt-1">
                      {(ir.issues || []).filter((i: any) => i.severity === "HIGH" || i.severity === "Critical").length} critical
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* ── HEALTH & OVERVIEW: Custom Dashboard ────────────────────── */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeCategory === "health" && (
            <motion.div
              key="health"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {d.dataProvenance && <ConfidenceBanner provenance={d.dataProvenance} />}

              {/* Dashboard sub-nav pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { id: 0, label: "Health Score",    icon: TrendingUp  },
                  { id: 1, label: "Cash",           icon: DollarSign   },
                  { id: 2, label: "Revenue Leaks",  icon: AlertCircle  },
                  { id: 3, label: "Issues",         icon: ShieldAlert  },
                  { id: 4, label: "At-Risk Clients",icon: Users        },
                  { id: 5, label: "Decision Brief", icon: Target       },
                  { id: 6, label: "Action Plan",    icon: Sparkles     },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = coreTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setCoreTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono rounded-full border transition-all ${
                        isActive
                          ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                          : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* ── Health Score ──────────────────────────────────────────── */}
              {coreTab === 0 && (
                <div className="space-y-4">
                  {(hs.dimensions || []).map((dim: any, i: number) => (
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

              {/* ── Cash Intelligence ─────────────────────────────────────── */}
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

                  <CashFlowChart projections={weeklyModel} overlay={chartOverlays.cash} />
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
                        {(ci.risks || []).map((r: any, i: number) => (
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
                        {(ci.recommendations || []).map((a: any, i: number) => (
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

              {/* ── Revenue Leaks ─────────────────────────────────────────── */}
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
                      <p className="text-xs text-zinc-700 font-medium leading-snug">{(rl as any)?.priorityAction ?? (rl as any)?.priority_action ?? "\u2014"}</p>
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

                  {(rl?.items || []).map((item: any, i: number) => (
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

              {/* ── Issues Register ───────────────────────────────────────── */}
              {coreTab === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                    {[
                      { label: "Total Issues",        value: String((ir.issues ?? []).length) },
                      { label: "Critical",            value: String((ir.issues ?? []).filter((i: any) => i.severity === "HIGH" || i.severity === "Critical").length), cls: "text-red-600" },
                      { label: "Financial Exposure",  value: fmt((ir.issues ?? []).reduce((s: number, i: any) => s + (i.financialImpact ?? 0), 0)) },
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

                  {(ir.issues || []).map((issue: any, i: number) => {
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

                        {issue.solution && (
                          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-widest">Recommended Solution</span>
                            </div>
                            <p className="text-sm text-emerald-900 leading-relaxed break-words">{issue.solution}</p>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {issue.expectedROI && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                                  ROI: {issue.expectedROI}
                                </span>
                              )}
                              {issue.implementationCost && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded-full border border-zinc-200">
                                  Cost: {issue.implementationCost}
                                </span>
                              )}
                              {issue.implementationTimeline && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
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

              {/* ── At-Risk Customers ─────────────────────────────────────── */}
              {coreTab === 4 && (
                <div className="space-y-4">
                  {arc.summary && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                      <p className="text-sm font-medium text-zinc-900">
                        Revenue at Risk: <span className="text-red-600 text-xl font-light ml-2">
                          {fmt(arc.customers?.reduce((s: number, c: any) => s + (c.revenueAtRisk ?? 0), 0) ?? 0)}
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

                  {(arc.customers || []).map((c: any, i: number) => (
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

              {/* ── Decision Brief ────────────────────────────────────────── */}
              {coreTab === 5 && (
                <div className="space-y-4">
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Decision Required</p>
                    <p className="text-2xl font-light mb-3">{db2?.decision ?? "\u2014"}</p>
                    {db2?.context && <p className="text-zinc-400 text-sm leading-relaxed">{db2.context}</p>}
                  </div>

                  {(db2?.options || []).length > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {(db2?.options || []).map((opt: any, i: number) => (
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
                                {opt.pros.map((p: string, pi: number) => (
                                  <p key={pi} className="text-xs text-zinc-700">+ {p}</p>
                                ))}
                              </div>
                            )}
                            {opt.cons && opt.cons.length > 0 && (
                              <div>
                                <p className="text-[9px] font-mono text-red-600 uppercase tracking-widest mb-1">Cons</p>
                                {opt.cons.map((c: string, ci2: number) => (
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

              {/* ── Action Plan ───────────────────────────────────────────── */}
              {coreTab === 6 && (
                <div>
                  <div className="space-y-10 relative before:absolute before:inset-0 before:left-[11px] before:w-[1px] before:bg-zinc-100 before:z-0">
                    {(ap.days || []).map((day: any, i: number) => (
                      <div key={i} className="relative z-10 pl-10">
                        <div className="absolute left-0 top-0 w-6 h-6 bg-white border-2 border-zinc-900 rounded-full flex items-center justify-center text-[10px] font-bold">
                          {day.day}
                        </div>
                        <div className="mb-4">
                          <h4 className="text-lg font-medium text-zinc-900">{day.title}</h4>
                          <div className="h-[1px] w-10 bg-zinc-200 mt-1" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {day.tasks.map((task: any, j: number) => {
                            const taskKey = `${i}-${j}`;
                            const isChecked = completedTasks.has(taskKey);
                            const actionable = isActionable(task.description);
                            const isDispatching = dispatchingTasks.has(taskKey);
                            const dispatched = dispatchedTasks[taskKey];
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
                                    {actionable && !dispatched && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); dispatchTask(taskKey, task.description, day.title); }}
                                        disabled={isDispatching}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all disabled:opacity-50"
                                      >
                                        {isDispatching ? (
                                          <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Sending...</>
                                        ) : (
                                          <><Zap className="w-2.5 h-2.5" /> Have agent do it</>
                                        )}
                                      </button>
                                    )}
                                    {dispatched && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onExecute?.(); }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5" /> View in Execution
                                      </button>
                                    )}
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

              {/* Also render "dashboard" chapter's non-core sections via ChapterView */}
              {(() => {
                const dashboardChapter = CHAPTERS.find(ch => ch.id === "dashboard");
                if (!dashboardChapter) return null;
                const nonCoreSections = dashboardChapter.sections.filter(
                  s => !["healthScore", "cashIntelligence", "revenueLeakAnalysis", "issuesRegister", "atRiskCustomers", "decisionBrief", "actionPlan"].includes(s)
                );
                const hasData = nonCoreSections.some(key => {
                  const val = (d as unknown as Record<string, unknown>)[key];
                  return val != null && val !== "";
                });
                if (!hasData) return null;
                return (
                  <div className="mt-8">
                    <ChapterView
                      chapterId="dashboard"
                      sections={nonCoreSections}
                      deliverables={d as unknown as Record<string, unknown>}
                      title="Additional Insights"
                      description="Executive metrics, forecasts, and benchmarks"
                      claimValidations={d.claimValidations}
                    />
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* ── OTHER CATEGORIES: ChapterView ──────────────────────────── */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeCategory && activeCategory !== "health" && (() => {
            const cat = CATEGORIES.find(c => c.id === activeCategory);
            if (!cat) return null;
            const chapter = CHAPTERS.find(ch => ch.id === cat.chapterId);
            if (!chapter) return null;
            return (
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {d.dataProvenance && <ConfidenceBanner provenance={d.dataProvenance} />}
                <ChapterView
                  chapterId={chapter.id}
                  sections={chapter.sections}
                  deliverables={d as unknown as Record<string, unknown>}
                  title={chapter.label}
                  description={chapter.description}
                  claimValidations={d.claimValidations}
                />
              </motion.div>
            );
          })()}

        </AnimatePresence>
      </main>

      {/* ── Share Modal ──────────────────────────────────────────────────── */}
      <ShareModal
        runId={runId}
        orgId={job.questionnaire.orgId ?? "default-org"}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      {/* ── Floating Ask Pivvy Button ──────────────────────────────────────── */}
      <button
        onClick={() => setPivvyOpen(!pivvyOpen)}
        className="fixed bottom-6 right-24 z-40 w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        title="Ask Pivvy"
      >
        {pivvyOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {pivvyOpen && (
          <PivvyChatOverlay
            open={pivvyOpen}
            onClose={() => setPivvyOpen(false)}
            orgId={job.questionnaire.orgId ?? "default-org"}
            onNavigate={handlePivvyNavigate}
          />
        )}
      </AnimatePresence>

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
