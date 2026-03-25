# Slack BI Hub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pivot's full BI reports, execution agents, and campaign engine accessible from Slack — so users can ask questions, run agents, launch campaigns, and get proactive alerts without ever leaving Slack.

**Architecture:** Extend the existing Slack webhook (`app/api/slack/webhook/route.ts`) with an intent router that detects whether a message is a BI query, agent task, campaign command, or general question — then dispatches to the right system. Add new slash commands for reports and agents. Add rich Block Kit formatters for financial data, reports, and agent results. Add proactive Slack alerts from the monitoring system.

**Tech Stack:** Next.js, Slack Events API (existing webhook), Slack Block Kit, Gemini Flash (intent classification), existing Orchestrator + CampaignEngine + business-agent

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/slack/intent-router.ts` | **NEW** — Classify Slack messages into intents (bi_query, agent_task, campaign, report, general) |
| `lib/slack/bi-responder.ts` | **NEW** — Pull BI data from deliverables and format as Slack blocks |
| `lib/slack/agent-dispatcher.ts` | **NEW** — Route agent tasks from Slack to Orchestrator, stream results back |
| `lib/slack/report-formatter.ts` | **NEW** — Rich Block Kit formatters for full report sections |
| `app/api/slack/webhook/route.ts` | **MODIFY** — Wire intent router into DM/mention handlers, add new slash commands |
| `lib/slack/block-kit.ts` | **MODIFY** — Add formatters for financial data, agent results, campaign status |

---

### Task 1: Intent Router

**Files:**
- Create: `lib/slack/intent-router.ts`

- [ ] **Step 1: Create intent router with type definitions**

```typescript
// lib/slack/intent-router.ts

/**
 * Intent Router — Classifies Slack messages into action types.
 * Uses Gemini Flash for cheap (~$0.001) classification.
 *
 * Intents:
 * - bi_query: Questions about business data (health score, revenue, cash, etc.)
 * - agent_task: Requests to DO something (post to LinkedIn, create a doc, etc.)
 * - campaign: Campaign-related commands (launch, status, list)
 * - report: Request for a specific report section
 * - slash: Slash command shortcuts (status, pipeline, tasks, report, agents)
 * - general: General conversation (pass to Pivvy business agent)
 */

import { GoogleGenAI } from '@google/genai';

export type SlackIntent =
  | { type: 'bi_query'; section: string; question: string }
  | { type: 'agent_task'; agentId: string; taskTitle: string; taskDescription: string }
  | { type: 'campaign'; action: 'launch' | 'status' | 'list' | 'pause' | 'cancel'; templateId?: string; campaignId?: string }
  | { type: 'report'; section: string }
  | { type: 'general'; message: string };

const INTENT_PROMPT = `You are a message classifier for a business intelligence platform called Pivot.
Classify the user's message into ONE intent. Output ONLY valid JSON.

INTENTS:
1. bi_query — Questions about business data: health score, revenue, cash, burn rate, customers, KPIs, runway, pipeline, financial metrics
   → {"type":"bi_query","section":"<deliverable_key>","question":"<the question>"}
   Sections: healthScore, cashIntelligence, revenueLeakAnalysis, revenueForecast, executiveSummary, kpiReport, atRiskCustomers, budgetPlanning, pricingIntelligence, competitorAnalysis, swotAnalysis, marketIntelligence, customerSegmentation, salesPlaybook

2. agent_task — Requests to DO something: post to social media, send email, create documents, write content, research
   → {"type":"agent_task","agentId":"<agent>","taskTitle":"<short title>","taskDescription":"<full description>"}
   Agents: marketer (content/social/ads), analyst (financial analysis), researcher (market research), strategist (strategy/planning), recruiter (hiring), operator (operations/processes), codebot (github/code)

3. campaign — Campaign management: launch a product, run content calendar, start hiring pipeline
   → {"type":"campaign","action":"launch|status|list|pause|cancel","templateId":"<template_id if launching>","campaignId":"<id if managing>"}
   Templates: product-launch, content-calendar-week, hiring-pipeline, financial-review, competitor-intel

4. report — Request for a full report section to be displayed
   → {"type":"report","section":"<section_key>"}

5. general — Anything else: greetings, general questions, advice
   → {"type":"general","message":"<the message>"}

Examples:
- "what's my burn rate?" → bi_query, section: cashIntelligence
- "how's the business doing?" → bi_query, section: healthScore
- "post our Q1 results to LinkedIn" → agent_task, agentId: marketer
- "launch the product launch campaign" → campaign, action: launch, templateId: product-launch
- "show me the revenue forecast" → report, section: revenueForecast
- "hey, how are you?" → general`;

