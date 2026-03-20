"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Search,
  Plus,
  X,
  Clock,
  Tag,
  User,
  Zap,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Minus,
  FileText,
  Sparkles,
  Building2,
  ClipboardList,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type TicketStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
type TicketPriority = "critical" | "high" | "medium" | "low";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: string | null;
  assigneeType: "person" | "agent" | null;
  dueDate: string | null;
  tags: string[];
  aiSummary: string | null;
  linkedContactId: string | null;
  linkedContactName: string | null;
  createdAt: string;
}

// ─── Column Config ──────────────────────────────────────────────────────────

const COLUMNS: { key: TicketStatus; label: string; color: string; bg: string; border: string; dot: string }[] = [
  { key: "backlog",     label: "Backlog",     color: "text-zinc-600",   bg: "bg-zinc-50",    border: "border-zinc-300",   dot: "bg-zinc-400" },
  { key: "todo",        label: "To Do",       color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",   dot: "bg-blue-500" },
  { key: "in_progress", label: "In Progress", color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",  dot: "bg-amber-500" },
  { key: "review",      label: "Review",      color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200", dot: "bg-violet-500" },
  { key: "done",        label: "Done",        color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200",dot: "bg-emerald-500" },
];

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; bg: string; border: string; icon: typeof ChevronUp }> = {
  critical: { label: "Critical", color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    icon: AlertCircle },
  high:     { label: "High",     color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", icon: ChevronUp },
  medium:   { label: "Medium",   color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", icon: Minus },
  low:      { label: "Low",      color: "text-zinc-500",   bg: "bg-zinc-50",   border: "border-zinc-200",   icon: ChevronDown },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function PMLoadingSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, ci) => (
        <div key={ci} className="flex-shrink-0 w-72">
          <div className="h-10 bg-zinc-200 rounded-t-xl animate-pulse" />
          <div className="space-y-2 min-h-[200px] bg-zinc-50/50 border border-t-0 border-zinc-200 rounded-b-xl p-2">
            {Array.from({ length: 2 }).map((_, ti) => (
              <div key={ti} className="bg-white border border-zinc-200 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="h-5 w-16 bg-zinc-200 rounded animate-pulse" />
                </div>
                <div className="h-4 w-40 bg-zinc-200 rounded animate-pulse" />
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 bg-zinc-100 rounded-full animate-pulse" />
                  <div className="h-3 w-16 bg-zinc-100 rounded animate-pulse" />
                </div>
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-zinc-100 rounded animate-pulse" />
                  <div className="flex gap-1">
                    <div className="h-4 w-10 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-4 w-10 bg-zinc-100 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function PMEmptyState({ onGenerate, onCreate }: { onGenerate: () => void; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-6">
        <ClipboardList className="w-8 h-8 text-zinc-300" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">No tickets yet</h2>
      <p className="text-sm text-zinc-500 text-center max-w-md mb-8">
        Generate tickets from your business analysis, or create one manually to get started.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onGenerate}
          className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-800 transition-all rounded-xl"
        >
          <Sparkles className="w-4 h-4" />
          Generate from Analysis
        </button>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-5 py-2.5 border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-widest hover:bg-zinc-50 transition-all rounded-xl"
        >
          <Plus className="w-4 h-4" />
          Create Ticket
        </button>
      </div>
    </div>
  );
}

// ─── Error State ────────────────────────────────────────────────────────────

function PMErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-red-300" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">Failed to load tickets</h2>
      <p className="text-sm text-zinc-500 text-center max-w-md mb-6">
        Something went wrong while fetching your project board. Please try again.
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-800 transition-all rounded-xl"
      >
        <RefreshCw className="w-4 h-4" />
        Retry
      </button>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface PMBoardProps {
  orgId: string;
  onBack: () => void;
}

export function PMBoard({ orgId, onBack }: PMBoardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [generating, setGenerating] = useState(false);

  // Fetch tickets — API only, no demo fallback
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/pm/tickets?orgId=${encodeURIComponent(orgId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
      setTickets([]);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleGenerateFromAnalysis = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/pm/generate?orgId=${encodeURIComponent(orgId)}`, { method: "POST" });
      if (res.ok) {
        await fetchTickets();
      }
    } catch {
      // generation failed
    }
    setGenerating(false);
  };

  const handleCreateTicket = () => {
    // Placeholder — would open a ticket creation form or modal
  };

  const handleAssignToAgent = (ticket: Ticket) => {
    // Would dispatch to execution system
  };

  // Filtering
  const filtered = useMemo(() => {
    let result = tickets;
    if (priorityFilter !== "all") result = result.filter(t => t.priority === priorityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [tickets, priorityFilter, search]);

  // Group by status
  const grouped = useMemo(() => {
    const map: Record<TicketStatus, Ticket[]> = {
      backlog: [], todo: [], in_progress: [], review: [], done: [],
    };
    for (const t of filtered) {
      map[t.status].push(t);
    }
    // Sort by priority within each column
    const priorityOrder: Record<TicketPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    for (const key of Object.keys(map) as TicketStatus[]) {
      map[key].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    }
    return map;
  }, [filtered]);

  // Stats
  const totalActive = tickets.filter(t => t.status !== "done").length;
  const totalDone = tickets.filter(t => t.status === "done").length;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 px-3 sm:px-6 py-3 sm:py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900">Project Board</h1>
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">Tasks & Tickets</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
            {/* Stats */}
            {tickets.length > 0 && (
              <div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono">
                <span className="text-zinc-500">{totalActive} active</span>
                <span className="text-emerald-600">{totalDone} done</span>
              </div>
            )}

            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 w-full sm:w-48"
              />
            </div>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as TicketPriority | "all")}
              className="px-3 py-2 text-xs font-mono border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 uppercase tracking-wider"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Generate from analysis */}
            <button
              onClick={handleGenerateFromAnalysis}
              disabled={generating}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-800 transition-all rounded-xl disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${generating ? "animate-pulse" : ""}`} />
              <span className="hidden sm:inline">Generate from Analysis</span>
              <span className="sm:hidden">Generate</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1400px] mx-auto p-6">
        {loading ? (
          <PMLoadingSkeleton />
        ) : error ? (
          <PMErrorState onRetry={fetchTickets} />
        ) : tickets.length === 0 ? (
          <PMEmptyState onGenerate={handleGenerateFromAnalysis} onCreate={handleCreateTicket} />
        ) : (
          /* Kanban Board */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col, ci) => (
              <motion.div
                key={col.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: ci * 0.05 }}
                className="flex-shrink-0 w-72"
              >
                {/* Column header */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl border-t-2 ${col.border} bg-white`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                  <span className="text-[10px] font-mono text-zinc-400 ml-auto">{grouped[col.key].length}</span>
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[200px] bg-zinc-50/50 border border-t-0 border-zinc-200 rounded-b-xl p-2">
                  {grouped[col.key].length === 0 && (
                    <div className="text-center py-8 text-zinc-300 text-xs font-mono">No tickets</div>
                  )}
                  {grouped[col.key].map((ticket, ti) => {
                    const pCfg = PRIORITY_CONFIG[ticket.priority];
                    const PIcon = pCfg.icon;
                    return (
                      <motion.div
                        key={ticket.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: ci * 0.05 + ti * 0.03 }}
                        onClick={() => setSelectedTicket(ticket)}
                        className="bg-white border border-zinc-200 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-zinc-300 transition-all group"
                      >
                        {/* Priority + Title */}
                        <div className="flex items-start gap-2 mb-2">
                          <div className={`shrink-0 mt-0.5 flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${pCfg.color} ${pCfg.bg} ${pCfg.border}`}>
                            <PIcon className="w-3 h-3" />
                            {pCfg.label}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-zinc-900 mb-2 leading-snug">{ticket.title}</div>

                        {/* Assignee */}
                        {ticket.assignee && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              ticket.assigneeType === "agent"
                                ? "bg-indigo-100 text-indigo-600"
                                : "bg-zinc-100 text-zinc-600"
                            }`}>
                              {ticket.assigneeType === "agent" ? <Zap className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            </div>
                            <span className={`text-[11px] ${ticket.assigneeType === "agent" ? "text-indigo-600 font-medium" : "text-zinc-500"}`}>
                              {ticket.assignee}
                            </span>
                          </div>
                        )}

                        {/* Footer: due date + tags */}
                        <div className="flex items-center justify-between">
                          {ticket.dueDate ? (
                            <div className={`flex items-center gap-1 text-[10px] font-mono ${
                              new Date(ticket.dueDate) < new Date() && ticket.status !== "done"
                                ? "text-red-500"
                                : "text-zinc-400"
                            }`}>
                              <Clock className="w-3 h-3" />
                              {formatDate(ticket.dueDate)}
                            </div>
                          ) : (
                            <div />
                          )}
                          <div className="flex gap-1">
                            {ticket.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Linked contact */}
                        {ticket.linkedContactName && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-500 font-mono">
                            <Building2 className="w-3 h-3" /> {ticket.linkedContactName}
                          </div>
                        )}

                        {/* Assign to agent (unassigned only) */}
                        {!ticket.assignee && (
                          <button
                            onClick={e => { e.stopPropagation(); handleAssignToAgent(ticket); }}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-100"
                          >
                            <Zap className="w-3 h-3" /> Assign to agent
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Ticket Detail Slide-over */}
      <AnimatePresence>
        {selectedTicket && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white border-l border-zinc-200 shadow-2xl z-50 overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${PRIORITY_CONFIG[selectedTicket.priority].color} ${PRIORITY_CONFIG[selectedTicket.priority].bg} ${PRIORITY_CONFIG[selectedTicket.priority].border}`}>
                    {PRIORITY_CONFIG[selectedTicket.priority].label}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">{selectedTicket.id}</span>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Title */}
                <h2 className="text-xl font-bold text-zinc-900 leading-snug">{selectedTicket.title}</h2>

                {/* Meta row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Status</div>
                    {(() => {
                      const col = COLUMNS.find(c => c.key === selectedTicket.status);
                      return col ? (
                        <div className={`text-sm font-semibold ${col.color}`}>{col.label}</div>
                      ) : null;
                    })()}
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Assignee</div>
                    {selectedTicket.assignee ? (
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          selectedTicket.assigneeType === "agent" ? "bg-indigo-100 text-indigo-600" : "bg-zinc-200 text-zinc-600"
                        }`}>
                          {selectedTicket.assigneeType === "agent" ? <Zap className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        </div>
                        <span className="text-sm font-medium text-zinc-900">{selectedTicket.assignee}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-400">Unassigned</span>
                    )}
                  </div>
                </div>

                {/* Due date */}
                {selectedTicket.dueDate && (
                  <div className={`flex items-center gap-2 text-sm ${
                    new Date(selectedTicket.dueDate) < new Date() && selectedTicket.status !== "done"
                      ? "text-red-600"
                      : "text-zinc-600"
                  }`}>
                    <Clock className="w-4 h-4" />
                    Due: {formatDate(selectedTicket.dueDate)}
                    {new Date(selectedTicket.dueDate) < new Date() && selectedTicket.status !== "done" && (
                      <span className="text-[10px] font-mono text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Overdue</span>
                    )}
                  </div>
                )}

                {/* Description */}
                <div>
                  <h3 className="text-xs font-mono text-zinc-900 uppercase tracking-[0.3em] mb-2">Description</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">{selectedTicket.description}</p>
                </div>

                {/* AI Summary */}
                {selectedTicket.aiSummary && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-mono text-indigo-700 uppercase tracking-wider font-bold">AI Summary</span>
                    </div>
                    <p className="text-sm text-indigo-900 leading-relaxed">{selectedTicket.aiSummary}</p>
                  </div>
                )}

                {/* Linked Contact */}
                {selectedTicket.linkedContactName && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                    <Building2 className="w-4 h-4 text-zinc-400" />
                    <div>
                      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Linked Contact</div>
                      <div className="text-sm font-medium text-zinc-900">{selectedTicket.linkedContactName}</div>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {selectedTicket.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTicket.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-mono px-2 py-1 bg-zinc-100 text-zinc-600 rounded-lg border border-zinc-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {!selectedTicket.assignee && (
                    <button
                      onClick={() => handleAssignToAgent(selectedTicket)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-800 transition-all rounded-xl"
                    >
                      <Zap className="w-4 h-4" /> Assign to Agent
                    </button>
                  )}
                  {selectedTicket.assignee && selectedTicket.assigneeType === "agent" && (
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-mono uppercase tracking-widest hover:bg-indigo-500 transition-all rounded-xl">
                      <Zap className="w-4 h-4" /> View Agent Output
                    </button>
                  )}
                </div>

                {/* Created at */}
                <div className="text-[10px] font-mono text-zinc-400 pt-4 border-t border-zinc-100">
                  Created {formatDate(selectedTicket.createdAt)}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
