"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ProjectionChart, parseTextToChartData } from "./charts/ProjectionChart";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PivvyFloatingChatProps {
  orgId: string;
  onNavigate?: (section: string) => void;
}

/** Extract projection from message */
function extractProjection(content: string): { text: string; projection: unknown | null } {
  const match = content.match(/<!--PROJECTION:([\s\S]*?)-->/);
  if (match) {
    try {
      return { text: content.replace(/<!--PROJECTION:[\s\S]*?-->/, "").trim(), projection: JSON.parse(match[1]) };
    } catch { return { text: content, projection: null }; }
  }
  return { text: content, projection: null };
}

/** Extract navigation from message */
function extractNavigation(content: string): { text: string; route: string | null } {
  const match = content.match(/<!--NAVIGATE:([\s\S]*?)-->/);
  if (match) {
    try {
      const route = JSON.parse(match[1]);
      return { text: content.replace(/<!--NAVIGATE:[\s\S]*?-->/, "").trim(), route: route.chapter ?? route.coreTab ?? null };
    } catch { return { text: content, route: null }; }
  }
  return { text: content, route: null };
}

export default function PivvyFloatingChat({ orgId, onNavigate }: PivvyFloatingChatProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && !minimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, minimized]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const recentCtx = messages.slice(-6).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content.slice(0, 1500),
      }));

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, message: msg, messages: recentCtx }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.message ?? "I'm here! What do you need?";
        setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again?" }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
  }, [input, loading, messages, orgId]);

  // Floating bubble when closed
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-zinc-900 rounded-full shadow-sm flex items-center justify-center text-white hover:bg-zinc-800 transition-colors group"
        title="Ask Pivvy anything"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
      </button>
    );
  }

  // Minimized bar
  if (minimized) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 bg-white border border-zinc-200 rounded-xl shadow-sm px-4 py-2 flex items-center gap-3 cursor-pointer hover:border-zinc-300 transition-colors"
        onClick={() => setMinimized(false)}
      >
        <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium text-zinc-700">Pivvy</span>
        {messages.length > 0 && (
          <span className="text-[10px] text-zinc-400">{messages.length} messages</span>
        )}
        <button onClick={(e) => { e.stopPropagation(); setOpen(false); setMinimized(false); }} className="text-zinc-400 hover:text-zinc-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Full chat panel
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] bg-white border border-zinc-200 rounded-xl shadow-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-zinc-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-zinc-200" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Pivvy</p>
            <p className="text-[10px] text-zinc-500">Your AI business advisor</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
            <Minimize2 className="w-4 h-4" />
          </button>
          <button onClick={() => { setOpen(false); setMinimized(false); }} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-zinc-500 mb-3">Ask me anything about your business</p>
            <div className="space-y-1.5">
              {["What's my health score?", "Show me revenue leaks", "Who should I follow up with?", "Project my cash flow"].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="block w-full text-left text-xs text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] bg-zinc-900 text-white rounded-2xl rounded-br-md px-3 py-2 text-sm">
                  {msg.content}
                </div>
              </div>
            );
          }

          const { text: navText, route } = extractNavigation(msg.content);
          const { text: displayText, projection } = extractProjection(navText);

          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[95%]">
                <div className="bg-zinc-50 rounded-2xl rounded-bl-md px-3 py-2 text-sm text-zinc-800">
                  <div className="prose prose-sm prose-zinc max-w-none [&_p]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_ul]:my-1 [&_li]:my-0 [&_table]:text-xs">
                    <ReactMarkdown>{displayText}</ReactMarkdown>
                  </div>
                </div>
                {projection != null && (
                  <div className="mt-1.5">
                    <ProjectionChart data={projection as any} />
                  </div>
                )}
                {route && onNavigate && (
                  <button
                    onClick={() => onNavigate(route)}
                    className="mt-1.5 text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-all"
                  >
                    Go to {route}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-50 rounded-2xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span className="text-xs text-zinc-400">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-zinc-100 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask Pivvy anything..."
            rows={1}
            className="flex-1 resize-none bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 placeholder:text-zinc-400"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="p-2 bg-zinc-900 text-white rounded-lg disabled:opacity-40 hover:bg-zinc-700 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