export async function classifyIntent(message: string): Promise<SlackIntent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { type: 'general', message };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Message: "${message.slice(0, 500)}"\n\nClassify:`,
      config: {
        temperature: 0,
        maxOutputTokens: 200,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: INTENT_PROMPT,
      },
    });

    const text = response.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.type) return parsed as SlackIntent;
    }
  } catch (err) {
    console.warn('[IntentRouter] Classification failed:', err instanceof Error ? err.message : err);
  }

  // Fallback: keyword-based detection
  const lower = message.toLowerCase();

  // BI query keywords
  const biKeywords: [string, string][] = [
    ['health score', 'healthScore'], ['burn rate', 'cashIntelligence'], ['runway', 'cashIntelligence'],
    ['cash', 'cashIntelligence'], ['revenue', 'revenueLeakAnalysis'], ['forecast', 'revenueForecast'],
    ['kpi', 'kpiReport'], ['at-risk', 'atRiskCustomers'], ['customer', 'atRiskCustomers'],
    ['budget', 'budgetPlanning'], ['pricing', 'pricingIntelligence'], ['competitor', 'competitorAnalysis'],
    ['swot', 'swotAnalysis'], ['pipeline', 'salesPlaybook'],
    ['how.*doing', 'healthScore'], ['how.*business', 'healthScore'],
  ];
  for (const [kw, section] of biKeywords) {
    if (new RegExp(kw, 'i').test(lower)) {
      return { type: 'bi_query', section, question: message };
    }
  }

  // Agent task keywords
  if (/post.*to.*linkedin|tweet|post.*instagram|post.*facebook|write.*blog|create.*content|send.*email/i.test(lower)) {
    return { type: 'agent_task', agentId: 'marketer', taskTitle: message.slice(0, 80), taskDescription: message };
  }
  if (/research|analyze.*market|competitor.*research/i.test(lower)) {
    return { type: 'agent_task', agentId: 'researcher', taskTitle: message.slice(0, 80), taskDescription: message };
  }

  // Campaign keywords
  if (/launch.*campaign|run.*campaign|start.*campaign/i.test(lower)) {
    const templates: [RegExp, string][] = [
      [/product.*launch/i, 'product-launch'],
      [/content.*calendar/i, 'content-calendar-week'],
      [/hiring|recruit/i, 'hiring-pipeline'],
      [/financial.*review/i, 'financial-review'],
      [/competitor.*intel/i, 'competitor-intel'],
    ];
    for (const [pat, tid] of templates) {
      if (pat.test(lower)) return { type: 'campaign', action: 'launch', templateId: tid };
    }
    return { type: 'campaign', action: 'launch' };
  }

  return { type: 'general', message };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/slack/intent-router.ts
git commit -m "feat: add Slack intent router — classifies messages into BI/agent/campaign/report/general"
```

---

### Task 2: BI Responder

**Files:**
- Create: `lib/slack/bi-responder.ts`

- [ ] **Step 1: Create BI responder that pulls from deliverables**

```typescript
// lib/slack/bi-responder.ts

/**
 * BI Responder — Pulls business intelligence data from the latest analysis
 * and formats it as rich Slack Block Kit messages.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  section, fieldsSection, divider, context, header,
  type SlackBlock,
} from './block-kit';

/**
 * Get the latest completed deliverables for an org.
 */
async function getLatestDeliverables(orgId: string): Promise<Record<string, any> | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('jobs')
    .select('results_json, questionnaire_json')
    .eq('organization_id', orgId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.results_json ?? null;
}

/**
 * Answer a BI question by pulling from deliverables.
 * Returns Block Kit blocks for a rich Slack response.
 */
export async function answerBiQuery(
  orgId: string,
  section: string,
  question: string,
): Promise<SlackBlock[]> {
  const deliverables = await getLatestDeliverables(orgId);
  if (!deliverables) {
    return [
      header('No Analysis Available'),
      { type: 'section', text: { type: 'mrkdwn', text: 'Run a full business analysis in Pivot first. Go to your dashboard and upload your business documents.' } },
    ];
  }

  const sectionData = deliverables[section];
  if (!sectionData) {
    // Try to find the closest match
    const keys = Object.keys(deliverables).filter(k => !k.startsWith('_'));
    return [
      header('Section Not Found'),
      { type: 'section', text: { type: 'mrkdwn', text: `I don't have data for "${section}". Available sections: ${keys.slice(0, 10).join(', ')}` } },
    ];
  }

  // Format based on section type
  switch (section) {
    case 'healthScore':
      return formatHealthScore(sectionData);
    case 'cashIntelligence':
      return formatCashIntelligence(sectionData);
    case 'revenueLeakAnalysis':
      return formatRevenueLeak(sectionData);
    case 'revenueForecast':
      return formatRevenueForecast(sectionData);
    case 'executiveSummary':
      return formatExecutiveSummary(sectionData);
    case 'kpiReport':
      return formatKpiReport(sectionData);
    case 'atRiskCustomers':
      return formatAtRiskCustomers(sectionData);
    default:
      return formatGenericSection(section, sectionData);
  }
}

