"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeft, FileText, UploadCloud, X, Send, Loader2,
  Bot, ChevronRight, AlertCircle, CheckCircle2, Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ChatMessage, Questionnaire } from "@/lib/types";

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv";
const MAX_FILE_MB = 50;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const INDUSTRIES = [
  "B2B SaaS", "Consumer SaaS", "Fintech", "Healthcare / MedTech",
  "E-commerce / Retail", "Services / Agency", "Digital Marketing",
  "Consulting", "IT Services", "Software Development", "Manufacturing",
  "Real Estate", "Logistics / Supply Chain", "EdTech", "LegalTech",
  "Construction", "Food & Beverage", "Hospitality / Tourism",
  "Media / Publishing", "Non-profit", "Staffing / Recruitment",
  "Insurance", "Telecommunications", "Energy / Utilities",
  "Agriculture / AgTech", "Automotive", "Cybersecurity",
  "Accounting / Finance Services", "Franchise", "Other",
];

interface StagedFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

interface UploadViewProps {
  onBack: () => void;
  onUploadComplete: (runId: string) => void;
}

// ── Field pill indicator ──────────────────────────────────────────────────────

const FIELD_LABELS: { key: keyof Questionnaire; label: string }[] = [
  { key: "organizationName", label: "Business" },
  { key: "industry", label: "Industry" },
  { key: "website", label: "Website" },
  { key: "businessModel", label: "Offer" },
  { key: "keyCompetitors", label: "Competitors" },
  { key: "keyConcerns", label: "Concerns" },
  { key: "oneDecisionKeepingOwnerUpAtNight", label: "Decision" },
  { key: "revenueRange", label: "Revenue" },
];

