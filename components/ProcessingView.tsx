import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, AlertCircle, Sparkles, BrainCircuit, Activity, Database, FileSearch, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const STEPS: { key: string; label: string; icon: any }[] = [
  { key: "pending", label: "Queueing Request", icon: Activity },
  { key: "parsing", label: "Ingesting Documents", icon: Database },
  { key: "categorizing", label: "Mapping Context", icon: FileSearch },
  { key: "synthesizing", label: "AI Synthesis", icon: BrainCircuit },
  { key: "formatting", label: "Generating Report", icon: Sparkles },
  { key: "completed", label: "Intelligence Ready", icon: CheckCircle2 },
];

interface ProcessingViewProps {
  runId: string;
  onComplete: () => void;
  onError: (message: string) => void;
}

export function ProcessingView({ runId, onComplete, onError }: ProcessingViewProps) {
  const [status, setStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);

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
        setStatus(job.status ?? "pending");
        if (job.status === "completed") {
          // Delay completion a bit so the user sees the final state
          setTimeout(() => {
            if (!cancelled) onComplete();
          }, 1000);
          return;
        }
        if (job.status === "failed") {
          setError(job.error || "Analysis failed");
          onError(job.error || "Analysis failed");
          return;
        }
      } catch {
        if (!cancelled) setError("Failed to fetch status");
        return;
      }
      setTimeout(poll, 1500);
    };
    poll();
    return () => { cancelled = true; };
  }, [runId, onComplete, onError]);

  const stepIndex = STEPS.findIndex((s) => s.key === status);
  const isFailed = status === "failed";

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 font-sans overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-zinc-800 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-6">
            <Activity className="w-3 h-3 animate-pulse" /> Live Analysis Phase
          </div>
          <h1 className="text-4xl font-light tracking-tight text-white mb-4">Synthesizing Business Intelligence</h1>
          <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
            Pivot is currently processing your data assets through our neural synthesis engine.
          </p>
        </motion.div>

        <div className="space-y-1 relative">
          {/* Vertical Progress Line */}
          <div className="absolute left-[21px] top-6 bottom-6 w-[1px] bg-zinc-800" />

          <div className="space-y-4">
            {STEPS.map((step, i) => {
              const active = step.key === status;
              const done = stepIndex > i || status === "completed";
              const Icon = step.icon;

              return (
                <motion.div
                  key={step.key}
                  initial={false}
                  animate={{
                    opacity: done || active ? 1 : 0.3,
                    x: active ? 4 : 0
                  }}
                  className={`flex items-start gap-6 p-4 rounded-xl transition-colors ${active ? 'bg-white/5 border border-white/10' : ''}`}
                >
                  <div className="relative z-10">
                    <div
                      className={`w-11 h-11 flex items-center justify-center rounded-lg border transition-all duration-500 ${done ? "bg-white border-white text-zinc-950" :
                          active ? "bg-zinc-800 border-zinc-700 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]" :
                            "bg-zinc-900 border-zinc-800 text-zinc-600"
                        }`}
                    >
                      {active && !done ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        >
                          <Icon className="w-5 h-5" />
                        </motion.div>
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    {active && !done && (
                      <motion.div
                        layoutId="active-glow"
                        className="absolute inset-0 bg-white/20 blur-xl rounded-full"
                      />
                    )}
                  </div>

                  <div className="flex-1 pt-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium transition-colors ${active ? "text-white" : done ? "text-zinc-300" : "text-zinc-600"}`}>
                        {step.label}
                      </span>
                      {done && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-[10px] font-mono text-zinc-500 uppercase"
                        >
                          Verified
                        </motion.span>
                      )}
                    </div>
                    <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                      {active && (
                        <motion.div
                          className="h-full bg-white"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                      {done && <div className="h-full w-full bg-zinc-700" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 p-6 bg-red-900/20 border border-red-500/30 rounded-2xl flex items-start gap-4"
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
                  Restart Engine
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-20 flex flex-col items-center">
          <div className="text-[10px] font-mono text-zinc-700 uppercase tracking-[0.3em] mb-4">Secured by Pivot Protocol</div>
          <div className="flex gap-4 opacity-30">
            <ShieldCheck className="w-4 h-4" />
            <Loader2 className="w-4 h-4 animate-spin" />
            <Activity className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
