import { useEffect, useState, useRef, useMemo } from "react";
import {
  Loader2, ShieldCheck, AlertCircle, Sparkles, BrainCircuit,
  Activity, Database, FileSearch, CheckCircle2, Zap, BarChart3,
  TrendingUp, Target, Users, DollarSign, Shield, Lightbulb,
  PieChart, LineChart, Globe, Layers, Search, BookOpen, Cpu,
  Fingerprint, Network, FlaskConical, Scale, Rocket
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/* ─────────────────────────────────────────────────────────────────────────────
 * Micro-phase definitions — each real backend phase maps to multiple visual
 * sub-steps that auto-advance on timers so the user always sees movement.
 * ───────────────────────────────────────────────────────────────────────────── */

interface MicroPhase {
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  durationMs: number; // how long to show before auto-advancing
}

const MICRO_PHASES: Record<string, MicroPhase[]> = {
  pending: [
    { label: "Initializing", detail: "Setting up your analysis workspace", icon: Activity, durationMs: 2000 },
    { label: "Queueing", detail: "Preparing processing pipeline", icon: Cpu, durationMs: 2500 },
  ],
  parsing: [
    { label: "Reading Documents", detail: "Scanning uploaded files for content", icon: FileSearch, durationMs: 3000 },
    { label: "Extracting Text", detail: "Converting documents to analyzable format", icon: BookOpen, durationMs: 3500 },
    { label: "Identifying Structure", detail: "Mapping tables, headers, and data fields", icon: Layers, durationMs: 3000 },
    { label: "Processing Numbers", detail: "Parsing financial figures and metrics", icon: DollarSign, durationMs: 2500 },
  ],
  ingesting: [
    { label: "Building Knowledge Base", detail: "Organizing extracted data into structured format", icon: Database, durationMs: 3000 },
    { label: "Mapping Relationships", detail: "Connecting data points across documents", icon: Network, durationMs: 3500 },
    { label: "Verifying Sources", detail: "Cross-referencing financial facts for accuracy", icon: Fingerprint, durationMs: 3000 },
    { label: "Indexing Context", detail: "Creating searchable business context layer", icon: Search, durationMs: 2500 },
  ],
  categorizing: [
    { label: "Classifying Data", detail: "Categorizing information by business domain", icon: Layers, durationMs: 3000 },
    { label: "Building Graph", detail: "Creating knowledge connections", icon: Network, durationMs: 3000 },
  ],
  synthesizing: [
    { label: "Analyzing Revenue Model", detail: "Evaluating revenue streams and growth patterns", icon: DollarSign, durationMs: 5000 },
    { label: "Competitive Intelligence", detail: "Mapping market position and competitor landscape", icon: Target, durationMs: 5000 },
    { label: "Financial Health Check", detail: "Assessing cash flow, margins, and burn rate", icon: Activity, durationMs: 5000 },
    { label: "Customer Insights", detail: "Analyzing customer segments and lifetime value", icon: Users, durationMs: 5000 },
    { label: "Market Opportunities", detail: "Identifying growth vectors and expansion paths", icon: TrendingUp, durationMs: 5000 },
    { label: "Risk Assessment", detail: "Evaluating threats and mitigation strategies", icon: Shield, durationMs: 5000 },
    { label: "Operational Analysis", detail: "Reviewing efficiency and process optimization", icon: Zap, durationMs: 5000 },
    { label: "Pricing Intelligence", detail: "Analyzing pricing strategy and elasticity", icon: PieChart, durationMs: 5000 },
    { label: "Growth Forecasting", detail: "Projecting revenue and key metric trajectories", icon: LineChart, durationMs: 5000 },
    { label: "Strategic Recommendations", detail: "Generating actionable insights and priorities", icon: Lightbulb, durationMs: 5000 },
    { label: "Benchmark Scoring", detail: "Comparing performance against industry standards", icon: BarChart3, durationMs: 5000 },
    { label: "Deep-Dive Modules", detail: "Running specialized analyses across 400+ dimensions", icon: FlaskConical, durationMs: 5000 },
    { label: "Scoring Relevance", detail: "Prioritizing insights by business impact", icon: Scale, durationMs: 5000 },
    { label: "Cross-Referencing", detail: "Validating findings against source documents", icon: Fingerprint, durationMs: 5000 },
    { label: "Building Playbooks", detail: "Assembling actionable strategy frameworks", icon: BookOpen, durationMs: 5000 },
    { label: "Finalizing Intelligence", detail: "Consolidating all analyses into unified report", icon: Globe, durationMs: 6000 },
  ],
  formatting: [
    { label: "Generating Visualizations", detail: "Creating charts, gauges, and data displays", icon: BarChart3, durationMs: 3000 },
    { label: "Compiling Report", detail: "Assembling your business intelligence dashboard", icon: Sparkles, durationMs: 3000 },
    { label: "Final Quality Check", detail: "Verifying accuracy and completeness", icon: ShieldCheck, durationMs: 2500 },
  ],
  completed: [
    { label: "Intelligence Ready", detail: "Your analysis is complete", icon: Rocket, durationMs: 99999 },
  ],
};

// Ordered list of real backend statuses
const STATUS_ORDER = ["pending", "parsing", "ingesting", "categorizing", "synthesizing", "formatting", "completed"];

/* ─────────────────────────────────────────────────────────────────────────────
 * Progress tips — rotate through these at the bottom
 * ───────────────────────────────────────────────────────────────────────────── */

const TIPS = [
  "Pivot analyzes 400+ business dimensions for comprehensive intelligence.",
  "Your data is processed securely and never shared with third parties.",
  "Each analysis includes source-verified financial facts from your documents.",
  "Smart relevance scoring ensures the most impactful insights appear first.",
  "Custom visualizations are selected based on your data type automatically.",
  "Revenue leaks, churn risks, and growth opportunities are identified in real-time.",
  "Your dashboard will include actionable playbooks, not just data.",
  "Benchmarks compare your metrics against industry standards.",
  "Competitive intelligence maps your position in the market landscape.",
  "Strategic recommendations are prioritized by potential business impact.",
];

interface ProcessingViewProps {
  runId: string;
  onComplete: () => void;
  onError: (message: string) => void;
}

export function ProcessingView({ runId, onComplete, onError }: ProcessingViewProps) {
  const [realStatus, setRealStatus] = useState<string>("pending");
  const [microIndex, setMicroIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef(realStatus);

  // Keep ref in sync
  statusRef.current = realStatus;

  // ── Poll real backend status ──
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/job?runId=${encodeURIComponent(runId)}`);
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) setError("Job not found");
          return;
        }
        const job = await res.json();
        const newStatus = job.status ?? "pending";

        if (newStatus !== statusRef.current) {
          setRealStatus(newStatus);
          setMicroIndex(0); // reset micro-phase on real status change
        }

        if (newStatus === "completed") {
          setTimeout(() => { if (!cancelled) onComplete(); }, 1200);
          return;
        }
        if (newStatus === "failed") {
          setError(job.error || "Analysis failed");
          onError(job.error || "Analysis failed");
          return;
        }
      } catch {
        if (!cancelled) setError("Failed to fetch status");
        return;
      }
      setTimeout(poll, 2000);
    };
    poll();
    return () => { cancelled = true; };
  }, [runId, onComplete, onError]);

  // ── Auto-advance micro-phases within current real status ──
  const currentMicros = MICRO_PHASES[realStatus] || MICRO_PHASES.pending;
  const currentMicro = currentMicros[Math.min(microIndex, currentMicros.length - 1)];

  useEffect(() => {
    if (realStatus === "completed" || realStatus === "failed") return;

    if (timerRef.current) clearTimeout(timerRef.current);

    const duration = currentMicro.durationMs;
    timerRef.current = setTimeout(() => {
      setMicroIndex((prev) => {
        const nextIdx = prev + 1;
        // If we've exhausted micro-phases for this status, loop back to last few
        // so it keeps cycling and never appears stuck
        if (nextIdx >= currentMicros.length) {
          // For synthesizing, loop through the last 6 phases continuously
          if (realStatus === "synthesizing") {
            return Math.max(0, currentMicros.length - 6);
          }
          // For other phases, stay on last item
          return currentMicros.length - 1;
        }
        return nextIdx;
      });
    }, duration);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [realStatus, microIndex, currentMicro.durationMs, currentMicros.length]);

  // ── Calculate overall progress percentage ──
  useEffect(() => {
    const statusIdx = STATUS_ORDER.indexOf(realStatus);
    if (statusIdx < 0) return;

    const totalPhases = STATUS_ORDER.length;
    const phaseWeight = 100 / totalPhases;
    const baseProgress = statusIdx * phaseWeight;
    const microProgress = currentMicros.length > 1
      ? (microIndex / (currentMicros.length - 1)) * phaseWeight
      : phaseWeight;

    const total = Math.min(100, Math.round(baseProgress + microProgress * 0.8));
    setOverallProgress(realStatus === "completed" ? 100 : total);
  }, [realStatus, microIndex, currentMicros.length]);

  // ── Rotate tips ──
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((p) => (p + 1) % TIPS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const isFailed = realStatus === "failed";
  const isCompleted = realStatus === "completed";
  const Icon = currentMicro.icon;

  // Calculate completed phases for the side tracker
  const completedPhases = useMemo(() => {
    const idx = STATUS_ORDER.indexOf(realStatus);
    return STATUS_ORDER.slice(0, Math.max(0, idx));
  }, [realStatus]);

  const PHASE_LABELS: Record<string, string> = {
    pending: "Queue",
    parsing: "Parse",
    ingesting: "Ingest",
    categorizing: "Classify",
    synthesizing: "Synthesize",
    formatting: "Report",
    completed: "Done",
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 font-sans overflow-hidden relative">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[160px] opacity-[0.07]"
          animate={{
            x: ["-30%", "30%", "-30%"],
            y: ["-20%", "20%", "-20%"],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          style={{ top: "20%", left: "30%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full blur-[120px] opacity-[0.05]"
          animate={{
            x: ["20%", "-20%", "20%"],
            y: ["10%", "-10%", "10%"],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          style={{ bottom: "10%", right: "20%", background: "linear-gradient(135deg, #10b981, #06b6d4)" }}
        />
      </div>

      <div className="w-full max-w-xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-6">
            <Activity className="w-3 h-3 animate-pulse" />
            Live Analysis
          </div>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-3">
            {isCompleted ? "Analysis Complete" : "Building Your Intelligence"}
          </h1>
          <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
            {isCompleted
              ? "Your business intelligence dashboard is ready."
              : "Analyzing your data across hundreds of business dimensions."
            }
          </p>
        </motion.div>

        {/* Overall progress bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Overall Progress</span>
            <span className="text-[10px] font-mono text-zinc-400">{overallProgress}%</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800/80 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500"
              initial={{ width: "0%" }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          {/* Phase dots */}
          <div className="flex items-center justify-between mt-3 px-1">
            {STATUS_ORDER.filter(s => s !== "pending").map((phase) => {
              const isActive = phase === realStatus;
              const isDone = completedPhases.includes(phase) || realStatus === "completed";
              return (
                <div key={phase} className="flex flex-col items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    isDone ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" :
                    isActive ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)]" :
                    "bg-zinc-700"
                  }`} />
                  <span className={`text-[8px] font-mono uppercase tracking-wider ${
                    isDone ? "text-emerald-400/70" :
                    isActive ? "text-white/70" :
                    "text-zinc-700"
                  }`}>
                    {PHASE_LABELS[phase]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current micro-phase hero card */}
        <AnimatePresence mode="wait">
          {!isFailed && (
            <motion.div
              key={`${realStatus}-${microIndex}`}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="bg-white/[0.04] border border-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6"
            >
              <div className="flex items-start gap-5">
                <div className="relative">
                  <div className={`w-14 h-14 flex items-center justify-center rounded-xl border transition-all duration-500 ${
                    isCompleted
                      ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                      : "bg-white/5 border-white/10 text-white"
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-7 h-7" />
                    ) : (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      >
                        <Icon className="w-7 h-7" />
                      </motion.div>
                    )}
                  </div>
                  {!isCompleted && (
                    <motion.div
                      className="absolute inset-0 rounded-xl border border-white/20"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-white mb-1 tracking-tight">
                    {currentMicro.label}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {currentMicro.detail}
                  </p>

                  {/* Micro-phase progress bar */}
                  {!isCompleted && (
                    <div className="mt-4 h-0.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-white/40 to-white/10"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                          duration: currentMicro.durationMs / 1000,
                          ease: "easeInOut",
                        }}
                        key={`bar-${realStatus}-${microIndex}`}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Activity feed — shows recently completed micro-phases */}
        {!isFailed && !isCompleted && microIndex > 0 && (
          <div className="space-y-1 mb-8 max-h-32 overflow-hidden">
            {currentMicros.slice(Math.max(0, microIndex - 3), microIndex).reverse().map((mp, i) => (
              <motion.div
                key={`done-${mp.label}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1 - i * 0.3, x: 0 }}
                className="flex items-center gap-3 px-4 py-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <span className="text-xs text-zinc-600">{mp.label}</span>
                <span className="text-[9px] font-mono text-zinc-700 ml-auto">Done</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-red-900/20 border border-red-500/30 rounded-2xl flex items-start gap-4 mb-8"
            >
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-1">Synthesis Interrupted</div>
                <div className="text-xs text-red-200/70 leading-relaxed">{error}</div>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 text-[10px] font-mono uppercase tracking-widest text-red-400 hover:text-red-300 underline underline-offset-4"
                >
                  Restart
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rotating tip */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={tipIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4 }}
              className="text-center px-8"
            >
              <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em] mb-2">Did you know?</div>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto">{TIPS[tipIndex]}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-12 flex flex-col items-center">
          <div className="text-[9px] font-mono text-zinc-700 uppercase tracking-[0.3em] mb-3">Secured by Pivot</div>
          <div className="flex gap-4 opacity-20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <Activity className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
