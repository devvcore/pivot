// @ts-nocheck
"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, X, Bot, Globe, BarChart3, Search, MessageCircle, ChevronDown, TrendingUp, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/lib/types";
import { ProjectionChart, parseTextToChartData } from "./charts/ProjectionChart";

export interface NavigateAction {
  chapter: string;
  coreTab?: number;
  label: string;
}

interface AgentChatProps {
  orgId: string;
  orgName: string;
  onClose?: () => void;
  embedded?: boolean; // if true, renders inline; if false, renders as floating panel
  onNavigate?: (action: NavigateAction) => void;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  search_web:          <Search className="w-3 h-3" />,
  get_report_section:  <BarChart3 className="w-3 h-3" />,
  analyze_website:     <Globe className="w-3 h-3" />,
  generate_projection: <TrendingUp className="w-3 h-3" />,
  navigate_to_page:    <Navigation className="w-3 h-3" />,
};

/** Extract projection JSON from <!--PROJECTION:{...}--> markers in message text.
 *  If no marker found but the text contains projection-like numbers, attempt to parse them. */
function extractProjection(content: string): { text: string; projection: any | null } {
  const match = content.match(/<!--PROJECTION:([\s\S]*?)-->/);
  if (match) {
    try {
      const projection = JSON.parse(match[1]);
      const text = content.replace(/<!--PROJECTION:[\s\S]*?-->/, "").trim();
      return { text, projection };
    } catch {
      return { text: content, projection: null };
    }
  }

  // Fallback: try to parse text-only projections with number patterns
  const hasProjectionKeywords = /(?:projection|forecast|scenario|week\s*\d|month\s*\d|opening\s*balance|closing\s*balance)/i.test(content);
  if (hasProjectionKeywords) {
    const parsed = parseTextToChartData(content);
    if (parsed && parsed.length >= 2) {
      const firstBaseline = parsed[0].baseline;
      const lastProjected = parsed[parsed.length - 1].projected;
      const changePercent = firstBaseline > 0
        ? Math.round(((lastProjected - firstBaseline) / firstBaseline) * 100)
        : 0;

      return {
        text: content,
        projection: {
          title: "Projection",
          subtitle: "Parsed from analysis",
          dataPoints: parsed,
          metrics: {
            currentValue: firstBaseline,
            projectedValue: lastProjected,
            changePercent,
            timeframe: `${parsed.length} periods`,
          },
        },
      };
    }
  }

  return { text: content, projection: null };
}

/** Extract navigation JSON from <!--NAVIGATE:{...}--> markers in message text */
function extractNavigation(content: string): { text: string; navigation: NavigateAction | null } {
  const match = content.match(/<!--NAVIGATE:([\s\S]*?)-->/);
  if (!match) return { text: content, navigation: null };
  try {
    const route = JSON.parse(match[1]);
    const text = content.replace(/<!--NAVIGATE:[\s\S]*?-->/, "").trim();
    return {
      text,
      navigation: {
        chapter: route.chapter,
        coreTab: route.coreTab,
        label: route.label,
      },
    };
  } catch {
    return { text: content, navigation: null };
  }
}

const STARTER_PROMPTS = [
  "What are my most urgent cash risks right now?",
  "What would my cash look like in 12 months if I fix the top 3 leaks?",
  "Show me the revenue impact if I lose my highest-risk customer",
  "What should I prioritize in the next 30 days?",
  "What's my growth trajectory if I implement all quick wins?",
];

