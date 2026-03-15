/**
 * CodeBot — AI-Powered Code Audit & Engineering Coach
 *
 * Architecture inspired by BetterBot:
 * - Identity + Situational Awareness + Context + Rules prompt assembly
 * - JUST DO IT behavioral rules: analyze code, don't hedge
 * - Repository intelligence: languages, commit patterns, PR health, CI status
 * - Proactive alerts: stale PRs, declining velocity, test coverage drops
 * - Engineering-specific coaching with dimension awareness
 *
 * Capabilities:
 * - Initial code audit on GitHub connect
 * - PR quality reviews on webhook events
 * - Weekly engineering health summaries
 * - Developer-specific coaching on code dimensions
 */

import { GoogleGenAI } from '@google/genai';
import { auditRepository } from '@/lib/integrations/github';
import type { PermissionTier } from '@/lib/permissions';

// ── Types ──────────────────────────────────────────────────────

export interface CodeBotContext {
  orgId: string;
  tier: PermissionTier;
  userName: string;
  githubOrg?: string;
  repos?: {
    name: string;
    language: string | null;
    openPRs: number;
    recentCommits: number;
    contributors: string[];
  }[];
  repoAudit?: Awaited<ReturnType<typeof auditRepository>>;
  teamMetrics?: {
    totalCommits: number;
    totalPRsMerged: number;
    avgReviewTurnaround: number;
    ciPassRate: number;
    topContributors: { name: string; commits: number; prs: number }[];
  };
}

// ── Engineering Coaching Knowledge ─────────────────────────────

const CODE_COACHING: Record<string, {
  label: string;
  description: string;
  tips: string[];
  redFlag: string;
}> = {
  commitHygiene: {
    label: 'Commit Hygiene',
    description: 'Quality of commit messages, atomic commits, logical grouping',
    tips: [
      'Use conventional commits: feat:, fix:, refactor:, docs:, test:',
      'Each commit should do ONE thing. If the message needs "and", split it.',
      'Write commit messages in imperative mood: "Add feature" not "Added feature"',
    ],
    redFlag: 'Large commits with vague messages like "updates" or "fix stuff"',
  },
  prQuality: {
    label: 'PR Quality',
    description: 'PR size, description quality, test coverage, review readiness',
    tips: [
      'Keep PRs under 400 lines of diff. Smaller PRs get faster, better reviews.',
      'Always include a description: what changed, why, and how to test it.',
      'Add tests for the specific behavior you changed, not just coverage padding.',
      'Self-review your diff before requesting review: catch your own typos.',
    ],
    redFlag: 'PRs over 1000 lines, missing descriptions, or no tests',
  },
  reviewCulture: {
    label: 'Review Culture',
    description: 'Review speed, quality of feedback, blocking vs non-blocking',
    tips: [
      'Aim for first review within 4 hours during work hours.',
      'Distinguish between blocking comments and suggestions (use "nit:" prefix).',
      'Approve with comments rather than blocking on style preferences.',
    ],
    redFlag: 'Reviews taking >24 hours, or rubber-stamp approvals with no comments',
  },
  ciHealth: {
    label: 'CI/CD Health',
    description: 'Build pass rates, test reliability, deploy frequency',
    tips: [
      'Fix flaky tests immediately. They erode trust in CI and slow everyone down.',
      'Keep build times under 10 minutes. Long builds kill developer flow.',
      'Deploy to staging on every merge. Deploy to production at least weekly.',
    ],
    redFlag: 'CI pass rate below 85% or builds taking over 15 minutes',
  },
  codeQuality: {
    label: 'Code Quality',
    description: 'Bug introduction rate, code complexity, maintainability',
    tips: [
      'Track bugs introduced per PR. If >20% of PRs introduce bugs, slow down.',
      'Refactor as you go: boy scout rule. Leave code cleaner than you found it.',
      'Use linters and formatters as pre-commit hooks, not PR review nits.',
    ],
    redFlag: 'Rising bug count, declining test coverage, or increasing code churn',
  },
};

// ── System Prompt Builder ──────────────────────────────────────

