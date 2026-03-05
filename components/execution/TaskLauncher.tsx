"use client";

import { useState } from "react";
import {
  Rocket,
  Target,
  DollarSign,
  User,
  ChevronDown,
  ChevronUp,
  Check,
  Sparkles,
} from "lucide-react";
import type { AgentType } from "./AgentCard";
import type { TaskPriority } from "./TaskCard";

/* ── Recommendation from analysis ── */
export interface AnalysisRecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  suggestedAgent?: AgentType;
  estimatedCostCents: number;
  impact: "low" | "medium" | "high";
}

export interface LaunchConfig {
  recommendationId: string;
  title: string;
  priority: TaskPriority;
  budgetCents: number;
  assignedAgent: AgentType | "auto";
}

export interface TaskLauncherProps {
  recommendations: AnalysisRecommendation[];
  onLaunch: (configs: LaunchConfig[]) => void;
  onCancel: () => void;
}

/* ── Impact styling ── */
const IMPACT_STYLES: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-zinc-100", text: "text-zinc-600" },
  medium: { bg: "bg-blue-50", text: "text-blue-700" },
  high: { bg: "bg-emerald-50", text: "text-emerald-700" },
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const AGENT_OPTIONS: { value: AgentType | "auto"; label: string }[] = [
  { value: "auto", label: "Auto-assign" },
  { value: "strategist", label: "Strategist" },
  { value: "marketer", label: "Marketer" },
  { value: "analyst", label: "Analyst" },
  { value: "recruiter", label: "Recruiter" },
  { value: "operator", label: "Operator" },
  { value: "researcher", label: "Researcher" },
];

