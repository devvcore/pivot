/**
 * BetterBot v2 — Per-User AI Performance Coach
 *
 * Architecture inspired by BetterBot (github.com/mylesndavid/betterbot):
 * - Identity + Situational Awareness + Context + Rules prompt assembly
 * - JUST DO IT behavioral rules: execute, don't ask
 * - Task plan injection: active goals shown as live progress tracker
 * - Score trend analysis: trajectory, not just snapshot
 * - Proactive coaching triggers: detect drops, celebrate wins
 * - Dimension-specific expertise with actionable strategies
 * - Escalation awareness: when to involve the manager
 *
 * Tier-aware: employees see only their data, leaders see everything.
 */
import { GoogleGenAI } from "@google/genai";
import type { PermissionTier } from "@/lib/permissions";
import { LoopGuard, closestToolName, smartTruncate, validateToolResult, detectVagueResponse, SPECIFICITY_NUDGE } from "./agent-guardrails";
import { getJob, listJobs } from "@/lib/job-store";
import type { MVPDeliverables } from "@/lib/types";

// ─── Conversation Memory (uses agent_memory table) ──────────────────────────

// Map coaching categories to agent_memory memory_type values
const CATEGORY_TO_TYPE: Record<string, string> = {
  commitment: "lesson",      // commitments are lessons learned
  struggle: "context",       // struggles are contextual info
  win: "lesson",             // wins are lessons to reinforce
  preference: "preference",  // direct match
  context: "context",        // direct match
};

interface BetterBotInsight {
  fact: string;
  category: string;
  createdAt: number;
}

async function loadBetterBotMemory(orgId: string, employeeId: string): Promise<BetterBotInsight[]> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("agent_memory")
      .select("content, memory_type, created_at")
      .eq("org_id", orgId)
      .eq("agent_id", `betterbot-${employeeId}`)
      .eq("expired", false)
      .order("created_at", { ascending: false })
      .limit(15);

    if (!data || data.length === 0) return [];

    return data.map(row => {
      // Try to parse the stored JSON, fall back to plain text
      try {
        const parsed = JSON.parse(row.content);
        return { fact: parsed.fact, category: parsed.category, createdAt: new Date(row.created_at).getTime() };
      } catch {
        return { fact: row.content, category: row.memory_type, createdAt: new Date(row.created_at).getTime() };
      }
    });
  } catch { return []; }
}

async function extractAndSaveBBInsights(
  orgId: string,
  employeeId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    const genai = new GoogleGenAI({ apiKey });
    const resp = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract key coaching facts from this performance coaching exchange. Only extract things worth remembering for FUTURE sessions.

USER: ${userMessage.slice(0, 500)}
COACH: ${assistantMessage.slice(0, 1000)}

Return ONLY a JSON array, or [] if nothing worth remembering:
[{"fact": "short statement", "category": "commitment|struggle|win|preference|context"}]

Rules:
- Max 2 insights per exchange
- "commitment": user agreed to do something ("I'll review PRs faster")
- "struggle": user mentioned a challenge ("meetings are eating my deep work time")
- "win": user shared a success ("I shipped 3 PRs today")
- "preference": how user wants to be coached ("give me specific numbers")
- "context": role info, team dynamics ("I just joined the backend team")
- Skip generic questions. Only save things that reveal coaching-relevant info.
- Keep facts under 80 characters`,
      config: {
        temperature: 0,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      } as Record<string, unknown>,
    });

    const text = resp.text?.trim();
    if (!text) return;

    let parsed: any[];
    try {
      parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
    } catch { return; }

    // Deduplicate against existing
    const existing = await loadBetterBotMemory(orgId, employeeId);
    const newInsights = parsed.slice(0, 2).filter((item: any) => {
      const fact = String(item.fact).toLowerCase();
      return !existing.some(old =>
        old.fact.toLowerCase().includes(fact.slice(0, 30)) ||
        fact.includes(old.fact.toLowerCase().slice(0, 30))
      );
    });

    if (newInsights.length === 0) return;

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    for (const item of newInsights) {
      const category = String(item.category);
      const memoryType = CATEGORY_TO_TYPE[category] ?? "context";
      await supabase.from("agent_memory").insert({
        org_id: orgId,
        agent_id: `betterbot-${employeeId}`,
        memory_type: memoryType,
        content: JSON.stringify({ fact: String(item.fact).slice(0, 120), category }),
        relevance_score: 1.0,
      });
    }

    console.log(`[BetterBot] Saved ${newInsights.length} coaching insight(s) for ${employeeId}`);
  } catch (e) {
    console.warn("[BetterBot] Insight extraction failed:", e);
  }
}

function formatBBInsights(insights: BetterBotInsight[]): string {
  if (!insights || insights.length === 0) return "";

  const lines = insights.slice(0, 10).map(i => {
    const age = Date.now() - i.createdAt;
    const daysAgo = Math.floor(age / (1000 * 60 * 60 * 24));
    const timeLabel = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`;
    return `- [${i.category}] ${i.fact} (${timeLabel})`;
  });

  return `\n\n--- Coaching Memory (from past sessions) ---\n${lines.join("\n")}\nUse this to follow up on commitments, check on struggles, and celebrate repeated wins.`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmployeeScoreSnapshot {
  employeeId: string;
  employeeName?: string;
  hardValue: number;
  totalCost: number;
  netValue: number;
  intangibleScore: number;
  dimensions: {
    responsiveness: number | null;
    outputVolume: number | null;
    qualitySignal: number | null;
    collaboration: number | null;
    reliability: number | null;
    managerAssessment: number | null;
  };
  roleType: string;
  confidence: string;
  rank: number;
  rankChange: number;
  scoredAt?: string;
}

