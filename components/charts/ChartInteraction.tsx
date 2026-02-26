"use client";

import { useState } from "react";
import { Bot, TrendingUp, Loader2, X, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ProjectionChart } from "./ProjectionChart";

interface ChartInteractionProps {
  /** Which tab/section this chart belongs to — maps to projection type */
  section: "cash" | "revenue" | "issues" | "customers" | "marketing" | "tech" | "pricing" | "competitors" | "growth";
  /** Pre-loaded prompt chips users can click */
  prompts: string[];
  /** Organization ID for API calls */
  orgId: string;
  /** Projection config — what type + scenario description to use */
  projectionConfig?: {
    type: "cash_forecast" | "revenue_recovery" | "customer_churn" | "growth_scenario";
    scenario: string;
    months?: number;
  };
}

export function ChartInteraction({ section, prompts, orgId, projectionConfig }: ChartInteractionProps) {
  const [response, setResponse] = useState<string | null>(null);
  const [projection, setProjection] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProjection, setLoadingProjection] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const askPivvy = async (prompt: string) => {
    setLoading(true);
    setResponse(null);
    setProjection(null);
    setExpanded(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          messages: [],
          message: prompt,
        }),
      });
      const data = await res.json();
      const text = data.message ?? "No response received.";

      // Check if the response includes a projection
      const projMatch = text.match(/<!--PROJECTION:([\s\S]*?)-->/);
      if (projMatch) {
        try {
          setProjection(JSON.parse(projMatch[1]));
          setResponse(text.replace(/<!--PROJECTION:[\s\S]*?-->/, "").trim());
        } catch {
          setResponse(text);
        }
      } else {
        setResponse(text);
      }
    } catch {
      setResponse("Could not reach Pivvy. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const runProjection = async () => {
    if (!projectionConfig) return;
    setLoadingProjection(true);
    setProjection(null);
    setResponse(null);
    setExpanded(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          messages: [],
          message: `Generate a ${projectionConfig.months ?? 10}-week projection for: ${projectionConfig.scenario}`,
        }),
      });
      const data = await res.json();
      const text = data.message ?? "";
      const projMatch = text.match(/<!--PROJECTION:([\s\S]*?)-->/);
      if (projMatch) {
        try {
          setProjection(JSON.parse(projMatch[1]));
          setResponse(text.replace(/<!--PROJECTION:[\s\S]*?-->/, "").trim());
        } catch {
          setResponse(text);
        }
      } else {
        setResponse(text);
      }
    } catch {
      setResponse("Projection failed. Please try again.");
    } finally {
      setLoadingProjection(false);
    }
  };

  const dismiss = () => {
    setExpanded(false);
    setResponse(null);
    setProjection(null);
  };

  return (
    <div className="mt-3">
      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Pivvy prompt chips */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-400 uppercase tracking-widest shrink-0">
            <MessageCircle className="w-3 h-3" /> Ask Pivvy
          </div>
          {prompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => askPivvy(prompt)}
              disabled={loading || loadingProjection}
              className="text-[10px] text-zinc-600 bg-white border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-50 hover:border-zinc-400 transition-all disabled:opacity-40 whitespace-nowrap"
            >
              {prompt.length > 45 ? prompt.slice(0, 42) + "..." : prompt}
            </button>
          ))}
        </div>

        {/* Projection button */}
        {projectionConfig && (
          <button
            onClick={runProjection}
            disabled={loading || loadingProjection}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white bg-zinc-900 px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-all disabled:opacity-40 shrink-0"
          >
            {loadingProjection ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <TrendingUp className="w-3 h-3" />
            )}
            Projections
          </button>
        )}
      </div>

      {/* Inline response area */}
      <AnimatePresence>
        {expanded && (loading || loadingProjection || response || projection) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 bg-zinc-50 border border-zinc-200 rounded-2xl p-4 relative">
              {/* Dismiss */}
              <button
                onClick={dismiss}
                className="absolute top-3 right-3 p-1 text-zinc-400 hover:text-zinc-700 transition-colors rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Loading state */}
              {(loading || loadingProjection) && !response && !projection && (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-6 h-6 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
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
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                    {loadingProjection ? "Generating projections..." : "Pivvy is thinking..."}
                  </span>
                </div>
              )}

              {/* Response text */}
              {response && (
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap pr-6">{response}</p>
                </div>
              )}

              {/* Projection chart */}
              {projection && <ProjectionChart data={projection} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