function buildSystemPrompt(ctx: CodeBotContext, conversationLength: number): string {
  const parts: string[] = [];

  // Identity
  if (ctx.tier === 'employee') {
    parts.push(`You are CodeBot, an AI engineering coach built into Pivot.
You are helping ${ctx.userName} improve their development practices.
You analyze code activity, PR quality, and engineering metrics to give specific, actionable feedback.`);
  } else {
    parts.push(`You are CodeBot, an AI engineering intelligence agent built into Pivot.
You are advising ${ctx.userName} (${ctx.tier} access) on engineering team health.
You have visibility into all repository activity, team metrics, and code quality signals.`);
  }

  // Situational Awareness
  const now = new Date();
  parts.push(`--- Situational Awareness ---
${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}, ${now.toLocaleDateString('en-US', { weekday: 'long' })}, ${now.toISOString().slice(0, 10)}
Conversation: ${conversationLength} messages
Tier: ${ctx.tier} | User: ${ctx.userName}`);

  // Repository Context
  if (ctx.repos && ctx.repos.length > 0) {
    parts.push(`--- Repositories (${ctx.repos.length}) ---`);
    for (const repo of ctx.repos.slice(0, 10)) {
      parts.push(`${repo.name} [${repo.language ?? 'unknown'}]: ${repo.recentCommits} commits (30d), ${repo.openPRs} open PRs, ${repo.contributors.length} contributors`);
    }
  } else {
    parts.push(`--- No Repositories Connected ---
GitHub repositories have not been connected yet. When the user asks about code quality or engineering health:
1. Explain what CodeBot offers once GitHub is connected (commit velocity, PR quality, CI health, review turnaround, developer productivity, automated audits)
2. Provide general engineering best practices from the coaching reference below
3. NEVER say "I don't have", "I cannot", or "I don't know". Instead use phrases like "Once GitHub is connected, I will be able to..." or "To get started, connect your repositories..."
4. Do NOT ask clarifying questions. Give useful advice immediately based on industry best practices.`);
  }

  // Repo Audit (if available)
  if (ctx.repoAudit) {
    const a = ctx.repoAudit;
    const langs = Object.entries(a.languages).sort((x, y) => y[1] - x[1]).map(([l]) => l);
    parts.push(`--- Repository Audit: ${a.repo} ---
Languages: ${langs.join(', ')}
Open Issues: ${a.openIssues} | Open PRs: ${a.openPRs}
Recent Commits (30d): ${a.recentCommits}
Contributors: ${a.contributors.slice(0, 10).join(', ')}
Default Branch: ${a.defaultBranch}`);

    if (a.codeFrequency.length > 0) {
      const recent = a.codeFrequency.slice(-4);
      const totalAdds = recent.reduce((s, w) => s + w.additions, 0);
      const totalDels = recent.reduce((s, w) => s + w.deletions, 0);
      parts.push(`Code Velocity (last 4 weeks): +${totalAdds} / -${totalDels} lines`);
    }
  }

  // Team Metrics (leaders only)
  if (ctx.tier !== 'employee' && ctx.teamMetrics) {
    const tm = ctx.teamMetrics;
    parts.push(`--- Team Engineering Metrics ---
Total Commits (30d): ${tm.totalCommits}
PRs Merged (30d): ${tm.totalPRsMerged}
Avg Review Turnaround: ${tm.avgReviewTurnaround.toFixed(1)} hours
CI Pass Rate: ${tm.ciPassRate}%

Top Contributors:`);
    for (const c of tm.topContributors.slice(0, 10)) {
      parts.push(`  ${c.name}: ${c.commits} commits, ${c.prs} PRs merged`);
    }
  }

  // Engineering Coaching Reference
  parts.push(`--- Engineering Best Practices Reference ---`);
  for (const [, coaching] of Object.entries(CODE_COACHING)) {
    parts.push(`${coaching.label}: ${coaching.description}
  Top tip: ${coaching.tips[0]}
  Red flag: ${coaching.redFlag}`);
  }

  // Behavioral Rules
  parts.push(`--- Rules ---

JUDGMENT:
- JUST DO IT. When asked about code quality, give a direct assessment with specific examples.
- Lead with the metric, then the insight, then the action.
- Be honest about bad engineering practices. Don't sugarcoat "your CI fails 40% of the time."
- When celebrating wins (fast reviews, high coverage), connect it to what the team DID differently.

ANALYSIS STYLE:
- Use data from the repos, commits, PRs, and CI status. Never make up metrics.
- When specific data is unavailable, provide coaching and best practices based on industry benchmarks and DORA metrics. NEVER say "I don't have access" or "I cannot" - instead, work with what you have and provide value.
- For employees: if their name appears in contributors lists, attribute that repo's metrics to them. If the repo has N commits and they are one of M contributors, estimate their share.
- For code audits: focus on patterns, not individual lines. Look at architecture decisions.
- Compare team metrics against industry benchmarks (e.g. DORA metrics).

FORMAT:
- No em dashes, en dashes, or double dashes. Use ":" or plain hyphens.
- No markdown bold (**) or italic (*). Plain text only.
- Use bullet points with "-" for lists.
- Keep responses under 400 words unless specifically asked for a deep audit.
- End actionable responses with "This week:" section of 1-3 specific things to do.`);

  // Security rules for employees
  if (ctx.tier === 'employee') {
    parts.push(`--- Security ---
- You are speaking to an EMPLOYEE. Only discuss THEIR commits, PRs, and reviews.
- NEVER reveal other team members' specific metrics or rankings.
- If asked about team-wide data: "Team-level metrics are available to your engineering lead."`);
  }

  return parts.join('\n\n');
}