export interface BetterBotContext {
  employeeId: string;
  employeeName: string;
  orgId: string;
  tier: PermissionTier;
  currentScore: EmployeeScoreSnapshot | null;
  goals: any[];
  scoreHistory: EmployeeScoreSnapshot[];
  teamScores?: EmployeeScoreSnapshot[];
}

// ─── Dimension Coaching Knowledge ────────────────────────────────────────────

const DIMENSION_COACHING: Record<string, {
  label: string;
  description: string;
  improveTips: string[];
  redFlags: string;
}> = {
  responsiveness: {
    label: "Responsiveness",
    description: "How quickly you respond to messages, requests, and reviews",
    improveTips: [
      "Set specific response windows: check Slack at 9am, 12pm, 3pm instead of reactively",
      "Use quick acknowledgment replies: 'On it, will have this by EOD' buys time without delays",
      "Prioritize PR reviews: aim for first review within 2 hours during work hours",
      "Turn off notification batching for DMs from your team during core hours",
      "Use threaded replies in Slack to keep conversations visible and show engagement",
    ],
    redFlags: "Consistently below 40 suggests messages are being missed or deprioritized",
  },
  outputVolume: {
    label: "Output Volume",
    description: "Quantity of meaningful work produced: commits, tickets closed, deals progressed",
    improveTips: [
      "Break large tasks into smaller, shippable units: ship 3 small PRs instead of 1 large one",
      "Use timeboxing: 90-minute deep work blocks with no interruptions, then a batch of messages",
      "Track your daily 'units of work' and set a minimum target (e.g. 2 merged PRs/day)",
      "Front-load the week: higher output Mon-Wed creates buffer for Thu-Fri reviews and meetings",
      "Automate repetitive tasks: scripts, templates, snippets for common patterns",
    ],
    redFlags: "Below 30 for more than 2 cycles: check for blockers, unclear requirements, or scope creep",
  },
  qualitySignal: {
    label: "Quality Signal",
    description: "Quality of output: approval rates, bug rates, rework frequency",
    improveTips: [
      "Self-review before submitting: read your own PR diff as if reviewing someone else's code",
      "Add tests for the specific behavior you changed, not just coverage numbers",
      "Create a personal checklist: common mistakes you've made before, check each one",
      "Ask for early feedback on approach before building the full solution",
      "Track your rework rate: if >20% of PRs need significant changes after review, adjust your process",
    ],
    redFlags: "Below 30 combined with high output may mean rushing: slow down, ship fewer but better",
  },
  collaboration: {
    label: "Collaboration",
    description: "Working with others: reviews given, cross-team work, helping teammates",
    improveTips: [
      "Set a daily goal: review at least 2 teammates' PRs before starting your own work",
      "Pair on complex problems: 30 minutes of pairing often saves hours of back-and-forth",
      "Share context proactively: write brief updates in team channel about what you're working on",
      "Offer help when you see someone stuck: 'I noticed your PR has been open for 2 days, need a review?'",
      "Join cross-team discussions even when not required: broader context improves your own work",
    ],
    redFlags: "Below 30 may indicate working in isolation. Even strong individual contributors need team connection",
  },
  reliability: {
    label: "Reliability",
    description: "Consistency and follow-through: on-time delivery, CI pass rates, commitments kept",
    improveTips: [
      "Estimate honestly: multiply your gut feeling by 1.5x and communicate that",
      "Track your commitments: write down what you said you'd do, check at end of day",
      "Fix CI failures immediately: don't let broken builds sit, it compounds",
      "Flag delays early: saying 'this will take 2 more days' is better than silence",
      "Build buffer into sprint commitments: commit to 80% of what you think you can do",
    ],
    redFlags: "Below 40 erodes team trust. This is often the dimension that gets people fired even with high output",
  },
  managerAssessment: {
    label: "Manager Assessment",
    description: "Your manager's evaluation of your overall performance",
    improveTips: [
      "Ask for specific feedback: 'What's the one thing I could improve that would have the biggest impact?'",
      "Share your wins: managers can't see everything, brief weekly updates help",
      "Align on priorities: make sure your top 3 priorities match what your manager expects",
      "Act on previous feedback visibly: if told to improve X, show concrete progress on X",
      "Request a regular 1:1 cadence if you don't have one: alignment prevents surprises",
    ],
    redFlags: "Below 50 is a serious signal. Request direct feedback and create a specific improvement plan",
  },
};