// ── Section Formatters ─────────────────────────────────────────────────────

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatHealthScore(d: any): SlackBlock[] {
  const emoji = d.score >= 80 ? ':green_circle:' : d.score >= 60 ? ':large_yellow_circle:' : ':red_circle:';
  const blocks: SlackBlock[] = [
    header(`${emoji} Business Health: ${d.score}/100 (${d.grade})`),
    section(d.headline ?? d.summary ?? ''),
    divider(),
  ];

  if (d.dimensions?.length > 0) {
    const fields: [string, string][] = d.dimensions.map((dim: any) => [
      dim.name,
      `${dim.score}/100 (${dim.grade}) — ${dim.driver ?? ''}`,
    ]);
    blocks.push(fieldsSection(fields.slice(0, 10)));
  }

  if (d.interpretation) {
    blocks.push(context([`_${d.interpretation}_`]));
  }

  return blocks;
}

function formatCashIntelligence(d: any): SlackBlock[] {
  const blocks: SlackBlock[] = [
    header(':bank: Cash Intelligence'),
    fieldsSection([
      ['Cash Position', fmt(d.currentCashPosition ?? 0)],
      ['Runway', `${d.runwayWeeks ?? '?'} weeks`],
    ]),
    section(d.summary ?? ''),
  ];

  if (d.topRisks?.length > 0) {
    blocks.push(divider());
    blocks.push(section('*Top Risks:*\n' + d.topRisks.slice(0, 3).map((r: string, i: number) => `${i + 1}. ${r.slice(0, 200)}`).join('\n')));
  }

  if (d.recommendations?.length > 0) {
    blocks.push(divider());
    blocks.push(section('*Recommendations:*\n' + d.recommendations.slice(0, 3).map((r: string) => `• ${r.slice(0, 200)}`).join('\n')));
  }

  return blocks;
}

function formatRevenueLeak(d: any): SlackBlock[] {
  const blocks: SlackBlock[] = [
    header(':chart_with_downwards_trend: Revenue Leak Analysis'),
    fieldsSection([
      ['Total Identified', fmt(d.totalIdentified ?? 0)],
      ['Recoverable', fmt(d.totalRecoverable ?? 0)],
      ['90-Day Recovery', fmt(d.day90RecoveryProjection ?? 0)],
    ]),
    section(d.summary ?? ''),
  ];

  if (d.items?.length > 0) {
    blocks.push(divider());
    for (const item of d.items.slice(0, 3)) {
      blocks.push(section(
        `*#${item.rank} ${item.category}* — ${fmt(item.amount)}\n` +
        `${item.description?.slice(0, 200) ?? ''}\n` +
        `_Confidence: ${item.confidence} | ${item.timeline}_`
      ));
    }
  }

  return blocks;
}

function formatRevenueForecast(d: any): SlackBlock[] {
  const blocks: SlackBlock[] = [
    header(':chart_with_upwards_trend: Revenue Forecast'),
    fieldsSection([
      ['Current MRR', d.currentMRR ?? '?'],
      ['Current ARR', d.currentARR ?? '?'],
      ['Growth Rate', d.growthRate ?? '?'],
    ]),
    section(d.summary ?? ''),
  ];

  if (d.scenarios?.length > 0) {
    blocks.push(divider());
    for (const scenario of d.scenarios) {
      blocks.push(section(
        `*${scenario.name} Scenario:*\n` +
        `12-Month Revenue: ${fmt(scenario.totalRevenue12Mo ?? 0)} | ` +
        `Profit: ${fmt(scenario.totalProfit12Mo ?? 0)}` +
        (scenario.breakEvenMonth ? ` | Break-even: ${scenario.breakEvenMonth}` : '')
      ));
    }
  }

  return blocks;
}

function formatExecutiveSummary(d: any): SlackBlock[] {
  const blocks: SlackBlock[] = [
    header(':clipboard: Executive Summary'),
    section(d.fullSummary?.slice(0, 2500) ?? d.summary ?? ''),
  ];

  if (d.keyFindings?.length > 0) {
    blocks.push(divider());
    blocks.push(section('*Key Findings:*\n' + d.keyFindings.slice(0, 5).map((f: string) => `• ${f.slice(0, 200)}`).join('\n')));
  }

  if (d.criticalActions?.length > 0) {
    blocks.push(divider());
    blocks.push(section('*Critical Actions:*\n' + d.criticalActions.slice(0, 3).map((a: string) => `:rotating_light: ${a.slice(0, 200)}`).join('\n')));
  }

  return blocks;
}

