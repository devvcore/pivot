"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  DollarSign,
  Phone,
  Mail,
  MessageSquare,
  ChevronRight,
  X,
  Clock,
  User,
  Building2,
  Zap,
  Filter,
  Plus,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type PipelineStage = "lead" | "prospect" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

interface Contact {
  id: string;
  name: string;
  company: string;
  email: string;
  dealValue: number;
  stage: PipelineStage;
  lastActivity: string;
  lastActivityDate: string;
  nextFollowup: string | null;
  tags: string[];
}

interface TimelineEntry {
  id: string;
  type: "email" | "call" | "note" | "agent";
  summary: string;
  date: string;
  agent?: string;
}

interface ContactDetail extends Contact {
  timeline: TimelineEntry[];
  notes: string;
}

// ─── Stage Config ───────────────────────────────────────────────────────────

const STAGES: { key: PipelineStage; label: string; color: string; bg: string; border: string; dot: string }[] = [
  { key: "lead",        label: "Lead",        color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",   dot: "bg-blue-500" },
  { key: "prospect",    label: "Prospect",    color: "text-cyan-700",   bg: "bg-cyan-50",    border: "border-cyan-200",   dot: "bg-cyan-500" },
  { key: "qualified",   label: "Qualified",   color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200", dot: "bg-violet-500" },
  { key: "proposal",    label: "Proposal",    color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",  dot: "bg-amber-500" },
  { key: "negotiation", label: "Negotiation", color: "text-orange-700", bg: "bg-orange-50",  border: "border-orange-200", dot: "bg-orange-500" },
  { key: "won",         label: "Won",         color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200",dot: "bg-emerald-500" },
  { key: "lost",        label: "Lost",        color: "text-red-700",    bg: "bg-red-50",     border: "border-red-200",    dot: "bg-red-500" },
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s])) as Record<PipelineStage, (typeof STAGES)[number]>;

// ─── Demo Data ──────────────────────────────────────────────────────────────

function makeDemoContacts(): Contact[] {
  return [
    { id: "c1", name: "Sarah Chen", company: "Acme Corp", email: "sarah@acme.com", dealValue: 45000, stage: "lead", lastActivity: "Visited pricing page", lastActivityDate: "2026-03-18", nextFollowup: "2026-03-22", tags: ["inbound", "enterprise"] },
    { id: "c2", name: "James Miller", company: "TechStart Inc", email: "james@techstart.io", dealValue: 12000, stage: "lead", lastActivity: "Downloaded whitepaper", lastActivityDate: "2026-03-17", nextFollowup: "2026-03-21", tags: ["content-lead"] },
    { id: "c3", name: "Maria Rodriguez", company: "GlobalFin", email: "maria@globalfin.com", dealValue: 120000, stage: "prospect", lastActivity: "Intro call completed", lastActivityDate: "2026-03-16", nextFollowup: "2026-03-20", tags: ["enterprise", "finance"] },
    { id: "c4", name: "David Park", company: "NovaTech", email: "david@novatech.co", dealValue: 35000, stage: "qualified", lastActivity: "Demo scheduled", lastActivityDate: "2026-03-15", nextFollowup: "2026-03-19", tags: ["mid-market"] },
    { id: "c5", name: "Emily Watson", company: "RetailMax", email: "emily@retailmax.com", dealValue: 85000, stage: "proposal", lastActivity: "Proposal sent", lastActivityDate: "2026-03-14", nextFollowup: "2026-03-18", tags: ["retail", "enterprise"] },
    { id: "c6", name: "Alex Kim", company: "DataFlow", email: "alex@dataflow.ai", dealValue: 60000, stage: "negotiation", lastActivity: "Contract review", lastActivityDate: "2026-03-13", nextFollowup: "2026-03-17", tags: ["tech", "priority"] },
    { id: "c7", name: "Lisa Thompson", company: "MedGroup", email: "lisa@medgroup.org", dealValue: 150000, stage: "won", lastActivity: "Contract signed", lastActivityDate: "2026-03-10", nextFollowup: null, tags: ["healthcare", "enterprise"] },
    { id: "c8", name: "Tom Harris", company: "SmallBiz LLC", email: "tom@smallbiz.com", dealValue: 8000, stage: "lost", lastActivity: "Chose competitor", lastActivityDate: "2026-03-08", nextFollowup: null, tags: ["smb"] },
    { id: "c9", name: "Rachel Green", company: "EcoVentures", email: "rachel@ecoventures.com", dealValue: 72000, stage: "qualified", lastActivity: "Requirements gathering", lastActivityDate: "2026-03-19", nextFollowup: "2026-03-23", tags: ["sustainability"] },
    { id: "c10", name: "Kevin Brown", company: "FinServe", email: "kevin@finserve.com", dealValue: 200000, stage: "negotiation", lastActivity: "Legal review in progress", lastActivityDate: "2026-03-19", nextFollowup: "2026-03-21", tags: ["finance", "enterprise", "priority"] },
  ];
}

function makeDemoTimeline(contactId: string): TimelineEntry[] {
  return [
    { id: "t1", type: "email", summary: "Initial outreach email sent", date: "2026-03-10" },
    { id: "t2", type: "call", summary: "Discovery call — discussed pain points and budget", date: "2026-03-12" },
    { id: "t3", type: "agent", summary: "Researcher agent pulled company financials and competitive landscape", date: "2026-03-13", agent: "researcher" },
    { id: "t4", type: "note", summary: "Decision maker is VP of Ops, budget approved for Q2", date: "2026-03-14" },
    { id: "t5", type: "email", summary: "Follow-up with custom proposal deck", date: "2026-03-16" },
    { id: "t6", type: "agent", summary: "Strategist drafted competitive positioning brief", date: "2026-03-17", agent: "strategist" },
  ];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TIMELINE_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  call: Phone,
  note: MessageSquare,
  agent: Zap,
};

// ─── Component ──────────────────────────────────────────────────────────────

interface CRMDashboardProps {
  orgId: string;
  onBack: () => void;
  onExecute?: () => void;
}

export function CRMDashboard({ orgId, onBack, onExecute }: CRMDashboardProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
  const [selectedContact, setSelectedContact] = useState<ContactDetail | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Fetch contacts — try API first, fall back to demo data
  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/pipeline?orgId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setContacts(data);
          setLoading(false);
          return;
        }
      }
    } catch {
      // fall through to demo
    }
    setContacts(makeDemoContacts());
    setLoading(false);
  };

  useEffect(() => { fetchContacts(); }, [orgId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/crm/pipeline?orgId=${encodeURIComponent(orgId)}&sync=1`, { method: "POST" });
      await fetchContacts();
    } catch {
      // ignore
    }
    setSyncing(false);
  };

  const handleSelectContact = (c: Contact) => {
    // Try API, fall back to demo timeline
    setSelectedContact({
      ...c,
      timeline: makeDemoTimeline(c.id),
      notes: "",
    });
  };

  const handleFollowUp = (contact: Contact) => {
    if (onExecute) onExecute();
  };

  // Filtering
  const filtered = useMemo(() => {
    let result = contacts;
    if (stageFilter !== "all") result = result.filter(c => c.stage === stageFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [contacts, stageFilter, search]);

  // Pipeline value (exclude lost)
  const totalPipelineValue = useMemo(() =>
    contacts.filter(c => c.stage !== "lost").reduce((sum, c) => sum + c.dealValue, 0),
    [contacts]
  );

  // Group by stage for kanban
  const grouped = useMemo(() => {
    const map: Record<PipelineStage, Contact[]> = {
      lead: [], prospect: [], qualified: [], proposal: [], negotiation: [], won: [], lost: [],
    };
    for (const c of filtered) {
      map[c.stage].push(c);
    }
    return map;
  }, [filtered]);

  // Active stages (exclude won/lost from main kanban, show as summary)
  const activeStages = STAGES.filter(s => s.key !== "won" && s.key !== "lost");

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">CRM Pipeline</h1>
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">Contacts & Deals</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Pipeline Value */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">{formatCurrency(totalPipelineValue)}</span>
              <span className="text-[10px] font-mono text-emerald-500 uppercase">Pipeline</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 w-48"
              />
            </div>

            {/* Stage Filter */}
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value as PipelineStage | "all")}
              className="px-3 py-2 text-xs font-mono border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 uppercase tracking-wider"
            >
              <option value="all">All Stages</option>
              {STAGES.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>

            {/* Sync */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-widest hover:bg-zinc-50 transition-all rounded-xl disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1400px] mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 border-2 border-zinc-100 border-t-zinc-900 rounded-full"
            />
          </div>
        ) : (
          <>
            {/* Stage summary chips */}
            <div className="flex flex-wrap gap-3 mb-6">
              {STAGES.map(s => {
                const count = grouped[s.key].length;
                const value = grouped[s.key].reduce((sum, c) => sum + c.dealValue, 0);
                return (
                  <button
                    key={s.key}
                    onClick={() => setStageFilter(stageFilter === s.key ? "all" : s.key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border transition-all ${
                      stageFilter === s.key
                        ? `${s.bg} ${s.border} ${s.color} font-bold`
                        : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                    {s.label}
                    <span className="font-semibold">{count}</span>
                    {value > 0 && <span className="text-zinc-400">{formatCurrency(value)}</span>}
                  </button>
                );
              })}
            </div>

            {/* Kanban Board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
              {activeStages.map((stage, si) => (
                <motion.div
                  key={stage.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: si * 0.05 }}
                  className="flex-shrink-0 w-72"
                >
                  {/* Column header */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl border-t-2 ${stage.border} bg-white`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${stage.color}`}>{stage.label}</span>
                    <span className="text-[10px] font-mono text-zinc-400 ml-auto">{grouped[stage.key].length}</span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2 min-h-[200px] bg-zinc-50/50 border border-t-0 border-zinc-200 rounded-b-xl p-2">
                    {grouped[stage.key].length === 0 && (
                      <div className="text-center py-8 text-zinc-300 text-xs font-mono">No contacts</div>
                    )}
                    {grouped[stage.key].map((contact, ci) => (
                      <motion.div
                        key={contact.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: si * 0.05 + ci * 0.03 }}
                        onClick={() => handleSelectContact(contact)}
                        className="bg-white border border-zinc-200 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-zinc-300 transition-all group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-900 truncate">{contact.name}</div>
                            <div className="text-[11px] text-zinc-500 truncate flex items-center gap-1">
                              <Building2 className="w-3 h-3 shrink-0" /> {contact.company}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-zinc-900 shrink-0">
                            {formatCurrency(contact.dealValue)}
                          </div>
                        </div>

                        <div className="text-[11px] text-zinc-400 mb-2 truncate">
                          {contact.lastActivity}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                            <Clock className="w-3 h-3" />
                            {formatDate(contact.lastActivityDate)}
                          </div>
                          {contact.nextFollowup && (
                            <div className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              Follow-up {formatDate(contact.nextFollowup)}
                            </div>
                          )}
                        </div>

                        {contact.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {contact.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Follow-up action */}
                        <button
                          onClick={e => { e.stopPropagation(); handleFollowUp(contact); }}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-100"
                        >
                          <Zap className="w-3 h-3" /> Have agent follow up
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Won / Lost summary */}
            {(grouped.won.length > 0 || grouped.lost.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {/* Won */}
                {grouped.won.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Won</span>
                      <span className="text-[10px] font-mono text-emerald-500 ml-auto">{grouped.won.length} deals</span>
                    </div>
                    <div className="space-y-2">
                      {grouped.won.map(c => (
                        <div key={c.id} onClick={() => handleSelectContact(c)} className="bg-white border border-emerald-100 rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-zinc-900">{c.name}</div>
                            <div className="text-[11px] text-zinc-500">{c.company}</div>
                          </div>
                          <div className="text-sm font-semibold text-emerald-700">{formatCurrency(c.dealValue)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lost */}
                {grouped.lost.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-xs font-bold uppercase tracking-wider text-red-700">Lost</span>
                      <span className="text-[10px] font-mono text-red-500 ml-auto">{grouped.lost.length} deals</span>
                    </div>
                    <div className="space-y-2">
                      {grouped.lost.map(c => (
                        <div key={c.id} onClick={() => handleSelectContact(c)} className="bg-white border border-red-100 rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-zinc-900">{c.name}</div>
                            <div className="text-[11px] text-zinc-500">{c.company}</div>
                          </div>
                          <div className="text-sm font-semibold text-red-600">{formatCurrency(c.dealValue)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Contact Detail Slide-over */}
      <AnimatePresence>
        {selectedContact && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedContact(null)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white border-l border-zinc-200 shadow-2xl z-50 overflow-y-auto"
            >
              {/* Panel header */}
              <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">{selectedContact.name}</h2>
                  <p className="text-sm text-zinc-500 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> {selectedContact.company}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedContact(null)}
                  className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Quick info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Deal Value</div>
                    <div className="text-xl font-semibold text-zinc-900">{formatCurrency(selectedContact.dealValue)}</div>
                  </div>
                  <div className={`${STAGE_MAP[selectedContact.stage].bg} border ${STAGE_MAP[selectedContact.stage].border} rounded-xl p-4`}>
                    <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Stage</div>
                    <div className={`text-xl font-semibold ${STAGE_MAP[selectedContact.stage].color}`}>
                      {STAGE_MAP[selectedContact.stage].label}
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm text-zinc-600">
                    <Mail className="w-4 h-4 text-zinc-400" /> {selectedContact.email}
                  </div>
                  {selectedContact.nextFollowup && (
                    <div className="flex items-center gap-3 text-sm text-indigo-600">
                      <Clock className="w-4 h-4" /> Next follow-up: {formatDate(selectedContact.nextFollowup)}
                    </div>
                  )}
                </div>

                {/* Tags */}
                {selectedContact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedContact.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-mono px-2 py-1 bg-zinc-100 text-zinc-600 rounded-lg border border-zinc-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFollowUp(selectedContact)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-zinc-800 transition-all rounded-xl"
                  >
                    <Zap className="w-4 h-4" /> Agent Follow Up
                  </button>
                  <button className="px-4 py-2.5 border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-widest hover:bg-zinc-50 transition-all rounded-xl">
                    <Mail className="w-4 h-4" />
                  </button>
                  <button className="px-4 py-2.5 border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-widest hover:bg-zinc-50 transition-all rounded-xl">
                    <Phone className="w-4 h-4" />
                  </button>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="text-xs font-mono text-zinc-900 uppercase tracking-[0.3em] mb-4">Activity Timeline</h3>
                  <div className="space-y-0">
                    {selectedContact.timeline.map((entry, i) => {
                      const Icon = TIMELINE_ICONS[entry.type] || MessageSquare;
                      const isLast = i === selectedContact.timeline.length - 1;
                      return (
                        <div key={entry.id} className="flex gap-3">
                          {/* Timeline line + dot */}
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              entry.type === "agent" ? "bg-indigo-100 text-indigo-600" : "bg-zinc-100 text-zinc-500"
                            }`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            {!isLast && <div className="w-px flex-1 bg-zinc-200 my-1" />}
                          </div>
                          {/* Content */}
                          <div className={`pb-4 ${isLast ? "" : ""}`}>
                            <div className="text-sm text-zinc-900">{entry.summary}</div>
                            <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                              {formatDate(entry.date)}
                              {entry.agent && (
                                <span className="ml-2 text-indigo-500">via {entry.agent} agent</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