// ─── System Prompt Builder (BetterBot-style architecture) ────────────────────

function buildSystemPrompt(ctx: BetterBotContext, conversationLength: number): string {
  const parts: string[] = [];

  // ═══ 1. IDENTITY ═══
  if (ctx.tier === "employee") {
    parts.push(`You are BetterBot, a personal performance coach built into Pivot.
You are coaching ${ctx.employeeName}. You have deep expertise in workplace performance optimization.
You are direct, data-driven, and action-oriented. You celebrate wins and are honest about problems.`);
  } else {
    parts.push(`You are BetterBot, a team performance advisor built into Pivot.
You are advising ${ctx.employeeName} (${ctx.tier} access). You have full visibility into team data.
You are strategic, data-driven, and direct. You optimize teams, not feelings.`);
  }

  // ═══ 2. SITUATIONAL AWARENESS ═══
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dayStr = now.toLocaleDateString("en-US", { weekday: "long" });

  parts.push(`--- Situational Awareness ---
${timeStr}, ${dayStr}, ${dateStr}
Conversation: ${conversationLength} messages so far
Tier: ${ctx.tier} | Employee: ${ctx.employeeName} (${ctx.employeeId})`);

  // ═══ 3. CURRENT SCORES (with trend analysis) ═══
  if (ctx.currentScore) {
    const s = ctx.currentScore;
    const trend = analyzeTrend(ctx.scoreHistory);

    parts.push(`--- Current Performance Snapshot ---
Intangible Score: ${s.intangibleScore}/100 ${trend.direction}
Net Value: $${s.netValue.toLocaleString()}/month
Hard Value: $${s.hardValue.toLocaleString()}/month | Cost: $${s.totalCost.toLocaleString()}/month
Role: ${s.roleType} | Confidence: ${s.confidence}
Rank: #${s.rank} of team ${s.rankChange > 0 ? `(up ${s.rankChange})` : s.rankChange < 0 ? `(down ${Math.abs(s.rankChange)})` : "(unchanged)"}

Dimensions:
  Responsiveness:     ${fmtDim(s.dimensions.responsiveness)}
  Output Volume:      ${fmtDim(s.dimensions.outputVolume)}
  Quality Signal:     ${fmtDim(s.dimensions.qualitySignal)}
  Collaboration:      ${fmtDim(s.dimensions.collaboration)}
  Reliability:        ${fmtDim(s.dimensions.reliability)}
  Manager Assessment: ${fmtDim(s.dimensions.managerAssessment)}

${trend.summary}`);
  } else {
    parts.push(`--- No Scoring Data Yet ---
A scoring cycle hasn't been run yet. Provide general coaching based on industry best practices.
Focus on the 6 dimensions: responsiveness, output volume, quality, collaboration, reliability, manager assessment.`);
  }

  // ═══ 4. ACTIVE GOALS (BetterBot-style task plan injection) ═══
  if (ctx.goals.length > 0) {
    parts.push(`--- Active Goals (Task Plan) ---`);
    for (const g of ctx.goals) {
      const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
      const bar = progressBar(pct);
      const status = g.status === "completed" ? "[x]" : g.status === "active" ? "[>]" : "[ ]";
      parts.push(`${status} ${g.title} (${g.dimension}): ${bar} ${pct}% (${g.current}/${g.target})`);
    }
  }

  // ═══ 5. SCORE HISTORY ═══
  if (ctx.scoreHistory.length > 1) {
    parts.push(`--- Score History (last ${Math.min(ctx.scoreHistory.length, 5)} entries) ---`);
    for (const h of ctx.scoreHistory.slice(0, 5)) {
      const date = h.scoredAt ? new Date(h.scoredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "?";
      parts.push(`${date}: Intangible ${h.intangibleScore}/100, Net $${h.netValue.toLocaleString()}, Rank #${h.rank}`);
    }
  }

  // ═══ 6. TEAM DATA (leaders only) ═══
  if (ctx.tier !== "employee" && ctx.teamScores && ctx.teamScores.length > 0) {
    const sorted = [...ctx.teamScores].sort((a, b) => a.rank - b.rank);
    const avgIntangible = sorted.reduce((s, e) => s + e.intangibleScore, 0) / sorted.length;
    const avgNetValue = sorted.reduce((s, e) => s + e.netValue, 0) / sorted.length;
    const negativeCount = sorted.filter(e => e.netValue < 0).length;
    const measuredCount = sorted.filter(e => e.confidence === "measured").length;

    parts.push(`--- Team Overview (${sorted.length} employees) ---
Avg Intangible: ${avgIntangible.toFixed(1)}/100 | Avg Net Value: $${avgNetValue.toLocaleString()}
Negative Net Value: ${negativeCount} employees | Data Coverage: ${Math.round((measuredCount / sorted.length) * 100)}%

Leaderboard:`);
    for (const ts of sorted.slice(0, 25)) {
      const dims = ts.dimensions;
      parts.push(`  #${ts.rank} ${ts.employeeName || ts.employeeId} | ${ts.intangibleScore}/100 | $${ts.netValue.toLocaleString()} | ${ts.roleType} | ${ts.confidence}
      R:${fmtDimShort(dims.responsiveness)} O:${fmtDimShort(dims.outputVolume)} Q:${fmtDimShort(dims.qualitySignal)} C:${fmtDimShort(dims.collaboration)} Rel:${fmtDimShort(dims.reliability)} M:${fmtDimShort(dims.managerAssessment)}`);
    }
    if (sorted.length > 25) {
      parts.push(`  ... and ${sorted.length - 25} more`);
    }
  }

  // ═══ 7. DIMENSION COACHING KNOWLEDGE ═══
  parts.push(`--- Dimension Coaching Reference ---`);
  for (const [key, coaching] of Object.entries(DIMENSION_COACHING)) {
    parts.push(`${coaching.label}: ${coaching.description}
  Top tip: ${coaching.improveTips[0]}
  Red flag: ${coaching.redFlags}`);
  }

  // ═══ 8. BEHAVIORAL RULES (adapted from BetterBot) ═══
  parts.push(`--- Rules ---

JUDGMENT:
- JUST DO IT. When the user asks a question, answer it directly. Don't hedge with "would you like me to..." or "shall I elaborate?"
- Lead with the data point, then the insight, then the action. Example: "Your responsiveness dropped from 82 to 65 this cycle. This is likely because [reason]. Here are 3 things to do this week: [specific actions]"
- Be proactive: if you see a concerning trend, flag it before being asked
- Be honest about bad scores. Don't sugarcoat. But always follow criticism with a concrete improvement path
- When celebrating wins, connect it to what they DID differently, so they can repeat it

COACHING STYLE:
- One key insight per response is better than dumping everything at once
- Give specific, actionable advice tied to their actual scores and role
- Refer to dimension scores by their actual numbers, not vague descriptions
- When asked "what should I focus on?", identify the dimension with the highest weighted impact (lowest score x highest weight for their role type)
- Use the coaching reference above for dimension-specific strategies
- Track conversation: don't repeat the same advice if they already acknowledged it

ESCALATION AWARENESS:
- If reliability < 40 for 3+ cycles: recommend involving manager for a performance plan
- If all dimensions declining: suggest an honest conversation with their manager
- If intangible score drops >10 points between cycles: flag as concerning and recommend a focused improvement plan
- If intangible score drops >15 points between cycles: flag as URGENT - explicitly recommend scheduling a 1:1 with their manager to discuss performance support before it becomes a formal issue
- If net value is negative: be direct that they are currently costing more than they produce, but frame it constructively with a clear path to positive ROI
- For leaders: flag employees who need intervention vs. those who just need time. Negative net value employees need immediate action plans

FORMAT:
- No em dashes, en dashes, or double dashes. Use ":" or plain hyphens
- No markdown bold (**) or italic (*). Plain text only
- Use bullet points with "-" for lists
- Keep responses under 300 words unless specifically asked for detail
- End actionable responses with a clear "This week:" section of 1-3 specific things to do`);

  // ═══ 9. SECURITY RULES (tier-specific) ═══
  if (ctx.tier === "employee") {
    parts.push(`--- Security (CRITICAL) ---
- You are speaking to an EMPLOYEE. You can ONLY discuss THEIR performance data.
- NEVER reveal: other employees' scores, rankings, names, salary data, team financials, or org-wide metrics
- NEVER compare them to specific named colleagues
- If asked about others: "I can only help with your performance. Your manager has team-wide visibility."
- If asked about salary/finances: "That information isn't available through me. Check with your manager or HR."`);
  }

  return parts.join("\n\n");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDim(val: number | null): string {
  if (val === null) return "-- (no data)";
  if (val >= 80) return `${val} (strong)`;
  if (val >= 60) return `${val} (solid)`;
  if (val >= 40) return `${val} (needs work)`;
  return `${val} (critical)`;
}

function fmtDimShort(val: number | null): string {
  return val !== null ? String(val) : "--";
}

function progressBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return "[" + "=".repeat(Math.min(filled, 10)) + " ".repeat(Math.max(10 - filled, 0)) + "]";
}

interface TrendAnalysis {
  direction: string;
  summary: string;
}

function analyzeTrend(history: EmployeeScoreSnapshot[]): TrendAnalysis {
  if (history.length < 2) {
    return { direction: "", summary: "First score: no trend data yet." };
  }

  const current = history[0];
  const previous = history[1];
  const diff = current.intangibleScore - previous.intangibleScore;
  const netDiff = current.netValue - previous.netValue;

  const parts: string[] = [];

  if (Math.abs(diff) < 2) {
    parts.push(`Trend: Stable (${diff >= 0 ? "+" : ""}${diff.toFixed(1)} points)`);
  } else if (diff > 0) {
    parts.push(`Trend: Improving (+${diff.toFixed(1)} points)`);
  } else {
    parts.push(`Trend: Declining (${diff.toFixed(1)} points)`);
  }

  // Check which dimensions changed most
  const dimChanges: { dim: string; change: number }[] = [];
  for (const key of Object.keys(current.dimensions) as (keyof typeof current.dimensions)[]) {
    const curr = current.dimensions[key];
    const prev = previous.dimensions[key];
    if (curr !== null && prev !== null) {
      const change = curr - prev;
      if (Math.abs(change) >= 5) {
        dimChanges.push({ dim: key, change });
      }
    }
  }

  if (dimChanges.length > 0) {
    const sorted = dimChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const biggest = sorted[0];
    const label = DIMENSION_COACHING[biggest.dim]?.label || biggest.dim;
    parts.push(`Biggest change: ${label} ${biggest.change > 0 ? "+" : ""}${biggest.change} points`);
  }

  if (history.length >= 3) {
    const threeBack = history[2];
    const longDiff = current.intangibleScore - threeBack.intangibleScore;
    parts.push(`3-cycle trend: ${longDiff >= 0 ? "+" : ""}${longDiff.toFixed(1)} points`);
  }

  return {
    direction: diff > 2 ? "(trending up)" : diff < -2 ? "(trending down)" : "(stable)",
    summary: parts.join("\n"),
  };
}

// ─── Sanitizer ───────────────────────────────────────────────────────────────

function sanitize(text: string): string {
  // Preserve <!--PROJECTION:...--> , <!--NAVIGATE:...--> , and <!--FOLLOWUPS:...--> markers
  const markers: string[] = [];
  let cleaned = text.replace(/<!--(PROJECTION|NAVIGATE|FOLLOWUPS):[\s\S]*?-->/g, (match) => {
    markers.push(match);
    return `__MARKER_${markers.length - 1}__`;
  });

  cleaned = cleaned
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\u2014/g, " - ")
    .replace(/\u2013/g, " - ")
    .replace(/---/g, " - ")
    .replace(/--/g, " - ")
    .trim();

  // Restore markers
  markers.forEach((marker, i) => {
    cleaned = cleaned.replace(`__MARKER_${i}__`, marker);
  });

  return cleaned;
}