function formatKpiReport(d: any): SlackBlock[] {
  const blocks: SlackBlock[] = [
    header(':bar_chart: KPI Report'),
    section(d.summary ?? ''),
  ];

  if (d.kpis?.length > 0) {
    const fields: [string, string][] = d.kpis.slice(0, 8).map((kpi: any) => {
      const emoji = kpi.status === 'on_track' ? ':white_check_mark:' : kpi.status === 'at_risk' ? ':warning:' : ':question:';
      return [
        `${emoji} ${kpi.name}`,
        `Current: ${kpi.currentValue} | Target: ${kpi.targetValue ?? 'N/A'}`,
      ];
    });
    blocks.push(fieldsSection(fields));
  }

  return blocks;
}

function formatAtRiskCustomers(d: any): SlackBlock[] {
  const blocks: SlackBlock[] = [
    header(':warning: At-Risk Customers'),
    fieldsSection([
      ['Revenue at Risk', fmt(d.totalRevenueAtRisk ?? 0)],
      ['Customers Flagged', String(d.customers?.length ?? 0)],
    ]),
    section(d.summary ?? ''),
  ];

  if (d.customers?.length > 0) {
    blocks.push(divider());
    for (const c of d.customers.slice(0, 3)) {
      blocks.push(section(
        `*${c.name}* — ${fmt(c.revenueAtRisk ?? 0)} at risk\n` +
        `Risk Score: ${c.riskScore}/100 | Churn in ~${c.daysToLikelyChurn ?? '?'} days\n` +
        `_${c.risk?.slice(0, 150) ?? ''}_`
      ));
    }
  }

  if (d.immediateAction) {
    blocks.push(divider());
    blocks.push(section(`:rotating_light: *Immediate Action:* ${d.immediateAction.slice(0, 300)}`));
  }

  return blocks;
}

function formatGenericSection(sectionKey: string, d: any): SlackBlock[] {
  const title = sectionKey.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, s => s.toUpperCase());
  const blocks: SlackBlock[] = [
    header(title),
  ];

  if (d.summary) blocks.push(section(d.summary.slice(0, 2500)));

  // Extract top-level metrics
  const metrics: [string, string][] = [];
  for (const [k, v] of Object.entries(d)) {
    if (k === 'summary' || k === 'recommendations' || k === 'items' || k.endsWith('_source') || k.startsWith('_')) continue;
    if (typeof v === 'number') metrics.push([k.replace(/([a-z])([A-Z])/g, '$1 $2'), typeof v === 'number' && v > 100 ? fmt(v) : String(v)]);
    if (typeof v === 'string' && v.length < 100 && !k.includes('summary')) metrics.push([k.replace(/([a-z])([A-Z])/g, '$1 $2'), v]);
    if (metrics.length >= 6) break;
  }
  if (metrics.length > 0) blocks.push(fieldsSection(metrics));

  // Recommendations
  if (d.recommendations?.length > 0) {
    blocks.push(divider());
    blocks.push(section('*Recommendations:*\n' + d.recommendations.slice(0, 3).map((r: string) => `• ${r.slice(0, 200)}`).join('\n')));
  }

  return blocks;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/slack/bi-responder.ts
git commit -m "feat: add BI responder — pulls report data and formats as Slack Block Kit"
```

---

### Task 3: Agent Dispatcher

**Files:**
- Create: `lib/slack/agent-dispatcher.ts`

- [ ] **Step 1: Create agent dispatcher**

```typescript
// lib/slack/agent-dispatcher.ts

/**
 * Agent Dispatcher — Routes Slack requests to execution agents.
 * Creates tasks, runs the orchestrator, and sends results back to Slack.
 */

import { Orchestrator } from '@/lib/execution/orchestrator';
import { CampaignEngine } from '@/lib/execution/campaign-engine';
import { getCampaignTemplate, listCampaignTemplates } from '@/lib/execution/campaign-templates';
import {
  section, fieldsSection, divider, context, header,
  type SlackBlock,
} from './block-kit';

/**
 * Dispatch an agent task from Slack. Creates an execution task and runs the pipeline.
 * Returns Block Kit blocks with the result.
 */