// ── Sanitizer ──────────────────────────────────────────────────

function sanitize(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\u2014/g, ' - ')
    .replace(/\u2013/g, ' - ')
    .replace(/---/g, ' - ')
    .replace(/--/g, ' - ')
    .trim();
}

// ── Proactive Alerts ───────────────────────────────────────────

function getCodeAlerts(ctx: CodeBotContext): string | null {
  const alerts: string[] = [];

  if (ctx.teamMetrics) {
    if (ctx.teamMetrics.ciPassRate < 85) {
      alerts.push(`ALERT: CI pass rate is ${ctx.teamMetrics.ciPassRate}% - below 85% threshold. Investigate flaky tests.`);
    }
    if (ctx.teamMetrics.avgReviewTurnaround > 24) {
      alerts.push(`WARNING: Average review turnaround is ${ctx.teamMetrics.avgReviewTurnaround.toFixed(1)} hours. Target is under 4 hours.`);
    }
  }

  if (ctx.repos) {
    const stalePRRepos = ctx.repos.filter(r => r.openPRs > 10);
    if (stalePRRepos.length > 0) {
      alerts.push(`WARNING: ${stalePRRepos.map(r => r.name).join(', ')} have 10+ open PRs. Review and close stale PRs.`);
    }
  }

  if (ctx.repoAudit) {
    if (ctx.repoAudit.openIssues > 50) {
      alerts.push(`WARNING: ${ctx.repoAudit.repo} has ${ctx.repoAudit.openIssues} open issues. Triage and prioritize.`);
    }
  }

  if (alerts.length === 0) return null;
  return `--- Proactive Engineering Alerts ---\n${alerts.join('\n')}`;
}

// ── Main Chat Function ─────────────────────────────────────────

const MAX_HISTORY = 20;

export async function chatWithCodeBot(
  context: CodeBotContext,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'model'; text: string }>,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return 'CodeBot is not available. GEMINI_API_KEY is not configured.';
  }

  const ai = new GoogleGenAI({ apiKey });
  const trimmedHistory = conversationHistory.slice(-MAX_HISTORY);
  let systemPrompt = buildSystemPrompt(context, trimmedHistory.length);

  // Inject proactive alerts
  const alerts = getCodeAlerts(context);
  if (alerts) {
    systemPrompt += '\n\n' + alerts;
  }

  const contents = [
    ...trimmedHistory.map(m => ({
      role: m.role === 'model' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.text }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: userMessage }],
    },
  ];

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 2500,
        thinkingConfig: { thinkingBudget: 0 },
      } as Record<string, unknown>,
    });

    return sanitize(resp.text ?? 'I couldn\'t generate a response. Please try again.');
  } catch (err) {
    console.error('[CodeBot] Agent error:', err);
    return 'I ran into a technical issue. Please try again in a moment.';
  }
}
