"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  ArrowLeft, FileText, UploadCloud, X,
  ChevronRight, AlertCircle, CheckCircle2,
  ShieldAlert, TrendingUp, Info, Phone, Sparkles, Rocket,
  Check, Plus, ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Questionnaire } from "@/lib/types";
import { OnboardingCall } from "@/components/OnboardingCall";

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md";

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

const REVENUE_RANGES = [
  "$0 - $500K",
  "$500K - $1M",
  "$1M - $5M",
  "$5M - $10M",
  "$10M - $50M",
  "$50M - $100M",
  "$100M - $500M",
  "$500M+",
];

const MARKETING_CHANNELS = [
  "Instagram", "LinkedIn", "TikTok", "X / Twitter", "YouTube",
  "Facebook", "Cold Email", "Newsletter", "Google Ads", "Meta Ads",
  "SEO / Content", "Podcast", "Referrals", "Events / Webinars", "Other",
];

const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourhandle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/yourco" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourhandle" },
  { key: "x", label: "X / Twitter", placeholder: "https://x.com/yourhandle" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourchannel" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourpage" },
];

const OAUTH_PROVIDERS = [
  // Communication
  { key: "slack", name: "Slack", description: "Team communication patterns", logo: "https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png" },
  { key: "gmail", name: "Gmail", description: "Email engagement analysis", logo: "https://cdn.simpleicons.org/gmail" },
  { key: "microsoft_teams", name: "MS Teams", description: "Team collaboration data", logo: "https://statics.teams.cdn.office.net/evergreen-assets/icons/microsoft_teams_logo_refresh_v2025.ico" },
  // Finance
  { key: "quickbooks", name: "QuickBooks", description: "Live financial data", logo: "https://cdn.simpleicons.org/quickbooks" },
  { key: "stripe", name: "Stripe", description: "Revenue & subscriptions", logo: "https://cdn.simpleicons.org/stripe" },
  // CRM & Sales
  { key: "salesforce", name: "Salesforce", description: "Pipeline & deals", logo: "https://www.salesforce.com/etc/designs/sfdc-www/en_us/favicon.ico" },
  { key: "hubspot", name: "HubSpot", description: "Marketing & contacts", logo: "https://cdn.simpleicons.org/hubspot" },
  // Project Management
  { key: "jira", name: "Jira", description: "Issue tracking & sprints", logo: "https://cdn.simpleicons.org/jira" },
  { key: "asana", name: "Asana", description: "Task & project tracking", logo: "https://cdn.simpleicons.org/asana" },
  { key: "linear", name: "Linear", description: "Engineering project data", logo: "https://cdn.simpleicons.org/linear" },
  // Development
  { key: "github", name: "GitHub", description: "Code repos & activity", logo: "https://cdn.simpleicons.org/github" },
  // Analytics & Data
  { key: "google_analytics", name: "Analytics", description: "Website traffic & behavior", logo: "https://cdn.simpleicons.org/googleanalytics" },
  { key: "google_sheets", name: "Google Sheets", description: "Custom data imports", logo: "https://cdn.simpleicons.org/googlesheets" },
  { key: "airtable", name: "Airtable", description: "Database & workflows", logo: "https://cdn.simpleicons.org/airtable" },
  // Productivity
  { key: "notion", name: "Notion", description: "Docs & knowledge base", logo: "https://cdn.simpleicons.org/notion" },
  { key: "google_calendar", name: "Calendar", description: "Meeting & time analysis", logo: "https://cdn.simpleicons.org/googlecalendar" },
  // HR & Payroll
  { key: "adp", name: "ADP", description: "Payroll & HR data", logo: "https://cdn.simpleicons.org/adp" },
  { key: "workday", name: "Workday", description: "HR & workforce analytics", logo: "https://www.workday.com/favicon.ico" },
] as const;

interface StagedFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

