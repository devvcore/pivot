"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Play,
  Users,
  ListTodo,
  DollarSign,
  FileStack,
  ArrowLeft,
  RefreshCw,
  Bell,
  Loader2,
  Settings,
} from "lucide-react";
import {
  AgentCard,
  type AgentDefinition,
  type AgentType,
  type AgentStatus,
} from "./AgentCard";
import { AgentFeed, type FeedEvent } from "./AgentFeed";
import { TaskCard, type TaskData } from "./TaskCard";
import {
  ApprovalCard,
  type ApprovalRequest,
} from "./ApprovalCard";
import {
  CostOverview,
  type AgentCostEntry,
  type DailyCostEntry,
  type TaskCostEntry,
} from "./CostOverview";
import {
  ArtifactViewer,
  type Artifact,
} from "./ArtifactViewer";
import {
  TaskLauncher,
  type AnalysisRecommendation,
  type LaunchConfig,
} from "./TaskLauncher";

/* ── Agent definitions ── */
const AGENTS: AgentDefinition[] = [
  { type: "strategist", name: "Strategist", role: "Business strategy & planning" },
  { type: "marketer", name: "Marketer", role: "Marketing & growth campaigns" },
  { type: "analyst", name: "Analyst", role: "Data analysis & insights" },
  { type: "recruiter", name: "Recruiter", role: "Talent acquisition & HR" },
  { type: "operator", name: "Operator", role: "Operations & process optimization" },
  { type: "researcher", name: "Researcher", role: "Market & competitive research" },
];

/* ── Agent state ── */
interface AgentState {
  status: AgentStatus;
  currentTask?: string;
  costTodayCents: number;
  events: FeedEvent[];
}

/* ── View modes ── */
type MainView = "tasks" | "feed" | "artifacts" | "launcher" | "costs";

/* ── Props ── */
export interface ExecutionDashboardProps {
  orgName: string;
  runId: string;
  onSwitchToAnalysis: () => void;
  recommendations?: AnalysisRecommendation[];
}

/* ── Demo data generators (will be replaced by real API/Trigger.dev) ── */
function createDemoAgentStates(): Record<AgentType, AgentState> {
  return {
    strategist: { status: "idle", costTodayCents: 0, events: [] },
    marketer: { status: "idle", costTodayCents: 0, events: [] },
    analyst: { status: "idle", costTodayCents: 0, events: [] },
    recruiter: { status: "idle", costTodayCents: 0, events: [] },
    operator: { status: "idle", costTodayCents: 0, events: [] },
    researcher: { status: "idle", costTodayCents: 0, events: [] },
  };
}

