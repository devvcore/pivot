"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Check,
  X,
  RotateCcw,
  AlertTriangle,
  Info,
} from "lucide-react";

/* ── Types ── */
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ApprovalRequest {
  id: string;
  agentName: string;
  agentType: string;
  action: string;
  reasoning: string;
  artifactPreview?: string;
  riskLevel: RiskLevel;
  costEstimateCents?: number;
  createdAt: number;
}

export interface ApprovalCardProps {
  request: ApprovalRequest;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRevise: (id: string, feedback: string) => void;
}

/* ── Risk level styling ── */
const RISK_STYLES: Record<
  RiskLevel,
  { bg: string; text: string; border: string; label: string; icon: typeof Info }
> = {
  low: {
    bg: "bg-zinc-50",
    text: "text-zinc-600",
    border: "border-zinc-200",
    label: "Low Risk",
    icon: Info,
  },
  medium: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Medium Risk",
    icon: Info,
  },
  high: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    label: "High Risk",
    icon: AlertTriangle,
  },
  critical: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    label: "Critical Risk",
    icon: ShieldAlert,
  },
};

export function ApprovalCard({
  request,
  onApprove,
  onReject,
  onRevise,
}: ApprovalCardProps) {
  const [mode, setMode] = useState<"idle" | "rejecting" | "revising">("idle");
  const [feedback, setFeedback] = useState("");

  const risk = RISK_STYLES[request.riskLevel];
  const RiskIcon = risk.icon;

  const handleReject = () => {
    if (mode !== "rejecting") {
      setMode("rejecting");
      setFeedback("");
      return;
    }
    if (!feedback.trim()) return;
    onReject(request.id, feedback.trim());
    setMode("idle");
    setFeedback("");
  };

  const handleRevise = () => {
    if (mode !== "revising") {
      setMode("revising");
      setFeedback("");
      return;
    }
    if (!feedback.trim()) return;
    onRevise(request.id, feedback.trim());
    setMode("idle");
    setFeedback("");
  };

  const handleCancel = () => {
    setMode("idle");
    setFeedback("");
  };

  return (
    <div className="border border-orange-200 bg-white rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-orange-50 px-4 py-3 flex items-center justify-between border-b border-orange-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-orange-700 uppercase tracking-wider">
            Approval Required
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase tracking-wider ${risk.bg} ${risk.text} ${risk.border}`}
        >
          <RiskIcon className="w-3 h-3" />
          {risk.label}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Agent + action */}
        <div>
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
            {request.agentName} wants to
          </div>
          <p className="text-sm font-medium text-zinc-900 leading-snug">
            {request.action}
          </p>
        </div>

        {/* Reasoning */}
        <div>
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
            Reasoning
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            {request.reasoning}
          </p>
        </div>

        {/* Artifact preview */}
        {request.artifactPreview && (
          <div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
              Preview
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 text-xs text-zinc-600 font-mono leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
              {request.artifactPreview}
            </div>
          </div>
        )}

        {/* Cost estimate */}
        {request.costEstimateCents != null && request.costEstimateCents > 0 && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              Est. cost:
            </span>
            <span className="font-mono tabular-nums">
              ${(request.costEstimateCents / 100).toFixed(2)}
            </span>
          </div>
        )}

        {/* Feedback input */}
        {(mode === "rejecting" || mode === "revising") && (
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
              {mode === "rejecting"
                ? "Rejection reason (required)"
                : "Revision feedback (required)"}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={
                mode === "rejecting"
                  ? "Explain why this action should not proceed..."
                  : "Describe what changes you'd like..."
              }
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none"
              rows={3}
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {mode === "idle" ? (
            <>
              <button
                onClick={() => onApprove(request.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-mono uppercase tracking-wider hover:bg-emerald-700 transition-colors rounded-lg"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={handleReject}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-mono uppercase tracking-wider hover:bg-red-700 transition-colors rounded-lg"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
              <button
                onClick={handleRevise}
                className="flex items-center gap-1.5 px-4 py-2 border border-amber-300 bg-amber-50 text-amber-700 text-xs font-mono uppercase tracking-wider hover:bg-amber-100 transition-colors rounded-lg"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Revise
              </button>
            </>
          ) : (
            <>
              <button
                onClick={mode === "rejecting" ? handleReject : handleRevise}
                disabled={!feedback.trim()}
                className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-mono uppercase tracking-wider transition-colors rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${
                  mode === "rejecting"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {mode === "rejecting" ? (
                  <>
                    <X className="w-3.5 h-3.5" /> Confirm Reject
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" /> Send Revision
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-xs font-mono text-zinc-500 uppercase tracking-wider hover:text-zinc-900 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
