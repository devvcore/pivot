"use client";

import { useState, useRef, useEffect } from "react";
import { GraduationCap, Send, Loader2, X, MessageCircle, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import type { NavigateAction } from "./AgentChat";
import { ProjectionChart, parseTextToChartData } from "./charts/ProjectionChart";
import ConnectionPrompt from "./execution/ConnectionPrompt";

interface CoachChatProps {
  orgId: string;
  runId?: string;
  memberRole?: "owner" | "employee";
  memberName?: string;
  onNavigate?: (action: NavigateAction) => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

/** Extract follow-up suggestions from <!--FOLLOWUPS:[...]--> markers */
function extractFollowUps(content: string): { text: string; followUps: string[] } {
  const match = content.match(/<!--FOLLOWUPS:([\s\S]*?)-->/);
  if (match) {
    try {
      const followUps = JSON.parse(match[1]);
      const text = content.replace(/<!--FOLLOWUPS:[\s\S]*?-->/, "").trim();
      if (Array.isArray(followUps) && followUps.length > 0) {
        return { text, followUps: followUps.slice(0, 3) };
      }
    } catch { /* fall through */ }
  }
  return { text: content, followUps: [] };
}

/** Extract projection JSON from <!--PROJECTION:{...}--> markers */
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
  // Fallback: detect text-based projections
  const hasKeywords = /(?:projection|forecast|scenario|week\s*\d|month\s*\d|opening\s*balance|closing\s*balance)/i.test(content);
  if (hasKeywords) {
    const parsed = parseTextToChartData(content);
    if (parsed && parsed.length >= 2) {
      const first = parsed[0].baseline;
      const last = parsed[parsed.length - 1].projected;
      return {
        text: content,
        projection: {
          title: "Projection",
          subtitle: "Parsed from analysis",
          dataPoints: parsed,
          metrics: {
            currentValue: first,
            projectedValue: last,
            changePercent: first > 0 ? Math.round(((last - first) / first) * 100) : 0,
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

function extractDisconnectedProvider(content: string): string | null {
  if (!/not connected|Connect.*via Settings|Connect.*Integrations/i.test(content)) return null;
  const map: [RegExp, string][] = [
    [/gmail/i, "gmail"],
    [/google calendar/i, "google_calendar"],
    [/google sheets/i, "google_sheets"],
    [/slack/i, "slack"],
    [/linkedin/i, "linkedin"],
    [/twitter/i, "twitter"],
    [/github/i, "github"],
    [/notion/i, "notion"],
    [/jira/i, "jira"],
    [/hubspot/i, "hubspot"],
  ];
  for (const [re, provider] of map) {
    if (re.test(content)) return provider;
  }
  return null;
}

const OWNER_PROMPTS = [
  "What should I focus on today?",
  "Who on my team has the highest ROI?",
  "What's the #1 thing holding my business back?",
  "What would you do differently if this was your business?",
];

const EMPLOYEE_PROMPTS = [
  "What should I focus on today?",
  "How can I improve my performance?",
  "What KPIs should I be tracking?",
  "How does my role impact the business?",
];

export function CoachChat({ orgId, runId, memberRole = "owner", memberName, onNavigate }: CoachChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prompts = memberRole === "owner" ? OWNER_PROMPTS : EMPLOYEE_PROMPTS;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          runId,
          messages: [...messages, userMsg].slice(-10), // last 10 messages for context
          message: text.trim(),
          memberRole,
          memberName,
        }),
      });
      const data = await res.json();
      const responseContent = data.message || "No response.";

      // Check for navigation action in the response
      const { navigation } = extractNavigation(responseContent);
      if (navigation && onNavigate) {
        onNavigate(navigation);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: responseContent },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Coach is unavailable. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-40 w-12 h-12 bg-zinc-900 text-white rounded-full shadow-sm hover:bg-zinc-800 transition-colors flex items-center justify-center"
        title="Talk to Coach"
      >
        <GraduationCap className="w-5 h-5" />
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 z-50 sm:w-[380px] h-[520px] max-h-[80vh] bg-white border border-zinc-200 rounded-xl shadow-lg flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                <div>
                  <p className="text-sm font-semibold">Coach</p>
                  <p className="text-[10px] opacity-80">
                    {memberRole === "owner"
                      ? "Business Performance Advisor"
                      : `Coaching ${memberName || "you"}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-emerald-500 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <GraduationCap className="w-8 h-8 text-emerald-300 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500 mb-4">
                    {memberRole === "owner"
                      ? "Ask me about your team, priorities, or what to focus on."
                      : "Ask me how to improve your performance and hit your targets."}
                  </p>
                  <div className="space-y-2">
                    {prompts.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(p)}
                        className="block w-full text-left text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 hover:bg-emerald-50 hover:border-emerald-200 transition-all"
                      >
                        <MessageCircle className="w-3 h-3 inline mr-1.5 text-emerald-400" />
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                // Parse navigation + projection markers from assistant messages
                const isAssistant = msg.role === "assistant";
                const { text: navText, navigation: navAction } = isAssistant
                  ? extractNavigation(msg.content)
                  : { text: msg.content, navigation: null };
                const { text: fuText, followUps } = isAssistant
                  ? extractFollowUps(navText)
                  : { text: navText, followUps: [] };
                const { text: displayText, projection } = isAssistant
                  ? extractProjection(fuText)
                  : { text: fuText, projection: null };
                const isLatestAssistant = isAssistant && i === messages.length - 1;

                return (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`${msg.role === "user" ? "max-w-[85%]" : "max-w-[95%] w-full"}`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                          msg.role === "user"
                            ? "bg-emerald-600 text-white"
                            : "bg-zinc-100 text-zinc-800"
                        }`}
                      >
                        {isAssistant ? (
                          <div className="prose prose-sm prose-zinc max-w-none [&_p]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_ul]:my-1 [&_li]:my-0 [&_table]:text-xs">
                            <ReactMarkdown>{displayText}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{displayText}</p>
                        )}
                      </div>
                      {/* Interactive projection chart */}
                      {projection && (
                        <div className="mt-2">
                          <ProjectionChart data={projection} />
                        </div>
                      )}
                      {/* Navigation button */}
                      {navAction && onNavigate && (
                        <button
                          onClick={() => onNavigate(navAction)}
                          className="flex items-center gap-1.5 mt-2 text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100 hover:border-emerald-400 transition-all"
                        >
                          <Navigation className="w-3 h-3" />
                          Go to {navAction.label}
                        </button>
                      )}
                      {/* Follow-up suggestions */}
                      {isLatestAssistant && followUps.length > 0 && !loading && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {followUps.map((q) => (
                            <button
                              key={q}
                              onClick={() => sendMessage(q)}
                              className="text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-all text-left"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Connection prompt for disconnected services */}
                      {isAssistant && (() => {
                        const provider = extractDisconnectedProvider(msg.content);
                        if (!provider) return null;
                        return (
                          <div className="mt-2">
                            <ConnectionPrompt orgId={orgId} filterServices={[provider]} compact={true} />
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    <span className="text-xs text-zinc-400">Coach is thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-zinc-200 p-3 shrink-0">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendMessage(input)
                  }
                  placeholder="Ask Coach..."
                  className="flex-1 text-sm border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400 transition-colors"
                  disabled={loading}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[9px] text-zinc-400 mt-1.5 text-center">
                Coach only uses data from your business report - never fabricates numbers
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Convenience export for use in ResultsView */
export function CoachChatButton({
  orgId,
  runId,
  onNavigate,
}: {
  orgId: string;
  runId?: string;
  onNavigate?: (action: NavigateAction) => void;
}) {
  return <CoachChat orgId={orgId} runId={runId} memberRole="owner" onNavigate={onNavigate} />;
}