// ─── Proactive Coaching Triggers ─────────────────────────────────────────────

function getProactiveInsert(ctx: BetterBotContext): string | null {
  if (!ctx.currentScore) return null;

  const current = ctx.currentScore;
  const previous = ctx.scoreHistory.length >= 2 ? ctx.scoreHistory[1] : null;
  const triggers: string[] = [];

  // Trend-based triggers (need history)
  if (previous) {
    const scoreDiff = current.intangibleScore - previous.intangibleScore;
    if (scoreDiff <= -15) {
      triggers.push(`URGENT: Intangible score dropped ${Math.abs(scoreDiff).toFixed(1)} points since last cycle. This is a critical decline. Recommend scheduling a 1:1 with their manager to discuss support before it becomes a formal performance issue.`);
    } else if (scoreDiff <= -10) {
      triggers.push(`ALERT: Intangible score dropped ${Math.abs(scoreDiff).toFixed(1)} points since last cycle. Investigate root causes and provide focused coaching on the declining dimensions.`);
    }

    // Big score jump (celebrate)
    if (scoreDiff >= 10) {
      triggers.push(`WIN: Intangible score jumped +${scoreDiff.toFixed(1)} points! Identify what changed and reinforce it.`);
    }
  }

  // Negative net value
  if (current.netValue < 0) {
    triggers.push(`CRITICAL: Net value is negative ($${current.netValue.toLocaleString()}/month). This employee currently costs more than they produce. Build an immediate improvement plan focused on highest-impact dimensions.`);
  }

  // Rank drop
  if (current.rankChange < -3) {
    triggers.push(`ALERT: Dropped ${Math.abs(current.rankChange)} rank positions. Check which dimensions declined.`);
  }

  // Rank climb
  if (current.rankChange > 3) {
    triggers.push(`WIN: Climbed ${current.rankChange} rank positions! Highlight this achievement.`);
  }

  // Critical dimensions
  const criticalDims: string[] = [];
  for (const [key, val] of Object.entries(current.dimensions)) {
    if (val !== null && val < 30) {
      const label = DIMENSION_COACHING[key]?.label || key;
      criticalDims.push(`${label} (${val})`);
    }
  }
  if (criticalDims.length > 0) {
    triggers.push(`WARNING: ${criticalDims.length} dimensions critically low: ${criticalDims.join(", ")}. Prioritize coaching on these.`);
  }

  // Goal completions
  for (const g of ctx.goals) {
    if (g.status === "active" && g.current >= g.target) {
      triggers.push(`WIN: Goal "${g.title}" has reached its target! Suggest marking it complete and setting a stretch goal.`);
    }
  }

  if (triggers.length === 0) return null;
  return `--- Proactive Coaching Triggers ---\n${triggers.join("\n")}`;
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

const BETTERBOT_TOOLS = [
  {
    name: "get_score_details",
    description: "Get detailed scoring breakdown for a specific dimension with historical trends. Use when the user asks about a specific performance area or wants to understand why a score changed.",
    parameters: {
      type: "object" as const,
      properties: {
        dimension: {
          type: "string",
          enum: ["responsiveness", "outputVolume", "qualitySignal", "collaboration", "reliability", "managerAssessment"],
          description: "Which dimension to analyze in detail",
        },
      },
      required: ["dimension"],
    },
  },
  {
    name: "get_report_section",
    description: "Retrieve a section from the business intelligence report. Use when the user asks about business performance, revenue, customers, or any data beyond employee scoring.",
    parameters: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          description: "Report section in camelCase (e.g. hiringPlan, kpiReport, teamPerformance, healthScore, actionPlan)",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "set_improvement_goal",
    description: "Create or update a performance improvement goal for the employee. Use when the user commits to improving something specific.",
    parameters: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short goal title (e.g. 'Improve PR review time to under 2 hours')" },
        dimension: {
          type: "string",
          enum: ["responsiveness", "outputVolume", "qualitySignal", "collaboration", "reliability", "managerAssessment"],
          description: "Which dimension this goal targets",
        },
        target: { type: "number", description: "Target score (0-100)" },
      },
      required: ["title", "dimension", "target"],
    },
  },
  {
    name: "get_team_comparison",
    description: "Compare the employee's scores against team averages. Only available for leaders. Use when asked about relative performance or team standing.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

const BETTERBOT_TOOL_NAMES = BETTERBOT_TOOLS.map(t => t.name);
const MAX_TOOL_ROUNDS = 3;

// ─── Tool Execution ─────────────────────────────────────────────────────────

async function executeBetterBotTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: BetterBotContext
): Promise<string> {
  if (toolName === "get_score_details") {
    const dim = args.dimension as string;
    const coaching = DIMENSION_COACHING[dim];
    if (!coaching) return `Unknown dimension: ${dim}`;

    const currentVal = ctx.currentScore?.dimensions[dim as keyof typeof ctx.currentScore.dimensions] ?? null;

    // Build history for this dimension
    const history = ctx.scoreHistory.slice(0, 10).map(s => {
      const val = s.dimensions[dim as keyof typeof s.dimensions];
      const date = s.scoredAt ? new Date(s.scoredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "?";
      return `${date}: ${val ?? "no data"}`;
    });

    return `[Score Details: ${coaching.label}]
Current: ${currentVal !== null ? `${currentVal}/100` : "no data"}
Description: ${coaching.description}
History: ${history.length > 0 ? history.join(" | ") : "No history"}
Red flag: ${coaching.redFlags}
Top tips:
${coaching.improveTips.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;
  }

  if (toolName === "get_report_section") {
    const section = args.section as string;
    const allJobs = await listJobs();
    const job = allJobs.find(j => j.questionnaire.orgId === ctx.orgId && j.status === "completed")
      ?? allJobs.find(j => j.status === "completed");

    if (!job?.deliverables) return `No completed report found for section: ${section}`;

    const d = job.deliverables as MVPDeliverables;
    const sectionData = (d as any)[section];
    if (!sectionData) return `Section "${section}" not found. Try: hiringPlan, kpiReport, teamPerformance, healthScore, actionPlan, goalTracker`;

    let dataToSerialize = sectionData;
    if (Array.isArray(sectionData)) {
      dataToSerialize = sectionData.slice(0, 10);
    } else if (typeof sectionData === "object" && sectionData !== null) {
      dataToSerialize = { ...sectionData };
      for (const [key, val] of Object.entries(dataToSerialize)) {
        if (Array.isArray(val) && val.length > 10) {
          (dataToSerialize as any)[key] = val.slice(0, 10);
        }
      }
    }

    return `[Report Section: ${section}]\n${smartTruncate(JSON.stringify(dataToSerialize), 2000)}`;
  }

  if (toolName === "set_improvement_goal") {
    const title = args.title as string;
    const dimension = args.dimension as string;
    const target = Number(args.target ?? 70);

    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      const currentVal = ctx.currentScore?.dimensions[dimension as keyof typeof ctx.currentScore.dimensions] ?? 0;

      await supabase.from("employee_goals").insert({
        employee_id: ctx.employeeId,
        org_id: ctx.orgId,
        title,
        dimension,
        current: currentVal,
        target,
        status: "active",
      });

      return `[Goal Created] "${title}" - targeting ${target}/100 for ${dimension} (currently ${currentVal}/100)`;
    } catch (e) {
      return `Failed to create goal: ${String(e)}`;
    }
  }

  if (toolName === "get_team_comparison") {
    if (ctx.tier === "employee") {
      return "Team comparison is only available for leaders. You can only see your own performance data.";
    }

    if (!ctx.teamScores || ctx.teamScores.length === 0) {
      return "No team scoring data available yet. Run a scoring cycle first.";
    }

    const dims = ["responsiveness", "outputVolume", "qualitySignal", "collaboration", "reliability", "managerAssessment"] as const;
    const teamAvg: Record<string, number> = {};
    for (const d of dims) {
      const vals = ctx.teamScores.map(s => s.dimensions[d]).filter((v): v is number => v !== null);
      teamAvg[d] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    }

    const myScore = ctx.currentScore;
    const lines = [`[Team Comparison — ${ctx.teamScores.length} members]\n`];
    for (const d of dims) {
      const label = DIMENSION_COACHING[d]?.label ?? d;
      const myVal = myScore?.dimensions[d] ?? null;
      const avg = teamAvg[d];
      const diff = myVal !== null ? myVal - avg : null;
      lines.push(`${label}: You ${myVal ?? "??"} | Team avg ${avg}${diff !== null ? ` | ${diff >= 0 ? "+" : ""}${diff}` : ""}`);
    }

    return lines.join("\n");
  }

  return `Unknown tool: ${toolName}`;
}

// ─── Main Chat Function ─────────────────────────────────────────────────────

const MAX_HISTORY = 20;

export async function chatWithBetterBot(
  context: BetterBotContext,
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "model"; text: string }>,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "BetterBot is not available. GEMINI_API_KEY is not configured.";
  }

  const ai = new GoogleGenAI({ apiKey });

  // Build the system prompt (BetterBot-style: identity + situational + context + rules)
  const trimmedHistory = conversationHistory.slice(-MAX_HISTORY);
  let systemPrompt = buildSystemPrompt(context, trimmedHistory.length);

  // Inject proactive coaching triggers
  const proactive = getProactiveInsert(context);
  if (proactive) {
    systemPrompt += "\n\n" + proactive;
  }

  // Load and inject conversation memory from past sessions
  const bbInsights = await loadBetterBotMemory(context.orgId, context.employeeId);
  const memoryBlock = formatBBInsights(bbInsights);
  if (memoryBlock) {
    systemPrompt += memoryBlock;
  }

  // Add tool info to system prompt
  systemPrompt += `\n\n--- Tools ---
You have these tools:
- get_score_details(dimension): Deep dive into a specific scoring dimension with history and improvement tips
- get_report_section(section): Access business report data (hiringPlan, kpiReport, teamPerformance, healthScore, actionPlan, goalTracker, etc.)
- set_improvement_goal(title, dimension, target): Create a performance goal when the user commits to improving something
- get_team_comparison(): Compare scores against team averages (leaders only)

Use tools when you need data beyond what's in your context. Don't guess — look it up.`;

  // Build conversation
  const contents: Array<{ role: string; parts: any[] }> = [
    ...trimmedHistory.map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: m.text }],
    })),
    {
      role: "user" as const,
      parts: [{ text: userMessage }],
    },
  ];

  const guard = new LoopGuard();

  try {
    // Multi-turn tool loop (same pattern as Pivvy/Coach)
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const isLastRound = round === MAX_TOOL_ROUNDS - 1;

      const resp = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.35,
          maxOutputTokens: 2000,
          thinkingConfig: { thinkingBudget: 0 },
          ...(isLastRound ? {} : {
            tools: [{ functionDeclarations: BETTERBOT_TOOLS }],
            toolConfig: { functionCallingMode: "AUTO" },
          }),
        } as Record<string, unknown>,
      });

      const candidate = resp.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      const fnCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join("");

      // No tool calls — final response
      if (fnCalls.length === 0) {
        if (!textParts.trim() && round === 0) {
          console.warn(`[BetterBot] Empty response on round 0, retrying...`);
          continue;
        }

        // Quality check
        const quality = detectVagueResponse(textParts);
        if (quality.isVague && round < MAX_TOOL_ROUNDS - 1) {
          console.warn(`[BetterBot] Vague response detected (${quality.reason}), nudging...`);
          contents.push({ role: "model", parts: [{ text: textParts }] });
          contents.push({ role: "user", parts: [{ text: SPECIFICITY_NUDGE }] });
          continue;
        }

        const result = sanitize(textParts || "I couldn't generate a response. Please try again.");
        extractAndSaveBBInsights(context.orgId, context.employeeId, userMessage, result).catch(() => {});
        return result;
      }

      // Execute tool calls
      const toolResults = await Promise.all(
        fnCalls.map(async (part: any) => {
          let { name, args } = part.functionCall;

          if (!BETTERBOT_TOOL_NAMES.includes(name)) {
            const matched = closestToolName(name, BETTERBOT_TOOL_NAMES);
            if (matched) name = matched;
          }

          const guardResult = guard.check(name, args);
          if (!guardResult.allowed) {
            return { name, result: `Blocked: ${guardResult.warning}` };
          }

          const rawResult = await executeBetterBotTool(name, args as Record<string, unknown>, context);
          const validated = validateToolResult(name, String(args.dimension ?? args.section ?? ""), rawResult);
          return { name, result: validated.content };
        })
      );

      contents.push({ role: "model", parts });
      contents.push({
        role: "user",
        parts: toolResults.map(tr => ({
          functionResponse: { name: tr.name, response: { result: tr.result } },
        })),
      });

      console.log(`[BetterBot] Tool round ${round + 1}/${MAX_TOOL_ROUNDS}: used ${toolResults.map(t => t.name).join(", ")}`);
    }

    // Exhausted rounds — force text
    const finalResp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.35,
        maxOutputTokens: 2000,
        thinkingConfig: { thinkingBudget: 0 },
      } as Record<string, unknown>,
    });

    const result = sanitize(finalResp.text || "I couldn't generate a response. Please try again.");
    extractAndSaveBBInsights(context.orgId, context.employeeId, userMessage, result).catch(() => {});
    return result;
  } catch (err) {
    console.error("[BetterBot] Agent error:", err);
    return "I ran into a technical issue. Please try again in a moment.";
  }
}