export async function dispatchAgentTask(
  orgId: string,
  agentId: string,
  taskTitle: string,
  taskDescription: string,
): Promise<SlackBlock[]> {
  const orchestrator = new Orchestrator();

  try {
    // Create and run task
    const task = await orchestrator.submitTask({
      orgId,
      title: taskTitle,
      description: taskDescription,
      agentId,
      priority: 'medium',
      acceptanceCriteria: [],
      maxAttempts: 3,
      costCeiling: 2.0,
    });

    const result = await orchestrator.runPipeline(task.id);

    if (result.status === 'completed' && result.result) {
      const blocks: SlackBlock[] = [
        header(`:white_check_mark: ${agentId.charAt(0).toUpperCase() + agentId.slice(1)} — Done`),
        section(result.result.slice(0, 2800)),
      ];

      if (result.artifacts?.length) {
        blocks.push(divider());
        blocks.push(context([`${result.artifacts.length} artifact(s) generated — view in Pivot dashboard`]));
      }

      blocks.push(context([`Cost: $${result.costSpent?.toFixed(4) ?? '?'} | Task: ${task.id.slice(0, 8)}`]));

      return blocks;
    }

    return [
      header(`:x: Task Failed`),
      section(result.reviewFeedback ?? result.result ?? 'The agent could not complete this task.'),
      context([`Task: ${task.id.slice(0, 8)}`]),
    ];
  } catch (err) {
    return [
      header(':x: Error'),
      section(`Failed to run agent: ${err instanceof Error ? err.message : String(err)}`),
    ];
  }
}

/**
 * Handle campaign commands from Slack.
 */
