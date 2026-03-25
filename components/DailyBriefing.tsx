"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowRight,
  Sunrise,
  Sun,
  Moon,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

interface BriefingSection {
  title: string;
  icon: string;
  content: string;
  priority: "high" | "medium" | "low";
}

interface Briefing {
  orgId: string;
  greeting: string;
  summary: string;
  sections: BriefingSection[];
  actionItems: string[];
  generatedAt: string;
  audioUrl?: string;
}

function TimeIcon() {
  const hour = new Date().getHours();
  if (hour < 12) return <Sunrise className="w-5 h-5 text-amber-500" />;
  if (hour < 17) return <Sun className="w-5 h-5 text-yellow-500" />;
  return <Moon className="w-5 h-5 text-indigo-400" />;
}

function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "high"
      ? "bg-red-400"
      : priority === "medium"
      ? "bg-amber-400"
      : "bg-green-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export function DailyBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [completedActions, setCompletedActions] = useState<Set<number>>(
    new Set()
  );

  const fetchBriefing = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const res = force
        ? await authFetch("/api/briefing", { method: "POST" })
        : await authFetch("/api/briefing");

      if (res.ok) {
        const data = await res.json();
        setBriefing(data.briefing);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  const toggleAction = (idx: number) => {
    setCompletedActions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 border border-indigo-100/50 p-6 animate-pulse">
        <div className="h-6 bg-indigo-100 rounded w-48 mb-3" />
        <div className="h-4 bg-indigo-50 rounded w-72 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-indigo-50/50 rounded-lg" />
          <div className="h-16 bg-indigo-50/50 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 border border-indigo-100/50 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-200">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                Daily Briefing
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                <TimeIcon />
                {new Date(briefing.generatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchBriefing(true)}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-indigo-100/50 transition-colors text-zinc-400 hover:text-indigo-600 disabled:opacity-50"
              title="Refresh briefing"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg hover:bg-indigo-100/50 transition-colors text-zinc-400"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Greeting */}
        <p className="mt-4 text-[15px] text-zinc-700 leading-relaxed">
          {briefing.greeting}
        </p>
        {briefing.summary && (
          <p className="mt-1 text-sm text-zinc-500">{briefing.summary}</p>
        )}
      </div>

      {/* Sections */}
      {expanded && (
        <div className="px-6 pb-5 space-y-4">
          {/* Briefing sections */}
          {briefing.sections.length > 0 && (
            <div className="space-y-2.5">
              {briefing.sections.map((section, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-white/80 border border-zinc-100 hover:border-indigo-200 transition-colors"
                >
                  <span className="text-lg shrink-0 mt-0.5">
                    {section.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-zinc-800">
                        {section.title}
                      </span>
                      <PriorityDot priority={section.priority} />
                    </div>
                    <p className="text-[13px] text-zinc-600 leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action items */}
          {briefing.actionItems.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
                Action Items
              </h3>
              <div className="space-y-2">
                {briefing.actionItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => toggleAction(i)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                      completedActions.has(i)
                        ? "bg-green-50 border border-green-200"
                        : "bg-white/80 border border-zinc-100 hover:border-indigo-200"
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        completedActions.has(i)
                          ? "text-green-500"
                          : "text-zinc-300"
                      }`}
                    />
                    <span
                      className={`text-[13px] flex-1 ${
                        completedActions.has(i)
                          ? "text-zinc-400 line-through"
                          : "text-zinc-700"
                      }`}
                    >
                      {item}
                    </span>
                    {!completedActions.has(i) && (
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-300" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