interface UploadViewProps {
  onBack: () => void;
  onUploadComplete: (runId: string) => void;
  orgId?: string;
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

const PLACEHOLDER_SET = new Set(["", "tbd", "not specified", "n/a", "unknown", "none"]);
function hasRealValue(v: unknown): boolean {
  if (!v) return false;
  if (typeof v === "string" && PLACEHOLDER_SET.has(v.trim().toLowerCase())) return false;
  return true;
}

function FieldPills({ extracted }: { extracted: Partial<Questionnaire> }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-2">
      {FIELD_LABELS.map(({ key, label }) => {
        const filled = hasRealValue(extracted[key]);
        return (
          <span
            key={key}
            className={`flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full transition-all ${
              filled
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-zinc-100 text-zinc-400 border border-zinc-200"
            }`}
          >
            {filled && <CheckCircle2 className="w-2.5 h-2.5" />}
            {label}
          </span>
        );
      })}
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

// ── Schema coverage estimation ────────────────────────────────────────────────

const SCHEMA_CATEGORIES = [
  "Team Structure",
  "Compensation & HR",
  "Financial Position",
  "Revenue Model",
  "Customer Portfolio",
  "Operations",
  "Sales & Pipeline",
  "Market & Competition",
  "Strategy & Planning",
  "Risk & Compliance",
] as const;

const CRITICAL_CATEGORIES = ["Financial Position", "Revenue Model", "Customer Portfolio"] as const;

const CATEGORY_SUGGESTIONS: Record<string, string> = {
  "Financial Position": "P&L statements, balance sheets, bank statements, or cash flow reports",
  "Revenue Model": "Invoices, pricing sheets, sales reports, or revenue breakdowns",
  "Customer Portfolio": "Customer list, CRM export, account summaries, or client roster",
  "Team Structure": "Org chart, team roster, or employee directory",
  "Operations": "Process documentation, SOPs, or operational reports",
  "Sales & Pipeline": "Pipeline data, funnel metrics, or sales forecasts",
  "Strategy & Planning": "Strategic plans, roadmaps, or business plans",
  "Compensation & HR": "Payroll data, compensation plans, or HR reports",
  "Market & Competition": "Market research, competitive analysis, or industry reports",
  "Risk & Compliance": "Risk assessments, compliance reports, or legal documents",
};

function guessFileCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("financial") || lower.includes("finance") || lower.includes("cash") || lower.includes("p&l") || lower.includes("balance") || lower.includes("bank")) return "Financial Position";
  if (lower.includes("customer") || lower.includes("client") || lower.includes("account") || lower.includes("crm")) return "Customer Portfolio";
  if (lower.includes("revenue") || lower.includes("sales") || lower.includes("invoice") || lower.includes("pricing")) return "Revenue Model";
  if (lower.includes("team") || lower.includes("staff") || lower.includes("org") || lower.includes("employee")) return "Team Structure";
  if (lower.includes("hr") || lower.includes("payroll") || lower.includes("compensation") || lower.includes("salary")) return "Compensation & HR";
  if (lower.includes("strategy") || lower.includes("plan") || lower.includes("roadmap") || lower.includes("business plan")) return "Strategy & Planning";
  if (lower.includes("risk") || lower.includes("compliance") || lower.includes("legal") || lower.includes("audit")) return "Risk & Compliance";
  if (lower.includes("market") || lower.includes("competitor") || lower.includes("competitive") || lower.includes("industry")) return "Market & Competition";
  if (lower.includes("operation") || lower.includes("process") || lower.includes("procedure") || lower.includes("sop")) return "Operations";
  if (lower.includes("pipeline") || lower.includes("funnel") || lower.includes("deal") || lower.includes("lead")) return "Sales & Pipeline";
  return "Other";
}

