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
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\u2014/g, " - ")
    .replace(/\u2013/g, " - ")
    .replace(/---/g, " - ")
    .replace(/--/g, " - ")
    .trim();
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

  // Build conversation
  const contents = [
    ...trimmedHistory.map((m) => ({
      role: m.role === "model" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.text }],
    })),
    {
      role: "user" as const,
      parts: [{ text: userMessage }],
    },
  ];

  try {
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.35,
        maxOutputTokens: 2000,
        thinkingConfig: { thinkingBudget: 0 },
      } as Record<string, unknown>,
    });

    return sanitize(resp.text ?? "I couldn't generate a response. Please try again.");
  } catch (err) {
    console.error("[BetterBot] Agent error:", err);
    return "I ran into a technical issue. Please try again in a moment.";
  }
}
