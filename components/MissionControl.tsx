"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  Bot,
  Eye,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Terminal,
  DollarSign,
  ArrowLeft,
  Loader2,
  MessageSquare,
  Cpu,
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
  Play,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ToolCallEvent {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "running" | "completed" | "error";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

interface AgentMessage {
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

interface AgentSession {
  id: string;
  agentType: "pivvy" | "coach" | "betterbot" | "codebot";
  status: "idle" | "thinking" | "tool_call" | "responding" | "error";
  currentTask?: string;
  toolCalls: ToolCallEvent[];
  messages: AgentMessage[];
  tokensUsed: number;
  costEstimate: number;
  startedAt: string;
  lastActivity: string;
}

interface QueuedTask {
  id: string;
  agentType: AgentSession["agentType"];
  task: string;
  priority: "high" | "normal" | "low";
  queuedAt: string;
}

interface MissionControlProps {
  onBack: () => void;
}

// ─── Agent Config ───────────────────────────────────────────────────────────────

const AGENT_CONFIG: Record<
  AgentSession["agentType"],
  { label: string; color: string; bgColor: string; borderColor: string; dotColor: string; iconBg: string }
> = {
  pivvy: {
    label: "Pivvy",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    dotColor: "bg-blue-400",
    iconBg: "bg-blue-500/20",
  },
  coach: {
    label: "Coach",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    dotColor: "bg-emerald-400",
    iconBg: "bg-emerald-500/20",
  },
  betterbot: {
    label: "BetterBot",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    dotColor: "bg-purple-400",
    iconBg: "bg-purple-500/20",
  },
  codebot: {
    label: "CodeBot",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    dotColor: "bg-orange-400",
    iconBg: "bg-orange-500/20",
  },
};

const STATUS_LABELS: Record<AgentSession["status"], string> = {
  idle: "Idle",
  thinking: "Thinking...",
  tool_call: "Calling tool",
  responding: "Generating response",
  error: "Error",
};

// ─── Mock Data ──────────────────────────────────────────────────────────────────

function createMockSessions(): AgentSession[] {
  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString();
  const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000).toISOString();

  return [
    {
      id: "sess-pivvy-001",
      agentType: "pivvy",
      status: "tool_call",
      currentTask: "Analyze Q4 revenue projections and identify growth opportunities",
      toolCalls: [
        {
          id: "tc-001",
          toolName: "get_report_section",
          args: { section: "financial_overview", runId: "run-abc123" },
          result: '{"revenue": 2400000, "growth": 0.12, "margin": 0.34}',
          status: "completed",
          startedAt: minutesAgo(3),
          completedAt: minutesAgo(2),
          durationMs: 1240,
        },
        {
          id: "tc-002",
          toolName: "query_market_data",
          args: { market: "SaaS", region: "North America", period: "Q4-2025" },
          result: '{"tam": 180000000000, "growth_rate": 0.15, "segments": 12}',
          status: "completed",
          startedAt: minutesAgo(2),
          completedAt: minutesAgo(1),
          durationMs: 2100,
        },
        {
          id: "tc-003",
          toolName: "analyze_competitors",
          args: { competitors: ["Acme Corp", "TechFlow", "DataPrime"], metrics: ["revenue", "market_share"] },
          status: "running",
          startedAt: secondsAgo(15),
        },
      ],
      messages: [
        {
          role: "user",
          content: "Analyze Q4 revenue projections and identify growth opportunities for our SaaS platform.",
          timestamp: minutesAgo(5),
        },
        {
          role: "agent",
          content:
            "I'll analyze your Q4 revenue projections by examining the financial overview, market data, and competitive landscape. Let me pull the relevant data.",
          timestamp: minutesAgo(4),
        },
        {
          role: "agent",
          content:
            "Based on the financial overview, your current revenue stands at $2.4M with 12% growth and 34% margins. Now let me cross-reference this with market data to identify expansion opportunities...",
          timestamp: minutesAgo(1),
        },
      ],
      tokensUsed: 14520,
      costEstimate: 0.0218,
      startedAt: minutesAgo(5),
      lastActivity: secondsAgo(15),
    },
    {
      id: "sess-coach-001",
      agentType: "coach",
      status: "responding",
      currentTask: "Create leadership development plan for VP of Engineering",
      toolCalls: [
        {
          id: "tc-004",
          toolName: "get_employee_profile",
          args: { employeeId: "emp-789", includeAssessments: true },
          result: '{"name": "Sarah Chen", "role": "VP Engineering", "tenure": 3.2, "directReports": 8}',
          status: "completed",
          startedAt: minutesAgo(8),
          completedAt: minutesAgo(7),
          durationMs: 890,
        },
        {
          id: "tc-005",
          toolName: "get_360_feedback",
          args: { employeeId: "emp-789", period: "2025-H2" },
          result: '{"avgScore": 4.2, "strengths": ["technical vision", "mentorship"], "gaps": ["delegation", "cross-functional communication"]}',
          status: "completed",
          startedAt: minutesAgo(7),
          completedAt: minutesAgo(6),
          durationMs: 1560,
        },
      ],
      messages: [
        {
          role: "user",
          content: "Create a leadership development plan for our VP of Engineering, Sarah Chen.",
          timestamp: minutesAgo(10),
        },
        {
          role: "agent",
          content:
            "I'll create a comprehensive leadership development plan for Sarah Chen. Let me start by reviewing her profile and recent 360-degree feedback.",
          timestamp: minutesAgo(9),
        },
        {
          role: "agent",
          content:
            "Sarah has strong technical vision and mentorship skills (4.2/5.0 average). The key development areas are delegation and cross-functional communication. Here's my recommended plan:\n\n**Phase 1 (Months 1-2): Delegation Framework**\n- Implement RACI matrices for all major engineering initiatives\n- Establish weekly 1:1 coaching with a delegation-focused agenda\n- Set measurable goals: reduce direct involvement in sprint-level decisions by 40%",
          timestamp: minutesAgo(2),
        },
      ],
      tokensUsed: 22310,
      costEstimate: 0.0335,
      startedAt: minutesAgo(10),
      lastActivity: secondsAgo(3),
    },
    {
      id: "sess-betterbot-001",
      agentType: "betterbot",
      status: "thinking",
      currentTask: "Optimize customer onboarding flow based on drop-off analytics",
      toolCalls: [
        {
          id: "tc-006",
          toolName: "get_funnel_analytics",
          args: { funnel: "onboarding", period: "last_30_days", granularity: "step" },
          result: '{"steps": [{"name": "signup", "users": 1240}, {"name": "profile", "users": 980}, {"name": "first_action", "users": 456}, {"name": "activation", "users": 312}]}',
          status: "completed",
          startedAt: minutesAgo(4),
          completedAt: minutesAgo(3),
          durationMs: 3200,
        },
      ],
      messages: [
        {
          role: "user",
          content: "Analyze our customer onboarding funnel and recommend optimizations for the biggest drop-off points.",
          timestamp: minutesAgo(6),
        },
        {
          role: "agent",
          content:
            "I'll analyze the onboarding funnel data to identify the critical drop-off points. Let me pull the step-by-step analytics.",
          timestamp: minutesAgo(5),
        },
      ],
      tokensUsed: 8740,
      costEstimate: 0.0131,
      startedAt: minutesAgo(6),
      lastActivity: secondsAgo(45),
    },
    {
      id: "sess-codebot-001",
      agentType: "codebot",
      status: "idle",
      currentTask: undefined,
      toolCalls: [
        {
          id: "tc-007",
          toolName: "run_code_analysis",
          args: { repo: "pivot-main", target: "api/pipeline", checks: ["complexity", "duplication", "coverage"] },
          result: '{"complexity": 12.4, "duplication": 3.2, "coverage": 78.5, "issues": 4}',
          status: "completed",
          startedAt: minutesAgo(20),
          completedAt: minutesAgo(18),
          durationMs: 124000,
        },
        {
          id: "tc-008",
          toolName: "generate_refactor_plan",
          args: { target: "api/pipeline/synthesize.ts", maxComplexity: 8 },
          result: '{"suggestions": 6, "estimatedEffort": "4 hours", "riskLevel": "low"}',
          status: "completed",
          startedAt: minutesAgo(18),
          completedAt: minutesAgo(15),
          durationMs: 180000,
        },
      ],
      messages: [
        {
          role: "user",
          content: "Run a code quality analysis on the pipeline module and suggest refactoring opportunities.",
          timestamp: minutesAgo(22),
        },
        {
          role: "agent",
          content:
            "I'll analyze the pipeline module for code quality metrics including complexity, duplication, and test coverage.",
          timestamp: minutesAgo(21),
        },
        {
          role: "agent",
          content:
            "Analysis complete. The pipeline module has a cyclomatic complexity of 12.4 (target: <8), 3.2% code duplication, and 78.5% test coverage. I've identified 6 refactoring opportunities with an estimated effort of 4 hours and low risk.\n\nKey recommendations:\n1. Extract the synthesis chain into smaller pure functions\n2. Deduplicate the Promise.allSettled error handling\n3. Add integration tests for the financial fact verification path",
          timestamp: minutesAgo(14),
        },
      ],
      tokensUsed: 31200,
      costEstimate: 0.0468,
      startedAt: minutesAgo(22),
      lastActivity: minutesAgo(14),
    },
  ];
}

function createMockQueue(): QueuedTask[] {
  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString();

  return [
    {
      id: "q-001",
      agentType: "pivvy",
      task: "Generate competitive landscape report for Series B pitch",
      priority: "high",
      queuedAt: minutesAgo(2),
    },
    {
      id: "q-002",
      agentType: "coach",
      task: "Review team sentiment analysis from Q4 survey",
      priority: "normal",
      queuedAt: minutesAgo(5),
    },
    {
      id: "q-003",
      agentType: "betterbot",
      task: "A/B test analysis: pricing page variants",
      priority: "normal",
      queuedAt: minutesAgo(8),
    },
    {
      id: "q-004",
      agentType: "codebot",
      task: "Security audit on authentication module",
      priority: "high",
      queuedAt: minutesAgo(1),
    },
  ];
}

// ─── Utility Helpers ────────────────────────────────────────────────────────────

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ─── Sub-Components ─────────────────────────────────────────────────────────────

function PulseDot({ color, active }: { color: string; active: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {active && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  );
}

function StatusBadge({ status, toolName }: { status: AgentSession["status"]; toolName?: string }) {
  const baseClasses = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider";

  switch (status) {
    case "thinking":
      return (
        <span className={`${baseClasses} bg-yellow-500/10 text-yellow-400 border border-yellow-500/20`}>
          <Loader2 className="w-3 h-3 animate-spin" /> Thinking
        </span>
      );
    case "tool_call":
      return (
        <span className={`${baseClasses} bg-cyan-500/10 text-cyan-400 border border-cyan-500/20`}>
          <Terminal className="w-3 h-3" /> {toolName ? `Tool: ${toolName}` : "Calling tool"}
        </span>
      );
    case "responding":
      return (
        <span className={`${baseClasses} bg-green-500/10 text-green-400 border border-green-500/20`}>
          <MessageSquare className="w-3 h-3 animate-pulse" /> Responding
        </span>
      );
    case "error":
      return (
        <span className={`${baseClasses} bg-red-500/10 text-red-400 border border-red-500/20`}>
          <AlertCircle className="w-3 h-3" /> Error
        </span>
      );
    default:
      return (
        <span className={`${baseClasses} bg-zinc-500/10 text-zinc-500 border border-zinc-500/20`}>
          <Clock className="w-3 h-3" /> Idle
        </span>
      );
  }
}

function ToolCallItem({ tc }: { tc: ToolCallEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-zinc-700/50 rounded-lg overflow-hidden bg-zinc-800/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-700/30 transition-colors"
      >
        {tc.status === "running" ? (
          <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
        ) : tc.status === "completed" ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
        ) : tc.status === "error" ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        )}
        <code className="text-xs text-cyan-300 font-mono truncate flex-1">{tc.toolName}</code>
        {tc.durationMs != null && (
          <span className="text-[10px] text-zinc-500 font-mono shrink-0">{tc.durationMs}ms</span>
        )}
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-zinc-700/50">
              <div className="mt-2">
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Arguments</div>
                <pre className="text-[11px] text-zinc-300 font-mono bg-zinc-900/60 rounded p-2 overflow-x-auto max-h-32 scrollbar-thin">
                  {JSON.stringify(tc.args, null, 2)}
                </pre>
              </div>
              {tc.result && (
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Result</div>
                  <pre className="text-[11px] text-zinc-300 font-mono bg-zinc-900/60 rounded p-2 overflow-x-auto max-h-32 scrollbar-thin">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(tc.result), null, 2);
                      } catch {
                        return tc.result;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentCard({
  session,
  onExpand,
}: {
  session: AgentSession;
  onExpand: () => void;
}) {
  const config = AGENT_CONFIG[session.agentType];
  const isActive = session.status !== "idle";
  const runningTool = session.toolCalls.find((tc) => tc.status === "running");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-zinc-900/80 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all hover:border-zinc-600 ${
        isActive ? config.borderColor : "border-zinc-800"
      }`}
    >
      {/* Card Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${config.iconBg} flex items-center justify-center`}>
              <Bot className={`w-4 h-4 ${config.color}`} />
            </div>
            <div>
              <div className={`text-sm font-semibold ${config.color}`}>{config.label}</div>
              <div className="text-[10px] font-mono text-zinc-500">
                {formatElapsed(session.startedAt)} elapsed
              </div>
            </div>
          </div>
          <PulseDot color={config.dotColor} active={isActive} />
        </div>

        <StatusBadge
          status={session.status}
          toolName={runningTool?.toolName}
        />

        {session.currentTask && (
          <p className="mt-3 text-xs text-zinc-300 line-clamp-2 leading-relaxed">
            {session.currentTask}
          </p>
        )}
      </div>

      {/* Card Stats */}
      <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center gap-4 text-[10px] font-mono text-zinc-500">
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" /> {formatTokens(session.tokensUsed)} tok
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" /> {formatCost(session.costEstimate)}
        </span>
        <span className="flex items-center gap-1">
          <Terminal className="w-3 h-3" /> {session.toolCalls.length} calls
        </span>
      </div>

      {/* Expand Button */}
      <button
        onClick={onExpand}
        className="w-full px-4 py-2.5 border-t border-zinc-800 flex items-center justify-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest hover:bg-zinc-800/60 hover:text-zinc-300 transition-all"
      >
        <Eye className="w-3 h-3" /> View Details
      </button>
    </motion.div>
  );
}

function AgentDetailView({
  session,
  onClose,
}: {
  session: AgentSession;
  onClose: () => void;
}) {
  const config = AGENT_CONFIG[session.agentType];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Detail Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center`}>
              <Bot className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <div className={`font-semibold ${config.color}`}>{config.label}</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {session.currentTask || "No active task"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={session.status} />
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-6 px-5 py-3 border-b border-zinc-800 text-xs font-mono text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {formatElapsed(session.startedAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> {formatTokens(session.tokensUsed)} tokens
          </span>
          <span className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> {formatCost(session.costEstimate)}
          </span>
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" /> {session.toolCalls.length} tool calls
          </span>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {session.messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "agent" && (
                <div className={`w-7 h-7 rounded-lg ${config.iconBg} flex items-center justify-center shrink-0 mt-1`}>
                  <Bot className={`w-3.5 h-3.5 ${config.color}`} />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600/20 border border-blue-500/30 text-blue-100"
                    : "bg-zinc-800/80 border border-zinc-700/50 text-zinc-200"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div className="text-[10px] font-mono text-zinc-500 mt-2">
                  {formatTimestamp(msg.timestamp)}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0 mt-1">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                </div>
              )}
            </div>
          ))}

          {/* Show tool calls between messages */}
          {session.toolCalls.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2 py-2">
                <Terminal className="w-3 h-3" /> Tool Calls
              </div>
              {session.toolCalls.map((tc) => (
                <ToolCallItem key={tc.id} tc={tc} />
              ))}
            </div>
          )}

          {/* Streaming indicator */}
          {session.status === "responding" && (
            <div className="flex gap-3">
              <div className={`w-7 h-7 rounded-lg ${config.iconBg} flex items-center justify-center shrink-0 mt-1`}>
                <Bot className={`w-3.5 h-3.5 ${config.color}`} />
              </div>
              <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function QueueItem({ task }: { task: QueuedTask }) {
  const config = AGENT_CONFIG[task.agentType];

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900/60 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all">
      <div className={`w-6 h-6 rounded-md ${config.iconBg} flex items-center justify-center shrink-0`}>
        <Bot className={`w-3 h-3 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300 truncate">{task.task}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-mono ${config.color}`}>{config.label}</span>
          <span className="text-[10px] text-zinc-600">|</span>
          <span className="text-[10px] text-zinc-500 font-mono">{formatTimestamp(task.queuedAt)}</span>
        </div>
      </div>
      <span
        className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
          task.priority === "high"
            ? "bg-red-500/10 text-red-400 border border-red-500/20"
            : "bg-zinc-500/10 text-zinc-500 border border-zinc-600/20"
        }`}
      >
        {task.priority}
      </span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function MissionControl({ onBack }: MissionControlProps) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [queue, setQueue] = useState<QueuedTask[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [elapsedTick, setElapsedTick] = useState(0);

  // Initialize mock data
  useEffect(() => {
    setSessions(createMockSessions());
    setQueue(createMockQueue());
  }, []);

  // Tick every second to update elapsed timers
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Aggregate stats
  const totalTokens = sessions.reduce((sum, s) => sum + s.tokensUsed, 0);
  const totalCost = sessions.reduce((sum, s) => sum + s.costEstimate, 0);
  const activeSessions = sessions.filter((s) => s.status !== "idle").length;
  const avgResponseTime = sessions.length > 0
    ? Math.round(
        sessions.reduce((sum, s) => {
          const elapsed = Date.now() - new Date(s.startedAt).getTime();
          return sum + elapsed;
        }, 0) / sessions.length / 1000
      )
    : 0;

  const selectedSession = sessions.find((s) => s.id === expandedSession) ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-all"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center rounded-xl shadow-lg shadow-blue-500/20">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-lg text-zinc-100 leading-none">
                Mission Control
              </div>
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] mt-0.5">
                Agent Monitoring
              </div>
            </div>
          </div>
        </div>

        {/* Header Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/60 border border-zinc-700 rounded-full">
            <PulseDot color="bg-green-400" active={activeSessions > 0} />
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              {activeSessions > 0 ? `${activeSessions} Active` : "All Idle"}
            </span>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-zinc-900/40 border-b border-zinc-800/50 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-8 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-200">{sessions.length}</div>
              <div className="text-[10px] font-mono text-zinc-500">Sessions</div>
            </div>
          </div>

          <div className="w-px h-8 bg-zinc-800 shrink-0" />

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-200">{formatTokens(totalTokens)}</div>
              <div className="text-[10px] font-mono text-zinc-500">Total Tokens</div>
            </div>
          </div>

          <div className="w-px h-8 bg-zinc-800 shrink-0" />

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-200">{formatCost(totalCost)}</div>
              <div className="text-[10px] font-mono text-zinc-500">Total Cost</div>
            </div>
          </div>

          <div className="w-px h-8 bg-zinc-800 shrink-0" />

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-200">{avgResponseTime}s</div>
              <div className="text-[10px] font-mono text-zinc-500">Avg Time</div>
            </div>
          </div>

          <div className="w-px h-8 bg-zinc-800 shrink-0" />

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-200">{queue.length}</div>
              <div className="text-[10px] font-mono text-zinc-500">Queued</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-8">
        {/* Section: Active Agents */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-800/60 border border-zinc-700 rounded-full text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
              <Bot className="w-3 h-3" /> Agent Sessions
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sessions.map((session) => (
              <AgentCard
                key={session.id}
                session={session}
                onExpand={() => setExpandedSession(session.id)}
              />
            ))}
          </div>
        </div>

        {/* Section: Task Queue */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-800/60 border border-zinc-700 rounded-full text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
              <Play className="w-3 h-3" /> Task Queue
            </div>
            <span className="text-[10px] font-mono text-zinc-600">{queue.length} pending</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {queue.map((task) => (
              <QueueItem key={task.id} task={task} />
            ))}
          </div>

          {queue.length === 0 && (
            <div className="text-center py-12 text-zinc-600">
              <Layers className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-mono">No tasks in queue</p>
            </div>
          )}
        </div>
      </main>

      {/* Expanded Agent Detail Modal */}
      <AnimatePresence>
        {selectedSession && (
          <AgentDetailView
            session={selectedSession}
            onClose={() => setExpandedSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