export async function handleCampaignCommand(
  orgId: string,
  action: 'launch' | 'status' | 'list' | 'pause' | 'cancel',
  templateId?: string,
  campaignId?: string,
): Promise<SlackBlock[]> {
  const engine = new CampaignEngine();

  try {
    switch (action) {
      case 'launch': {
        if (!templateId) {
          // Show available templates
          const templates = listCampaignTemplates();
          return [
            header(':rocket: Available Campaign Templates'),
            ...templates.map(t => section(
              `*${t.name}*\n${t.description}\n_${t.steps.length} steps · ${t.estimatedDuration} · Category: ${t.category}_\n` +
              `Launch with: \`@Pivot launch ${t.id} campaign\``
            )),
          ];
        }

        const template = getCampaignTemplate(templateId);
        if (!template) {
          return [section(`:x: Template "${templateId}" not found. Use \`@Pivot launch campaign\` to see available templates.`)];
        }

        const campaign = await engine.createCampaign(orgId, template.name, template.steps, {
          description: template.description,
          templateId,
          triggerType: 'manual',
        });

        // Start running in background
        engine.runCampaign(campaign.id).catch(err =>
          console.error(`[Campaign] ${campaign.id} failed:`, err)
        );

        return [
          header(`:rocket: Campaign Launched: ${template.name}`),
          section(`${template.description}\n\n*Steps:*\n` +
            template.steps.map((s, i) => `${i + 1}. ${s.title} _(${s.agentId})_`).join('\n')
          ),
          divider(),
          context([`Campaign ID: ${campaign.id.slice(0, 8)} · ${template.steps.length} steps · Est. ${template.estimatedDuration}`]),
        ];
      }

      case 'list': {
        const campaigns = await engine.listCampaigns(orgId);
        if (campaigns.length === 0) {
          return [section('No campaigns found. Launch one with `@Pivot launch campaign`')];
        }
        return [
          header(':clipboard: Your Campaigns'),
          ...campaigns.slice(0, 5).map(c => section(
            `*${c.title}* — ${c.status}\n` +
            `Progress: ${c.completedSteps}/${c.totalSteps} steps · Started: ${c.startedAt ? new Date(c.startedAt).toLocaleDateString() : 'Not started'}`
          )),
        ];
      }

      case 'status': {
        if (!campaignId) {
          // Show latest campaign
          const campaigns = await engine.listCampaigns(orgId);
          const latest = campaigns.find(c => c.status === 'running') ?? campaigns[0];
          if (!latest) return [section('No campaigns found.')];
          campaignId = latest.id;
        }

        const result = await engine.getCampaign(campaignId);
        if (!result) return [section(':x: Campaign not found.')];

        const { campaign, steps } = result;
        return [
          header(`${campaign.status === 'running' ? ':hourglass_flowing_sand:' : ':white_check_mark:'} ${campaign.title}`),
          fieldsSection([
            ['Status', campaign.status],
            ['Progress', `${campaign.completedSteps}/${campaign.totalSteps}`],
          ]),
          divider(),
          ...steps.map(s => {
            const emoji = s.status === 'completed' ? ':white_check_mark:' :
              s.status === 'running' ? ':hourglass_flowing_sand:' :
              s.status === 'failed' ? ':x:' : ':black_small_square:';
            return section(`${emoji} Step ${s.stepOrder}: ${s.title} _(${s.agentId})_ — ${s.status}`);
          }),
        ];
      }

      case 'pause':
      case 'cancel': {
        if (!campaignId) {
          const campaigns = await engine.listCampaigns(orgId);
          const running = campaigns.find(c => c.status === 'running');
          if (!running) return [section('No running campaign to ' + action + '.')];
          campaignId = running.id;
        }
        if (action === 'pause') await engine.pauseCampaign(campaignId);
        else await engine.cancelCampaign(campaignId);
        return [section(`:${action === 'pause' ? 'pause_button' : 'octagonal_sign'}: Campaign ${action}${action === 'cancel' ? 'l' : ''}ed.`)];
      }

      default:
        return [section('Unknown campaign action.')];
    }
  } catch (err) {
    return [section(`:x: Campaign error: ${err instanceof Error ? err.message : String(err)}`)];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/slack/agent-dispatcher.ts
git commit -m "feat: add Slack agent dispatcher — routes tasks to orchestrator and campaigns"
```

---

### Task 4: Wire Intent Router into Webhook

**Files:**
- Modify: `app/api/slack/webhook/route.ts`

- [ ] **Step 1: Add intent-based routing to handleDirectMessage and handleAppMention**

In the `handleDirectMessage` function (around line 140), replace the direct `runBusinessAgent` call with intent routing:

```typescript
// REPLACE the try block (lines 141-175) with:
try {
  const { classifyIntent } = await import('@/lib/slack/intent-router');
  const intent = await classifyIntent(text);

  let reply: string;
  let blocks: SlackBlock[] | null = null;

  switch (intent.type) {
    case 'bi_query': {
      const { answerBiQuery } = await import('@/lib/slack/bi-responder');
      blocks = await answerBiQuery(orgId, intent.section, intent.question);
      reply = ''; // blocks handle the response
      break;
    }
    case 'agent_task': {
      // Send immediate acknowledgment
      await sendSlackText(orgId, channel, `:hourglass_flowing_sand: Running ${intent.agentId} agent: "${intent.taskTitle}"...`, threadTs);
      const { dispatchAgentTask } = await import('@/lib/slack/agent-dispatcher');
      blocks = await dispatchAgentTask(orgId, intent.agentId, intent.taskTitle, intent.taskDescription);
      reply = '';
      break;
    }
    case 'campaign': {
      const { handleCampaignCommand } = await import('@/lib/slack/agent-dispatcher');
      blocks = await handleCampaignCommand(orgId, intent.action, intent.templateId, intent.campaignId);
      reply = '';
      break;
    }
    case 'report': {
      const { answerBiQuery } = await import('@/lib/slack/bi-responder');
      blocks = await answerBiQuery(orgId, intent.section, `Show me the ${intent.section}`);
      reply = '';
      break;
    }
    case 'general':
    default: {
      // Fall through to Pivvy business agent (existing behavior)
      const { runBusinessAgent } = await import('@/lib/agent/business-agent');
      const chatMessages = updatedHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: parseFloat(m.ts) * 1000 || Date.now(),
      }));
      const result = await runBusinessAgent({
        orgId,
        messages: chatMessages.slice(0, -1),
        message: text,
      });
      reply = result.message ?? "I couldn't process that. Try asking about your business data.";
      blocks = formatPivvyResponse(reply);
    }
  }

  if (blocks && blocks.length > 0) {
    const fallback = blocksToFallbackText(blocks);
    await sendSlackBlocks(orgId, channel, blocks, fallback, threadTs);
  } else if (reply) {
    await sendSlackText(orgId, channel, reply, threadTs);
  }

  // Save conversation
  const replyText = blocks ? blocksToFallbackText(blocks) : reply;
  await saveConversation(orgId, channel, threadTs, slackUserId, [
    ...updatedHistory,
    { role: 'assistant' as const, content: replyText, ts: String(Date.now() / 1000) },
  ]);

  // Run incremental processing
  runIncrementalProcessing(orgId, text, slackUserId, channel).catch(() => {});
} catch (err) {
  console.error('[Slack DM] Error:', err);
  await sendSlackText(orgId, channel, 'Sorry, I ran into an issue. Please try again.', threadTs);
}
```

Do the same pattern for `handleAppMention` — replace its try block with the same intent routing logic.

- [ ] **Step 2: Add new slash commands**

In the `handleSlashCommand` function (around line 365), add these new commands before the default help block:

```typescript
  if (text === 'report' || text === 'summary') {
    processSlashReport(orgId, responseUrl).catch(err =>
      console.error('[Slash] report error:', err)
    );
    return NextResponse.json({
      response_type: 'ephemeral',
      text: ':hourglass_flowing_sand: Generating executive summary...',
    });
  }

  if (text.startsWith('ask ')) {
    const question = text.slice(4).trim();
    processSlashAsk(orgId, question, responseUrl).catch(err =>
      console.error('[Slash] ask error:', err)
    );
    return NextResponse.json({
      response_type: 'ephemeral',
      text: ':hourglass_flowing_sand: Looking into that...',
    });
  }

  if (text === 'campaigns') {
    processSlashCampaigns(orgId, responseUrl).catch(err =>
      console.error('[Slash] campaigns error:', err)
    );
    return NextResponse.json({
      response_type: 'ephemeral',
      text: ':hourglass_flowing_sand: Loading campaigns...',
    });
  }

  if (text === 'agents') {
    return NextResponse.json({
      response_type: 'ephemeral',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Available Agents', emoji: true } },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              ':mega: *Marketer (Maven)* — Content, social media, ads, email campaigns',
              ':chart_with_upwards_trend: *Analyst (Quant)* — Financial analysis, budgets, projections',
              ':mag: *Researcher (Lens)* — Market research, competitors, trends',
              ':chess_pawn: *Strategist (Atlas)* — Strategy, planning, coordination',
              ':briefcase: *Recruiter (Scout)* — Hiring, job posts, interviews',
              ':gear: *Operator (Forge)* — SOPs, project plans, processes',
              ':computer: *Codebot (Dev)* — GitHub, code review, CI/CD',
              '',
              'DM or @mention me to use any agent!',
              'Example: _"Post our Q1 results to LinkedIn"_ → Marketer runs it',
            ].join('\n'),
          },
        },
      ],
    });
  }
