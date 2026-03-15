"use client";

import { useState, useMemo } from "react";
import { CHAPTERS } from "@/lib/chapters";
import { formatLabel } from "@/lib/utils";
import ChapterView from "./ChapterView";
import {
  BarChart3,
  MessageCircle,
  ChevronRight,
  CheckCircle2,
  Target,
  TrendingUp,
  Clock,
  AlertTriangle,
  X,
} from "lucide-react";

interface SharedResultsViewProps {
  deliverables: Record<string, unknown>;
  role: "owner" | "employee" | "coach" | "other";
  employeeName?: string;
  orgName: string;
  runId: string;
}

// Convert camelCase to Title Case
function formatTitle(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
}

export default function SharedResultsView({
  deliverables,
  role,
  employeeName,
  orgName,
  runId,
}: SharedResultsViewProps) {
  const [showCoach, setShowCoach] = useState(false);

  if (role === "owner") {
    return <OwnerView deliverables={deliverables} orgName={orgName} runId={runId} />;
  }

  if (role === "employee") {
    return (
      <EmployeeView
        deliverables={deliverables}
        employeeName={employeeName || "Team Member"}
        orgName={orgName}
        runId={runId}
        showCoach={showCoach}
        onToggleCoach={() => setShowCoach(!showCoach)}
      />
    );
  }

  if (role === "other") {
    return <OtherView deliverables={deliverables} orgName={orgName} />;
  }

  // Coach role
  return (
    <CoachRoleView
      deliverables={deliverables}
      orgName={orgName}
      runId={runId}
      showCoach={showCoach}
      onToggleCoach={() => setShowCoach(!showCoach)}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Owner View: Full chapter-based layout
   ───────────────────────────────────────────────────────────────────────────── */

function OwnerView({
  deliverables,
  orgName,
  runId,
}: {
  deliverables: Record<string, unknown>;
  orgName: string;
  runId: string;
}) {
  // Find chapters that have data
  const populatedChapters = useMemo(() => {
    return CHAPTERS.filter((ch) =>
      ch.sections.some((s) => deliverables[s] != null),
    );
  }, [deliverables]);

  const [activeChapter, setActiveChapter] = useState(
    populatedChapters[0]?.id || "dashboard",
  );

  const currentChapter = populatedChapters.find((c) => c.id === activeChapter) || populatedChapters[0];

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-zinc-400" />
              <h1 className="text-lg font-semibold text-zinc-900">{orgName}</h1>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Shared Business Intelligence Report</p>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-full">
            Full Access
          </span>
        </div>
      </header>

      {/* Chapter Navigation */}
      <nav className="sticky top-[73px] z-20 bg-white border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {populatedChapters.map((ch) => {
              const Icon = ch.icon;
              const isActive = ch.id === activeChapter;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChapter(ch.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {ch.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Chapter Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1">
        {currentChapter && (
          <ChapterView
            chapterId={currentChapter.id}
            sections={currentChapter.sections}
            deliverables={deliverables}
            title={currentChapter.label}
            description={currentChapter.description}
          />
        )}
      </main>

      <PivotFooter />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Employee View: Personal dashboard with tasks, KPIs, and coach
   ───────────────────────────────────────────────────────────────────────────── */

function EmployeeView({
  deliverables,
  employeeName,
  orgName,
  runId,
  showCoach,
  onToggleCoach,
}: {
  deliverables: Record<string, unknown>;
  employeeName: string;
  orgName: string;
  runId: string;
  showCoach: boolean;
  onToggleCoach: () => void;
}) {
  const healthScore = deliverables.healthScore as Record<string, unknown> | undefined;
  const actionPlan = deliverables.actionPlan as Record<string, unknown> | undefined;
  const kpis = deliverables.kpis as Record<string, unknown> | undefined;
  const goalTracker = deliverables.goalTracker as Record<string, unknown> | undefined;
  const milestoneTracker = deliverables.milestoneTracker as Record<string, unknown> | undefined;

  // Extract tasks from action plan
  const myTasks = useMemo(() => {
    if (!actionPlan?.days) return [];
    const days = actionPlan.days as Array<{
      day: number;
      title: string;
      tasks: Array<{ description: string; owner: string; priority?: string }>;
    }>;
    return days.flatMap((d) =>
      d.tasks.map((t) => ({ ...t, day: d.day, dayTitle: d.title })),
    );
  }, [actionPlan]);

  // Extract KPI items
  const kpiItems = useMemo(() => {
    if (!kpis || typeof kpis !== "object") return [];
    const items: Array<{ label: string; value: string | number }> = [];
    for (const [key, val] of Object.entries(kpis)) {
      if (key.startsWith("_") || key === "summary") continue;
      if (typeof val === "number" || typeof val === "string") {
        items.push({ label: formatTitle(key), value: val });
      }
    }
    return items.slice(0, 8);
  }, [kpis]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">{orgName}</p>
              <h1 className="text-2xl font-light text-zinc-900">
                Welcome, {employeeName}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                Your personal dashboard and action items
              </p>
            </div>
            <button
              onClick={onToggleCoach}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm hover:bg-zinc-800 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Ask Coach
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8 flex-1">
        {/* Health Score Banner */}
        {healthScore && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-zinc-50 border-2 border-zinc-200 flex items-center justify-center">
                <span className="text-2xl font-light text-zinc-900">
                  {typeof healthScore.score === "number" ? healthScore.score : "--"}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Business Health Score</h2>
                {typeof healthScore.grade === "string" && (
                  <p className="text-sm text-zinc-500">Grade: {formatLabel(healthScore.grade)}</p>
                )}
                {typeof healthScore.summary === "string" && (
                  <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{healthScore.summary}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* KPIs Grid */}
        {kpiItems.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-zinc-400" />
              Key Performance Indicators
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpiItems.map((kpi, i) => (
                <div
                  key={i}
                  className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm"
                >
                  <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1 truncate">
                    {kpi.label}
                  </div>
                  <div className="text-lg font-light text-zinc-900 tabular-nums">
                    {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* My Action Items */}
        {myTasks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-zinc-400" />
              Your Action Items ({myTasks.length})
            </h2>
            <div className="space-y-2">
              {myTasks.map((task, i) => (
                <div
                  key={i}
                  className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex items-start gap-3"
                >
                  <div className="mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-zinc-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-900">{task.description}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Day {task.day}
                      </span>
                      <span className="text-[10px] text-zinc-400">{task.dayTitle}</span>
                      {task.priority && (
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            task.priority === "high"
                              ? "bg-red-50 text-red-600"
                              : task.priority === "medium"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-300 mt-0.5 shrink-0" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Goal Tracker */}
        {goalTracker && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-zinc-400" />
              Goals
            </h2>
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
              <GenericSectionDisplay data={goalTracker} />
            </div>
          </section>
        )}

        {/* Milestone Tracker */}
        {milestoneTracker && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-zinc-400" />
              Milestones
            </h2>
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
              <GenericSectionDisplay data={milestoneTracker} />
            </div>
          </section>
        )}

        {/* No data fallback */}
        {!healthScore && kpiItems.length === 0 && myTasks.length === 0 && (
          <div className="text-center py-16">
            <AlertTriangle className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No data available for your role yet.</p>
          </div>
        )}
      </main>

      <PivotFooter />

      {/* Coach Chat Overlay */}
      {showCoach && (
        <CoachOverlay
          runId={runId}
          memberRole="employee"
          memberName={employeeName}
          onClose={onToggleCoach}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Coach Role View: Coaching-relevant sections + coach chat
   ───────────────────────────────────────────────────────────────────────────── */

function CoachRoleView({
  deliverables,
  orgName,
  runId,
  showCoach,
  onToggleCoach,
}: {
  deliverables: Record<string, unknown>;
  orgName: string;
  runId: string;
  showCoach: boolean;
  onToggleCoach: () => void;
}) {
  // Group coaching-relevant deliverables into logical sections
  const coachSections = useMemo(() => {
    const sections: Array<{ title: string; icon: React.ReactNode; items: Array<{ key: string; data: Record<string, unknown> }> }> = [];

    const healthKeys = ["healthScore", "executiveSummary", "benchmarkScore", "healthChecklist"];
    const performanceKeys = ["kpis", "kpiReport", "teamPerformance"];
    const riskKeys = ["issuesRegister", "riskRegister", "swotAnalysis"];
    const strategyKeys = ["decisionBrief", "competitiveMoat", "scenarioPlanner", "actionPlan"];
    const teamKeys = ["hiringPlan", "milestoneTracker", "goalTracker"];

    const buildSection = (title: string, icon: React.ReactNode, keys: string[]) => {
      const items = keys
        .filter((k) => deliverables[k] != null)
        .map((k) => ({ key: k, data: deliverables[k] as Record<string, unknown> }));
      if (items.length > 0) sections.push({ title, icon, items });
    };

    buildSection("Business Health", <BarChart3 className="w-4 h-4" />, healthKeys);
    buildSection("Performance Metrics", <TrendingUp className="w-4 h-4" />, performanceKeys);
    buildSection("Risks & Issues", <AlertTriangle className="w-4 h-4" />, riskKeys);
    buildSection("Strategy & Decisions", <Target className="w-4 h-4" />, strategyKeys);
    buildSection("Team & Milestones", <CheckCircle2 className="w-4 h-4" />, teamKeys);

    return sections;
  }, [deliverables]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">{orgName}</p>
              <h1 className="text-2xl font-light text-zinc-900">Coach Dashboard</h1>
              <p className="text-sm text-zinc-500 mt-1">
                Coaching-relevant insights and metrics
              </p>
            </div>
            <button
              onClick={onToggleCoach}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm hover:bg-zinc-800 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Coach Chat
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8 flex-1">
        {coachSections.map((section, idx) => (
          <section key={idx}>
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="text-zinc-400">{section.icon}</span>
              {section.title}
            </h2>
            <div className="space-y-4">
              {section.items.map((item) => (
                <div
                  key={item.key}
                  className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-base font-medium text-zinc-900 mb-3">
                    {formatTitle(item.key)}
                  </h3>
                  <GenericSectionDisplay data={item.data} />
                </div>
              ))}
            </div>
          </section>
        ))}

        {coachSections.length === 0 && (
          <div className="text-center py-16">
            <AlertTriangle className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No coaching data available yet.</p>
          </div>
        )}
      </main>

      {/* Coach Chat Overlay */}
      <PivotFooter />

      {showCoach && (
        <CoachOverlay
          runId={runId}
          memberRole="coach"
          onClose={onToggleCoach}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Other View: Generic improvement guide (minimal data, no sensitive info)
   ───────────────────────────────────────────────────────────────────────────── */

function OtherView({
  deliverables,
  orgName,
}: {
  deliverables: Record<string, unknown>;
  orgName: string;
}) {
  const healthScore = deliverables.healthScore as Record<string, unknown> | undefined;
  const actionPlan = deliverables.actionPlan as Record<string, unknown> | undefined;
  const healthChecklist = deliverables.healthChecklist as Record<string, unknown> | undefined;

  const recommendations = useMemo(() => {
    if (!actionPlan?.days) return [];
    const days = actionPlan.days as Array<{
      day: number;
      title: string;
      tasks: Array<{ description: string }>;
    }>;
    return days.flatMap((d) =>
      d.tasks.map((t) => ({ ...t, day: d.day, dayTitle: d.title })),
    ).slice(0, 10);
  }, [actionPlan]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">{orgName}</p>
          <h1 className="text-2xl font-light text-zinc-900">Business Improvement Guide</h1>
          <p className="text-sm text-zinc-500 mt-1">
            General recommendations and health overview
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8 flex-1">
        {/* Health Score */}
        {healthScore && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-zinc-50 border-2 border-zinc-200 flex items-center justify-center">
                <span className="text-2xl font-light text-zinc-900">
                  {typeof healthScore.score === "number" ? healthScore.score : "--"}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Business Health Score</h2>
                {typeof healthScore.grade === "string" && (
                  <p className="text-sm text-zinc-500">Grade: {formatLabel(healthScore.grade)}</p>
                )}
                {typeof healthScore.summary === "string" && (
                  <p className="text-sm text-zinc-500 mt-1 line-clamp-3">{healthScore.summary}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* General Recommendations */}
        {recommendations.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-zinc-400" />
              Recommendations
            </h2>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex items-start gap-3"
                >
                  <div className="mt-0.5 w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono text-zinc-500">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-900">{rec.description}</p>
                    <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      Day {rec.day} &mdash; {rec.dayTitle}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Health Checklist */}
        {healthChecklist && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-zinc-400" />
              Health Checklist
            </h2>
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
              <GenericSectionDisplay data={healthChecklist} />
            </div>
          </section>
        )}

        {/* No data fallback */}
        {!healthScore && recommendations.length === 0 && (
          <div className="text-center py-16">
            <AlertTriangle className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No data available for this link.</p>
          </div>
        )}
      </main>

      {/* Powered by Pivot Footer */}
      <PivotFooter />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Powered by Pivot Footer
   ───────────────────────────────────────────────────────────────────────────── */

function PivotFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white py-6 mt-auto">
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-center gap-2">
        <div className="w-5 h-5 bg-zinc-900 flex items-center justify-center rounded-md">
          <div className="w-1.5 h-1.5 bg-white rounded-sm rotate-45" />
        </div>
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
          Powered by Pivot
        </span>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Generic Section Display: Renders unknown data structures cleanly
   ───────────────────────────────────────────────────────────────────────────── */

function GenericSectionDisplay({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(
    ([k]) => !k.startsWith("_") && k !== "selectedSections",
  );

  if (entries.length === 0) {
    return <p className="text-sm text-zinc-400">No data</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, val]) => {
        // Simple string/number
        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
          return (
            <div key={key} className="flex items-start justify-between gap-4">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider shrink-0">
                {formatTitle(key)}
              </span>
              <span className="text-sm text-zinc-700 text-right">
                {typeof val === "number" ? val.toLocaleString() : String(val)}
              </span>
            </div>
          );
        }

        // Array
        if (Array.isArray(val) && val.length > 0) {
          return (
            <div key={key}>
              <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
                {formatTitle(key)} ({val.length})
              </p>
              <ul className="space-y-1.5">
                {val.slice(0, 10).map((item, i) => (
                  <li key={i} className="text-sm text-zinc-700 pl-3 border-l-2 border-zinc-100">
                    {typeof item === "string"
                      ? item
                      : typeof item === "object" && item !== null
                        ? String((item as Record<string, unknown>).title ||
                          (item as Record<string, unknown>).name ||
                          (item as Record<string, unknown>).description ||
                          (item as Record<string, unknown>).label ||
                          JSON.stringify(item).slice(0, 120))
                        : String(item)}
                  </li>
                ))}
                {val.length > 10 && (
                  <li className="text-xs text-zinc-400 pl-3">
                    +{val.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          );
        }

        // Nested object — show summary
        if (val && typeof val === "object" && !Array.isArray(val)) {
          const nestedStr = (val as Record<string, unknown>).summary ||
            (val as Record<string, unknown>).description ||
            (val as Record<string, unknown>).headline;
          if (typeof nestedStr === "string") {
            return (
              <div key={key}>
                <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  {formatTitle(key)}
                </p>
                <p className="text-sm text-zinc-700">{nestedStr}</p>
              </div>
            );
          }
        }

        return null;
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Coach Chat Overlay: Slide-in panel for coach chat
   ───────────────────────────────────────────────────────────────────────────── */

function CoachOverlay({
  runId,
  memberRole,
  memberName,
  onClose,
}: {
  runId: string;
  memberRole: string;
  memberName?: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");

    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          messages: newMessages.slice(-10),
          message: userMsg,
          memberRole,
          memberName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages([...newMessages, { role: "assistant", content: data.message || data.reply || "I'm here to help." }]);
      } else {
        setMessages([...newMessages, { role: "assistant", content: "Sorry, I ran into an issue. Please try again." }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">AI Coach</h3>
            <p className="text-xs text-zinc-400">Ask questions about your business data</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageCircle className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">
                Ask me anything about the analysis. I can help explain metrics, suggest next steps, or dive deeper into any area.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-800"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-zinc-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask a question..."
              className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