export function AgentChat({ orgId, orgName, onClose, embedded = false, onNavigate }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolsUsed, setToolsUsed] = useState<Record<number, string[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Welcome message
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `You made the right call joining Pivot.\n\nI'm Pivvy, your business intelligence advisor for ${orgName}. I've reviewed your full report and I'm ready to work through the specifics with you.\n\nWhat do you need to tackle first?`,
        timestamp: Date.now(),
      },
    ]);
  }, [orgName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          messages: messages.slice(-14), // send last 14 messages for context
          message: text.trim(),
        }),
      });
      const data = await res.json();
      const responseContent = data.message ?? "I encountered an issue — please try again.";

      // Check for navigation action in the response
      const { navigation } = extractNavigation(responseContent);
      if (navigation && onNavigate) {
        onNavigate(navigation);
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: responseContent,
        timestamp: Date.now(),
      };
      const msgIndex = messages.length + 1;
      if (data.toolsUsed?.length) setToolsUsed((prev) => ({ ...prev, [msgIndex]: data.toolsUsed }));
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection issue — please try again.", timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const container = embedded
    ? "flex flex-col h-full"
    : "flex flex-col h-full max-h-[600px]";

  return (
    <div className={container}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-900">Pivvy</div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Business Advisor · {orgName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[9px] font-mono text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full uppercase">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Live
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-900 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#F8F9FA]">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-1">
                <Bot className="w-3 h-3 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] ${msg.role === "user" ? "order-last" : ""}`}>
              {(() => {
                if (msg.role !== "assistant") {
                  return (
                    <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-zinc-900 text-white rounded-br-sm">
                      {msg.content}
                    </div>
                  );
                }
                // Strip navigation markers first, then extract projections
                const { text: navStripped, navigation: navAction } = extractNavigation(msg.content);
                const { text, projection } = extractProjection(navStripped);
                return (
                  <>
                    <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm shadow-sm">
                      <div className="prose prose-sm prose-zinc max-w-none [&_p]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_ul]:my-1 [&_li]:my-0 [&_table]:text-xs">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    </div>
                    {navAction && onNavigate && (
                      <button
                        onClick={() => onNavigate(navAction)}
                        className="flex items-center gap-1.5 mt-2 ml-1 text-[11px] font-mono text-zinc-600 bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-200 hover:border-zinc-400 transition-all"
                      >
                        <Navigation className="w-3 h-3" />
                        Go to {navAction.label}
                      </button>
                    )}
                    {projection && <ProjectionChart data={projection} narrative={projection.dataPoints?.length ? text : undefined} />}
                  </>
                );
              })()}
              {/* Tools used indicator */}
              {toolsUsed[i] && (
                <div className="flex items-center gap-1 mt-1 ml-1">
                  {toolsUsed[i].map((tool) => (
                    <span key={tool} className="flex items-center gap-1 text-[9px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                      {TOOL_ICONS[tool]} {tool.replace("_", " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
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
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Starter prompts (only show before any user messages) */}
      {messages.filter((m) => m.role === "user").length === 0 && (
        <div className="px-4 py-2 bg-[#F8F9FA] border-t border-zinc-100">
          <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Quick Questions</div>
          <div className="flex flex-wrap gap-1.5">
            {STARTER_PROMPTS.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                onClick={() => send(prompt)}
                className="text-[11px] text-zinc-600 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50 hover:border-zinc-400 transition-all text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-100 bg-white px-4 py-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Pivvy anything about your business..."
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm focus:border-zinc-900 focus:bg-white focus:outline-none transition-all disabled:opacity-50 max-h-24 overflow-y-auto"
            style={{ minHeight: "42px" }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="flex items-center justify-center w-9 h-9 bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-40 transition-all shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <div className="text-[9px] font-mono text-zinc-400 text-center mt-2 uppercase tracking-widest">
          Pivvy can search the web · access your full report · analyze websites · generate projections · navigate pages
        </div>
      </div>
    </div>
  );
}

// ── Floating button variant ───────────────────────────────────────────────────

export function AgentChatButton({ orgId, orgName, onNavigate }: { orgId: string; orgName: string; onNavigate?: (action: NavigateAction) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-sm hover:bg-zinc-800 transition-colors"
      >
        <Bot className="w-4 h-4" />
        <span className="text-xs font-mono uppercase tracking-widest">Ask Pivvy</span>
        {!open && (
          <span className="w-2 h-2 bg-green-400 rounded-full" />
        )}
      </motion.button>

      {/* Slide-up chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 left-4 sm:left-auto sm:right-6 z-50 sm:w-96 h-[520px] max-h-[80vh] bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden flex flex-col"
          >
            <AgentChat orgId={orgId} orgName={orgName} onClose={() => setOpen(false)} onNavigate={onNavigate} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
