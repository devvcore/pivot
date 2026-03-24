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
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Paperclip,
  X,
  Image as ImageIcon,
  GitPullRequest,
  Share2,
  Calendar,
  ClipboardList,
  Target,
  TrendingUp,
  Mail,
  CheckCircle,
  Layers,
  type LucideIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatLabel } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";
import ConnectionPrompt from "./ConnectionPrompt";
import AgentPlan, { type PlanTask } from "@/components/ui/agent-plan";
import {
  generateArtifact,
  detectArtifacts,
  type DetectedArtifacts,
  type ArtifactType,
} from "@/lib/execution/artifact-generator";

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

/* ── Source citation parsing ── */
const SOURCE_TAG_RE = /\[from\s+([^\]]+)\]/gi;

interface SourceCitation {
  index: number;
  label: string;
  sourceType: "stripe" | "gmail" | "github" | "salesforce" | "analysis" | "web" | "integration" | "other";
  snippet: string;
}

function detectSourceType(label: string): SourceCitation["sourceType"] {
  const l = label.toLowerCase();
  if (l.includes("stripe")) return "stripe";
  if (l.includes("gmail") || l.includes("email")) return "gmail";
  if (l.includes("github")) return "github";
  if (l.includes("salesforce") || l.includes("crm")) return "salesforce";
  if (l.includes("analysis") || l.includes("report") || l.includes("task")) return "analysis";
  if (l.includes("web") || l.includes("search")) return "web";
  if (l.includes("slack") || l.includes("jira") || l.includes("notion") || l.includes("sheets") || l.includes("calendar") || l.includes("hubspot") || l.includes("linkedin") || l.includes("twitter")) return "integration";
  return "other";
}

function extractSourceCitations(content: string): { cleanContent: string; sources: SourceCitation[] } {
  const sources: SourceCitation[] = [];
  const seen = new Map<string, number>();
  let index = 0;

  const cleanContent = content.replace(SOURCE_TAG_RE, (_match, label: string) => {
    const key = label.toLowerCase().trim();
    if (!seen.has(key)) {
      index++;
      seen.set(key, index);
      // Extract a snippet: grab some surrounding text context
      const matchPos = content.indexOf(_match);
      const before = content.slice(Math.max(0, matchPos - 80), matchPos).trim();
      const snippetParts = before.split(/[.!?\n]/).filter(Boolean);
      const snippet = snippetParts[snippetParts.length - 1]?.trim().slice(0, 60) ?? "";
      sources.push({
        index,
        label: label.trim(),
        sourceType: detectSourceType(label),
        snippet,
      });
    }
    const num = seen.get(key)!;
    return `[${num}]`;
  });

  return { cleanContent, sources };
}