export function ExecutionDashboard({
  orgName,
  runId,
  onSwitchToAnalysis,
  recommendations = [],
}: ExecutionDashboardProps) {
  /* ── State ── */
  const [activeTab, setActiveTab] = useState<"analysis" | "execution">("execution");
  const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);
  const [mainView, setMainView] = useState<MainView>("tasks");
  const [agentStates, setAgentStates] = useState<Record<AgentType, AgentState>>(
    createDemoAgentStates
  );
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* ── Polling for real-time updates (placeholder - replace with Trigger.dev hooks) ── */
  const pollUpdates = useCallback(async () => {
    try {
      // Future: fetch from /api/execution/status?runId=...
      // For now, agent states are managed locally
    } catch {
      // silently ignore polling errors
    }
  }, [runId]);

  useEffect(() => {
    const interval = setInterval(pollUpdates, 5000);
    return () => clearInterval(interval);
  }, [pollUpdates]);

  /* ── Approval handlers ── */
  const handleApprove = (id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    // Future: POST /api/execution/approve
  };

  const handleReject = (id: string, reason: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    // Future: POST /api/execution/reject
  };

  const handleRevise = (id: string, feedback: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    // Future: POST /api/execution/revise
  };

  /* ── Task launcher ── */
  const handleLaunch = (configs: LaunchConfig[]) => {
    const newTasks: TaskData[] = configs.map((cfg, i) => ({
      id: `task-${Date.now()}-${i}`,
      title: cfg.title,
      assignedAgent: cfg.assignedAgent === "auto" ? "strategist" : cfg.assignedAgent,
      agentName:
        AGENTS.find(
          (a) => a.type === (cfg.assignedAgent === "auto" ? "strategist" : cfg.assignedAgent)
        )?.name ?? "Strategist",
      priority: cfg.priority,
      status: "queued",
      attempt: 1,
      maxAttempts: 3,
      costCents: 0,
      costCeilingCents: cfg.budgetCents,
      startedAt: Date.now(),
    }));

    setTasks((prev) => [...prev, ...newTasks]);
    setMainView("tasks");
  };

  /* ── Computed values ── */
  const totalCostToday = Object.values(agentStates).reduce(
    (sum, s) => sum + s.costTodayCents,
    0
  );

  const agentCosts: AgentCostEntry[] = AGENTS.map((a) => ({
    agentType: a.type,
    agentName: a.name,
    costCents: agentStates[a.type].costTodayCents,
  }));

  const dailyTrend: DailyCostEntry[] = [
    { date: "Feb 26", costCents: 320 },
    { date: "Feb 27", costCents: 450 },
    { date: "Feb 28", costCents: 280 },
    { date: "Mar 1", costCents: 510 },
    { date: "Mar 2", costCents: 390 },
    { date: "Mar 3", costCents: 440 },
    { date: "Today", costCents: totalCostToday },
  ];

  const taskCosts: TaskCostEntry[] = tasks
    .filter((t) => t.costCents > 0)
    .map((t) => ({
      taskId: t.id,
      taskTitle: t.title,
      agentName: t.agentName,
      costCents: t.costCents,
    }));

  const pendingApprovals = approvals.length;
  const activeTasks = tasks.filter(
    (t) => t.status === "executing" || t.status === "reviewing"
  ).length;

  /* ── Feed approval handlers ── */
  const handleFeedApprove = (approvalId: string) => {
    handleApprove(approvalId);
  };

  const handleFeedReject = (approvalId: string) => {
    handleReject(approvalId, "Rejected from feed");
  };

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans flex flex-col">
      {/* ── Top Bar ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-6 py-3">
          {/* Left: Logo + org */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 flex items-center justify-center rounded-lg shadow-lg shadow-zinc-900/10">
              <div className="w-3 h-3 bg-white rounded-sm rotate-45" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-zinc-900 tracking-tight leading-none">
                {orgName}
              </div>
              <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-[0.2em] mt-0.5">
                Execution Dashboard
              </div>
            </div>
          </div>

          {/* Center: Tab switcher */}
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5">
            <button
              onClick={() => {
                setActiveTab("analysis");
                onSwitchToAnalysis();
              }}
              className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-all ${
                activeTab === "analysis"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" /> Analysis
              </span>
            </button>
            <button
              onClick={() => setActiveTab("execution")}
              className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-all ${
                activeTab === "execution"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5" /> Execution
              </span>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Approval badge */}
            {pendingApprovals > 0 && (
              <button
                onClick={() => setMainView("tasks")}
                className="relative p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                title={`${pendingApprovals} pending approvals`}
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {pendingApprovals}
                </span>
              </button>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Sidebar: Agent List ── */}
        <aside
          className={`${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:relative z-30 lg:z-auto inset-y-0 left-0 top-[57px] w-72 bg-white border-r border-zinc-200 flex flex-col transition-transform duration-200`}
        >
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Agents
              </h2>
              <div className="flex items-center gap-1">
                {activeTasks > 0 && (
                  <span className="flex items-center gap-1 text-[9px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    {activeTasks} active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Agent cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {AGENTS.map((agent) => (
              <AgentCard
                key={agent.type}
                agent={agent}
                status={agentStates[agent.type].status}
                currentTask={agentStates[agent.type].currentTask}
                costToday={agentStates[agent.type].costTodayCents}
                selected={selectedAgent === agent.type}
                onClick={() => {
                  setSelectedAgent(
                    selectedAgent === agent.type ? null : agent.type
                  );
                  if (selectedAgent !== agent.type) {
                    setMainView("feed");
                  }
                  setMobileMenuOpen(false);
                }}
              />
            ))}
          </div>

          {/* Sidebar footer: summary */}
          <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Total Cost
                </div>
                <div className="text-sm font-mono font-medium text-zinc-900 tabular-nums">
                  ${(totalCostToday / 100).toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Tasks
                </div>
                <div className="text-sm font-mono font-medium text-zinc-900 tabular-nums">
                  {tasks.length}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-20 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* ── Main Content Area ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* View switcher tabs */}
          <div className="bg-white border-b border-zinc-200 px-4 lg:px-6">
            <div className="flex items-center gap-1 -mb-px overflow-x-auto">
              {[
                { id: "tasks" as MainView, label: "Tasks", icon: ListTodo },
                { id: "feed" as MainView, label: "Feed", icon: LayoutDashboard },
                { id: "artifacts" as MainView, label: "Artifacts", icon: FileStack },
                { id: "costs" as MainView, label: "Costs", icon: DollarSign },
                { id: "launcher" as MainView, label: "Launch", icon: Play },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMainView(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                      mainView === tab.id
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.id === "tasks" && pendingApprovals > 0 && (
                      <span className="w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ml-1">
                        {pendingApprovals}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* ── Tasks View ── */}
            {mainView === "tasks" && (
              <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full space-y-6">
                {/* Pending approvals */}
                {approvals.length > 0 && (
                  <section>
                    <h3 className="text-[10px] font-mono text-orange-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5" /> Pending Approvals ({approvals.length})
                    </h3>
                    <div className="space-y-3">
                      {approvals.map((approval) => (
                        <ApprovalCard
                          key={approval.id}
                          request={approval}
                          onApprove={handleApprove}
                          onReject={handleReject}
                          onRevise={handleRevise}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* All tasks */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <ListTodo className="w-3.5 h-3.5" /> All Tasks
                    </h3>
                    <div className="text-[10px] font-mono text-zinc-300 tabular-nums">
                      {tasks.length} total
                    </div>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
                      <div className="w-14 h-14 rounded-xl bg-zinc-50 flex items-center justify-center mx-auto mb-4">
                        <ListTodo className="w-6 h-6 text-zinc-200" />
                      </div>
                      <h4 className="text-lg font-light text-zinc-900 mb-2">
                        No tasks yet
                      </h4>
                      <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-6">
                        Launch execution tasks from your analysis recommendations
                        to get agents working.
                      </p>
                      <button
                        onClick={() => setMainView("launcher")}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-mono uppercase tracking-wider hover:bg-indigo-700 transition-colors rounded-lg shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5" /> Launch Tasks
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ── Feed View ── */}
            {mainView === "feed" && (
              <div className="h-full flex flex-col">
                {selectedAgent ? (
                  <AgentFeed
                    agentName={
                      AGENTS.find((a) => a.type === selectedAgent)?.name ??
                      selectedAgent
                    }
                    events={agentStates[selectedAgent].events}
                    onApprove={handleFeedApprove}
                    onReject={handleFeedReject}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-xl bg-zinc-50 flex items-center justify-center mx-auto mb-4">
                        <Users className="w-6 h-6 text-zinc-200" />
                      </div>
                      <h4 className="text-lg font-light text-zinc-900 mb-2">
                        Select an Agent
                      </h4>
                      <p className="text-sm text-zinc-500 max-w-sm">
                        Click on an agent in the sidebar to view their live
                        activity feed.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Artifacts View ── */}
            {mainView === "artifacts" && (
              <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
                <ArtifactViewer
                  artifacts={artifacts}
                  selectedId={selectedArtifactId}
                  onSelect={setSelectedArtifactId}
                />
              </div>
            )}

            {/* ── Costs View ── */}
            {mainView === "costs" && (
              <div className="p-4 lg:p-6 max-w-3xl mx-auto w-full">
                <CostOverview
                  totalTodayCents={totalCostToday}
                  dailyBudgetCents={5000}
                  agentCosts={agentCosts}
                  dailyTrend={dailyTrend}
                  taskCosts={taskCosts}
                />
              </div>
            )}

            {/* ── Launcher View ── */}
            {mainView === "launcher" && (
              <div className="p-4 lg:p-6 max-w-4xl mx-auto w-full">
                <TaskLauncher
                  recommendations={recommendations}
                  onLaunch={handleLaunch}
                  onCancel={() => setMainView("tasks")}
                />
              </div>
            )}
          </div>
        </main>

        {/* ── Right Sidebar: Active Task Details (desktop only) ── */}
        <aside className="hidden xl:flex w-80 border-l border-zinc-200 bg-white flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h2 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Settings className="w-3.5 h-3.5" /> Details
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Active task info */}
            {selectedAgent && agentStates[selectedAgent].currentTask ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Current Task
                  </div>
                  <p className="text-sm text-zinc-900">
                    {agentStates[selectedAgent].currentTask}
                  </p>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Agent
                  </div>
                  <p className="text-sm text-zinc-900">
                    {AGENTS.find((a) => a.type === selectedAgent)?.name}
                  </p>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Status
                  </div>
                  <p className="text-sm text-zinc-900 capitalize">
                    {agentStates[selectedAgent].status}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-zinc-400">
                  {selectedAgent
                    ? "No active task for this agent"
                    : "Select an agent to see details"}
                </p>
              </div>
            )}

            {/* Quick approvals */}
            {approvals.length > 0 && (
              <div className="pt-4 border-t border-zinc-100">
                <div className="text-[10px] font-mono text-orange-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Bell className="w-3 h-3" /> Approvals ({approvals.length})
                </div>
                <div className="space-y-2">
                  {approvals.slice(0, 3).map((approval) => (
                    <div
                      key={approval.id}
                      className="bg-orange-50 border border-orange-100 rounded-lg p-3"
                    >
                      <p className="text-xs text-zinc-900 font-medium mb-1 line-clamp-2">
                        {approval.action}
                      </p>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {approval.agentName}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => handleApprove(approval.id)}
                          className="px-2 py-1 bg-emerald-600 text-white text-[9px] font-mono uppercase tracking-wider rounded hover:bg-emerald-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(approval.id, "Rejected")}
                          className="px-2 py-1 bg-red-600 text-white text-[9px] font-mono uppercase tracking-wider rounded hover:bg-red-700 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent artifacts */}
            {artifacts.length > 0 && (
              <div className="pt-4 border-t border-zinc-100">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileStack className="w-3 h-3" /> Recent Artifacts
                </div>
                <div className="space-y-1.5">
                  {artifacts.slice(0, 5).map((artifact) => (
                    <button
                      key={artifact.id}
                      onClick={() => {
                        setSelectedArtifactId(artifact.id);
                        setMainView("artifacts");
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                      <div className="text-xs text-zinc-900 truncate">
                        {artifact.title}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                        {artifact.type} - {artifact.agentName}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
