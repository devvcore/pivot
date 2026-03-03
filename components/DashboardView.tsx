import { useEffect, useState } from "react";
import { Plus, History, ChevronRight, BarChart3, Clock, AlertCircle, CheckCircle2, TrendingUp, ShieldCheck, Sparkles, FileText, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface JobSummary {
  runId: string;
  status: string;
  orgName: string;
  industry?: string;
  createdAt: number;
  updatedAt: number;
  docCount: number;
  healthScore: number | null;
  healthGrade: string | null;
  healthHeadline: string | null;
}

interface DashboardViewProps {
  onStartNew: () => void;
  onViewRun: (runId: string) => void;
}

const GRADE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  B: { text: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  C: { text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  D: { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  F: { text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
};

const STATUS_CONFIG: Record<string, { label: string; dotClass: string; textClass: string }> = {
  completed:    { label: "Complete",    dotClass: "bg-green-500",  textClass: "text-green-700" },
  formatting:   { label: "Formatting",  dotClass: "bg-blue-500 animate-pulse",   textClass: "text-blue-700" },
  synthesizing: { label: "Analyzing",   dotClass: "bg-violet-500 animate-pulse", textClass: "text-violet-700" },
  categorizing: { label: "Processing",  dotClass: "bg-blue-500 animate-pulse",   textClass: "text-blue-700" },
  parsing:      { label: "Parsing",     dotClass: "bg-blue-500 animate-pulse",   textClass: "text-blue-700" },
  pending:      { label: "Pending",     dotClass: "bg-yellow-500", textClass: "text-yellow-700" },
  failed:       { label: "Failed",      dotClass: "bg-red-500",    textClass: "text-red-700" },
};

function ScoreBadge({ score, grade }: { score: number | null; grade: string | null }) {
  if (score == null) return null;
  const colors = grade ? GRADE_COLORS[grade] : null;
  return (
    <div className="flex items-baseline gap-1.5 shrink-0">
      <span className="text-3xl font-light text-zinc-900 tabular-nums">{score}</span>
      <span className="text-zinc-400 text-sm">/100</span>
      {grade && colors && (
        <span className={`ml-1 text-xs font-bold px-2 py-0.5 rounded border ${colors.text} ${colors.bg} ${colors.border}`}>
          {grade}
        </span>
      )}
    </div>
  );
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DashboardView({ onStartNew, onViewRun }: DashboardViewProps) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = () => {
    setLoading(true);
    fetch("/api/job/list")
      .then((res) => res.json())
      .then((data) => setJobs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchJobs(); }, []);

  const completedJobs = jobs.filter(j => j.status === "completed");
  const inProgressJobs = jobs.filter(j => !["completed", "failed"].includes(j.status));
  const failedJobs = jobs.filter(j => j.status === "failed");

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-zinc-100 rounded-full blur-[100px] -mr-64 -mt-64 opacity-50 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-zinc-100 rounded-full blur-[80px] -ml-40 -mb-40 opacity-50 pointer-events-none" />

      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 p-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-900 flex items-center justify-center rounded-xl shadow-lg shadow-zinc-900/10">
            <div className="w-3.5 h-3.5 bg-white rounded-sm rotate-45" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-xl text-zinc-900 leading-none">Pivot</div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mt-1">Enterprise Intelligence</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchJobs}
            className="p-2.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onStartNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/10 active:scale-95 group font-bold rounded-xl"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> New Analysis
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-8 lg:p-12 relative z-10">
        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-full text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">
            <Sparkles className="w-3 h-3 text-zinc-400" /> Intelligence Reports
          </div>
          <h1 className="text-4xl font-light tracking-tight text-zinc-900 mb-2">Analysis History</h1>
          <p className="text-zinc-500 max-w-xl">
            {jobs.length === 0
              ? "No analyses yet — start your first one."
              : `${completedJobs.length} completed · ${inProgressJobs.length} in progress · ${failedJobs.length} failed`}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white border border-zinc-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="text-4xl font-light mb-1">{jobs.length}</div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">Total Analyses</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white border border-zinc-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-6 group-hover:bg-green-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-5 h-5 text-green-600 group-hover:text-white" />
            </div>
            <div className="text-4xl font-light mb-1">{completedJobs.length}</div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">Completed Reports</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-zinc-900 text-white p-8 rounded-2xl shadow-xl shadow-zinc-900/10 relative overflow-hidden group cursor-pointer"
            onClick={onStartNew}
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-6 relative z-10">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-xl font-light mb-1 relative z-10 leading-tight">Start New<br />Analysis</div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-zinc-400 uppercase tracking-widest group-hover:text-white transition-colors relative z-10">
              Upload Documents <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        </div>

        {/* Reports List */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-mono text-zinc-900 uppercase tracking-[0.3em] flex items-center gap-3">
              <History className="w-4 h-4 text-zinc-400" /> Reports
            </h2>
            {jobs.length > 0 && (
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                {jobs.length} {jobs.length === 1 ? "report" : "reports"}
              </div>
            )}
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-24 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-10 h-10 border-2 border-zinc-100 border-t-zinc-900 rounded-full mx-auto mb-4"
                />
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Loading reports...</div>
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-24 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-zinc-100">
                  <BarChart3 className="w-8 h-8 text-zinc-200" />
                </div>
                <h3 className="text-xl font-light text-zinc-900 mb-2">No reports yet</h3>
                <p className="text-zinc-500 text-sm mb-10 max-w-xs mx-auto">
                  Upload your business documents to generate your first intelligence report.
                </p>
                <button
                  onClick={onStartNew}
                  className="inline-flex items-center gap-3 px-8 py-3 bg-zinc-900 text-white text-xs font-mono uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all rounded-xl"
                >
                  <Plus className="w-4 h-4" /> Start First Analysis
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-50">
                {jobs.map((job, i) => {
                  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
                  const isComplete = job.status === "completed";
                  const isRunning = !["completed", "failed"].includes(job.status);

                  return (
                    <motion.div
                      key={job.runId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      {/* Top info row */}
                      <div
                        className={`px-8 py-6 transition-all border-l-4 ${isComplete ? "border-l-transparent hover:border-l-zinc-900 hover:bg-zinc-50/50 cursor-pointer" : "border-l-transparent"}`}
                        onClick={isComplete ? () => onViewRun(job.runId) : undefined}
                      >
                        <div className="flex items-start gap-4">
                          {/* Status dot */}
                          <div className="mt-1.5 shrink-0">
                            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dotClass}`} />
                          </div>

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap mb-1">
                              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${cfg.textClass}`}>
                                {cfg.label}
                              </span>
                              {job.industry && (
                                <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  {job.industry}
                                </span>
                              )}
                              {job.docCount > 0 && (
                                <span className="text-[9px] font-mono text-zinc-400 flex items-center gap-1">
                                  <FileText className="w-3 h-3" /> {job.docCount} doc{job.docCount !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>

                            <div className="text-lg font-medium text-zinc-900 mb-1 uppercase tracking-tight">
                              {job.orgName || "Intelligence Run"}
                            </div>

                            {/* Headline for completed jobs */}
                            {isComplete && job.healthHeadline && (
                              <p className="text-sm text-zinc-500 leading-snug mb-2 line-clamp-2 max-w-2xl">
                                {job.healthHeadline}
                              </p>
                            )}

                            {/* Progress message for running */}
                            {isRunning && (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="w-32 h-1 bg-zinc-100 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ x: "-100%" }}
                                    animate={{ x: "100%" }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                    className="w-1/2 h-full bg-zinc-400"
                                  />
                                </div>
                                <span className="text-[10px] text-zinc-400 font-mono uppercase">Processing...</span>
                              </div>
                            )}

                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {formatDate(job.createdAt)}
                              </span>
                              {isComplete && job.updatedAt !== job.createdAt && (
                                <span className="text-[10px] font-mono text-zinc-400">
                                  Completed {formatDate(job.updatedAt)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Score + action */}
                          <div className="flex flex-col items-end gap-3 shrink-0">
                            {isComplete && job.healthScore != null && (
                              <ScoreBadge score={job.healthScore} grade={job.healthGrade} />
                            )}

                            {isComplete ? (
                              <button
                                onClick={() => onViewRun(job.runId)}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-700 transition-all rounded-lg shadow-sm"
                              >
                                View Report <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            ) : job.status === "failed" ? (
                              <span className="flex items-center gap-1.5 text-[10px] font-mono text-red-600 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg">
                                <AlertCircle className="w-3 h-3" /> Failed
                              </span>
                            ) : (
                              <button
                                onClick={() => onViewRun(job.runId)}
                                className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 text-zinc-500 text-xs font-mono uppercase tracking-widest hover:bg-zinc-50 transition-all rounded-lg"
                              >
                                View Progress
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="p-10 text-center border-t border-zinc-100 bg-white">
        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.4em]">Pivot Intelligence Platform</div>
      </footer>
    </div>
  );
}