interface SelectedRec {
  id: string;
  priority: TaskPriority;
  budgetCents: number;
  agent: AgentType | "auto";
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function RecommendationRow({
  rec,
  selected,
  config,
  onToggle,
  onUpdateConfig,
}: {
  rec: AnalysisRecommendation;
  selected: boolean;
  config?: SelectedRec;
  onToggle: () => void;
  onUpdateConfig: (update: Partial<SelectedRec>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const impact = IMPACT_STYLES[rec.impact];

  return (
    <div
      className={`border rounded-xl transition-all ${
        selected
          ? "border-indigo-300 bg-indigo-50/30"
          : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={onToggle}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
              selected
                ? "bg-indigo-600 border-indigo-600"
                : "border-zinc-300 hover:border-zinc-400"
            }`}
          >
            {selected && <Check className="w-3 h-3 text-white" />}
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-sm font-medium text-zinc-900">
                {rec.title}
              </h4>
              <span
                className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${impact.bg} ${impact.text}`}
              >
                {rec.impact} impact
              </span>
              <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                {rec.category}
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-snug">
              {rec.description}
            </p>

            {/* Est cost */}
            <div className="flex items-center gap-1 mt-2 text-[10px] font-mono text-zinc-400">
              <DollarSign className="w-3 h-3" />
              Est. {formatDollars(rec.estimatedCostCents)}
              {rec.suggestedAgent && (
                <>
                  <span className="mx-1">|</span>
                  <User className="w-3 h-3" />
                  Suggested: {rec.suggestedAgent}
                </>
              )}
            </div>
          </div>

          {/* Expand config */}
          {selected && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Config panel */}
      {selected && expanded && config && (
        <div className="px-4 pb-4 pt-0 border-t border-indigo-100 mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            {/* Priority */}
            <div>
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1.5">
                Priority
              </label>
              <select
                value={config.priority}
                onChange={(e) =>
                  onUpdateConfig({
                    priority: e.target.value as TaskPriority,
                  })
                }
                className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget */}
            <div>
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1.5">
                Budget ($)
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={(config.budgetCents / 100).toFixed(2)}
                onChange={(e) =>
                  onUpdateConfig({
                    budgetCents: Math.round(
                      parseFloat(e.target.value || "0") * 100
                    ),
                  })
                }
                className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 font-mono tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
            </div>

            {/* Agent */}
            <div>
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1.5">
                Assign To
              </label>
              <select
                value={config.agent}
                onChange={(e) =>
                  onUpdateConfig({
                    agent: e.target.value as AgentType | "auto",
                  })
                }
                className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              >
                {AGENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TaskLauncher({
  recommendations,
  onLaunch,
  onCancel,
}: TaskLauncherProps) {
  const [selectedMap, setSelectedMap] = useState<Map<string, SelectedRec>>(
    new Map()
  );

  const toggleRec = (rec: AnalysisRecommendation) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(rec.id)) {
        next.delete(rec.id);
      } else {
        next.set(rec.id, {
          id: rec.id,
          priority: rec.impact === "high" ? "high" : "medium",
          budgetCents: rec.estimatedCostCents,
          agent: rec.suggestedAgent ?? "auto",
        });
      }
      return next;
    });
  };

  const updateConfig = (id: string, update: Partial<SelectedRec>) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) {
        next.set(id, { ...existing, ...update });
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedMap(() => {
      const next = new Map<string, SelectedRec>();
      recommendations.forEach((rec) => {
        next.set(rec.id, {
          id: rec.id,
          priority: rec.impact === "high" ? "high" : "medium",
          budgetCents: rec.estimatedCostCents,
          agent: rec.suggestedAgent ?? "auto",
        });
      });
      return next;
    });
  };

  const clearAll = () => setSelectedMap(new Map());

  const handleLaunch = () => {
    const configs: LaunchConfig[] = [];
    selectedMap.forEach((cfg, id) => {
      const rec = recommendations.find((r) => r.id === id);
      if (rec) {
        configs.push({
          recommendationId: id,
          title: rec.title,
          priority: cfg.priority,
          budgetCents: cfg.budgetCents,
          assignedAgent: cfg.agent,
        });
      }
    });
    onLaunch(configs);
  };

  const totalBudget = Array.from(selectedMap.values()).reduce(
    (sum, c) => sum + c.budgetCents,
    0
  );

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-zinc-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Rocket className="w-4.5 h-4.5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-zinc-900">
              Launch Execution Tasks
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Select analysis recommendations to turn into agent tasks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={selectAll}
            className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider hover:text-indigo-800 transition-colors"
          >
            Select All
          </button>
          <span className="text-zinc-200">|</span>
          <button
            onClick={clearAll}
            className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider hover:text-zinc-600 transition-colors"
          >
            Clear
          </button>
          <div className="ml-auto text-[10px] font-mono text-zinc-400">
            {selectedMap.size} of {recommendations.length} selected
          </div>
        </div>
      </div>

      {/* Recommendations list */}
      <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
        {recommendations.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">No recommendations available</p>
            <p className="text-[10px] font-mono text-zinc-300 mt-1 uppercase tracking-wider">
              Complete an analysis to generate action items
            </p>
          </div>
        ) : (
          recommendations.map((rec) => (
            <RecommendationRow
              key={rec.id}
              rec={rec}
              selected={selectedMap.has(rec.id)}
              config={selectedMap.get(rec.id)}
              onToggle={() => toggleRec(rec)}
              onUpdateConfig={(update) => updateConfig(rec.id, update)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              Total Budget
            </div>
            <div className="text-sm font-mono font-medium text-zinc-900 tabular-nums">
              {formatDollars(totalBudget)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              Tasks
            </div>
            <div className="text-sm font-mono font-medium text-zinc-900 tabular-nums">
              {selectedMap.size}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-mono text-zinc-500 uppercase tracking-wider hover:text-zinc-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={selectedMap.size === 0}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-mono uppercase tracking-wider hover:bg-indigo-700 transition-colors rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Target className="w-3.5 h-3.5" />
            Launch {selectedMap.size > 0 ? `(${selectedMap.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