```

- [ ] **Step 3: Add the processor functions**

Add these functions after the existing slash command processors:

```typescript
async function processSlashReport(orgId: string, responseUrl: string): Promise<void> {
  try {
    const { answerBiQuery } = await import('@/lib/slack/bi-responder');
    const blocks = await answerBiQuery(orgId, 'executiveSummary', 'Show full executive summary');
    await sendSlashResponse(responseUrl, {
      response_type: 'ephemeral',
      blocks,
      text: blocksToFallbackText(blocks),
    });
  } catch (err) {
    console.error('[Slash Report] Error:', err);
    await sendSlashResponse(responseUrl, { response_type: 'ephemeral', text: 'Failed to load report.' });
  }
}

async function processSlashAsk(orgId: string, question: string, responseUrl: string): Promise<void> {
  try {
    const { classifyIntent } = await import('@/lib/slack/intent-router');
    const intent = await classifyIntent(question);

    let blocks: SlackBlock[];
    if (intent.type === 'bi_query') {
      const { answerBiQuery } = await import('@/lib/slack/bi-responder');
      blocks = await answerBiQuery(orgId, intent.section, intent.question);
    } else {
      // Run through Pivvy for general questions
      const { runBusinessAgent } = await import('@/lib/agent/business-agent');
      const result = await runBusinessAgent({ orgId, messages: [], message: question });
      blocks = formatPivvyResponse(result.message ?? 'No answer available.');
    }

    await sendSlashResponse(responseUrl, {
      response_type: 'ephemeral',
      blocks,
      text: blocksToFallbackText(blocks),
    });
  } catch (err) {
    console.error('[Slash Ask] Error:', err);
    await sendSlashResponse(responseUrl, { response_type: 'ephemeral', text: 'Failed to answer question.' });
  }
}

async function processSlashCampaigns(orgId: string, responseUrl: string): Promise<void> {
  try {
    const { handleCampaignCommand } = await import('@/lib/slack/agent-dispatcher');
    const blocks = await handleCampaignCommand(orgId, 'list');
    await sendSlashResponse(responseUrl, {
      response_type: 'ephemeral',
      blocks,
      text: blocksToFallbackText(blocks),
    });
  } catch (err) {
    console.error('[Slash Campaigns] Error:', err);
    await sendSlashResponse(responseUrl, { response_type: 'ephemeral', text: 'Failed to load campaigns.' });
  }
}
```

- [ ] **Step 4: Update the help text**

In the default help block (around line 418), add the new commands:

```typescript
text: [
  '`/pivot status` - Business health summary (score, runway, risks)',
  '`/pivot pipeline` - CRM pipeline overview (stages, values, win rate)',
  '`/pivot tasks` - Open tickets count by status',
  '`/pivot report` - Full executive summary',
  '`/pivot ask [question]` - Ask anything about your business data',
  '`/pivot campaigns` - List active campaigns',
  '`/pivot agents` - See available AI agents',
  '',
  'You can also DM me directly or @mention me in any channel!',
  'Try: _"what\'s my burn rate?"_ or _"post to LinkedIn"_ or _"launch product launch campaign"_',
].join('\n'),
```

- [ ] **Step 5: Commit**

```bash
git add app/api/slack/webhook/route.ts
git commit -m "feat: wire intent router into Slack webhook — BI queries, agent tasks, campaigns from Slack"
```

---

### Task 5: Proactive Slack Alerts

**Files:**
- Modify: `lib/execution/proactive-monitor.ts` (add Slack notification)
- Modify: `app/api/cron/proactive-check/route.ts` (send alerts to Slack)

- [ ] **Step 1: Add Slack notification to proactive monitor**

Read `lib/execution/proactive-monitor.ts` and find where alerts with outcome 'ACT' are processed. Add a function to send ACT alerts to Slack:

```typescript
// Add to proactive-monitor.ts or create lib/slack/proactive-alerts.ts

