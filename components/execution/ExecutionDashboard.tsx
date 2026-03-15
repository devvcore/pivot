// @ts-nocheck
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Play,
  Send,
  Loader2,
  Bot,
  User,
  Wrench,
  Brain,
  FileOutput,
  AlertCircle,
  ArrowRight,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  DollarSign,
  FileText,
  Code,
  Globe,
  Download,
  Activity,
  CircleDot,
} from "lucide-react";
import { formatLabel } from "@/lib/utils";

/* ── Agent name map ── */
const AGENT_NAMES: Record<string, { name: string; emoji: string; role: string; color: string }> = {
  strategist: { name: "Atlas", emoji: "S", role: "Strategy & Planning", color: "bg-blue-500" },
  marketer: { name: "Maven", emoji: "M", role: "Marketing & Content", color: "bg-pink-500" },
  analyst: { name: "Quant", emoji: "Q", role: "Finance & Analytics", color: "bg-emerald-500" },
  recruiter: { name: "Scout", emoji: "R", role: "HR & Talent", color: "bg-amber-500" },
  operator: { name: "Forge", emoji: "O", role: "Operations & Process", color: "bg-violet-500" },
  researcher: { name: "Lens", emoji: "L", role: "Research & Intel", color: "bg-cyan-500" },
  codebot: { name: "CodeBot", emoji: "C", role: "Engineering & Code", color: "bg-orange-500" },
};

/* ── Chat message types ── */
interface ChatMessage {
  id: string;
  timestamp: number;
  type: "user" | "routing" | "thinking" | "tool_use" | "output" | "error" | "artifact";
  content: string;
  agentName?: string;
  agentId?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  artifacts?: { name: string; type: string; content: string }[];
  taskId?: string;
}

/* ── Recommendation pills ── */
const QUICK_ACTIONS = [
  { label: "Create LinkedIn posts", icon: Globe },
  { label: "Build a landing page", icon: Code },
  { label: "Analyze our competitors", icon: BarChart3 },
  { label: "Create a budget forecast", icon: DollarSign },
  { label: "Write a job posting", icon: FileText },
  { label: "Research our market", icon: Sparkles },
];

/* ── Props ── */
export interface ExecutionDashboardProps {
  orgName: string;
  runId: string;
  orgId: string;
  onSwitchToAnalysis: () => void;
}

