"use client";

import { useEffect, useRef, useState } from "react";
import {
  Wrench,
  Brain,
  FileOutput,
  ShieldAlert,
  AlertCircle,
  Clock,
  Check,
  X,
  RotateCcw,
  ChevronDown,
  Send,
  Loader2,
} from "lucide-react";

/* ── Feed event types ── */
export type FeedEventType =
  | "tool_use"
  | "thinking"
  | "output"
  | "approval_request"
  | "error"
  | "status_change";

export interface ToolUseDetails {
  toolName: string;
  argumentsSummary: string;
  resultPreview?: string;
}

export interface FeedEvent {
  id: string;
  timestamp: number;
  type: FeedEventType;
  description: string;
  toolDetails?: ToolUseDetails;
  markdownContent?: string;
  approvalId?: string;
}

export interface AgentFeedProps {
  agentName: string;
  events: FeedEvent[];
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
  onSendCommand?: (message: string) => void;
  isLoading?: boolean;
}

/* ── Event type config ── */
const EVENT_CONFIG: Record<
  FeedEventType,
  { icon: typeof Wrench; iconClass: string; bgClass: string }
> = {
  tool_use: {
    icon: Wrench,
    iconClass: "text-indigo-500",
    bgClass: "bg-indigo-50",
  },
  thinking: {
    icon: Brain,
    iconClass: "text-violet-500",
    bgClass: "bg-violet-50",
  },
  output: {
    icon: FileOutput,
    iconClass: "text-emerald-500",
    bgClass: "bg-emerald-50",
  },
  approval_request: {
    icon: ShieldAlert,
    iconClass: "text-orange-500",
    bgClass: "bg-orange-50",
  },
  error: {
    icon: AlertCircle,
    iconClass: "text-red-500",
    bgClass: "bg-red-50",
  },
  status_change: {
    icon: RotateCcw,
    iconClass: "text-zinc-400",
    bgClass: "bg-zinc-50",
  },
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function FeedItem({
  event,
  isLatest,
  onApprove,
  onReject,
}: {
  event: FeedEvent;
  isLatest: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const cfg = EVENT_CONFIG[event.type];
  const Icon = cfg.icon;

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg transition-all ${
        isLatest ? "bg-zinc-50/80" : ""
      }`}
      style={{
        animation: isLatest ? "feedSlideIn 0.3s ease-out" : undefined,
      }}
    >
      {/* Timeline icon */}
      <div
        className={`w-7 h-7 rounded-lg ${cfg.bgClass} flex items-center justify-center shrink-0 mt-0.5`}
      >
        <Icon className={`w-3.5 h-3.5 ${cfg.iconClass}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
            {formatTime(event.timestamp)}
          </span>
          <span
            className={`text-[9px] font-mono font-bold uppercase tracking-wider ${cfg.iconClass}`}
          >
            {event.type.replace("_", " ")}
          </span>
        </div>

        <p className="text-sm text-zinc-700 leading-snug">
          {event.description}
        </p>

        {/* Tool use details */}
        {event.type === "tool_use" && event.toolDetails && (
          <div className="mt-2 bg-zinc-50 border border-zinc-100 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                Tool:
              </span>
              <code className="text-xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                {event.toolDetails.toolName}
              </code>
            </div>
            <div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                Args:
              </span>
              <span className="text-xs text-zinc-600 ml-1.5">
                {event.toolDetails.argumentsSummary}
              </span>
            </div>
            {event.toolDetails.resultPreview && (
              <div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Result:
                </span>
                <pre className="text-xs text-zinc-600 font-mono mt-1 whitespace-pre-wrap max-h-20 overflow-y-auto">
                  {event.toolDetails.resultPreview}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Markdown output */}
        {event.type === "output" && event.markdownContent && (
          <div className="mt-2 bg-zinc-50 border border-zinc-100 rounded-lg p-3 text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
            {event.markdownContent}
          </div>
        )}

        {/* Approval request actions */}
        {event.type === "approval_request" && event.approvalId && (
          <div className="mt-2 flex items-center gap-2">
            {onApprove && (
              <button
                onClick={() => onApprove(event.approvalId!)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-mono uppercase tracking-wider hover:bg-emerald-700 transition-colors rounded-lg"
              >
                <Check className="w-3 h-3" /> Approve
              </button>
            )}
            {onReject && (
              <button
                onClick={() => onReject(event.approvalId!)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-[10px] font-mono uppercase tracking-wider hover:bg-red-700 transition-colors rounded-lg"
              >
                <X className="w-3 h-3" /> Reject
              </button>
            )}
          </div>
        )}

        {/* Error styling */}
        {event.type === "error" && (
          <div className="mt-2 bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700 font-mono">
            {event.description}
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentFeed({
  agentName,
  events,
  onApprove,
  onReject,
  onSendCommand,
  isLoading,
}: AgentFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(true);
  const [commandText, setCommandText] = useState("");

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (isAutoScrolling.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If user scrolled up more than 100px from bottom, stop auto-scrolling
    isAutoScrolling.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  const scrollToBottom = () => {
    isAutoScrolling.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">
            Activity Feed
          </h3>
          <span className="text-[10px] font-mono text-zinc-300">
            {agentName}
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-300 tabular-nums">
          {events.length} events
        </span>
      </div>

      {/* Feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 space-y-1 relative"
      >
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-xl bg-zinc-50 flex items-center justify-center mb-4">
              <Brain className="w-5 h-5 text-zinc-200" />
            </div>
            <p className="text-sm text-zinc-400">No activity yet</p>
            <p className="text-[10px] font-mono text-zinc-300 mt-1 uppercase tracking-wider">
              Events will appear here as the agent works
            </p>
          </div>
        ) : (
          events.map((event, i) => (
            <FeedItem
              key={event.id}
              event={event}
              isLatest={i === events.length - 1}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {events.length > 5 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 flex items-center gap-1 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg shadow-sm text-[10px] font-mono text-zinc-500 uppercase tracking-wider hover:bg-zinc-50 transition-colors z-10"
        >
          <ChevronDown className="w-3 h-3" /> Latest
        </button>
      )}

      {/* Command input */}
      {onSendCommand && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const msg = commandText.trim();
            if (!msg || isLoading) return;
            onSendCommand(msg);
            setCommandText("");
          }}
          className="shrink-0 border-t border-zinc-200 bg-white px-3 py-2.5 flex items-center gap-2"
        >
          <input
            type="text"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder={`Tell ${agentName} what to do...`}
            disabled={isLoading}
            className="flex-1 text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !commandText.trim()}
            className="w-9 h-9 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      )}

      {/* Keyframe animation (injected via style tag once) */}
      <style>{`
        @keyframes feedSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