const SOURCE_ICONS: Record<SourceCitation["sourceType"], { icon: string; color: string; bg: string }> = {
  stripe: { icon: "S", color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  gmail: { icon: "M", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  github: { icon: "G", color: "text-zinc-800", bg: "bg-zinc-50 border-zinc-300" },
  salesforce: { icon: "SF", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  analysis: { icon: "A", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  web: { icon: "W", color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200" },
  integration: { icon: "I", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  other: { icon: "?", color: "text-zinc-600", bg: "bg-zinc-50 border-zinc-200" },
};

/* ── Source card component ── */
function SourceCard({ source }: { source: SourceCitation }) {
  const style = SOURCE_ICONS[source.sourceType];
  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] shrink-0 ${style.bg}`}>
      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold ${style.color} bg-white/60`}>
        {style.icon}
      </span>
      <div className="min-w-0">
        <div className={`font-medium truncate ${style.color}`}>{source.label}</div>
        {source.snippet && (
          <div className="text-[10px] text-zinc-500 truncate max-w-[140px]">{source.snippet}</div>
        )}
      </div>
      <span className="text-[9px] text-zinc-400 font-mono shrink-0">[{source.index}]</span>
    </div>
  );
}

/* ── Sources panel ── */
function SourcesPanel({ sources }: { sources: SourceCitation[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-2 pt-2 border-t border-zinc-100">
      <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Sources</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {sources.map((s) => (
          <SourceCard key={s.index} source={s} />
        ))}
      </div>
    </div>
  );
}

/* ── Thinking step labels ── */
const THINKING_LABELS: Record<string, { active: string; done: string }> = {
  query_analysis: { active: "Searching business data...", done: "Found relevant business data" },
  query_integration_data: { active: "Pulling live integration data...", done: "Loaded integration data" },
  web_search: { active: "Searching the web...", done: "Found web results" },
  scrape_website: { active: "Reading website content...", done: "Finished reading website" },
  send_email: { active: "Sending email...", done: "Email sent" },
  post_to_linkedin: { active: "Publishing to LinkedIn...", done: "Posted to LinkedIn" },
  post_to_instagram: { active: "Publishing to Instagram...", done: "Posted to Instagram" },
  post_to_twitter: { active: "Publishing to Twitter...", done: "Posted to Twitter" },
  generate_media: { active: "Creating media content...", done: "Media generated" },
  get_social_analytics: { active: "Analyzing social engagement...", done: "Engagement data loaded" },
  create_jira_ticket: { active: "Creating Jira ticket...", done: "Jira ticket created" },
  github_create_issue: { active: "Creating GitHub issue...", done: "Issue created" },
  github_create_pr: { active: "Creating pull request...", done: "Pull request created" },
  write_to_google_sheets: { active: "Writing to Sheets...", done: "Exported to Sheets" },
  read_from_google_sheets: { active: "Reading from Sheets...", done: "Loaded spreadsheet data" },
  financial_projection: { active: "Running financial model...", done: "Projection complete" },
  create_budget: { active: "Building budget...", done: "Budget created" },
  create_document: { active: "Drafting document...", done: "Document drafted" },
  create_spreadsheet: { active: "Building spreadsheet...", done: "Spreadsheet ready" },
  create_social_post: { active: "Crafting social content...", done: "Content drafted" },
  create_job_posting: { active: "Writing job posting...", done: "Job posting ready" },
};

function getThinkingLabel(toolName: string, isComplete: boolean): string {
  const entry = THINKING_LABELS[toolName];
  if (entry) return isComplete ? entry.done : entry.active;
  return isComplete ? `Finished ${formatLabel(toolName).toLowerCase()}` : `${formatLabel(toolName)}...`;
}

function getToolResultSummary(toolName: string, toolResult: string): string | null {
  if (!toolResult || toolResult.length < 5) return null;
  try {
    const r = JSON.parse(toolResult);
    if (r.count !== undefined) return `${r.count} results found`;
    if (r.total !== undefined) return `Total: ${r.total}`;
    if (r.success === true && r.message) return r.message;
  } catch {
    // Not JSON — extract first meaningful line
    const line = toolResult.split("\n").find(l => l.trim().length > 5);
    if (line && line.length < 80) return line.trim();
  }
  return null;
}

/* ── Collapsible thinking/reasoning steps ── */
function ThinkingSteps({ steps, isComplete }: { steps: ChatMessage[]; isComplete: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const thinkingSteps = steps.filter(s => s.type === "thinking" || s.type === "tool_use");

  if (thinkingSteps.length === 0) return null;

  return (
    <div className="pl-9 mb-1">
      {/* When task is done, collapse into a toggle */}
      {isComplete ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors py-1"
        >
          <Brain className="w-3 h-3" />
          <span>{thinkingSteps.filter(s => s.type === "tool_use").length} steps</span>
          <span className="mx-0.5">·</span>
          <span>Show reasoning</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      ) : null}

      {/* Show steps: always visible while in progress, toggleable when done */}
      {(!isComplete || expanded) && (
        <div className="space-y-0.5 mt-0.5">
          {thinkingSteps.map((step) => {
            if (step.type === "thinking") {
              return (
                <div key={step.id} className="flex items-center gap-1.5 py-0.5">
                  <div className="w-1 h-1 rounded-full bg-violet-300" />
                  <span className="text-[11px] text-violet-500">{step.content}</span>
                </div>
              );
            }
            // tool_use
            const toolName = step.toolName ?? "unknown";
            const isDone = !!step.toolResult;
            const label = getThinkingLabel(toolName, isDone);
            const summary = isDone ? getToolResultSummary(toolName, step.toolResult ?? "") : null;
            return (
              <div key={step.id} className="flex items-center gap-1.5 py-0.5">
                {isDone ? (
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <Loader2 className="w-3 h-3 text-indigo-400 animate-spin shrink-0" />
                )}
                <span className={`text-[11px] ${isDone ? "text-zinc-500" : "text-indigo-600"}`}>
                  {label}
                </span>
                {summary && (
                  <span className="text-[10px] text-zinc-400 ml-1 truncate max-w-[200px]">
                    — {summary}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Parse [connect:provider] markers from agent output ── */
const CONNECT_MARKER_RE = /\[connect:([a-z_]+)\]/g;

/** Extract and render data:image URLs as actual images */
function extractInlineImages(content: string): { text: string; images: string[] } {
  const imageRe = /data:image\/[a-z]+;base64,[A-Za-z0-9+/=]{100,}/g;
  const images: string[] = [];
  const text = content.replace(imageRe, (match) => {
    images.push(match);
    return ''; // Remove from text
  });
  // Also clean up "Image Data URL:" labels that precede the data URL
  const cleaned = text.replace(/Image Data URL:\s*/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  return { text: cleaned, images };
}

/** Parse a plan text (from orchestrator planning phase) into structured PlanTask objects */
function parsePlanText(planText: string, agentId: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  // Split by numbered steps or bullet points
  const lines = planText.split('\n').filter(l => l.trim().length > 0);
  let currentTask: PlanTask | null = null;
  let stepNum = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Detect step headers: "1. Title", "Step 1: Title", "- Title" (top-level)
    const stepMatch = trimmed.match(/^(?:(\d+)\.|Step\s+(\d+)[:.]\s*|-\s+)(.+)/i);

    if (stepMatch && !trimmed.startsWith('  ') && !trimmed.startsWith('\t')) {
      stepNum++;
      const title = (stepMatch[3] ?? trimmed.replace(/^[-*]\s+/, '')).trim();
      currentTask = {
        id: String(stepNum),
        title,
        description: '',
        status: 'pending',
        priority: stepNum <= 2 ? 'high' : 'medium',
        level: 0,
        dependencies: stepNum > 1 ? [String(stepNum - 1)] : [],
        subtasks: [],
      };
      tasks.push(currentTask);
    } else if (currentTask && (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.match(/^\d+\.\d+/))) {
      // Sub-items become subtasks
      const subTitle = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\d+[.)]\s*/, '').trim();
      if (subTitle.length > 3) {
        currentTask.subtasks.push({
          id: `${currentTask.id}.${currentTask.subtasks.length + 1}`,
          title: subTitle,
          description: '',
          status: 'pending',
          priority: 'medium',
          tools: detectToolsInText(subTitle),
        });
      }
    } else if (currentTask && currentTask.subtasks.length === 0) {
      // Append to description of current task
      currentTask.description = (currentTask.description + ' ' + trimmed).trim();
    }
  }

  // If no structured tasks found, create one per line
  if (tasks.length === 0 && lines.length > 0) {
    return lines.slice(0, 8).map((line, i) => ({
      id: String(i + 1),
      title: line.replace(/^[-*\d.)\s]+/, '').trim().slice(0, 100),
      description: '',
      status: 'pending',
      priority: i < 2 ? 'high' : 'medium',
      level: 0,
      dependencies: i > 0 ? [String(i)] : [],
      subtasks: [],
    }));
  }

  return tasks;
}

/** Detect tool names mentioned in text */
function detectToolsInText(text: string): string[] {
  const toolPatterns: [RegExp, string][] = [
    [/web.?search|search.*web/i, 'web_search'],
    [/scrape|website.*anal/i, 'scrape_website'],
    [/linked.?in/i, 'post_to_linkedin'],
    [/twitter|tweet/i, 'post_to_twitter'],
    [/email|gmail/i, 'send_email'],
    [/slack/i, 'send_slack_message'],
    [/sheets?|spreadsheet/i, 'write_to_google_sheets'],
    [/jira|ticket/i, 'create_jira_ticket'],
    [/github|pull.?req/i, 'github_create_issue'],
    [/compet/i, 'analyze_competitors'],
    [/query.*data|integr.*data/i, 'query_integration_data'],
    [/analysis|report/i, 'query_analysis'],
    [/schedul/i, 'schedule_post'],
    [/slide|deck|present/i, 'create_slide_deck'],
    [/crm|contact/i, 'search_crm'],
  ];
  return toolPatterns
    .filter(([pat]) => pat.test(text))
    .map(([, name]) => name);
}

function splitConnectMarkers(content: string): Array<{ type: "text"; value: string } | { type: "connect"; provider: string }> {
  const parts: Array<{ type: "text"; value: string } | { type: "connect"; provider: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(CONNECT_MARKER_RE.source, "g");
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "connect", provider: match[1] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }
  return parts;
}

/* ── Chat message types ── */
interface ClarificationQuestion {
  id: string;
  question: string;
  options: { label: string; value: string; description?: string }[];
  context?: string;
}

interface ChatMessage {
  id: string;
  timestamp: number;
  type: "user" | "routing" | "thinking" | "tool_use" | "output" | "error" | "artifact" | "clarification" | "plan";
  content: string;
  agentName?: string;
  agentId?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  artifacts?: { name: string; type: string; content: string }[];
  taskId?: string;
  attachments?: { name: string; url: string; type: string }[];
  clarifications?: ClarificationQuestion[];
  planTasks?: PlanTask[];
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

/* ── Context-aware action pills ── */
interface ActionPill {
  label: string;
  icon: LucideIcon;
  prompt: string;
}

const AGENT_PILLS: Record<string, ActionPill[]> = {
  marketer: [
    { label: "Post to LinkedIn", icon: Share2, prompt: "Post this content to LinkedIn" },
    { label: "Post to Twitter", icon: Share2, prompt: "Post this content to Twitter" },
    { label: "Create ad copy", icon: FileText, prompt: "Create ad copy based on this content" },
    { label: "Build email campaign", icon: Mail, prompt: "Build an email campaign from this" },
  ],
  analyst: [
    { label: "Export to Sheets", icon: BarChart3, prompt: "Export this data to Google Sheets" },
    { label: "Create slide deck", icon: FileText, prompt: "Create a slide deck from this analysis" },
    { label: "Run scenario analysis", icon: TrendingUp, prompt: "Run a scenario analysis on this" },
  ],
  recruiter: [
    { label: "Post job to LinkedIn", icon: Share2, prompt: "Post this job listing to LinkedIn" },
    { label: "Create interview guide", icon: ClipboardList, prompt: "Create an interview guide for this role" },
    { label: "Build onboarding plan", icon: Target, prompt: "Build an onboarding plan for this hire" },
  ],
  operator: [
    { label: "Create Jira tickets", icon: ClipboardList, prompt: "Create Jira tickets for this SOP" },
    { label: "Export to Notion", icon: FileText, prompt: "Export this process documentation to Notion" },
    { label: "Set up reminders", icon: Calendar, prompt: "Set up calendar reminders for these action items" },
  ],
  researcher: [
    { label: "Create strategy from this", icon: Target, prompt: "Create a strategy from this research" },
    { label: "Turn into LinkedIn posts", icon: Share2, prompt: "Turn these research findings into LinkedIn posts" },
    { label: "Build battle cards", icon: ClipboardList, prompt: "Build competitive battle cards from this research" },
  ],
  strategist: [
    { label: "Break into tasks", icon: ClipboardList, prompt: "Break this strategy into individual tasks for the team" },
    { label: "Create timeline", icon: Calendar, prompt: "Create a project timeline for this plan" },
    { label: "Research the market", icon: Globe, prompt: "Research the market for this strategy" },
  ],
  codebot: [
    { label: "Push to GitHub", icon: GitPullRequest, prompt: "Push these changes to GitHub" },
    { label: "Create a PR", icon: GitPullRequest, prompt: "Create a pull request for these changes" },
    { label: "Create GitHub issue", icon: Code, prompt: "Create a GitHub issue to track this" },
  ],
};

const TOOL_PILLS: Record<string, ActionPill[]> = {
  create_social_post: [
    { label: "Post to LinkedIn", icon: Share2, prompt: "Post this content to LinkedIn" },
    { label: "Post to Twitter", icon: Share2, prompt: "Post this content to Twitter" },
  ],
  post_to_linkedin: [
    { label: "Create follow-up posts", icon: Share2, prompt: "Create follow-up posts for LinkedIn" },
  ],
  post_to_twitter: [
    { label: "Create follow-up posts", icon: Share2, prompt: "Create follow-up posts for Twitter" },
  ],
  web_search: [
    { label: "Dig deeper", icon: Globe, prompt: "Dig deeper into this research" },
    { label: "Create report", icon: FileText, prompt: "Create a report from these findings" },
  ],
  scrape_website: [
    { label: "Create report", icon: FileText, prompt: "Create a report from these findings" },
  ],
  create_document: [
    { label: "Export to Sheets", icon: BarChart3, prompt: "Export this to Google Sheets" },
  ],
  create_spreadsheet: [
    { label: "Create slide deck", icon: FileText, prompt: "Create a slide deck from this data" },
  ],
  financial_projection: [
    { label: "Export to Sheets", icon: BarChart3, prompt: "Export this projection to Google Sheets" },
    { label: "Create investor deck", icon: FileText, prompt: "Create an investor deck from this projection" },
  ],
  create_budget: [
    { label: "Export to Sheets", icon: BarChart3, prompt: "Export this budget to Google Sheets" },
  ],
  create_job_posting: [
    { label: "Post to LinkedIn", icon: Share2, prompt: "Post this job listing to LinkedIn" },
    { label: "Create interview questions", icon: ClipboardList, prompt: "Create interview questions for this role" },
  ],
  github_create_pr: [
    { label: "List open issues", icon: Code, prompt: "List open GitHub issues" },
  ],
  github_create_issue: [
    { label: "Review PR status", icon: GitPullRequest, prompt: "Review open pull request status" },
  ],
};

const KEYWORD_PILLS: [RegExp, ActionPill][] = [
  [/\b(code|implementation|commit|push|deploy)\b/i, { label: "Push to GitHub", icon: GitPullRequest, prompt: "Push these changes to GitHub" }],
  [/\b(pull request|PR|merge)\b/i, { label: "Create a PR", icon: GitPullRequest, prompt: "Create a pull request for these changes" }],
  [/\b(linkedin|social media|social post)\b/i, { label: "Post to LinkedIn", icon: Share2, prompt: "Post this content to LinkedIn" }],
  [/\b(twitter|tweet|x\.com)\b/i, { label: "Post to Twitter", icon: Share2, prompt: "Post this content to Twitter" }],
  [/\b(budget|forecast|projection|revenue|financial)\b/i, { label: "Export to Sheets", icon: BarChart3, prompt: "Export this to Google Sheets" }],
  [/\b(job posting|job listing|hire|candidate|recruiting)\b/i, { label: "Post job to LinkedIn", icon: Share2, prompt: "Post this job listing to LinkedIn" }],
  [/\b(SOP|standard operating|process|workflow|checklist)\b/i, { label: "Create Jira tickets", icon: ClipboardList, prompt: "Create Jira tickets for these steps" }],
  [/\b(competitor|market research|competitive|landscape)\b/i, { label: "Build strategy from this", icon: Target, prompt: "Build a strategy from this research" }],
  [/\b(email|campaign|newsletter)\b/i, { label: "Send via Gmail", icon: Mail, prompt: "Send this via email" }],
  [/\b(next steps|action items|to.?do|follow.?up)\b/i, { label: "Create Jira tickets", icon: ClipboardList, prompt: "Create Jira tickets for these action items" }],
];

function generateContextPills(agentId: string, toolsUsed: string[], outputContent: string): ActionPill[] {
  const seen = new Set<string>();
  const pills: ActionPill[] = [];

  const add = (pill: ActionPill) => {
    if (!seen.has(pill.prompt) && pills.length < 6) {
      seen.add(pill.prompt);
      pills.push(pill);
    }
  };

  // Signal 2 first — tools used are highest signal (most specific)
  for (const tool of toolsUsed) {
    const toolKey = Object.keys(TOOL_PILLS).find(k => tool.includes(k) || k.includes(tool));
    if (toolKey) {
      for (const p of TOOL_PILLS[toolKey]) add(p);
    }
  }

  // Signal 3 — keyword matches from output
  const lowerOutput = outputContent.toLowerCase();
  for (const [regex, pill] of KEYWORD_PILLS) {
    if (regex.test(lowerOutput)) add(pill);
  }

  // Signal 4 — content-specific smart pills based on what was discussed
  if (/client|customer|upsell|outreach|retention/i.test(lowerOutput)) {
    add({ label: "Email this to client", icon: Mail, prompt: "Draft and send this as an email to the relevant client" });
    add({ label: "Add to CRM", icon: Target, prompt: "Add this interaction to the CRM as a contact note" });
  }
  if (/instagram|social|post|content/i.test(lowerOutput)) {
    add({ label: "Generate image", icon: Sparkles, prompt: "Generate a social media image for this content" });
  }
  if (/plan|strategy|roadmap|initiative/i.test(lowerOutput)) {
    add({ label: "Create tickets", icon: ClipboardList, prompt: "Create project tickets from this plan" });
  }
  if (/data|revenue|mrr|expense|cash/i.test(lowerOutput)) {
    add({ label: "Show projection", icon: TrendingUp, prompt: "Generate a 6-month projection chart for this" });
  }

  // Signal 5 — ONE agent default as fallback (only if we have fewer than 3 pills)
  if (pills.length < 3) {
    const agentDefaults = AGENT_PILLS[agentId] ?? AGENT_PILLS.strategist;
    add(agentDefaults[0]);
  }

  return pills.slice(0, 4);
}

/* ── Conversation type ── */
interface Conversation {
  id: string;
  title: string;
  timestamp: number;
  taskIds: string[];
}

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

/* ── Multi-task detection heuristic ── */
function detectMultiTask(text: string): boolean {
  // Numbered list: "1. ...\n2. ..."
  if (/\d+\.\s+.+\n\d+\.\s+/.test(text)) return true;
  // Bullet list: "- ...\n- ..."
  if (/^[-*]\s+.+\n[-*]\s+/m.test(text)) return true;
  // Semicolon-separated (each part > 10 chars)
  const semiParts = text.split(";").filter(p => p.trim().length > 10);
  if (semiParts.length >= 2) return true;
  return false;
}

/* ── Wide task detection — same task across multiple items ── */
const WIDE_PATTERNS = [
  /(?:for|about|on|research|analyze|compare|review|contact|email|brief)\s+(?:these|the following|each of|all of|every)\s+\w+[\s:]+(.+)/i,
  /for\s+each\s+\w+\s+(?:in|:)\s*(.+)/i,
  /\b(?:all|each|every)\s+(?:my|our)\s+(?:clients?|customers?|leads?|contacts?|accounts?|prospects?|subscribers?)\b/i,
];

function detectWideTask(text: string): boolean {
  for (const pattern of WIDE_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  // Colon-separated list with 2+ items after an action phrase
  const colonMatch = text.match(/^.+:\s*(.+)$/s);
  if (colonMatch) {
    const items = colonMatch[1].split(/,\s*(?:and\s+)?|\s+and\s+/).filter(s => s.trim().length > 0);
    if (items.length >= 2) return true;
  }
  return false;
}

/* ── Wide task card status type ── */
interface WideTaskCard {
  id: string;
  item: string;
  title: string;
  agentId: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  result?: string;
  costCents: number;
  toolsUsed: string[];
}

interface WideExecution {
  wideId: string;
  taskTemplate: string;
  agentId: string;
  cards: WideTaskCard[];
  startedAt: number;
}

/* ── Conversational pre-filter — only catch true non-tasks ── */
const THANKS_PATTERN = /^(thanks|thank you|thx|ty|cheers)\b/i;

function getConversationalResponse(text: string): string | null {
  const trimmed = text.trim();
  // Only filter pure thanks — everything else goes to the agent
  if (THANKS_PATTERN.test(trimmed) && trimmed.split(/\s+/).length <= 3) {
    return "Anytime! What's next?";
  }
  // Let EVERYTHING else through — even "hi", "hey", short messages
  // The agent should handle greetings conversationally
  return null;
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

/* ── Artifact download bar (Manus-style) ── */
function ArtifactDownloadBar({ content, title }: { content: string; title: string }) {
  const detected = detectArtifacts(content);
  const [copiedMd, setCopiedMd] = useState(false);

  // Don't show if content is trivial (< 100 chars, no structure)
  if (content.length < 100 && !detected.hasTable && !detected.hasCodeBlock) return null;

  const downloadArtifact = (type: ArtifactType) => {
    const artifact = generateArtifact(type, title, content);
    const blob = new Blob([artifact.content], { type: artifact.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMarkdown = () => {
    navigator.clipboard.writeText(content);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const btnClass =
    "flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-full transition-all";

  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      {detected.hasTable && (
        <button
          onClick={() => downloadArtifact("csv")}
          className={`${btnClass} text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100`}
        >
          <Download className="w-3 h-3" /> CSV
        </button>
      )}
      {(detected.isReport || content.length > 200) && (
        <button
          onClick={() => downloadArtifact("html")}
          className={`${btnClass} text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100`}
        >
          <Download className="w-3 h-3" /> Report
        </button>
      )}
      {detected.hasStructuredData && (
        <button
          onClick={() => downloadArtifact("json")}
          className={`${btnClass} text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100`}
        >
          <Download className="w-3 h-3" /> JSON
        </button>
      )}
      <button
        onClick={copyMarkdown}
        className={`${btnClass} text-zinc-600 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100`}
      >
        {copiedMd ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        {copiedMd ? "Copied" : "Markdown"}
      </button>
      <button
        onClick={() => downloadArtifact("markdown")}
        className={`${btnClass} text-zinc-600 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100`}
      >
        <Download className="w-3 h-3" /> .md
      </button>
    </div>
  );
}

/* ── Artifact card ── */
function ArtifactCard({ artifact }: { artifact: { name: string; type: string; content: string } }) {
  const [copied, setCopied] = useState(false);
  const isImage = artifact.type === 'image' || artifact.content?.startsWith('data:image/');

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (isImage) {
      const a = document.createElement("a");
      a.href = artifact.content;
      a.download = artifact.name;
      a.click();
    } else {
      const blob = new Blob([artifact.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = artifact.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Image artifacts render as actual images
  if (isImage) {
    const [imgError, setImgError] = useState(false);
    const contentLen = artifact.content?.length ?? 0;

    return (
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
        {contentLen > 100 && !imgError ? (
          <img
            src={artifact.content}
            alt={artifact.name}
            className="w-full max-w-lg"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="px-4 py-8 text-center bg-zinc-50">
            <FileOutput className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-zinc-500 mb-2">{artifact.name}</p>
            <p className="text-xs text-zinc-400 mb-3">{contentLen > 0 ? `${Math.round(contentLen / 1024)}KB image` : 'Image data not loaded'}</p>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 border-t border-zinc-100">
          <FileOutput className="w-3.5 h-3.5 text-teal-600" />
          <span className="text-xs text-zinc-600 truncate flex-1">{artifact.name}</span>
          <button onClick={handleDownload} className="text-[10px] font-mono text-teal-600 hover:text-teal-800 transition-colors px-2 py-1 bg-teal-50 rounded-lg">
            Download Image
          </button>
        </div>
      </div>
    );
  }

  const preview = artifact.content.split("\n").slice(0, 4).join("\n");

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <FileOutput className="w-4 h-4 text-teal-600" />
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
  const [hydrating, setHydrating] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvoId, setCurrentConvoId] = useState<string>(() => `convo-${Date.now()}`);
  const [showSidebar, setShowSidebar] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<{ id: string; file: File; preview?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [wideExecution, setWideExecution] = useState<WideExecution | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
          const lastTool = [...msgs].reverse().find(m => m.type === "tool_use" && m.toolName === (data.tool ?? ""));
          if (lastTool) {
            lastTool.toolResult = data.outputSummary ?? "";
          }
          break;
        case "thinking":
          // Special handling for clarification requests
          if (data.phase === "clarification_request" && data.questions?.length > 0) {
            msgs.push({
              id: ev.id,
              timestamp: ts,
              type: "clarification",
              content: "I have a few questions before I start:",
              agentName: agentInfo.name,
              agentId,
              taskId,
              clarifications: data.questions,
            });
          } else if (data.phase === "planning" && data.plan) {
            // Convert plan text into structured PlanTask objects
            const planTasks = parsePlanText(data.plan, agentId);
            if (planTasks.length > 0) {
              msgs.push({
                id: ev.id,
                timestamp: ts,
                type: "plan",
                content: "Here's my execution plan:",
                agentName: agentInfo.name,
                agentId,
                taskId,
                planTasks,
              });
            } else {
              msgs.push({
                id: ev.id,
                timestamp: ts,
                type: "thinking",
                content: `${agentInfo.name} is planning...`,
                agentName: agentInfo.name,
                agentId,
                taskId,
              });
            }
          } else {
            msgs.push({
              id: ev.id,
              timestamp: ts,
              type: "thinking",
              content: data.phase ? `${agentInfo.name} is ${data.phase.replace(/_/g, " ")}...` : `${agentInfo.name} is thinking...`,
              agentName: agentInfo.name,
              agentId,
              taskId,
            });
          }
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

  /* ── Poll a task (concurrent-safe: only touches its own taskId) ── */
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
        const res = await authFetch(`/api/execution/tasks/${taskId}`);
        if (res.status === 401) {
          // Session expired even after refresh — stop polling
          clearInterval(interval);
          pollIntervals.current.delete(interval);
          setActiveAgents(prev => { const s = new Set(prev); s.delete(agentId); return s; });
          return;
        }
        if (!res.ok) return;
        const { task, events: dbEvents } = await res.json();

        // Map events (chronological order)
        const agentMsgs = mapEventsToMessages(
          (dbEvents ?? []).reverse(),
          taskId,
          task.agent_id ?? agentId
        );

        // Update cost (accumulate across all tasks)
        if (task.cost_spent) {
          setTotalCostCents(prev => {
            // We track per-task cost in agentTasks, so just recalculate
            return prev; // Will be recalculated from agentTasks
          });
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

        // Update messages: only replace messages for THIS taskId, leave everything else
        setMessages(prev => {
          // Remove old messages for this task (keep user messages and non-task messages)
          const withoutThisTask = prev.filter(m => m.taskId !== taskId);

          // Find the user message that triggered this task
          const userMsgIdx = withoutThisTask.findIndex(m => m.id === userMsgId);

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

          // Insert this task's messages right after the user message (or at end if no user msg found)
          if (userMsgIdx === -1) {
            return [...withoutThisTask, routingMsg, ...taskMsgs];
          }

          const before = withoutThisTask.slice(0, userMsgIdx + 1);
          // Find where to insert: after user msg and any batch routing messages
          const after = withoutThisTask.slice(userMsgIdx + 1);

          // Find the first message after userMsg that belongs to a different conversation
          // (i.e. another user message), so we insert before it
          const nextUserIdx = after.findIndex(m => m.type === "user");
          if (nextUserIdx === -1) {
            // No more user messages after, append at end
            return [...before, ...after, routingMsg, ...taskMsgs];
          } else {
            const middleSection = after.slice(0, nextUserIdx);
            const restSection = after.slice(nextUserIdx);
            return [...before, ...middleSection, routingMsg, ...taskMsgs, ...restSection];
          }
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

  /* ── Poll wide tasks — update grid cards ── */
  function pollWideTask(taskId: string, item: string) {
    let pollCount = 0;
    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > 150) {
        clearInterval(interval);
        pollIntervals.current.delete(interval);
        return;
      }

      try {
        const res = await authFetch(`/api/execution/tasks/${taskId}`);
        if (res.status === 401 || !res.ok) {
          if (res.status === 401) {
            clearInterval(interval);
            pollIntervals.current.delete(interval);
          }
          return;
        }
        const { task, events: dbEvents } = await res.json();

        // Extract tools used from events
        const tools = (dbEvents ?? [])
          .filter((e: any) => e.event_type === "tool_call")
          .map((e: any) => e.data?.tool ?? "unknown");

        // Update the wide execution card
        setWideExecution(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            cards: prev.cards.map(card =>
              card.id === taskId
                ? {
                    ...card,
                    status: task.status as WideTaskCard["status"],
                    result: task.result ?? undefined,
                    costCents: Math.round((task.cost_spent ?? 0) * 100),
                    toolsUsed: tools,
                  }
                : card
            ),
          };
        });

        if (isTerminalStatus(task.status)) {
          clearInterval(interval);
          pollIntervals.current.delete(interval);

          // Check if all wide tasks are done
          setWideExecution(prev => {
            if (!prev) return prev;
            const allDone = prev.cards.every(card =>
              card.id === taskId
                ? isTerminalStatus(task.status)
                : isTerminalStatus(card.status)
            );
            if (allDone) {
              setActiveAgents(prevAgents => {
                const s = new Set(prevAgents);
                s.delete(prev.agentId);
                return s;
              });
            }
            return prev;
          });
        }
      } catch {
        // silently ignore
      }
    }, 2000);

    pollIntervals.current.add(interval);
  }

  /* ── Hydrate state from Supabase on mount ── */
  useEffect(() => {
    async function hydrateFromDb() {
      try {
        const res = await authFetch(`/api/execution/tasks?orgId=${orgId}&limit=20`);
        if (!res.ok) { setHydrating(false); return; }
        const { tasks } = await res.json();

        if (!tasks || tasks.length === 0) { setHydrating(false); return; }

        const restoredMessages: ChatMessage[] = [];
        const restoredActiveAgents = new Set<string>();
        const restoredAgentTasks: Record<string, { task: string; status: string; costCents: number }> = {};
        let restoredCostCents = 0;
        const seenBatchIds = new Set<string>();

        // Process oldest first for chronological ordering
        const chronologicalTasks = [...tasks].reverse();

        // ── Parallel fetch: load all task details at once instead of sequential N+1 ──
        const detailResults = await Promise.all(
          chronologicalTasks.map(async (task) => {
            try {
              const detailRes = await authFetch(`/api/execution/tasks/${task.id}`);
              if (!detailRes.ok) return null;
              return await detailRes.json();
            } catch { return null; }
          })
        );

        // Build conversation map during the same loop (no second fetch round)
        const convoMap = new Map<string, Conversation>();

        for (let i = 0; i < chronologicalTasks.length; i++) {
          const detail = detailResults[i];
          if (!detail) continue;
          const { task: fullTask, events: dbEvents } = detail;

          // Find session_start event for user message and batch context
          const sessionStartEvent = (dbEvents ?? []).find(
            (e: any) => e.event_type === "session_start"
          );
          const userMessage = sessionStartEvent?.data?.userMessage ?? fullTask.title;
          const batchId = sessionStartEvent?.data?.batchId;

          // Build conversation map (reuse data from same fetch — no duplicate API calls)
          const convoId = sessionStartEvent?.data?.conversationId || `legacy-${fullTask.id}`;
          if (!convoMap.has(convoId)) {
            convoMap.set(convoId, {
              id: convoId,
              title: (userMessage ?? fullTask.title ?? "").slice(0, 60),
              timestamp: new Date(fullTask.created_at).getTime(),
              taskIds: [],
            });
          }
          convoMap.get(convoId)!.taskIds.push(fullTask.id);

          // For batch tasks, only show one user message per batch
          const shouldShowUserMsg = !batchId || !seenBatchIds.has(batchId);
          if (batchId) seenBatchIds.add(batchId);

          const userMsgId = batchId ? `user-restored-batch-${batchId}` : `user-restored-${fullTask.id}`;

          if (shouldShowUserMsg) {
            restoredMessages.push({
              id: userMsgId,
              timestamp: new Date(fullTask.created_at).getTime(),
              type: "user",
              content: userMessage,
            });
          }

          // Add routing message
          const agentId = fullTask.agent_id ?? "strategist";
          const agentInfo = AGENT_NAMES[agentId] ?? { name: agentId, emoji: "?" };
          restoredMessages.push({
            id: `route-${fullTask.id}`,
            timestamp: new Date(fullTask.created_at).getTime() + 1,
            type: "routing",
            content: `Routed to ${agentInfo.name}`,
            agentName: agentInfo.name,
            agentId,
            taskId: fullTask.id,
          });

          // Map DB events to chat messages (events come DESC, reverse to chronological)
          const agentMsgs = mapEventsToMessages(
            (dbEvents ?? []).reverse(),
            fullTask.id,
            agentId
          );
          restoredMessages.push(...agentMsgs);

          // Add final result if terminal and not already in events
          if (isTerminalStatus(fullTask.status) && fullTask.result) {
            const hasOutput = agentMsgs.some(m => m.type === "output");
            if (!hasOutput) {
              restoredMessages.push({
                id: `result-${fullTask.id}`,
                timestamp: new Date(fullTask.completed_at ?? fullTask.updated_at).getTime(),
                type: fullTask.status === "completed" ? "output" : "error",
                content: fullTask.result,
                agentName: agentInfo.name,
                agentId,
                taskId: fullTask.id,
              });
            }
          }

          // Add artifacts
          if (fullTask.artifacts?.length > 0) {
            restoredMessages.push({
              id: `artifacts-${fullTask.id}`,
              timestamp: new Date(fullTask.updated_at).getTime(),
              type: "artifact",
              content: `${fullTask.artifacts.length} artifact(s) created`,
              agentName: agentInfo.name,
              agentId,
              artifacts: fullTask.artifacts,
              taskId: fullTask.id,
            });
          }

          // Track agent task
          restoredAgentTasks[agentId] = {
            task: fullTask.title,
            status: fullTask.status,
            costCents: Math.round((fullTask.cost_spent ?? 0) * 100),
          };

          restoredCostCents += Math.round((fullTask.cost_spent ?? 0) * 100);

          // Resume polling for in-progress tasks
          if (!isTerminalStatus(fullTask.status)) {
            restoredActiveAgents.add(agentId);
            setTimeout(() => pollTask(fullTask.id, agentId, userMsgId), 100);
          }
        }
        // Set the most recent conversation as current, rest as history
        const allConvos = [...convoMap.values()].sort((a, b) => b.timestamp - a.timestamp);
        if (allConvos.length > 0) {
          setCurrentConvoId(allConvos[0].id);
          setConversations(allConvos.slice(1));
        }

        setMessages(restoredMessages);
        setActiveAgents(restoredActiveAgents);
        setAgentTasks(restoredAgentTasks);
        setTotalCostCents(restoredCostCents);
      } catch (err) {
        console.error("[ExecutionDashboard] Hydration error:", err);
      } finally {
        setHydrating(false);
      }
    }

    hydrateFromDb();
  }, [orgId]);

  /* ── New conversation ── */
  const handleNewChat = useCallback(() => {
    // Save current conversation if it has messages
    if (messages.length > 0) {
      const firstUserMsg = messages.find(m => m.type === "user");
      const title = firstUserMsg?.content?.slice(0, 60) || "Untitled";
      setConversations(prev => {
        const existing = prev.find(c => c.id === currentConvoId);
        if (existing) return prev;
        return [{
          id: currentConvoId,
          title,
          timestamp: messages[0]?.timestamp || Date.now(),
          taskIds: [...new Set(messages.filter(m => m.taskId).map(m => m.taskId!))],
        }, ...prev];
      });
    }

    // Clear state and create new conversation
    pollIntervals.current.forEach(clearInterval);
    pollIntervals.current.clear();
    setMessages([]);
    setActiveAgents(new Set());
    setAgentTasks({});
    setTotalCostCents(0);
    setCurrentConvoId(`convo-${Date.now()}`);
    setShowSidebar(false);
  }, [messages, currentConvoId]);

  /* ── Load a past conversation ── */
  const loadConversation = useCallback(async (convo: Conversation) => {
    // Save current conversation first
    if (messages.length > 0) {
      const firstUserMsg = messages.find(m => m.type === "user");
      const title = firstUserMsg?.content?.slice(0, 60) || "Untitled";
      setConversations(prev => {
        const existing = prev.find(c => c.id === currentConvoId);
        if (existing) return prev;
        return [{
          id: currentConvoId,
          title,
          timestamp: messages[0]?.timestamp || Date.now(),
          taskIds: [...new Set(messages.filter(m => m.taskId).map(m => m.taskId!))],
        }, ...prev];
      });
    }

    // Clear current state
    pollIntervals.current.forEach(clearInterval);
    pollIntervals.current.clear();
    setActiveAgents(new Set());
    setAgentTasks({});
    setTotalCostCents(0);
    setCurrentConvoId(convo.id);
    setShowSidebar(false);

    // Load the conversation's messages from task IDs (parallel fetch)
    const restoredMessages: ChatMessage[] = [];
    let restoredCostCents = 0;

    const detailResults = await Promise.all(
      convo.taskIds.map(async (taskId) => {
        try {
          const detailRes = await authFetch(`/api/execution/tasks/${taskId}`);
          if (!detailRes.ok) return null;
          return await detailRes.json();
        } catch { return null; }
      })
    );

    for (let idx = 0; idx < convo.taskIds.length; idx++) {
      const detail = detailResults[idx];
      if (!detail) continue;
      try {
        const { task: fullTask, events: dbEvents } = detail;

        const sessionStartEvent = (dbEvents ?? []).find(
          (e: any) => e.event_type === "session_start"
        );
        const userMessage = sessionStartEvent?.data?.userMessage ?? fullTask.title;
        const userMsgId = `user-restored-${fullTask.id}`;

        // Only add user message if not already added (for batch tasks)
        if (!restoredMessages.some(m => m.type === "user" && m.content === userMessage)) {
          restoredMessages.push({
            id: userMsgId,
            timestamp: new Date(fullTask.created_at).getTime(),
            type: "user",
            content: userMessage,
          });
        }

        const agentId = fullTask.agent_id ?? "strategist";
        const agentInfo = AGENT_NAMES[agentId] ?? { name: agentId, emoji: "?" };
        restoredMessages.push({
          id: `route-${fullTask.id}`,
          timestamp: new Date(fullTask.created_at).getTime() + 1,
          type: "routing",
          content: `Routed to ${agentInfo.name}`,
          agentName: agentInfo.name,
          agentId,
          taskId: fullTask.id,
        });

        const agentMsgs = mapEventsToMessages(
          (dbEvents ?? []).reverse(),
          fullTask.id,
          agentId
        );
        restoredMessages.push(...agentMsgs);

        if (isTerminalStatus(fullTask.status) && fullTask.result) {
          const hasOutput = agentMsgs.some(m => m.type === "output");
          if (!hasOutput) {
            restoredMessages.push({
              id: `result-${fullTask.id}`,
              timestamp: new Date(fullTask.completed_at ?? fullTask.updated_at).getTime(),
              type: fullTask.status === "completed" ? "output" : "error",
              content: fullTask.result,
              agentName: agentInfo.name,
              agentId,
              taskId: fullTask.id,
            });
          }
        }

        restoredCostCents += Math.round((fullTask.cost_spent ?? 0) * 100);
      } catch {
        // Skip failed tasks
      }
    }

    setMessages(restoredMessages);
    setTotalCostCents(restoredCostCents);
  }, [messages, currentConvoId]);

  /* ── File handling ── */
  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).map(file => {
      const entry: { id: string; file: File; preview?: string } = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
      };
      if (file.type.startsWith('image/')) {
        entry.preview = URL.createObjectURL(file);
      }
      return entry;
    });
    setStagedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setStagedFiles(prev => {
      const removed = prev.find(f => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const uploadFiles = useCallback(async (files: { id: string; file: File }[]): Promise<{ name: string; url: string; type: string; size: number }[]> => {
    if (files.length === 0) return [];
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('orgId', orgId);
      for (const f of files) {
        formData.append('files', f.file);
      }
      const res = await authFetch('/api/execution/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const { uploaded } = await res.json();
      return uploaded ?? [];
    } catch (err) {
      console.error('File upload failed:', err);
      return [];
    } finally {
      setUploading(false);
    }
  }, [orgId]);

  /* ── Send message (single or batch) ── */
  const handleSend = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg && stagedFiles.length === 0) return;
    if (sending) return;

    setSending(true);
    setInput("");

    // Capture and clear staged files
    const filesToUpload = [...stagedFiles];
    setStagedFiles([]);

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      timestamp: Date.now(),
      type: "user",
      content: msg || `[${filesToUpload.length} file(s) attached]`,
    };
    setMessages(prev => [...prev, userMsg]);

    // ── Fast path: conversational messages go to Pivvy (instant), tasks go to orchestrator ──
    if (filesToUpload.length === 0) {
      const conversationalReply = getConversationalResponse(msg);
      if (conversationalReply) {
        setMessages(prev => [...prev, {
          id: `reply-${Date.now()}`, timestamp: Date.now(), type: "output",
          content: conversationalReply, agentName: "Pivvy", agentId: "system",
        }]);
        setSending(false);
        return;
      }

      // Route decision: task → orchestrator, conversation → Pivvy
      // ANY message starting with an action verb is a TASK, regardless of length
      const actionVerbStart = /^(create|build|write|draft|research|analyze|generate|make|send|post|design|develop|pull|check|scrape|search|find|get|show|list|export|update|fix|run|deploy|set up|schedule|plan|prepare|review|audit|compare|track|monitor|optimize)/i.test(msg.trim());
      // Detect references to previous content — these are ALWAYS follow-ups, even with action verbs
      const referencePrevious = /\b(them|it|this|that|those|the post|the image|the email|the content|what you|above|from above)\b/i.test(msg.trim());
      const hasRecentOutput = messages.some(m => m.type === "output" && Date.now() - m.timestamp < 300000); // 5 min window
      // Short replies to previous output are conversational
      const isFollowUp = (hasRecentOutput && referencePrevious) || (hasRecentOutput && msg.trim().length < 40 && !actionVerbStart);
      // Questions are conversational
      const isQuestion = /^(what|how|who|why|when|where|which|is |are |do |does |can |could |should |would |tell me|show me|help)/i.test(msg.trim()) && !actionVerbStart;
      const isNewTask = actionVerbStart && !isFollowUp && !isQuestion || (msg.trim().length > 30 && !isFollowUp && !isQuestion && !referencePrevious);
      if (!isNewTask) {
        try {
          const recentCtx = messages
            .filter(m => m.type === "user" || m.type === "output")
            .slice(-6)
            .map(m => ({ role: m.type === "user" ? "user" : "assistant", content: m.content?.slice(0, 1500) ?? "" }));

          const pivvyRes = await fetch("/api/agent/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgId, message: msg, messages: recentCtx }),
          });

          if (pivvyRes.ok) {
            const data = await pivvyRes.json();
            const reply = data.message ?? data.response ?? "I'm here! What would you like me to do?";
            setMessages(prev => [...prev, {
              id: `pivvy-${Date.now()}`, timestamp: Date.now(), type: "output",
              content: reply, agentName: "Pivvy", agentId: "pivvy",
            }]);
            setSending(false);
            return;
          }
          // If Pivvy API fails, fall through to task creation
          console.warn('[Execution] Pivvy fast path failed:', pivvyRes.status);
        } catch (err) {
          console.warn('[Execution] Pivvy fast path error:', err);
          /* fall through to task creation */
        }
      }
    }

    try {
      // Upload files if any
      let attachments: { name: string; url: string; type: string; size: number }[] = [];
      if (filesToUpload.length > 0) {
        attachments = await uploadFiles(filesToUpload);
        if (attachments.length > 0) {
          // Update user message with attachment previews
          setMessages(prev => prev.map(m =>
            m.id === userMsgId
              ? { ...m, attachments: attachments.map(a => ({ name: a.name, url: a.url, type: a.type })) }
              : m
          ));
        }
        // Clean up previews
        for (const f of filesToUpload) {
          if (f.preview) URL.revokeObjectURL(f.preview);
        }
      }

      // ── Build conversation context for follow-up awareness ──
      // Include enough of agent output so follow-ups like "post this to instagram" work
      const recentContext = messages
        .filter(m => m.type === "user" || m.type === "output")
        .slice(-8)  // last 4 exchanges (user + agent)
        .map(m => m.type === "user" ? `User: ${m.content?.slice(0, 400)}` : `Agent (${m.agentName ?? 'assistant'}): ${m.content?.slice(0, 3000)}`)
        .join('\n');
      const contextBlock = recentContext ? `\n\n--- CONVERSATION CONTEXT (previous messages in this session) ---\n${recentContext}\n--- END CONTEXT ---\nIMPORTANT: Use the context above. If the user references something from a previous message (e.g. "post this", "send that", "use those numbers"), find it in the context. Do NOT create new content if the user is asking you to USE existing content.` : '';

      const isWide = detectWideTask(msg);
      const isMultiTask = !isWide && detectMultiTask(msg);

      if (isWide) {
        // ── Wide path: same task across multiple items in parallel ──
        const res = await authFetch("/api/execution/wide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, task: msg + contextBlock, costCeiling: 0.50, conversationId: currentConvoId }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(res.status === 401 ? "Session expired. Please refresh the page or sign in again." : errBody?.error || "Failed to create wide execution");
        }
        const { tasks: wideTasks, wideId, agentId: resolvedAgent, taskTemplate } = await res.json();

        if (!wideTasks || wideTasks.length === 0) throw new Error("No items detected for wide execution");

        // Initialize wide execution grid
        const cards: WideTaskCard[] = wideTasks.map((t: any) => ({
          id: t.id,
          item: t.item,
          title: t.title,
          agentId: t.agentId ?? resolvedAgent,
          status: "queued" as const,
          costCents: 0,
          toolsUsed: [],
        }));

        setWideExecution({
          wideId,
          taskTemplate,
          agentId: resolvedAgent,
          cards,
          startedAt: Date.now(),
        });

        setActiveAgents(prev => new Set(prev).add(resolvedAgent));

        // Add routing message
        const agentInfo = AGENT_NAMES[resolvedAgent] ?? { name: resolvedAgent, emoji: "?" };
        setMessages(prev => [...prev, {
          id: `wide-route-${wideId}`,
          timestamp: Date.now(),
          type: "routing",
          content: `Wide execution: ${agentInfo.name} working on ${wideTasks.length} items in parallel`,
          agentName: agentInfo.name,
          agentId: resolvedAgent,
        }]);

        // Start polling each wide task
        for (const ct of wideTasks) {
          pollWideTask(ct.id, ct.item);
        }
      } else if (isMultiTask) {
        // ── Batch path: split into multiple tasks ──
        const res = await authFetch("/api/execution/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, message: msg + contextBlock, costCeiling: 0.50, conversationId: currentConvoId, ...(attachments.length > 0 && { attachments }) }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(res.status === 401 ? "Session expired. Please refresh the page or sign in again." : errBody?.error || "Failed to create batch tasks");
        }
        const { tasks } = await res.json();

        if (!tasks || tasks.length === 0) throw new Error("No tasks created");

        // Add batch routing message
        const agentList = tasks.map((t: any) => AGENT_NAMES[t.agentId]?.name ?? t.agentId).join(", ");
        setMessages(prev => [...prev, {
          id: `batch-route-${Date.now()}`,
          timestamp: Date.now(),
          type: "routing",
          content: `Splitting into ${tasks.length} tasks: ${agentList}`,
        }]);

        // Activate agents and start polling for each task
        for (const task of tasks) {
          const resolvedAgent = task.agentId ?? "strategist";
          setActiveAgents(prev => new Set(prev).add(resolvedAgent));

          const agentInfo = AGENT_NAMES[resolvedAgent] ?? { name: resolvedAgent, emoji: "?" };
          setMessages(prev => [...prev, {
            id: `thinking-${task.id}`,
            timestamp: Date.now(),
            type: "thinking",
            content: `${agentInfo.name} is working on: ${task.title}`,
            agentName: agentInfo.name,
            agentId: resolvedAgent,
            taskId: task.id,
          }]);

          pollTask(task.id, resolvedAgent, userMsgId);
        }
      } else {
        // ── Single task path ──
        // Append conversation context to the task description so the agent has follow-up awareness
        const taskTitle = msg || `Post uploaded image${attachments.length > 1 ? 's' : ''}`;
        const res = await authFetch("/api/execution/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId,
            title: taskTitle,
            description: contextBlock || undefined,
            agentId: "auto",
            priority: "medium",
            costCeiling: 0.50,
            conversationId: currentConvoId,
            ...(attachments.length > 0 && { attachments }),
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(res.status === 401 ? "Session expired. Please refresh the page or sign in again." : errBody?.error || "Failed to create task");
        }
        const { task } = await res.json();
        const resolvedAgent = task.agent_id ?? "strategist";

        setActiveAgents(prev => new Set(prev).add(resolvedAgent));

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

        pollTask(task.id, resolvedAgent, userMsgId);
      }
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
  }, [orgId, sending, currentConvoId, stagedFiles, uploadFiles]);

  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans flex">
      {/* ── Mobile sidebar backdrop ── */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* ── Sidebar (conversation history) ── */}
      {showSidebar && (
        <div className="fixed inset-y-0 left-0 z-50 w-64 md:relative md:z-auto bg-white border-r border-zinc-200 flex flex-col h-screen md:sticky top-0">
          <div className="p-3 border-b border-zinc-100">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-all"
            >
              <Plus className="w-4 h-4" /> New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {/* Current conversation */}
            {messages.length > 0 && (
              <div className="px-3 py-2 bg-zinc-100 rounded-lg">
                <div className="text-xs font-medium text-zinc-900 truncate">
                  {messages.find(m => m.type === "user")?.content?.slice(0, 50) || "Current chat"}
                </div>
                <div className="text-[9px] text-zinc-400 mt-0.5">Now</div>
              </div>
            )}
            {/* Past conversations */}
            {conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => loadConversation(convo)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors group"
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-700 truncate group-hover:text-zinc-900">{convo.title}</div>
                    <div className="text-[9px] text-zinc-400">
                      {new Date(convo.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" "}· {convo.taskIds.length} task{convo.taskIds.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {conversations.length === 0 && messages.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-6 h-6 text-zinc-300 mx-auto mb-2" />
                <p className="text-[10px] text-zinc-400">No conversations yet</p>
              </div>
            )}
          </div>
          <div className="p-2 border-t border-zinc-100">
            <button
              onClick={() => setShowSidebar(false)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <PanelLeftClose className="w-3.5 h-3.5" /> Close sidebar
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-h-screen">
      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-all"
              title="Toggle sidebar"
            >
              <PanelLeft className="w-4 h-4 text-zinc-500" />
            </button>
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
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                <Loader2 className="w-3 h-3 animate-spin" />
                {activeAgents.size} working
              </span>
            )}
            <span className="hidden sm:inline text-[10px] font-mono text-zinc-400 tabular-nums">
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
          {/* Loading state during hydration */}
          {hydrating && !hasMessages && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mb-3" />
              <p className="text-sm text-zinc-400">Loading your session...</p>
            </div>
          )}

          {/* Empty state with recommendation pills */}
          {!hydrating && !hasMessages && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-16 h-16 bg-zinc-900 flex items-center justify-center rounded-xl mb-6">
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
          {messages.map((msg, msgIndex) => {
            /* ── Skip thinking/tool_use — rendered as ThinkingSteps above output ── */
            if (msg.type === "thinking" || msg.type === "tool_use") {
              // Check if a later output message exists for this task
              const hasLaterOutput = messages.slice(msgIndex + 1).some(
                m => m.type === "output" && m.taskId === msg.taskId
              );
              // If an output follows, skip (ThinkingSteps will render them)
              // If no output yet (still in progress), render inline
              if (hasLaterOutput) return null;

              // Still in progress — show as live thinking step
              if (msg.type === "thinking") {
                const phase = msg.content?.toLowerCase() ?? "";
                const isPlanning = phase.includes("plan");
                const isExecuting = phase.includes("execut") || phase.includes("start");
                const isReviewing = phase.includes("review");
                const icon = isPlanning ? "📋" : isExecuting ? "⚡" : isReviewing ? "🔍" : "💭";
                return (
                  <div key={msg.id} className="flex items-center gap-2 pl-2 my-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50/50 border border-violet-100 rounded-full">
                      <span className="text-xs">{icon}</span>
                      <span className="text-[11px] text-violet-600 font-medium">{msg.content}</span>
                      <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                    </div>
                  </div>
                );
              }
              // In-progress tool_use
              const toolName = msg.toolName ?? "unknown";
              const isDone = !!msg.toolResult;
              const label = getThinkingLabel(toolName, isDone);
              return (
                <div key={msg.id} className="pl-9 my-0.5">
                  <div className="flex items-center gap-1.5 py-0.5">
                    {isDone ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Loader2 className="w-3 h-3 text-indigo-400 animate-spin shrink-0" />
                    )}
                    <span className={`text-[11px] ${isDone ? "text-zinc-500" : "text-indigo-600"}`}>
                      {label}
                    </span>
                    {isDone && msg.toolResult && (() => {
                      const summary = getToolResultSummary(toolName, msg.toolResult);
                      return summary ? (
                        <span className="text-[10px] text-zinc-400 ml-1 truncate max-w-[200px]">
                          — {summary}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              );
            }

            /* ── Clarification questions — interactive buttons like Claude ── */
            if (msg.type === "clarification" && msg.clarifications) {
              const agentId = msg.agentId ?? "strategist";
              const agentConfig = AGENT_NAMES[agentId];
              const agentColor = agentConfig?.color ?? "bg-violet-500";

              return (
                <div key={msg.id} className="flex items-start gap-2 max-w-[85%]">
                  <div className={`w-7 h-7 ${agentColor} rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
                    <span className="text-[10px] font-bold text-white">{agentConfig?.emoji ?? "?"}</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-sm text-zinc-600 font-medium">{msg.content}</p>
                    {msg.clarifications.map((q) => (
                      <div key={q.id} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                        <p className="text-sm font-medium text-zinc-800 mb-1">{q.question}</p>
                        {q.context && (
                          <p className="text-xs text-zinc-400 mb-3">{q.context}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={async () => {
                                try {
                                  await authFetch("/api/execution/clarifications", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ clarificationId: q.id, response: opt.value }),
                                  });
                                  // Update UI: replace this question with the selected answer
                                  setMessages(prev => prev.map(m => {
                                    if (m.id !== msg.id) return m;
                                    return {
                                      ...m,
                                      clarifications: m.clarifications?.map(c =>
                                        c.id === q.id
                                          ? { ...c, options: c.options.map(o => ({ ...o, selected: o.value === opt.value })) } as any
                                          : c
                                      ),
                                    };
                                  }));
                                } catch (err) {
                                  console.error("Failed to submit clarification:", err);
                                }
                              }}
                              disabled={(q as any).options?.some((o: any) => o.selected)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                (opt as any).selected
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white text-zinc-700 border-zinc-300 hover:border-indigo-400 hover:bg-indigo-50"
                              } disabled:opacity-60 disabled:cursor-default`}
                            >
                              {opt.label}
                              {opt.description && (
                                <span className="text-zinc-400 ml-1 font-normal">· {opt.description}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            /* ── Execution plan — visual task tree ── */
            if (msg.type === "plan" && msg.planTasks) {
              const agentId = msg.agentId ?? "strategist";
              const agentConfig = AGENT_NAMES[agentId];
              const agentColor = agentConfig?.color ?? "bg-violet-500";

              return (
                <div key={msg.id} className="flex items-start gap-2 max-w-[90%]">
                  <div className={`w-7 h-7 ${agentColor} rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
                    <span className="text-[10px] font-bold text-white">{agentConfig?.emoji ?? "?"}</span>
                  </div>
                  <div className="flex-1">
                    <AgentPlan
                      tasks={msg.planTasks}
                      isLive={activeAgents.has(agentId)}
                      compact
                    />
                  </div>
                </div>
              );
            }

            /* ── User message ── */
            if (msg.type === "user") {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="flex items-start gap-2 max-w-[80%]">
                    <div className="bg-zinc-900 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm max-w-[85%]">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {msg.attachments.map((att, i) => (
                            att.type.startsWith('image/') ? (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                                <img src={att.url} alt={att.name} className="w-20 h-20 object-cover rounded-lg border border-zinc-700 hover:opacity-80 transition-opacity" />
                              </a>
                            ) : (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs hover:bg-zinc-700 transition-colors">
                                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                                <span className="truncate max-w-[120px]">{att.name}</span>
                              </a>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-7 h-7 bg-zinc-200 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                  </div>
                </div>
              );
            }

            /* ── Routing badge — show which agent was assigned ── */
            if (msg.type === "routing") {
              const agentId = msg.agentId ?? "";
              const agentConfig = AGENT_NAMES[agentId];
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="inline-flex items-center gap-2 text-[11px] font-medium bg-zinc-50 border border-indigo-100 px-4 py-2 rounded-full">
                    {agentConfig && (
                      <span className={`w-5 h-5 ${agentConfig.color} rounded-full flex items-center justify-center text-[9px] font-bold text-white`}>
                        {agentConfig.emoji}
                      </span>
                    )}
                    <span className="text-indigo-700">{msg.content}</span>
                  </div>
                </div>
              );
            }

            /* ── Agent output ── */
            if (msg.type === "output") {
              const agentId = msg.agentId ?? "strategist";
              const initial = AGENT_NAMES[agentId]?.emoji ?? "A";
              const agentColor = AGENT_NAMES[agentId]?.color ?? "bg-emerald-500";
              const agentRole = AGENT_NAMES[agentId]?.role ?? "Agent";

              // Extract source citations and clean the content
              // Extract inline images (data:image/... URLs) and render them as actual images
              const { text: textWithoutImages, images: inlineImages } = extractInlineImages(msg.content);
              const { cleanContent, sources } = extractSourceCitations(textWithoutImages);

              // Apply connect marker parsing on the citation-cleaned content
              const contentParts = splitConnectMarkers(cleanContent);
              const detected = detectArtifacts(msg.content);
              const isDocument = detected.isReport || detected.hasTable || msg.content.length > 600;
              const proseClasses = `prose prose-sm prose-zinc max-w-none
                          prose-headings:text-zinc-900 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1.5
                          prose-h2:text-base prose-h3:text-sm
                          prose-p:text-sm prose-p:text-zinc-700 prose-p:leading-relaxed prose-p:my-1.5
                          prose-li:text-sm prose-li:text-zinc-700 prose-li:my-0.5
                          prose-strong:text-zinc-900 prose-strong:font-semibold
                          prose-blockquote:border-l-indigo-400 prose-blockquote:bg-indigo-50/50 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-3 prose-blockquote:not-italic prose-blockquote:text-zinc-700
                          prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                          prose-table:text-sm prose-th:text-left prose-th:text-zinc-600 prose-th:font-medium prose-th:pb-1 prose-td:py-1
                          prose-hr:my-3 prose-hr:border-zinc-200
                          prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline`;

              // Extract a title from the first heading or agent name
              const titleMatch = msg.content.match(/^#+\s+(.+)$/m);
              const docTitle = titleMatch?.[1] ?? `${msg.agentName ?? agentRole} Output`;

              // Gather preceding thinking/tool_use steps for this task
              const taskSteps = messages.filter(
                m => m.taskId === msg.taskId && (m.type === "thinking" || m.type === "tool_use")
              );

              return (
                <div key={msg.id} className="space-y-1">
                  {/* Thinking steps (collapsible reasoning) */}
                  {taskSteps.length > 0 && (
                    <ThinkingSteps steps={taskSteps} isComplete={true} />
                  )}

                  <div className="flex items-start gap-2">
                    <div className={`w-7 h-7 ${agentColor} rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-white`}>
                      {initial}
                    </div>
                    <div className="max-w-[85%] min-w-0">
                      <div className="text-[10px] font-mono text-zinc-400 mb-1">{msg.agentName}</div>
                      {isDocument ? (
                        /* ── Document frame (Manus-style) ── */
                        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                          {/* Document header bar */}
                          <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-zinc-100">
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-xs font-semibold text-zinc-800 truncate flex-1">{docTitle}</span>
                            <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                              {detected.hasTable ? "DATA" : "REPORT"}
                            </span>
                          </div>
                          {/* Document body */}
                          <div className="px-4 py-3">
                            <div className={proseClasses}>
                              {contentParts.map((part, idx) =>
                                part.type === "text" ? (
                                  <ReactMarkdown key={idx}>{part.value}</ReactMarkdown>
                                ) : (
                                  <div key={idx} className="my-2">
                                    <ConnectionPrompt orgId={orgId} filterServices={[part.provider]} compact={true} />
                                  </div>
                                )
                              )}
                            </div>
                            {/* Sources panel inside document */}
                            <SourcesPanel sources={sources} />
                          </div>
                          {/* Generated images */}
                          {inlineImages.length > 0 && (
                            <div className="px-4 py-3 space-y-2">
                              {inlineImages.map((src, imgIdx) => (
                                <img key={imgIdx} src={src} alt="Generated content" className="w-full max-w-md rounded-lg border border-zinc-200" />
                              ))}
                            </div>
                          )}
                          {/* Download bar */}
                          <div className="px-4 py-2 bg-zinc-50/80 border-t border-zinc-100">
                            <ArtifactDownloadBar content={msg.content} title={docTitle} />
                          </div>
                        </div>
                      ) : (
                        /* ── Regular chat bubble for short responses ── */
                        <div className="bg-white border border-zinc-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                          <div className={proseClasses}>
                            {contentParts.map((part, idx) =>
                              part.type === "text" ? (
                                <ReactMarkdown key={idx}>{part.value}</ReactMarkdown>
                              ) : (
                                <div key={idx} className="my-2">
                                  <ConnectionPrompt orgId={orgId} filterServices={[part.provider]} compact={true} />
                                </div>
                              )
                            )}
                          </div>
                          {/* Generated images */}
                          {inlineImages.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {inlineImages.map((src, imgIdx) => (
                                <img key={imgIdx} src={src} alt="Generated content" className="w-full max-w-md rounded-lg border border-zinc-200" />
                              ))}
                            </div>
                          )}
                          {/* Sources panel inside bubble */}
                          <SourcesPanel sources={sources} />
                          <ArtifactDownloadBar content={msg.content} title={docTitle} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            /* ── Error ── */
            if (msg.type === "error") {
              const errorParts = splitConnectMarkers(msg.content);
              return (
                <div key={msg.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
                      {errorParts.map((part, idx) =>
                        part.type === "text" ? (
                          <p key={idx} className="text-sm text-red-700">{part.value}</p>
                        ) : (
                          <div key={idx} className="my-2">
                            <ConnectionPrompt orgId={orgId} filterServices={[part.provider]} compact={true} />
                          </div>
                        )
                      )}
                    </div>
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

          {/* ── Wide Execution Grid ── */}
          {wideExecution && (
            <div className="my-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-zinc-800">
                  Wide Execution — {wideExecution.cards.length} items
                </span>
                {(() => {
                  const done = wideExecution.cards.filter(c => isTerminalStatus(c.status)).length;
                  const total = wideExecution.cards.length;
                  return (
                    <span className="text-[10px] font-mono text-zinc-400 ml-auto">
                      {done}/{total} complete
                    </span>
                  );
                })()}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-100 rounded-full h-1.5 mb-3">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${(wideExecution.cards.filter(c => isTerminalStatus(c.status)).length / wideExecution.cards.length) * 100}%`,
                  }}
                />
              </div>

              {/* Grid of task cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {wideExecution.cards.map((card) => {
                  const agentInfo = AGENT_NAMES[card.agentId] ?? { name: card.agentId, emoji: "?", color: "bg-zinc-500", role: "Agent" };
                  const isDone = isTerminalStatus(card.status);
                  const isFailed = card.status === "failed";
                  const isWorking = !isDone;

                  return (
                    <div
                      key={card.id}
                      className={`rounded-xl border p-3 transition-all ${
                        isFailed
                          ? "border-red-200 bg-red-50/50"
                          : isDone
                          ? "border-emerald-200 bg-emerald-50/50"
                          : "border-indigo-200 bg-indigo-50/30"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-5 h-5 rounded-md ${agentInfo.color} flex items-center justify-center text-[9px] font-bold text-white`}>
                          {agentInfo.emoji}
                        </div>
                        <span className="text-xs font-semibold text-zinc-800 truncate flex-1">
                          {card.item}
                        </span>
                        {isWorking && (
                          <Loader2 className="w-3 h-3 animate-spin text-indigo-500 shrink-0" />
                        )}
                        {isDone && !isFailed && (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                        {isFailed && (
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isFailed
                            ? "bg-red-100 text-red-700"
                            : isDone
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {isFailed ? "Failed" : isDone ? "Complete" : "Working"}
                        </span>
                        {card.toolsUsed.length > 0 && (
                          <span className="text-[9px] text-zinc-400">{card.toolsUsed.length} tools</span>
                        )}
                        {card.costCents > 0 && (
                          <span className="text-[8px] font-mono text-zinc-400 ml-auto tabular-nums">
                            ${(card.costCents / 100).toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Result preview */}
                      {card.result && (
                        <div className="mt-2 text-[11px] text-zinc-600 line-clamp-3 leading-relaxed">
                          <ReactMarkdown>{card.result.slice(0, 300)}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Expand results when all done */}
              {wideExecution.cards.every(c => isTerminalStatus(c.status)) && (
                <button
                  onClick={() => {
                    // Emit all results as output messages
                    const newMsgs: ChatMessage[] = wideExecution.cards
                      .filter(c => c.result)
                      .map(c => ({
                        id: `wide-result-${c.id}`,
                        timestamp: Date.now(),
                        type: "output" as const,
                        content: `## ${c.item}\n\n${c.result}`,
                        agentName: AGENT_NAMES[c.agentId]?.name ?? c.agentId,
                        agentId: c.agentId,
                        taskId: c.id,
                      }));
                    setMessages(prev => [...prev, ...newMsgs]);
                    setWideExecution(null);
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all"
                >
                  <FileOutput className="w-3.5 h-3.5" />
                  View all {wideExecution.cards.filter(c => c.result).length} results in chat
                </button>
              )}
            </div>
          )}

          {/* Context-aware follow-up pills after completed task */}
          {hasMessages && !sending && !activeAgents.size && (() => {
            const lastOutput = [...messages].reverse().find(m => m.type === "output" && m.agentId);
            if (!lastOutput) return null;

            const taskId = lastOutput.taskId;
            const toolsUsed = messages
              .filter(m => m.taskId === taskId && m.type === "tool_use" && m.toolName)
              .map(m => m.toolName!);

            const pills = generateContextPills(
              lastOutput.agentId ?? "strategist",
              toolsUsed,
              lastOutput.content
            );

            if (pills.length === 0) return null;

            return (
              <div className="flex flex-wrap gap-1.5 pl-9 pt-2">
                {pills.map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <button
                      key={pill.prompt}
                      onClick={() => handleSend(pill.prompt)}
                      className="flex items-center gap-1.5 text-[11px] text-zinc-600 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
                    >
                      <Icon className="w-3 h-3 text-zinc-400" />
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          <div ref={bottomRef} />
        </div>

        {/* ── Input (textarea for multiline support) ── */}
        <div className="sticky bottom-0 bg-[#F8F9FA] pt-6 pb-4 px-4">
          {/* File previews */}
          {stagedFiles.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap px-1">
              {stagedFiles.map(sf => (
                <div key={sf.id} className="relative group">
                  {sf.preview ? (
                    <img
                      src={sf.preview}
                      alt={sf.file.name}
                      className="w-16 h-16 object-cover rounded-lg border border-zinc-200 shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-zinc-100 border border-zinc-200 rounded-lg flex items-center justify-center shadow-sm">
                      <FileText className="w-5 h-5 text-zinc-400" />
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(sf.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="text-[9px] text-zinc-500 truncate w-16 mt-0.5 text-center">{sf.file.name}</div>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addFiles(e.dataTransfer.files);
            }}
            className="flex items-end gap-2 bg-white border border-zinc-200 rounded-xl shadow-sm px-3 py-2.5 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all"
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {/* Paperclip button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg disabled:opacity-30 transition-all shrink-0"
              title="Attach files (images, documents)"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (items) {
                  const imageFiles: File[] = [];
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith('image/')) {
                      const file = item.getAsFile();
                      if (file) imageFiles.push(file);
                    }
                  }
                  if (imageFiles.length > 0) {
                    const dt = new DataTransfer();
                    imageFiles.forEach(f => dt.items.add(f));
                    addFiles(dt.files);
                  }
                }
              }}
              placeholder={stagedFiles.length > 0 ? "Add a message with your files..." : "Ask me anything or give me a task..."}
              disabled={sending}
              rows={1}
              className="flex-1 text-sm bg-transparent placeholder:text-zinc-400 focus:outline-none disabled:opacity-50 resize-none max-h-32 overflow-y-auto leading-relaxed"
              style={{ minHeight: "1.5rem" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 128) + "px";
              }}
            />
            <button
              type="submit"
              disabled={sending || uploading || (!input.trim() && stagedFiles.length === 0)}
              className="w-8 h-8 flex items-center justify-center bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
            >
              {sending || uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
              7 agents · 49 tools · auto-routed · drop files to attach
            </span>
          </div>
        </div>
      </div>
      </div>{/* close main content */}
    </div>
  );
}