function CoverageIndicator({ files }: { files: StagedFile[] }) {
  const coverage = useMemo(() => {
    const covered = new Set<string>();
    for (const f of files) {
      const cat = guessFileCategory(f.name);
      if (cat !== "Other") covered.add(cat);
    }
    return covered;
  }, [files]);

  const criticalGaps = CRITICAL_CATEGORIES.filter((c) => !coverage.has(c));
  const allGaps = SCHEMA_CATEGORIES.filter((c) => !coverage.has(c));
  const pct = Math.round((coverage.size / SCHEMA_CATEGORIES.length) * 100);

  if (files.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" />
          Data Coverage Estimate
        </span>
        <span className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
          pct >= 60 ? "text-green-600" : pct >= 30 ? "text-amber-600" : "text-zinc-400"
        }`}>
          {pct}%
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Coverage bar */}
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              pct >= 60 ? "bg-green-500" : pct >= 30 ? "bg-amber-500" : "bg-zinc-300"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          {SCHEMA_CATEGORIES.map((cat) => (
            <span
              key={cat}
              className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                coverage.has(cat)
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : CRITICAL_CATEGORIES.includes(cat as typeof CRITICAL_CATEGORIES[number])
                    ? "bg-red-50 text-red-500 border border-red-200"
                    : "bg-zinc-50 text-zinc-400 border border-zinc-200"
              }`}
            >
              {coverage.has(cat) && <CheckCircle2 className="w-2.5 h-2.5" />}
              {!coverage.has(cat) && CRITICAL_CATEGORIES.includes(cat as typeof CRITICAL_CATEGORIES[number]) && (
                <ShieldAlert className="w-2.5 h-2.5" />
              )}
              {cat}
            </span>
          ))}
        </div>

        {/* Critical gaps warning */}
        {criticalGaps.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-mono text-amber-700 uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              Critical data gaps — upload more for better results
            </div>
            <div className="space-y-1">
              {criticalGaps.map((cat) => (
                <div key={cat} className="text-[11px] text-amber-800 leading-snug">
                  <span className="font-medium">{cat}:</span>{" "}
                  <span className="text-amber-600">{CATEGORY_SUGGESTIONS[cat]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional suggestions for non-critical gaps */}
        {criticalGaps.length === 0 && allGaps.length > 0 && (
          <div className="text-[10px] text-zinc-500 flex items-start gap-1.5">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              Good coverage on critical data. For even deeper analysis, add documents for: {allGaps.slice(0, 3).join(", ")}.
            </span>
          </div>
        )}

        {allGaps.length === 0 && (
          <div className="text-[10px] text-green-700 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Excellent coverage across all categories — ready for deep analysis.
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function UploadView({ onBack, onUploadComplete, orgId }: UploadViewProps) {
  // Flow: 01 Upload → 02 Analyze (extraction preview) → 03 Call (fill gaps) → 04 Launch
  const [phase, setPhase] = useState<"upload" | "analyze" | "chat">("upload");
  const [runId, setRunId] = useState<string | null>(null);

  // ── Persist form state to localStorage so it survives refresh/OAuth ────────
  const DRAFT_KEY = "pivot_uploadDraft";

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  const draft = useRef(loadDraft());

  // Upload phase state (hydrate from draft if available)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState(draft.current?.websiteUrl ?? "");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(draft.current?.selectedChannels ?? []);
  const [socialUrls, setSocialUrls] = useState<Record<string, string>>(draft.current?.socialUrls ?? {});
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(draft.current?.competitorUrls ?? [""]);
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Call phase state (fill gaps by voice)
  const [extracted, setExtracted] = useState<Partial<Questionnaire>>(draft.current?.extracted ?? {});
  const [extractedFromDocs, setExtractedFromDocs] = useState<Partial<Questionnaire>>(draft.current?.extractedFromDocs ?? {});

  // Save form state to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        websiteUrl, selectedChannels, socialUrls, competitorUrls, extracted, extractedFromDocs,
      }));
    } catch {}
  }, [websiteUrl, selectedChannels, socialUrls, competitorUrls, extracted, extractedFromDocs]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch brand logos from OpenBrand
  const [brandLogos, setBrandLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/brand-logos")
      .then(r => r.ok ? r.json() : null)
      .then((data: Record<string, string> | null) => {
        if (data && !("error" in data)) setBrandLogos(data);
      })
      .catch(() => {});
  }, []);

  // Check connected integrations on mount
  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/integrations/list?orgId=${encodeURIComponent(orgId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        // List API returns { connected: [...], available: [...] }
        if (data.connected && Array.isArray(data.connected)) {
          setConnectedProviders(new Set(data.connected.map((c: any) => c.provider)));
        }
      })
      .catch(() => {});
  }, [orgId]);

  const handleConnectProvider = async (providerKey: string) => {
    if (!orgId) return;
    setConnectingProvider(providerKey);
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerKey, orgId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate connection");
      }
      if (data.connected) {
        setConnectedProviders((prev) => new Set([...prev, providerKey]));
      } else if (data.redirectUrl) {
        // Save view state so we return here after OAuth callback redirect
        try { localStorage.setItem("pivot_returnView", "upload"); } catch {}
        window.location.href = data.redirectUrl;
        return; // navigating away
      }
    } catch (err: any) {
      setError(err.message || `Failed to connect ${providerKey}. Please try again.`);
    } finally {
      setConnectingProvider(null);
    }
  };

  // Compute data coverage gaps from staged files to pass to phone call
  const dataCoverageGaps = useMemo(() => {
    const covered = new Set<string>();
    for (const f of stagedFiles) {
      const cat = guessFileCategory(f.name);
      if (cat !== "Other") covered.add(cat);
    }
    return SCHEMA_CATEGORIES.filter((c) => !covered.has(c)) as string[];
  }, [stagedFiles]);

  const handleContinueFromUpload = async () => {
    setError(null);
    if (stagedFiles.length === 0) {
      setError("Add at least one document to continue.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("organizationName", "");
      formData.set("industry", "");
      formData.set("revenueRange", "$0 - $10M");
      formData.set("businessModel", "");
      formData.set("keyConcerns", "");
      formData.set("oneDecisionKeepingOwnerUpAtNight", "");
      if (orgId) formData.set("orgId", orgId);
      if (websiteUrl.trim()) formData.set("website", websiteUrl.trim());
      if (selectedChannels.length > 0) formData.set("marketingChannels", JSON.stringify(selectedChannels));
      const filledSocials = Object.fromEntries(
        Object.entries(socialUrls).filter(([, v]) => v.trim())
      );
      if (Object.keys(filledSocials).length > 0) formData.set("socialMediaUrls", JSON.stringify(filledSocials));
      const filteredCompetitorUrls = competitorUrls.filter((u) => u.trim());
      if (filteredCompetitorUrls.length > 0) formData.set("competitorUrls", JSON.stringify(filteredCompetitorUrls));
      stagedFiles.forEach((f) => formData.append("files", f.file));

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const d = await uploadRes.json().catch(() => ({}));
        throw new Error(d.error || uploadRes.statusText);
      }
      const { runId: id } = await uploadRes.json();
      if (!id) throw new Error("No runId returned");
      setRunId(id);

      const extractRes = await fetch("/api/job/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: id, website: websiteUrl.trim() || undefined }),
      });
      const extractData = extractRes.ok ? await extractRes.json() : { extracted: {} };
      const fromDocs = extractData.extracted ?? {};
      setExtractedFromDocs(fromDocs);
      setExtracted((prev) => ({ ...fromDocs, ...prev }));

      setPhase("analyze");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Voice call replaces text chat in phase 2.

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

  const handleLaunchAnalysis = async () => {
    setError(null);
    if (!runId) return;
    // Derive a fallback org name from website URL if not provided
    let orgName = extracted.organizationName?.trim() || "";
    if (!orgName || orgName === "TBD") {
      // Try to derive from website URL
      const url = extracted.website || websiteUrl;
      if (url) {
        try {
          const hostname = new URL(url).hostname.replace(/^www\./, "");
          orgName = hostname.split(".")[0].charAt(0).toUpperCase() + hostname.split(".")[0].slice(1);
        } catch { orgName = "My Business"; }
      } else {
        orgName = "My Business";
      }
    }
    setSubmitting(true);
    try {
      const questionnaire: Questionnaire = {
        organizationName: orgName,
        industry: extracted.industry ?? "",
        revenueRange: extracted.revenueRange ?? "$0 - $10M",
        businessModel: extracted.businessModel ?? "",
        keyConcerns: extracted.keyConcerns ?? "",
        oneDecisionKeepingOwnerUpAtNight: extracted.oneDecisionKeepingOwnerUpAtNight ?? "",
        website: extracted.website,
        websiteVisitorsPerDay: extracted.websiteVisitorsPerDay,
        keyCompetitors: extracted.keyCompetitors,
        location: extracted.location,
        techStack: extracted.techStack,
        competitorUrls: extracted.competitorUrls,
        marketingChannels: selectedChannels.length > 0 ? selectedChannels : extracted.marketingChannels,
        socialMediaUrls: Object.keys(socialUrls).some((k) => socialUrls[k]?.trim())
          ? Object.fromEntries(Object.entries(socialUrls).filter(([, v]) => v.trim()))
          : extracted.socialMediaUrls,
        socialMediaPlatforms: extracted.socialMediaPlatforms,
      };

      // Retry helper for network resilience (handles sleep/suspend)
      const fetchRetry = async (url: string, opts: RequestInit, retries = 3): Promise<Response> => {
        for (let i = 0; i < retries; i++) {
          try {
            const res = await fetch(url, opts);
            return res;
          } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
          }
        }
        throw new Error("Network error");
      };

      const updateRes = await fetchRetry("/api/job/update-questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, questionnaire }),
      });
      if (!updateRes.ok) throw new Error("Failed to update");

      const runRes = await fetchRetry("/api/job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      if (!runRes.ok) {
        const d = await runRes.json().catch(() => ({}));
        throw new Error(d.error || "Failed to start analysis");
      }
      // Clear saved draft on successful launch
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      onUploadComplete(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
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
              {phase === "upload" ? "Document Upload" : phase === "analyze" ? "Extraction Results" : "Live Call"}
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
          <span className={phase === "upload" ? "text-zinc-900 font-bold" : ""}>01 Upload</span>
          <span>→</span>
          <span className={phase === "analyze" ? "text-zinc-900 font-bold" : ""}>02 Analyze</span>
          <span>→</span>
          <span className={phase === "chat" ? "text-zinc-900 font-bold" : ""}>03 Call</span>
          <span>→</span>
          <span className={submitting ? "text-zinc-900 font-bold" : ""}>04 Launch</span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {/* ── Phase A: Upload First ── */}
        {phase === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -30 }}
            className="flex-1 p-8 lg:p-12 overflow-y-auto"
          >
            <div className="max-w-3xl mx-auto space-y-8">
              <div>
                <h2 className="text-sm font-medium text-zinc-900 mb-2">Drop your documents first</h2>
                <p className="text-sm text-zinc-500 mb-6">
                  Upload everything you have — P&amp;L statements, cash flow reports, invoices, customer lists, emails, WhatsApp exports, Slack exports, team communications, contracts, proposals. The more data you provide, the deeper and more accurate your analysis will be. You can also connect tools like Slack and Gmail below for live communication analysis.
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
                    dragActive ? "border-zinc-900 bg-zinc-50 ring-4 ring-zinc-900/5" : "border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-lg"
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
                    PDF, DOCX, XLSX, CSV, PPTX, TXT, MD · Max 50MB per file
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
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Staged Files ({stagedFiles.length})</span>
                        <button type="button" onClick={() => setStagedFiles([])} className="text-[10px] font-mono text-zinc-400 hover:text-red-500 transition-colors">Clear All</button>
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-zinc-50">
                        {stagedFiles.map((f) => (
                          <motion.div key={f.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 flex items-center justify-between group hover:bg-zinc-50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="w-4 h-4 text-zinc-300 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs text-zinc-900 font-medium break-words">{f.name}</div>
                                <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider mt-0.5">{(f.size / 1024 / 1024).toFixed(2)} MB</div>
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

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Website URL (optional)</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm focus:border-zinc-900 focus:outline-none transition-all"
                />
              </div>

              {/* Marketing channels multi-select */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">
                  Current Marketing Channels (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {MARKETING_CHANNELS.map((ch) => {
                    const active = selectedChannels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() =>
                          setSelectedChannels((prev) =>
                            active ? prev.filter((c) => c !== ch) : [...prev, ch]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          active
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                        }`}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Social media profile URLs */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">
                  Social Media Profiles (optional)
                </label>
                <div className="space-y-2">
                  {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider w-20 shrink-0">{label}</span>
                      <input
                        type="url"
                        value={socialUrls[key] ?? ""}
                        onChange={(e) =>
                          setSocialUrls((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={placeholder}
                        className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Competitor website URLs */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">
                  Competitor Websites (optional)
                </label>
                <p className="text-[11px] text-zinc-400 mb-3">
                  Enter competitor URLs so we can benchmark your business against them.
                </p>
                <div className="space-y-2">
                  {competitorUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) =>
                          setCompetitorUrls((prev) =>
                            prev.map((u, i) => (i === idx ? e.target.value : u))
                          )
                        }
                        placeholder="https://competitor.com"
                        className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm focus:border-zinc-900 focus:outline-none transition-all"
                      />
                      {competitorUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCompetitorUrls((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCompetitorUrls((prev) => [...prev, ""])}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add another competitor
                  </button>
                </div>
              </div>

              {/* Connect data sources (OAuth) */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-1">
                  Connect Your Tools
                </label>
                <p className="text-[11px] text-zinc-400 mb-4">
                  Optional — connect for deeper analysis with live data
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {OAUTH_PROVIDERS.map(({ key, name, description, logo }) => {
                    const isConnected = connectedProviders.has(key);
                    const isConnecting = connectingProvider === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => !isConnected && handleConnectProvider(key)}
                        disabled={isConnected || isConnecting}
                        className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                          isConnected
                            ? "bg-green-50 border-green-200 cursor-default"
                            : `bg-white border-zinc-200 hover:border-zinc-400 hover:shadow-md cursor-pointer`
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${
                            isConnected ? "bg-green-500" : "bg-zinc-50"
                          } transition-colors`}
                        >
                          {isConnected ? (
                            <Check className="w-4 h-4 text-white" />
                          ) : (
                            <img src={brandLogos[key] || logo} alt={name} className="w-5 h-5 object-contain" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-900 flex items-center gap-1.5">
                            {name}
                            {isConnected && (
                              <span className="text-[9px] font-mono text-green-600 uppercase tracking-wider">
                                Connected
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400 leading-snug">
                            {description}
                          </div>
                        </div>
                        {!isConnected && (
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-300 shrink-0 ml-auto" />
                        )}
                        {isConnecting && (
                          <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-900 rounded-full"
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <CoverageIndicator files={stagedFiles} />

              <button
                onClick={handleContinueFromUpload}
                disabled={uploading || stagedFiles.length === 0}
                className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-zinc-900 text-white text-xs font-mono uppercase tracking-[0.2em] hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-zinc-900/10 active:scale-95 group overflow-hidden relative rounded-xl"
              >
                <ChevronRight className="w-4 h-4" />
                {uploading ? "Extracting from documents…" : "Continue to Live Call"}
                {uploading && (
                  <motion.div className="absolute inset-0 bg-zinc-800" initial={{ left: "-100%" }} animate={{ left: "0%" }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
                )}
              </button>

              {stagedFiles.length === 0 && <p className="text-center text-[11px] text-zinc-400">Add at least one document to continue.</p>}
              {error && phase === "upload" && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 leading-normal">{error}</div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Phase B: Extraction Preview ── */}
        {phase === "analyze" && (
          <motion.div
            key="analyze"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="flex-1 p-8 lg:p-12 overflow-y-auto"
          >
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="text-center">
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-light tracking-tight text-zinc-900 mb-2">
                  Here&apos;s what I found
                </h2>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                  I&apos;ve extracted what I can from your {stagedFiles.length} document{stagedFiles.length !== 1 ? "s" : ""}
                  {websiteUrl ? " and website" : ""}. Fields marked green are covered — everything else will be filled via the live call.
                </p>
              </div>

              {/* Coverage pills */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-4">Data Coverage</div>
                <FieldPills extracted={extracted} />
              </div>

              {/* Extracted fields — editable */}
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Extracted Details — click to edit</div>
                </div>
                <div className="divide-y divide-zinc-50 px-6 py-2">
                  {/* Business Name */}
                  <div className="py-3 space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Business Name</label>
                    <input
                      type="text"
                      value={extracted.organizationName ?? ""}
                      onChange={(e) => setExtracted((prev) => ({ ...prev, organizationName: e.target.value }))}
                      placeholder="Your business name"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Industry */}
                  <div className="py-3 space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Industry</label>
                    <select
                      value={extracted.industry ?? ""}
                      onChange={(e) => setExtracted((prev) => ({ ...prev, industry: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none transition-all appearance-none"
                    >
                      <option value="">Select industry...</option>
                      {INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>

                  {/* Revenue Range */}
                  <div className="py-3 space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Revenue Range</label>
                    <select
                      value={extracted.revenueRange ?? ""}
                      onChange={(e) => setExtracted((prev) => ({ ...prev, revenueRange: e.target.value }))}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none transition-all appearance-none"
                    >
                      <option value="">Select revenue range...</option>
                      {REVENUE_RANGES.map((rr) => (
                        <option key={rr} value={rr}>{rr}</option>
                      ))}
                    </select>
                  </div>

                  {/* Business Model */}
                  <div className="py-3 space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Business Model</label>
                    <input
                      type="text"
                      value={extracted.businessModel ?? ""}
                      onChange={(e) => setExtracted((prev) => ({ ...prev, businessModel: e.target.value }))}
                      placeholder="e.g. B2B subscription, marketplace, services"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Website */}
                  <div className="py-3 space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Website</label>
                    <input
                      type="url"
                      value={extracted.website ?? ""}
                      onChange={(e) => setExtracted((prev) => ({ ...prev, website: e.target.value }))}
                      placeholder="https://yourcompany.com"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Location */}
                  <div className="py-3 space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Location</label>
                    <input
                      type="text"
                      value={extracted.location ?? ""}
                      onChange={(e) => setExtracted((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="City, State or Country"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Key Competitors */}
                  <div className="py-3 space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Key Competitors</label>
                    <input
                      type="text"
                      value={extracted.keyCompetitors ?? ""}
                      onChange={(e) => setExtracted((prev) => ({ ...prev, keyCompetitors: e.target.value }))}
                      placeholder="Competitor A, Competitor B"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Key Concerns */}
                  <div className="py-3 space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Key Concerns</label>
                    <textarea
                      rows={2}
                      value={extracted.keyConcerns ?? ""}
                      onChange={(e) => setExtracted((prev) => ({ ...prev, keyConcerns: e.target.value }))}
                      placeholder="Main challenges or concerns for your business"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Gap summary */}
              {dataCoverageGaps.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-amber-900 mb-1">Missing data categories</div>
                      <div className="text-xs text-amber-700 leading-relaxed">
                        The live call will focus on: {dataCoverageGaps.slice(0, 5).join(", ")}
                        {dataCoverageGaps.length > 5 ? ` and ${dataCoverageGaps.length - 5} more` : ""}.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => setPhase("chat")}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-zinc-900 text-white text-xs font-mono uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/10 active:scale-95 rounded-xl"
                >
                  <Phone className="w-4 h-4" />
                  Continue to Live Call
                </button>
                <button
                  onClick={() => handleLaunchAnalysis()}
                  className="w-full flex items-center justify-center gap-3 px-8 py-3 bg-white text-zinc-600 text-xs font-mono uppercase tracking-[0.2em] border border-zinc-200 hover:border-zinc-400 hover:text-zinc-900 transition-all rounded-xl"
                >
                  <Rocket className="w-4 h-4" />
                  Skip Call — Launch Analysis Now
                </button>
                <button
                  onClick={() => setPhase("upload")}
                  className="w-full flex items-center justify-center gap-3 px-8 py-3 text-zinc-400 text-xs font-mono uppercase tracking-[0.2em] hover:text-zinc-700 transition-all rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Upload
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Phase C: Full-screen live call ── */}
        {phase === "chat" && !submitting && (
          <>
            <OnboardingCall
              extractedFromDocs={extractedFromDocs}
              dataCoverageGaps={dataCoverageGaps}
              onExtracted={(patch) => setExtracted((prev) => ({ ...prev, ...patch }))}
              onComplete={() => handleLaunchAnalysis()}
              onSkip={() => handleLaunchAnalysis()}
              onError={setError}
            />
            {/* Persistent back button + error banner */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-md w-full px-4 space-y-2">
              {error && (
                <div className="bg-red-950/90 border border-red-800 rounded-xl p-4 flex items-start gap-3 shadow-2xl backdrop-blur-sm">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-red-200 leading-normal">{error}</div>
                  <button onClick={() => handleLaunchAnalysis()} className="text-[10px] font-mono text-emerald-400 hover:text-white uppercase tracking-wider shrink-0 mr-2">
                    Retry
                  </button>
                </div>
              )}
              <button
                onClick={() => { setError(null); setPhase("analyze"); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900/80 border border-zinc-700 text-zinc-300 text-[10px] font-mono uppercase tracking-[0.2em] hover:bg-zinc-900 hover:text-white transition-all rounded-xl backdrop-blur-sm shadow-lg"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Review
              </button>
            </div>
          </>
        )}

        {/* ── Launching Analysis Spinner ── */}
        {phase === "chat" && submitting && (
          <motion.div
            key="launching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-center text-white"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-2 border-zinc-700 border-t-white rounded-full mb-8"
            />
            <div className="text-xl font-light tracking-tight mb-2">Launching Analysis</div>
            <div className="text-sm text-zinc-500 mb-8">Building your intelligence report...</div>
            <div className="w-64 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white/80 rounded-full"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 max-w-md bg-red-950/80 border border-red-800 rounded-xl p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-200">{error}</div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