export async function sendProactiveAlertToSlack(
  orgId: string,
  alert: { type: string; title: string; message: string; severity: string },
): Promise<void> {
  // Check if org has Slack connected
  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from('slack_bot_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (!settings) return; // No Slack configured

  // Find the best channel to post to (first monitored channel, or a default)
  const channel = settings.monitored_channels?.[0];
  if (!channel) return;

  const emoji = alert.severity === 'critical' ? ':rotating_light:' :
    alert.severity === 'warning' ? ':warning:' : ':information_source:';

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `${emoji} ${alert.title}`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: alert.message.slice(0, 2500) } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `_Proactive alert · ${alert.type} · ${new Date().toLocaleString()}_` }] },
  ];

  // Send via Slack API
  const token = process.env.SLACK_APP_TOKEN;
  if (token) {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, blocks, text: `${emoji} ${alert.title}: ${alert.message.slice(0, 200)}` }),
    });
  }
}
```

- [ ] **Step 2: Wire into the proactive check cron**

In `app/api/cron/proactive-check/route.ts`, after alerts are classified as ACT, call the Slack sender.

- [ ] **Step 3: Commit**

```bash
git add lib/slack/proactive-alerts.ts app/api/cron/proactive-check/route.ts
git commit -m "feat: proactive Slack alerts — ACT-severity alerts posted to monitored channels"
```

---

### Task 6: Test Script

**Files:**
- Create: `scripts/test-slack-bi-hub.ts`

- [ ] **Step 1: Create test script**

```typescript
// scripts/test-slack-bi-hub.ts

import { classifyIntent } from '../lib/slack/intent-router';

const results: { name: string; pass: boolean }[] = [];

async function test(name: string, fn: () => Promise<boolean>) {
  try {
    const pass = await fn();
    results.push({ name, pass });
    console.log(`${pass ? '✓' : '✗'} ${name}`);
  } catch (err) {
    results.push({ name, pass: false });
    console.log(`✗ ${name}: ${err}`);
  }
}

async function main() {
  console.log('=== Slack BI Hub Tests ===\n');

  // Intent Router tests (keyword fallback — no API key needed)
  await test('health query → bi_query', async () => {
    const r = await classifyIntent("what's my health score?");
    return r.type === 'bi_query';
  });

  await test('burn rate → cashIntelligence', async () => {
    const r = await classifyIntent("what's my burn rate?");
    return r.type === 'bi_query' && (r as any).section === 'cashIntelligence';
  });

  await test('post to LinkedIn → agent_task', async () => {
    const r = await classifyIntent("post our Q1 results to LinkedIn");
    return r.type === 'agent_task';
  });

  await test('launch campaign → campaign', async () => {
    const r = await classifyIntent("launch the product launch campaign");
    return r.type === 'campaign';
  });

  await test('greeting → general', async () => {
    const r = await classifyIntent("hey how are you");
    return r.type === 'general';
  });

  await test('revenue question → bi_query', async () => {
    const r = await classifyIntent("how much revenue did we make?");
    return r.type === 'bi_query';
  });

  await test('competitor question → bi_query', async () => {
    const r = await classifyIntent("who are our competitors?");
    return r.type === 'bi_query' && (r as any).section === 'competitorAnalysis';
  });

  await test('send email → agent_task', async () => {
    const r = await classifyIntent("send an email to the team about the Q1 results");
    return r.type === 'agent_task';
  });

  console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
}

main().catch(console.error);
```

- [ ] **Step 2: Run tests**

Run: `GEMINI_API_KEY= npx tsx scripts/test-slack-bi-hub.ts`
(Empty GEMINI_API_KEY forces keyword fallback mode)
Expected: 8/8 passed

- [ ] **Step 3: Commit**

```bash
git add scripts/test-slack-bi-hub.ts
git commit -m "test: add Slack BI Hub test suite — intent router keyword fallback tests"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1. Intent Router | Classify messages → BI/agent/campaign/report/general | `lib/slack/intent-router.ts` |
| 2. BI Responder | Pull report data → rich Slack blocks | `lib/slack/bi-responder.ts` |
| 3. Agent Dispatcher | Route to orchestrator + campaign engine | `lib/slack/agent-dispatcher.ts` |
| 4. Webhook Wiring | Connect intent router to DM/mention/slash | `app/api/slack/webhook/route.ts` |
| 5. Proactive Alerts | ACT alerts → Slack channel | `lib/slack/proactive-alerts.ts` |
| 6. Tests | Intent classification tests | `scripts/test-slack-bi-hub.ts` |

**New files:** 4 | **Modified files:** 2 | **New slash commands:** `/pivot report`, `/pivot ask`, `/pivot campaigns`, `/pivot agents`
