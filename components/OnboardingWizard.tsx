"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Link2,
  Upload,
  FileText,
  Users,
  ChevronRight,
  ArrowRight,
  X,
  Globe,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  orgId: string;
  onComplete: () => void;
}

// ── Integration Config ───────────────────────────────────────────────────────

const TOP_INTEGRATIONS = [
  {
    key: "stripe",
    name: "Stripe",
    description: "Revenue, subscriptions, and payment data",
    logo: "https://cdn.simpleicons.org/stripe",
    color: "#635BFF",
  },
  {
    key: "gmail",
    name: "Gmail",
    description: "Email engagement and communication",
    logo: "https://cdn.simpleicons.org/gmail",
    color: "#EA4335",
  },
  {
    key: "slack",
    name: "Slack",
    description: "Team communication patterns",
    logo: "https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png",
    color: "#4A154B",
  },
  {
    key: "github",
    name: "GitHub",
    description: "Code repos, PRs, and engineering activity",
    logo: "https://cdn.simpleicons.org/github",
    color: "#24292F",
  },
];

// ── Agent Config ─────────────────────────────────────────────────────────────

const AGENTS = [
  {
    name: "Atlas",
    role: "Strategy",
    color: "bg-indigo-100 text-indigo-700",
    example: "Create a 90-day growth plan for my startup",
  },
  {
    name: "Maven",
    role: "Marketing",
    color: "bg-pink-100 text-pink-700",
    example: "Write a LinkedIn post about our new product launch",
  },
  {
    name: "Quant",
    role: "Finance",
    color: "bg-emerald-100 text-emerald-700",
    example: "Build a monthly budget from my Stripe data",
  },
  {
    name: "Scout",
    role: "HR",
    color: "bg-amber-100 text-amber-700",
    example: "Draft a job posting for a senior engineer",
  },
  {
    name: "Forge",
    role: "Operations",
    color: "bg-orange-100 text-orange-700",
    example: "Create an SOP for our customer onboarding process",
  },
  {
    name: "Lens",
    role: "Research",
    color: "bg-cyan-100 text-cyan-700",
    example: "Research our top 3 competitors and compare pricing",
  },
  {
    name: "CodeBot",
    role: "Engineering",
    color: "bg-violet-100 text-violet-700",
    example: "Create a GitHub issue for the auth bug we discussed",
  },
];

// ── File Config ──────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md";
const MAX_FILE_MB = 50;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// ── Component ────────────────────────────────────────────────────────────────

export function OnboardingWizard({ orgId, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSteps = 3;

  // ── Integration Handlers ─────────────────────────────────────────────────

  const handleConnect = useCallback(
    (provider: string) => {
      setConnecting(provider);
      // Store return view so we come back after OAuth
      try {
        localStorage.setItem("pivot_returnView", "dashboard");
      } catch {}
      window.location.href = `/api/integrations/connect?provider=${encodeURIComponent(provider)}&orgId=${encodeURIComponent(orgId)}`;
    },
    [orgId]
  );

  // ── File Upload Handlers ─────────────────────────────────────────────────

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(
        (f) => f.size <= MAX_FILE_BYTES
      );
      if (fileArray.length === 0) return;

      setUploading(true);
      const formData = new FormData();
      formData.append("orgId", orgId);
      fileArray.forEach((f) => formData.append("files", f));

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          setUploadedFiles((prev) => [
            ...prev,
            ...fileArray.map((f) => f.name),
          ]);
        }
      } catch {
        // silent
      } finally {
        setUploading(false);
      }
    },
    [orgId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────

  const next = () => {
    if (step < totalSteps - 1) setStep(step + 1);
  };

  const finish = () => {
    try {
      localStorage.setItem("pivot_onboarded", "true");
    } catch {}
    onComplete();
  };

  // ── Step Indicator ───────────────────────────────────────────────────────

  const StepDots = () => (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <button
          key={i}
          onClick={() => setStep(i)}
          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
            i === step
              ? "bg-indigo-600 w-8"
              : i < step
              ? "bg-indigo-300"
              : "bg-zinc-200"
          }`}
        />
      ))}
    </div>
  );

  // ── Step 1: Connect Tools ────────────────────────────────────────────────

  const StepConnect = () => (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">
            Connect your tools
          </h2>
          <p className="text-sm text-zinc-500">
            Pivot pulls live data for smarter analysis
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {TOP_INTEGRATIONS.map((integration) => {
          const isConnected = connectedProviders.has(integration.key);
          const isConnecting = connecting === integration.key;
          return (
            <div
              key={integration.key}
              className="flex items-center gap-4 p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
            >
              <img
                src={integration.logo}
                alt={integration.name}
                className="w-8 h-8 rounded-lg object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900">
                  {integration.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {integration.description}
                </p>
              </div>
              {isConnected ? (
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
                  Connected
                </span>
              ) : (
                <button
                  onClick={() => handleConnect(integration.key)}
                  disabled={isConnecting}
                  className="text-xs font-medium text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={next}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={next}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ── Step 2: Upload Document ──────────────────────────────────────────────

  const StepUpload = () => (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <FileText className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">
            Upload your first document
          </h2>
          <p className="text-sm text-zinc-500">
            Pivot analyzes your business docs to build intelligence
          </p>
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`mt-6 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-indigo-400 bg-indigo-50/50"
            : "border-zinc-200 bg-zinc-50/30 hover:border-zinc-300"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
          }}
        />
        <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
        {uploading ? (
          <p className="text-sm text-indigo-600 font-medium">Uploading...</p>
        ) : uploadedFiles.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-emerald-600 mb-1">
              {uploadedFiles.length} file{uploadedFiles.length > 1 ? "s" : ""}{" "}
              uploaded
            </p>
            <p className="text-xs text-zinc-400">
              {uploadedFiles.join(", ")}
            </p>
            <p className="text-xs text-zinc-400 mt-2">
              Drop more files or click to add
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-zinc-700">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Financial statements, business plans, pitch decks, competitor
              reports
            </p>
            <p className="text-xs text-zinc-400">
              PDF, Word, Excel, PowerPoint, CSV (max {MAX_FILE_MB}MB)
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-zinc-200" />
        <span className="text-xs text-zinc-400">or</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 border border-zinc-200 rounded-xl px-3 py-2.5 bg-white">
          <Globe className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="Paste a URL to your website"
            className="flex-1 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none bg-transparent"
          />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={next}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={next}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ── Step 3: Meet Your Team ───────────────────────────────────────────────

  const StepTeam = () => (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Users className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">
            Meet your team
          </h2>
          <p className="text-sm text-zinc-500">
            7 AI agents ready to execute for your business
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {AGENTS.map((agent) => (
          <div
            key={agent.name}
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors"
          >
            <span
              className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${agent.color}`}
            >
              {agent.name}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900">
                {agent.role}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                &ldquo;{agent.example}&rdquo;
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-end">
        <button
          onClick={finish}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Start using Pivot
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const steps = [StepConnect, StepUpload, StepTeam];
  const CurrentStep = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={finish}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 pt-10">
          <StepDots />

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <CurrentStep />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