function FieldPills({ extracted }: { extracted: Partial<Questionnaire> }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-2">
      {FIELD_LABELS.map(({ key, label }) => (
        <span
          key={key}
          className={`flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full transition-all ${
            extracted[key]
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-zinc-100 text-zinc-400 border border-zinc-200"
          }`}
        >
          {extracted[key] && <CheckCircle2 className="w-2.5 h-2.5" />}
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Industry autocomplete ─────────────────────────────────────────────────────

function IndustryAutocomplete({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (industry: string) => void;
}) {
  if (!query.trim() || query.length < 2) return null;
  const matches = INDUSTRIES.filter((i) =>
    i.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);
  if (matches.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden z-10"
    >
      {matches.map((m) => (
        <button
          key={m}
          onMouseDown={() => onSelect(m)}
          className="w-full text-left px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          {m}
        </button>
      ))}
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function UploadView({ onBack, onUploadComplete }: UploadViewProps) {
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<Partial<Questionnaire>>({});
  const [phase, setPhase] = useState<"onboarding" | "upload">("onboarding");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Upload state
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load welcome message
  useEffect(() => {
    fetch("/api/onboarding/chat")
      .then((r) => r.json())
      .then((d) => {
        setMessages([{ role: "assistant", content: d.message, timestamp: Date.now() }]);
      })
      .catch(() => {
        setMessages([
          {
            role: "assistant",
            content:
              "Welcome to Pivot. I'm Pivvy, your business intelligence advisor.\n\nBefore we run your analysis, I have a few quick questions to understand your business. What is the name of your business, and what industry are you in?",
            timestamp: Date.now(),
          },
        ]);
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.slice(-12),
          message: text.trim(),
        }),
      });
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.message ?? "Sorry, I had a technical issue. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Merge extracted fields
      if (data.extracted) {
        setExtracted((prev) => ({ ...prev, ...data.extracted }));
      }

      if (data.complete) {
        setPhase("upload");
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection issue — please try again.", timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  // Check if input likely mentions an industry for autocomplete
  const showIndustryAutocomplete =
    messages.length <= 3 && input.length >= 2;

  // File handling
  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const next: StagedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_BYTES) continue;
      const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ACCEPTED_TYPES.split(",").includes(ext)) continue;
      next.push({ id: `${file.name}-${file.size}-${Date.now()}-${i}`, file, name: file.name, size: file.size });
    }
    setStagedFiles((prev) => [...prev, ...next]);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!extracted.organizationName?.trim()) {
      setError("Organization name is required — please complete the chat first.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("organizationName", extracted.organizationName ?? "");
      formData.set("industry", extracted.industry ?? "");
      formData.set("revenueRange", extracted.revenueRange ?? "$0 - $10M");
      formData.set("businessModel", extracted.businessModel ?? "");
      formData.set("keyConcerns", extracted.keyConcerns ?? "");
      formData.set("oneDecisionKeepingOwnerUpAtNight", extracted.oneDecisionKeepingOwnerUpAtNight ?? "");
      if (extracted.website) formData.set("website", extracted.website);
      if (extracted.websiteVisitorsPerDay)
        formData.set("websiteVisitorsPerDay", String(extracted.websiteVisitorsPerDay));
      if (extracted.keyCompetitors) formData.set("keyCompetitors", extracted.keyCompetitors);
      if (extracted.location) formData.set("location", extracted.location);
      if (extracted.techStack) formData.set("techStack", extracted.techStack);
      if (extracted.competitorUrls?.length)
        formData.set("competitorUrls", JSON.stringify(extracted.competitorUrls));
      stagedFiles.forEach((f) => formData.append("files", f.file));

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const d = await uploadRes.json().catch(() => ({}));
        throw new Error(d.error || uploadRes.statusText);
      }
      const { runId } = await uploadRes.json();
      if (!runId) throw new Error("No runId returned");

      const runRes = await fetch("/api/job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      if (!runRes.ok) {
        const d = await runRes.json().catch(() => ({}));
        throw new Error(d.error || "Failed to start analysis");
      }
      onUploadComplete(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-zinc-900 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-zinc-200 p-4 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-zinc-50 rounded-full transition-colors text-zinc-400 hover:text-zinc-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-zinc-900 flex items-center justify-center rounded-lg shadow-sm">
            <div className="w-3 h-3 bg-white rounded-sm rotate-45" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-lg text-zinc-900 leading-none">Pivot</div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mt-1">
              {phase === "onboarding" ? "Business Onboarding" : "Document Upload"}
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
          <span className={phase === "onboarding" ? "text-zinc-900 font-bold" : ""}>01 Chat</span>
          <span>→</span>
          <span className={phase === "upload" ? "text-zinc-900 font-bold" : ""}>02 Upload</span>
          <span>→</span>
          <span>03 Analyze</span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {/* ── Phase A: Onboarding Chat ── */}
        {phase === "onboarding" && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -30 }}
            className="flex-1 flex flex-col max-w-2xl mx-auto w-full"
          >
            {/* Field progress */}
            <div className="pt-3">
              <FieldPills extracted={extracted} />
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-1">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === "user" ? "order-last" : ""}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-zinc-900 text-white rounded-br-sm"
                          : "bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm shadow-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-zinc-100 bg-white px-4 py-3">
              <div className="flex gap-2 items-end relative">
                {showIndustryAutocomplete && (
                  <div className="absolute bottom-full left-0 right-10 z-10">
                    <IndustryAutocomplete
                      query={input}
                      onSelect={(industry) => {
                        setInput(industry);
                        inputRef.current?.focus();
                      }}
                    />
                  </div>
                )}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Tell Pivvy about your business…"
                  rows={1}
                  disabled={loading}
                  className="flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm focus:border-zinc-900 focus:bg-white focus:outline-none transition-all disabled:opacity-50 max-h-24 overflow-y-auto"
                  style={{ minHeight: "42px" }}
                />
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading}
                  className="flex items-center justify-center w-9 h-9 bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-40 transition-all shrink-0"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-[9px] font-mono text-zinc-400 text-center mt-2 uppercase tracking-widest">
                Pivvy will collect your business information · then ask for documents
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Phase B: Document Upload ── */}
        {phase === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 p-8 lg:p-12 overflow-y-auto"
          >
            <div className="max-w-3xl mx-auto space-y-8">
              {/* Collected info summary */}
              <div className="bg-zinc-900 text-white rounded-2xl p-6">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  Onboarding Complete — Here's What I Captured
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Business", value: extracted.organizationName },
                    { label: "Industry", value: extracted.industry },
                    { label: "Website", value: extracted.website },
                    { label: "Revenue Range", value: extracted.revenueRange },
                    { label: "Offer", value: extracted.businessModel },
                    { label: "Competitors", value: extracted.keyCompetitors },
                  ].filter((f) => f.value).map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">{label}</div>
                      <div className="text-sm text-white mt-0.5 truncate">{value}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setPhase("onboarding")}
                  className="mt-4 text-[10px] font-mono text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
                >
                  ← Edit info
                </button>
              </div>

              {/* Document upload */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-mono font-bold text-zinc-400 border border-zinc-200">
                    02
                  </div>
                  <h2 className="text-xs font-mono text-zinc-900 uppercase tracking-[0.2em]">Upload Your Documents</h2>
                </div>
                <p className="text-sm text-zinc-500 mb-6">
                  Upload P&amp;L statements, cash flow reports, invoices, customer lists, payroll — anything that shows your
                  business's financial and operational state. The more you share, the deeper the analysis.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  multiple
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />

                <motion.div
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  className={`border border-dashed p-10 rounded-2xl text-center flex flex-col items-center justify-center cursor-pointer group transition-all ${
                    dragActive
                      ? "border-zinc-900 bg-zinc-50 ring-4 ring-zinc-900/5"
                      : "border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-lg"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-medium text-zinc-900 mb-1">Drop files here or click to browse</div>
                  <div className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                    PDF, DOCX, XLSX, CSV, PPTX · Max 50MB per file
                  </div>
                </motion.div>

                <AnimatePresence>
                  {stagedFiles.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm"
                    >
                      <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                          Staged Files ({stagedFiles.length})
                        </span>
                        <button type="button" onClick={() => setStagedFiles([])} className="text-[10px] font-mono text-zinc-400 hover:text-red-500 transition-colors">
                          Clear All
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-zinc-50">
                        {stagedFiles.map((f) => (
                          <motion.div key={f.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 flex items-center justify-between group hover:bg-zinc-50 transition-colors">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <FileText className="w-4 h-4 text-zinc-300 shrink-0" />
                              <div className="truncate">
                                <div className="text-xs text-zinc-900 font-medium truncate">{f.name}</div>
                                <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider mt-0.5">
                                  {(f.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                              </div>
                            </div>
                            <button type="button" onClick={() => setStagedFiles((p) => p.filter((x) => x.id !== f.id))} className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-white rounded transition-all opacity-0 group-hover:opacity-100">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Launch button */}
              <div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || stagedFiles.length === 0}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-zinc-900 text-white text-xs font-mono uppercase tracking-[0.2em] hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-zinc-900/10 active:scale-95 group overflow-hidden relative rounded-xl"
                >
                  <Building2 className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">
                    {submitting ? "Launching Analysis…" : "Launch Intelligence Analysis"}
                  </span>
                  {!submitting && <ChevronRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />}
                  {submitting && (
                    <motion.div
                      className="absolute inset-0 bg-zinc-800"
                      initial={{ left: "-100%" }}
                      animate={{ left: "0%" }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </button>

                {stagedFiles.length === 0 && (
                  <p className="text-center text-[11px] text-zinc-400 mt-3">
                    Upload at least one document to begin the analysis.
                  </p>
                )}

                {error && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-700 leading-normal">{error}</div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