/* ── Helpers ── */
function isTerminalStatus(status: string) {
  return ["completed", "failed", "cancelled"].includes(status);
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/* ── Tool use card (collapsible) ── */
function ToolCard({ msg }: { msg: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left bg-indigo-50/60 border border-indigo-100 rounded-lg px-3 py-2 transition-all hover:bg-indigo-50"
    >
      <div className="flex items-center gap-2">
        <Wrench className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <code className="text-xs font-mono text-indigo-700">{formatLabel(msg.toolName ?? "unknown")}</code>
        <ChevronDown className={`w-3 h-3 text-indigo-400 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
      </div>
      {expanded && msg.toolArgs && (
        <pre className="mt-2 text-[11px] font-mono text-zinc-600 whitespace-pre-wrap max-h-32 overflow-y-auto border-t border-indigo-100 pt-2">
          {msg.toolArgs}
        </pre>
      )}
      {expanded && msg.toolResult && (
        <pre className="mt-1 text-[11px] font-mono text-zinc-500 whitespace-pre-wrap max-h-32 overflow-y-auto">
          {msg.toolResult}
        </pre>
      )}
    </button>
  );
}

/* ── Artifact card ── */
function ArtifactCard({ artifact }: { artifact: { name: string; type: string; content: string } }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const preview = artifact.content.split("\n").slice(0, 4).join("\n");

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <FileOutput className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-medium text-zinc-900 truncate flex-1">{artifact.name}</span>
        <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase">{artifact.type}</span>
      </div>
      <pre className="text-[11px] font-mono text-zinc-500 whitespace-pre-wrap max-h-20 overflow-hidden mb-2">{preview}{artifact.content.split("\n").length > 4 ? "\n..." : ""}</pre>
      <div className="flex items-center gap-1.5">
        <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-zinc-600 bg-zinc-50 border border-zinc-200 rounded hover:bg-zinc-100 transition-colors">
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button onClick={handleDownload} className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-zinc-600 bg-zinc-50 border border-zinc-200 rounded hover:bg-zinc-100 transition-colors">
          <Download className="w-3 h-3" /> Download
        </button>
      </div>
    </div>
  );
}

/* ── Main Dashboard ── */
export function ExecutionDashboard({
  orgName,
  runId,
  orgId,
  onSwitchToAnalysis,
}: ExecutionDashboardProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [totalCostCents, setTotalCostCents] = useState(0);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const [agentTasks, setAgentTasks] = useState<Record<string, { task: string; status: string; costCents: number }>>({});
  const [showMissionControl, setShowMissionControl] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollIntervals = useRef<Set<ReturnType<typeof setInterval>>>(new Set());

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Cleanup polls on unmount
  useEffect(() => {
    return () => {
      pollIntervals.current.forEach(clearInterval);
    };
  }, []);

  /* ── Map DB events → chat messages ── */
  function mapEventsToMessages(dbEvents: any[], taskId: string, agentId: string): ChatMessage[] {
    const agentInfo = AGENT_NAMES[agentId] ?? { name: agentId, emoji: "?" };
    const msgs: ChatMessage[] = [];

    for (const ev of dbEvents) {
      const data = ev.data ?? {};
      const ts = new Date(ev.created_at).getTime();

      switch (ev.event_type) {
        case "tool_call":
          msgs.push({
            id: ev.id,
            timestamp: ts,
            type: "tool_use",
            content: `Using ${formatLabel(data.tool ?? "tool")}`,
            agentName: agentInfo.name,
            agentId,
            toolName: data.tool ?? "unknown",
            toolArgs: data.args ? JSON.stringify(data.args, null, 2).slice(0, 500) : undefined,
            taskId,
          });
          break;
        case "tool_result":
          // Update the last tool_use message with the result
          const lastTool = msgs.findLast(m => m.type === "tool_use" && m.toolName === (data.tool ?? ""));
          if (lastTool) {
            lastTool.toolResult = data.outputSummary ?? "";
          }
          break;
        case "thinking":
          msgs.push({
            id: ev.id,
            timestamp: ts,
            type: "thinking",
            content: data.phase ? `${agentInfo.name} is ${data.phase.replace(/_/g, " ")}...` : `${agentInfo.name} is thinking...`,
            agentName: agentInfo.name,
            agentId,
            taskId,
          });
          break;
        case "output":
          msgs.push({
            id: ev.id,
            timestamp: ts,
            type: "output",
            content: data.content ?? data.text ?? data.summary ?? "Task completed",
            agentName: agentInfo.name,
            agentId,
            taskId,
          });
          break;
        case "error":
          msgs.push({
            id: ev.id,
            timestamp: ts,
            type: "error",
            content: data.message ?? data.error ?? "An error occurred",
            agentName: agentInfo.name,
            agentId,
            taskId,
          });
          break;
        case "status_change":
          // Only show meaningful status changes
          if (data.to && data.to !== "queued") {
            msgs.push({
              id: ev.id,
              timestamp: ts,
              type: "routing",
              content: `${formatLabel(data.to)}`,
              agentName: agentInfo.name,
              agentId,
              taskId,
            });
          }
          break;
      }
    }
    return msgs;
  }

  /* ── Poll a task ── */
  function pollTask(taskId: string, agentId: string, userMsgId: string) {
    let pollCount = 0;
    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > 150) {
        clearInterval(interval);
        pollIntervals.current.delete(interval);
        setActiveAgents(prev => { const s = new Set(prev); s.delete(agentId); return s; });
        return;
      }

      try {
        const res = await fetch(`/api/execution/tasks/${taskId}`);
        if (!res.ok) return;
        const { task, events: dbEvents } = await res.json();

        // Map events (chronological order)
        const agentMsgs = mapEventsToMessages(
          (dbEvents ?? []).reverse(),
          taskId,
          task.agent_id ?? agentId
        );

        // Update cost
        if (task.cost_spent) {
          setTotalCostCents(prev => Math.max(prev, Math.round(task.cost_spent * 100)));
        }

        // Track agent task for mission control
        const resolvedAgent = task.agent_id ?? agentId;
        setAgentTasks(prev => ({
          ...prev,
          [resolvedAgent]: {
            task: task.title,
            status: task.status,
            costCents: Math.round((task.cost_spent ?? 0) * 100),
          },
        }));

        // Update messages: keep everything before userMsgId, then user msg, then routing, then agent msgs
        setMessages(prev => {
          const userMsgIdx = prev.findIndex(m => m.id === userMsgId);
          if (userMsgIdx === -1) return prev;

          // Keep messages before this conversation
          const before = prev.slice(0, userMsgIdx + 1);

          // Build the routing message
          const agentInfo = AGENT_NAMES[task.agent_id ?? agentId] ?? { name: agentId, emoji: "?" };
          const routingMsg: ChatMessage = {
            id: `route-${taskId}`,
            timestamp: Date.now(),
            type: "routing",
            content: `Routed to ${agentInfo.name}`,
            agentName: agentInfo.name,
            agentId: task.agent_id ?? agentId,
            taskId,
          };

          // If terminal, add final result
          const taskMsgs = [...agentMsgs];
          if (isTerminalStatus(task.status) && task.result) {
            const existingOutput = taskMsgs.find(m => m.type === "output");
            if (!existingOutput) {
              taskMsgs.push({
                id: `result-${taskId}`,
                timestamp: Date.now(),
                type: task.status === "completed" ? "output" : "error",
                content: task.result,
                agentName: agentInfo.name,
                agentId: task.agent_id ?? agentId,
                taskId,
              });
            }
          }

          // Add artifacts if any
          if (task.artifacts && task.artifacts.length > 0) {
            taskMsgs.push({
              id: `artifacts-${taskId}`,
              timestamp: Date.now(),
              type: "artifact",
              content: `${task.artifacts.length} artifact${task.artifacts.length > 1 ? "s" : ""} created`,
              agentName: agentInfo.name,
              agentId: task.agent_id ?? agentId,
              artifacts: task.artifacts,
              taskId,
            });
          }

          // Get messages from other conversations (after userMsgIdx)
          const otherConversations = prev.slice(userMsgIdx + 1).filter(m => m.taskId !== taskId);

          return [...before, routingMsg, ...taskMsgs, ...otherConversations];
        });

        if (isTerminalStatus(task.status)) {
          clearInterval(interval);
          pollIntervals.current.delete(interval);
          setActiveAgents(prev => { const s = new Set(prev); s.delete(agentId); return s; });
        }
      } catch {
        // silently ignore
      }
    }, 2000);

    pollIntervals.current.add(interval);
  }

  /* ── Send message ── */
  const handleSend = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || sending) return;

    setSending(true);
    setInput("");

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      timestamp: Date.now(),
      type: "user",
      content: msg,
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch("/api/execution/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          title: msg,
          agentId: "auto",
          priority: "medium",
          costCeiling: 0.50,
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");
      const { task } = await res.json();
      const resolvedAgent = task.agent_id ?? "strategist";

      setActiveAgents(prev => new Set(prev).add(resolvedAgent));

      // Add initial routing message
      const agentInfo = AGENT_NAMES[resolvedAgent] ?? { name: resolvedAgent, emoji: "?" };
      setMessages(prev => [...prev, {
        id: `route-${task.id}`,
        timestamp: Date.now(),
        type: "routing",
        content: `Routed to ${agentInfo.name}`,
        agentName: agentInfo.name,
        agentId: resolvedAgent,
        taskId: task.id,
      }, {
        id: `thinking-${task.id}`,
        timestamp: Date.now(),
        type: "thinking",
        content: `${agentInfo.name} is working on this...`,
        agentName: agentInfo.name,
        agentId: resolvedAgent,
        taskId: task.id,
      }]);

      // Start polling
      pollTask(task.id, resolvedAgent, userMsgId);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        timestamp: Date.now(),
        type: "error",
        content: e instanceof Error ? e.message : "Something went wrong",
      }]);
    } finally {
      setSending(false);
    }
  }, [orgId, sending]);

  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 flex items-center justify-center rounded-lg shadow-lg shadow-zinc-900/10">
              <div className="w-3 h-3 bg-white rounded-sm rotate-45" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-zinc-900 tracking-tight leading-none">{orgName}</div>
              <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-[0.2em] mt-0.5">Command Center</div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5">
            <button
              onClick={onSwitchToAnalysis}
              className="px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-all text-zinc-500 hover:text-zinc-700"
            >
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" /> Analysis
              </span>
            </button>
            <button
              className="px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-all bg-white text-zinc-900 shadow-sm"
            >
              <span className="flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5" /> Execution
              </span>
            </button>
          </div>

          {/* Status + Mission Control toggle */}
          <div className="flex items-center gap-2">
            {activeAgents.size > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                <Loader2 className="w-3 h-3 animate-spin" />
                {activeAgents.size} working
              </span>
            )}
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              ${(totalCostCents / 100).toFixed(2)} spent
            </span>
            <button
              onClick={() => setShowMissionControl(!showMissionControl)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg border transition-all ${
                showMissionControl
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Agents
              {showMissionControl ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mission Control Panel ── */}
      {showMissionControl && (
        <div className="bg-white border-b border-zinc-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-zinc-400" />
              <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">Mission Control — All Agents</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {Object.entries(AGENT_NAMES).map(([id, agent]) => {
                const isActive = activeAgents.has(id);
                const taskInfo = agentTasks[id];
                return (
                  <div
                    key={id}
                    className={`relative rounded-xl border p-3 transition-all ${
                      isActive
                        ? "border-indigo-200 bg-indigo-50/50 shadow-sm"
                        : taskInfo
                        ? "border-zinc-200 bg-zinc-50/50"
                        : "border-zinc-100 bg-white"
                    }`}
                  >
                    {/* Status dot */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className={`w-5 h-5 rounded-md ${agent.color} flex items-center justify-center text-[10px] font-bold text-white`}>
                        {agent.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-zinc-900 truncate">{agent.name}</div>
                      </div>
                      {isActive && (
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
                      )}
                    </div>
                    <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider mb-1">{agent.role}</div>
                    {taskInfo ? (
                      <div className="mt-1">
                        <p className="text-[10px] text-zinc-600 truncate">{taskInfo.task}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[8px] font-mono uppercase tracking-wider px-1 py-0.5 rounded ${
                            isActive
                              ? "bg-blue-100 text-blue-700"
                              : taskInfo.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : taskInfo.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-zinc-100 text-zinc-600"
                          }`}>
                            {isActive ? "Working" : formatLabel(taskInfo.status)}
                          </span>
                          {taskInfo.costCents > 0 && (
                            <span className="text-[8px] font-mono text-zinc-400 tabular-nums">
                              ${(taskInfo.costCents / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <span className="text-[9px] font-mono text-zinc-300 uppercase">Ready</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Area ── */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
          {/* Empty state with recommendation pills */}
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-16 h-16 bg-zinc-900 flex items-center justify-center rounded-2xl shadow-xl shadow-zinc-900/10 mb-6">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-light text-zinc-900 mb-2">What do you need done?</h2>
              <p className="text-sm text-zinc-500 max-w-md mb-8">
                Tell me what you need and I'll route it to the right specialist agent.
                Marketing, finance, hiring, operations, research — I handle it all.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.label)}
                      className="flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 hover:border-zinc-300 transition-all text-left shadow-sm"
                    >
                      <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            /* ── User message ── */
            if (msg.type === "user") {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="flex items-start gap-2 max-w-[80%]">
                    <div className="bg-zinc-900 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    <div className="w-7 h-7 bg-zinc-200 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                  </div>
                </div>
              );
            }

            /* ── Routing badge ── */
            if (msg.type === "routing") {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                    <ArrowRight className="w-3 h-3" />
                    {msg.content}
                    {msg.agentName && (
                      <span className="text-indigo-400">({AGENT_NAMES[msg.agentId ?? ""]?.name === msg.agentName ? formatLabel(msg.agentId ?? "") : msg.agentName})</span>
                    )}
                  </span>
                </div>
              );
            }

            /* ── Thinking indicator ── */
            if (msg.type === "thinking") {
              return (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Brain className="w-3.5 h-3.5 text-violet-500" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-violet-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {msg.content}
                  </div>
                </div>
              );
            }

            /* ── Tool use ── */
            if (msg.type === "tool_use") {
              return (
                <div key={msg.id} className="pl-9">
                  <ToolCard msg={msg} />
                </div>
              );
            }

            /* ── Agent output ── */
            if (msg.type === "output") {
              const agentId = msg.agentId ?? "strategist";
              const initial = AGENT_NAMES[agentId]?.emoji ?? "A";
              return (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-emerald-700">
                    {initial}
                  </div>
                  <div className="max-w-[85%]">
                    <div className="text-[10px] font-mono text-zinc-400 mb-1">{msg.agentName}</div>
                    <div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                      <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                </div>
              );
            }

            /* ── Error ── */
            if (msg.type === "error") {
              return (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
                    <p className="text-sm text-red-700">{msg.content}</p>
                  </div>
                </div>
              );
            }

            /* ── Artifacts ── */
            if (msg.type === "artifact" && msg.artifacts) {
              return (
                <div key={msg.id} className="pl-9 space-y-2">
                  {msg.artifacts.map((art, i) => (
                    <ArtifactCard key={`${msg.id}-${i}`} artifact={art} />
                  ))}
                </div>
              );
            }

            return null;
          })}

          {/* Follow-up pills after completed task */}
          {hasMessages && !sending && !activeAgents.size && (
            <div className="flex flex-wrap gap-1.5 pl-9 pt-2">
              {["Create social posts about this", "Build an email campaign", "Research competitors"].map((pill) => (
                <button
                  key={pill}
                  onClick={() => handleSend(pill)}
                  className="text-[11px] text-zinc-600 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
                >
                  {pill}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="sticky bottom-0 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA] to-transparent pt-6 pb-4 px-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl shadow-lg shadow-zinc-900/5 px-4 py-2.5 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What do you want to get done?"
              disabled={sending}
              className="flex-1 text-sm bg-transparent placeholder:text-zinc-400 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="w-8 h-8 flex items-center justify-center bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
              7 agents · 49 tools · auto-routed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
