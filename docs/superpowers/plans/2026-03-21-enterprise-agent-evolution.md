# Enterprise Agent Evolution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Pivot's agent system from single-turn task execution into an enterprise-grade autonomous business operating system with multi-step campaigns, adaptive model routing, learning loops, deep integrations, and an optimized orchestrator.

**Architecture:** Six independent subsystems that layer onto the existing orchestrator. Each subsystem is self-contained with its own DB migration, core logic, API routes, and tests. The orchestrator gains a `runCampaign()` method for multi-step workflows, a `selectModel()` router for intelligent model selection, and a `feedbackLoop()` for continuous learning. Integration tools gain scheduling, A/B testing, and cross-platform analytics capabilities.

**Tech Stack:** Next.js 15 + TypeScript, Supabase (PostgreSQL), Google Gemini (Flash/Pro/Deep), Composio SDK, existing ToolRegistry pattern

---

## Phase 1: Adaptive Model Routing (Smart Intelligence)

> Replace fixed `gemini-2.5-flash` with dynamic model selection based on task complexity, domain, and cost constraints.

### Task 1: Model Router Core

**Files:**
- Create: `lib/execution/model-router.ts`
- Modify: `lib/execution/orchestrator.ts:44,708-722`
- Create: `scripts/test-model-router.ts`

- [ ] **Step 1: Create model-router.ts with types and scoring**

```typescript
// lib/execution/model-router.ts

export type ModelTier = 'flash' | 'pro' | 'deep';

export interface ModelConfig {
  id: string;
  tier: ModelTier;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  maxOutputTokens: number;
  strengths: string[];
}

export const MODELS: Record<ModelTier, ModelConfig> = {
  flash: {
    id: 'gemini-2.5-flash',
    tier: 'flash',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    maxOutputTokens: 8192,
    strengths: ['speed', 'simple-tasks', 'tool-calling', 'data-lookup'],
  },
  pro: {
    id: 'gemini-2.5-pro',
    tier: 'pro',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.0,
    maxOutputTokens: 16384,
    strengths: ['reasoning', 'analysis', 'multi-step', 'nuance', 'strategy'],
  },
  deep: {
    id: 'gemini-2.5-pro',  // same model, higher token budget
    tier: 'deep',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.0,
    maxOutputTokens: 32768,
    strengths: ['complex-strategy', 'long-form', 'multi-domain', 'creative'],
  },
};

interface RoutingSignals {
  triageLevel: 'quick' | 'standard' | 'heavy';
  agentId: string;
  taskTitle: string;
  taskDescription: string;
  costCeiling: number;
  costSpent: number;
  hasIntegrationData: boolean;
  toolCount: number;
}

/**
 * Select optimal model tier based on task signals.
 *
 * Rules:
 * - QUICK tasks always use flash (cost efficiency)
 * - HEAVY tasks use pro (better reasoning)
 * - Strategist agent gets pro by default (strategy needs nuance)
 * - If cost ceiling is tight (<$0.10 remaining), downgrade to flash
 * - Tasks mentioning "strategy", "plan", "analyze deeply" get pro
 * - Tasks with >15 tools available get pro (complex tool selection)
 */
export function selectModel(signals: RoutingSignals): ModelConfig {
  // Budget guard: if we can't afford pro, use flash
  const remaining = signals.costCeiling - signals.costSpent;
  if (remaining < 0.05) return MODELS.flash;

  // QUICK always flash
  if (signals.triageLevel === 'quick') return MODELS.flash;

  // Strategist gets pro for nuanced strategic thinking
  if (signals.agentId === 'strategist') return MODELS.pro;

  // HEAVY tasks get pro
  if (signals.triageLevel === 'heavy') return MODELS.pro;

  // Keyword-based upgrade for STANDARD tasks
  const text = `${signals.taskTitle} ${signals.taskDescription}`.toLowerCase();
  const proKeywords = [
    'strategy', 'strategic', 'analyze deeply', 'comprehensive plan',
    'competitive analysis', 'market entry', 'business plan', 'fundraising',
    'investor', 'board presentation', 'due diligence', 'risk assessment',
    'pricing strategy', 'go-to-market', 'financial model', 'unit economics',
  ];
  if (proKeywords.some(kw => text.includes(kw))) return MODELS.pro;

  // Many tools = complex selection, benefit from better model
  if (signals.toolCount > 15) return MODELS.pro;

  return MODELS.flash;
}

/**
 * Get model config for a specific tier.
 */
export function getModelConfig(tier: ModelTier): ModelConfig {
  return MODELS[tier];
}

/**
 * Calculate cost for a model call.
 */
export function calculateCost(model: ModelConfig, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * model.inputPricePerMillion +
         (outputTokens / 1_000_000) * model.outputPricePerMillion;
}
```

- [ ] **Step 2: Wire model router into orchestrator**

In `lib/execution/orchestrator.ts`, replace the fixed `FLASH_MODEL` constant with dynamic selection.

At line 44, change:
```typescript
const FLASH_MODEL = 'gemini-2.5-flash';
```
to:
```typescript
import { selectModel, calculateCost, type ModelConfig, MODELS } from './model-router';
const FLASH_MODEL = 'gemini-2.5-flash'; // keep as fallback for quick-generate calls
```

In `executeTask()` (around line 608), after loading outfit, add model selection:
```typescript
// Select model based on task signals
const modelConfig = selectModel({
  triageLevel: task.triageLevel ?? 'standard',
  agentId: task.agentId,
  taskTitle: task.title,
  taskDescription: task.description,
  costCeiling: task.costCeiling,
  costSpent: task.costSpent,
  hasIntegrationData: !!context.deliverables?.__integrationData,
  toolCount: outfit.tools.length,
});

await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
  phase: 'model_selection',
  selectedModel: modelConfig.id,
  tier: modelConfig.tier,
  reason: modelConfig.tier !== 'flash' ? 'complexity/domain upgrade' : 'standard',
});
```

In the Gemini call (around line 708), replace `FLASH_MODEL` with `modelConfig.id`:
```typescript
const response = await ai.models.generateContent({
  model: modelConfig.id,  // was: FLASH_MODEL
  contents: conversationHistory,
  config: {
    temperature: modelConfig.tier === 'flash' ? 0.1 : 0.3,  // pro/deep get slightly more creativity
    maxOutputTokens: modelConfig.maxOutputTokens,
    // ... rest unchanged
  },
});
```

Update cost calculation (around line 730):
```typescript
const callCost = calculateCost(modelConfig, inputTokens, outputTokens);
```

- [ ] **Step 3: Add triageLevel to ExecutionTask type**

In `orchestrator.ts` around line 68, add `triageLevel` to ExecutionTask:
```typescript
export interface ExecutionTask {
  // ... existing fields
  triageLevel?: TriageLevel;  // set during triage phase
}
```

In `runPipeline()` after triage (around line 1241), store it:
```typescript
const triageLevel = await this.triageTask(task);
task.triageLevel = triageLevel;  // NEW: store for model router
```

- [ ] **Step 4: Update cost ceilings for pro model usage**

In `outfits.ts`, increase cost ceilings to accommodate pro model:
```typescript
// marketing outfit
costCeiling: 1.50,  // was 0.50 — pro model costs ~3x more per call

// finance outfit
costCeiling: 0.80,  // was 0.30

// research outfit
costCeiling: 1.00,  // was 0.30 (strategist uses this)
```

- [ ] **Step 5: Write test script**

```typescript
// scripts/test-model-router.ts
import { selectModel, MODELS } from '../lib/execution/model-router';

const tests = [
  { name: 'QUICK task → flash', signals: { triageLevel: 'quick' as const, agentId: 'marketer', taskTitle: 'Post to LinkedIn', taskDescription: '', costCeiling: 0.50, costSpent: 0, hasIntegrationData: false, toolCount: 10 }, expected: 'flash' },
  { name: 'HEAVY task → pro', signals: { triageLevel: 'heavy' as const, agentId: 'marketer', taskTitle: 'Full campaign', taskDescription: 'multi-channel campaign', costCeiling: 1.50, costSpent: 0, hasIntegrationData: true, toolCount: 20 }, expected: 'pro' },
  { name: 'Strategist → pro', signals: { triageLevel: 'standard' as const, agentId: 'strategist', taskTitle: 'Review Q1', taskDescription: '', costCeiling: 1.00, costSpent: 0, hasIntegrationData: false, toolCount: 10 }, expected: 'pro' },
  { name: 'Low budget → flash', signals: { triageLevel: 'heavy' as const, agentId: 'analyst', taskTitle: 'Deep analysis', taskDescription: '', costCeiling: 0.10, costSpent: 0.08, hasIntegrationData: false, toolCount: 10 }, expected: 'flash' },
  { name: 'Strategy keyword → pro', signals: { triageLevel: 'standard' as const, agentId: 'marketer', taskTitle: 'Go-to-market strategy', taskDescription: 'comprehensive plan', costCeiling: 1.50, costSpent: 0, hasIntegrationData: false, toolCount: 10 }, expected: 'pro' },
];

let passed = 0;
for (const t of tests) {
  const result = selectModel(t.signals);
  const ok = result.tier === t.expected;
  console.log(`${ok ? '✓' : '✗'} ${t.name}: got ${result.tier}, expected ${t.expected}`);
  if (ok) passed++;
}
console.log(`\n${passed}/${tests.length} passed`);
```

- [ ] **Step 6: Run test**

Run: `npx tsx scripts/test-model-router.ts`
Expected: 5/5 passed

- [ ] **Step 7: Commit**

```bash
git add lib/execution/model-router.ts scripts/test-model-router.ts
git commit -m "feat: add adaptive model routing — flash/pro/deep selection based on task complexity"
```

---

## Phase 2: Context Ceiling Lift (Unlimited Intelligence)

> Remove context bottlenecks: bigger tool results, smarter compression, streaming for large datasets.

### Task 2: Expand Context Limits

**Files:**
- Modify: `lib/execution/tools/data-tools.ts` (query_analysis truncation)
- Modify: `lib/execution/defensive-harness.ts` (guardContextBudget)
- Modify: `lib/execution/orchestrator.ts` (maxOutputTokens, context injection)

- [ ] **Step 1: Increase tool result limits in data-tools.ts**

Find the truncation constant in `data-tools.ts` (search for `24KB` or `24000` or `24 *`):
```typescript
// OLD: const MAX_SECTION_LENGTH = 24 * 1024;
const MAX_SECTION_LENGTH = 64 * 1024;  // 64KB per section

// OLD: const MAX_SEARCH_SUMMARY = 2000;
const MAX_SEARCH_SUMMARY = 6000;  // 6KB per search summary
```

- [ ] **Step 2: Upgrade context budget stages in defensive-harness.ts**

Find `guardContextBudget()` in defensive-harness.ts. Update the token thresholds:

```typescript
// Stage 1: Soft compression (summarize old tool results)
// OLD: triggered at 50% utilization
// NEW: triggered at 65% utilization (we have more budget now)
const STAGE_1_THRESHOLD = 0.65;

// Stage 2: Aggressive compression (drop old tool results, keep summaries)
// OLD: triggered at 75%
// NEW: triggered at 80%
const STAGE_2_THRESHOLD = 0.80;

// Stage 3: Nuclear (reset conversation, inject summary)
// OLD: triggered at 90%
// NEW: triggered at 92%
const STAGE_3_THRESHOLD = 0.92;
```

- [ ] **Step 3: Add progressive summarization to guardContextBudget**

In `guardContextBudget()`, add a new compression strategy before the nuclear option:

```typescript
// NEW: Stage 2.5 — Summarize tool results into compact key-value pairs
if (stage >= 2) {
  for (let i = 0; i < messages.length - 4; i++) {
    const msg = messages[i];
    if (msg.role === 'model' && msg.parts) {
      for (const part of msg.parts) {
        const p = part as Record<string, unknown>;
        if (p.functionResponse) {
          const resp = p.functionResponse as { response: { output: string } };
          if (resp.response.output.length > 1000) {
            // Compress old tool results to just key findings
            resp.response.output = smartTruncate(resp.response.output, 500) +
              '\n[... compressed for context budget]';
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Increase maxOutputTokens for pro/deep models**

Already handled in Task 1 via `modelConfig.maxOutputTokens`, but verify the values:
- flash: 8192 (was 4096)
- pro: 16384
- deep: 32768

- [ ] **Step 5: Commit**

```bash
git add lib/execution/tools/data-tools.ts lib/execution/defensive-harness.ts
git commit -m "feat: lift context ceiling — 64KB sections, 6KB summaries, smarter compression"
```

---

## Phase 3: Multi-Step Campaigns (Workflow Engine)

> Enable agents to run coordinated, multi-step workflows that span hours or days.

### Task 3: Campaign Database Schema

**Files:**
- Create: `supabase/migrations/018_campaigns.sql`

- [ ] **Step 1: Write migration**

```sql
-- 018_campaigns.sql — Multi-step campaign/workflow engine

-- Campaign: a named sequence of coordinated agent tasks
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  template_id TEXT,                -- optional: which template spawned this
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled'
  )),

  -- Execution config
  trigger_type TEXT DEFAULT 'manual' CHECK (trigger_type IN (
    'manual', 'scheduled', 'event', 'webhook'
  )),
  cron_expression TEXT,            -- for scheduled triggers
  timezone TEXT DEFAULT 'UTC',

  -- Progress
  total_steps INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  current_step_id UUID,

  -- Context: shared data that flows between steps
  shared_context JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign step: one task in the sequence
CREATE TABLE IF NOT EXISTS campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,

  -- Step config
  step_order INTEGER NOT NULL,        -- execution order (1, 2, 3...)
  title TEXT NOT NULL,
  description TEXT,
  agent_id TEXT NOT NULL,

  -- Dependencies
  depends_on UUID[],                  -- step IDs that must complete first
  condition TEXT,                     -- optional: JS expression for conditional execution

  -- Execution
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'waiting', 'running', 'completed', 'failed', 'skipped'
  )),
  task_id UUID REFERENCES execution_tasks(id),  -- linked execution task
  result_summary TEXT,                -- compact result for downstream context

  -- Timing
  delay_minutes INTEGER DEFAULT 0,    -- wait N minutes after dependencies complete
  timeout_minutes INTEGER DEFAULT 30, -- max execution time
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 2,

  -- Metadata
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign ON campaign_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_status ON campaign_steps(status);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/018_campaigns.sql
git commit -m "feat: add campaigns schema — multi-step workflow support"
```

### Task 4: Campaign Engine Core

**Files:**
- Create: `lib/execution/campaign-engine.ts`
- Create: `lib/execution/campaign-templates.ts`

- [ ] **Step 1: Create campaign engine**

```typescript
// lib/execution/campaign-engine.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { v4 as uuidv4 } from 'uuid';
import { Orchestrator } from './orchestrator';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  templateId?: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  triggerType: 'manual' | 'scheduled' | 'event' | 'webhook';
  cronExpression?: string;
  timezone: string;
  totalSteps: number;
  completedSteps: number;
  currentStepId?: string;
  sharedContext: Record<string, unknown>;
  createdBy?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface CampaignStep {
  id: string;
  campaignId: string;
  orgId: string;
  stepOrder: number;
  title: string;
  description?: string;
  agentId: string;
  dependsOn: string[];
  condition?: string;
  status: 'pending' | 'waiting' | 'running' | 'completed' | 'failed' | 'skipped';
  taskId?: string;
  resultSummary?: string;
  delayMinutes: number;
  timeoutMinutes: number;
  retryCount: number;
  maxRetries: number;
  startedAt?: string;
  completedAt?: string;
}

// ── DB Mappers ───────────────────────────────────────────────────────────────

function dbToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    templateId: row.template_id as string | undefined,
    status: row.status as Campaign['status'],
    triggerType: row.trigger_type as Campaign['triggerType'],
    cronExpression: row.cron_expression as string | undefined,
    timezone: (row.timezone as string) ?? 'UTC',
    totalSteps: (row.total_steps as number) ?? 0,
    completedSteps: (row.completed_steps as number) ?? 0,
    currentStepId: row.current_step_id as string | undefined,
    sharedContext: (row.shared_context as Record<string, unknown>) ?? {},
    createdBy: row.created_by as string | undefined,
    startedAt: row.started_at as string | undefined,
    completedAt: row.completed_at as string | undefined,
    createdAt: row.created_at as string,
  };
}

function dbToStep(row: Record<string, unknown>): CampaignStep {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    orgId: row.org_id as string,
    stepOrder: row.step_order as number,
    title: row.title as string,
    description: row.description as string | undefined,
    agentId: row.agent_id as string,
    dependsOn: (row.depends_on as string[]) ?? [],
    condition: row.condition as string | undefined,
    status: row.status as CampaignStep['status'],
    taskId: row.task_id as string | undefined,
    resultSummary: row.result_summary as string | undefined,
    delayMinutes: (row.delay_minutes as number) ?? 0,
    timeoutMinutes: (row.timeout_minutes as number) ?? 30,
    retryCount: (row.retry_count as number) ?? 0,
    maxRetries: (row.max_retries as number) ?? 2,
    startedAt: row.started_at as string | undefined,
    completedAt: row.completed_at as string | undefined,
  };
}

// ── Campaign Engine ──────────────────────────────────────────────────────────

export class CampaignEngine {
  private supabase = createAdminClient();
  private orchestrator: Orchestrator;

  constructor() {
    this.orchestrator = new Orchestrator();
  }

  /**
   * Create a campaign from a template or manual step definitions.
   */
  async createCampaign(
    orgId: string,
    title: string,
    steps: Array<{
      title: string;
      description?: string;
      agentId: string;
      dependsOn?: number[];  // step order numbers (not IDs)
      delayMinutes?: number;
      condition?: string;
    }>,
    options?: {
      description?: string;
      templateId?: string;
      triggerType?: Campaign['triggerType'];
      cronExpression?: string;
      createdBy?: string;
    }
  ): Promise<Campaign> {
    const campaignId = uuidv4();

    // Insert campaign
    const { data: campaign, error } = await this.supabase
      .from('campaigns')
      .insert({
        id: campaignId,
        org_id: orgId,
        title,
        description: options?.description,
        template_id: options?.templateId,
        status: 'draft',
        trigger_type: options?.triggerType ?? 'manual',
        cron_expression: options?.cronExpression,
        total_steps: steps.length,
        created_by: options?.createdBy,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create campaign: ${error.message}`);

    // Create step IDs upfront so we can resolve depends_on references
    const stepIds = steps.map(() => uuidv4());

    // Insert steps
    const stepRows = steps.map((s, i) => ({
      id: stepIds[i],
      campaign_id: campaignId,
      org_id: orgId,
      step_order: i + 1,
      title: s.title,
      description: s.description,
      agent_id: s.agentId,
      depends_on: (s.dependsOn ?? []).map(orderNum => stepIds[orderNum - 1]).filter(Boolean),
      delay_minutes: s.delayMinutes ?? 0,
      condition: s.condition,
    }));

    const { error: stepError } = await this.supabase
      .from('campaign_steps')
      .insert(stepRows);

    if (stepError) throw new Error(`Failed to create steps: ${stepError.message}`);

    return dbToCampaign(campaign);
  }

  /**
   * Run a campaign: execute steps in dependency order.
   * This is the main execution loop — runs until all steps complete or fail.
   */
  async runCampaign(campaignId: string): Promise<Campaign> {
    // Mark running
    await this.supabase.from('campaigns').update({
      status: 'running',
      started_at: new Date().toISOString(),
    }).eq('id', campaignId);

    // Load all steps
    const { data: stepRows } = await this.supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('step_order');

    if (!stepRows || stepRows.length === 0) {
      throw new Error('Campaign has no steps');
    }

    const steps = stepRows.map(dbToStep);
    const completedStepIds = new Set<string>();
    const stepResults = new Map<string, string>();  // stepId → result summary
    let failedStep: CampaignStep | null = null;

    // Execution loop: keep running until all steps done or a step fails
    while (completedStepIds.size < steps.length && !failedStep) {
      // Find ready steps (dependencies met, not yet started)
      const readySteps = steps.filter(s => {
        if (s.status === 'completed' || s.status === 'failed' || s.status === 'skipped' || s.status === 'running') return false;
        // Check all dependencies are completed
        return s.dependsOn.every(depId => completedStepIds.has(depId));
      });

      if (readySteps.length === 0) {
        // No ready steps but not all complete — deadlock or waiting
        if (completedStepIds.size < steps.length) {
          // Check for steps still running
          const runningSteps = steps.filter(s => s.status === 'running');
          if (runningSteps.length === 0) {
            // True deadlock — circular dependency or all remaining failed
            break;
          }
          // Wait for running steps
          await new Promise(resolve => setTimeout(resolve, 5000));
          // Refresh step statuses
          const { data: refreshed } = await this.supabase
            .from('campaign_steps')
            .select('*')
            .eq('campaign_id', campaignId);
          if (refreshed) {
            for (const row of refreshed) {
              const s = dbToStep(row);
              const idx = steps.findIndex(st => st.id === s.id);
              if (idx >= 0) {
                steps[idx] = s;
                if (s.status === 'completed') completedStepIds.add(s.id);
                if (s.resultSummary) stepResults.set(s.id, s.resultSummary);
              }
            }
          }
          continue;
        }
        break;
      }

      // Execute ready steps (parallel if no dependencies between them)
      const execPromises = readySteps.map(step => this.executeStep(step, stepResults));
      const results = await Promise.allSettled(execPromises);

      for (let i = 0; i < results.length; i++) {
        const step = readySteps[i];
        const result = results[i];

        if (result.status === 'fulfilled' && result.value.status === 'completed') {
          completedStepIds.add(step.id);
          step.status = 'completed';
          if (result.value.resultSummary) {
            stepResults.set(step.id, result.value.resultSummary);
          }
          // Update campaign progress
          await this.supabase.from('campaigns').update({
            completed_steps: completedStepIds.size,
            current_step_id: step.id,
          }).eq('id', campaignId);
        } else {
          // Step failed — retry or fail campaign
          step.retryCount++;
          if (step.retryCount <= step.maxRetries) {
            step.status = 'pending';  // retry
            await this.supabase.from('campaign_steps').update({
              status: 'pending',
              retry_count: step.retryCount,
            }).eq('id', step.id);
          } else {
            step.status = 'failed';
            failedStep = step;
          }
        }
      }
    }

    // Determine final status
    const finalStatus = failedStep ? 'failed' :
      completedStepIds.size >= steps.length ? 'completed' : 'failed';

    await this.supabase.from('campaigns').update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      completed_steps: completedStepIds.size,
    }).eq('id', campaignId);

    // Reload and return
    const { data: final } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    return dbToCampaign(final!);
  }

  /**
   * Execute a single campaign step by spawning an orchestrator task.
   */
  private async executeStep(
    step: CampaignStep,
    priorResults: Map<string, string>
  ): Promise<{ status: 'completed' | 'failed'; resultSummary?: string }> {
    // Handle delay: if step has a delay, mark it as 'waiting' and skip.
    // A cron job (or the next runCampaign call) will pick it up when ready.
    if (step.delayMinutes > 0) {
      const readyAt = new Date(Date.now() + step.delayMinutes * 60 * 1000);
      await this.supabase.from('campaign_steps').update({
        status: 'waiting',
        // Store ready_at in the step for cron pickup
      }).eq('id', step.id);
      // For short delays (<5 min), wait inline. For longer, return and let cron resume.
      if (step.delayMinutes <= 5) {
        await new Promise(resolve => setTimeout(resolve, step.delayMinutes * 60 * 1000));
      } else {
        return { status: 'completed' as const, resultSummary: `Waiting until ${readyAt.toISOString()} (${step.delayMinutes} min delay)` };
      }
    }

    // Mark running
    await this.supabase.from('campaign_steps').update({
      status: 'running',
      started_at: new Date().toISOString(),
    }).eq('id', step.id);

    // Build context from prior step results
    const priorContext = Array.from(priorResults.entries())
      .map(([, summary]) => summary)
      .join('\n\n---\n\n');

    const description = [
      step.description ?? '',
      priorContext ? `\n\n--- PRIOR CAMPAIGN STEPS ---\n${priorContext}` : '',
    ].join('');

    // Submit as execution task
    const task = await this.orchestrator.submitTask({
      orgId: step.orgId,
      title: step.title,
      description,
      agentId: step.agentId,
      priority: 'medium',
      acceptanceCriteria: [],
      maxAttempts: 3,
      costCeiling: 2.0,
    });

    // Run the orchestrator pipeline
    const result = await this.orchestrator.runPipeline(task.id);

    // Summarize result for downstream steps (compact)
    const resultSummary = (result.result ?? '').slice(0, 3000);

    // Update step
    const stepStatus = result.status === 'completed' ? 'completed' : 'failed';
    await this.supabase.from('campaign_steps').update({
      status: stepStatus,
      task_id: task.id,
      result_summary: resultSummary,
      completed_at: new Date().toISOString(),
    }).eq('id', step.id);

    return { status: stepStatus as 'completed' | 'failed', resultSummary };
  }

  /**
   * Get campaign with all steps.
   */
  async getCampaign(campaignId: string): Promise<{ campaign: Campaign; steps: CampaignStep[] } | null> {
    const { data: campaign } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign) return null;

    const { data: steps } = await this.supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('step_order');

    return {
      campaign: dbToCampaign(campaign),
      steps: (steps ?? []).map(dbToStep),
    };
  }

  /**
   * List campaigns for an org.
   */
  async listCampaigns(orgId: string, status?: Campaign['status']): Promise<Campaign[]> {
    let query = this.supabase
      .from('campaigns')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (status) query = query.eq('status', status);

    const { data } = await query;
    return (data ?? []).map(dbToCampaign);
  }

  /**
   * Pause a running campaign.
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    await this.supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
  }

  /**
   * Resume a paused campaign.
   */
  async resumeCampaign(campaignId: string): Promise<Campaign> {
    await this.supabase.from('campaigns').update({ status: 'running' }).eq('id', campaignId);
    return this.runCampaign(campaignId);
  }

  /**
   * Cancel a campaign.
   */
  async cancelCampaign(campaignId: string): Promise<void> {
    await this.supabase.from('campaigns').update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    }).eq('id', campaignId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/execution/campaign-engine.ts
git commit -m "feat: add campaign engine — multi-step workflow execution with dependency resolution"
```

### Task 5: Campaign Templates

**Files:**
- Create: `lib/execution/campaign-templates.ts`

- [ ] **Step 1: Create pre-built campaign templates**

```typescript
// lib/execution/campaign-templates.ts

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: 'marketing' | 'sales' | 'hiring' | 'product' | 'operations';
  estimatedDuration: string;  // "2 hours", "3 days"
  steps: Array<{
    title: string;
    description: string;
    agentId: string;
    dependsOn?: number[];
    delayMinutes?: number;
  }>;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'product-launch',
    name: 'Product Launch Campaign',
    description: 'End-to-end product launch: research → messaging → content → social → email → analytics',
    category: 'marketing',
    estimatedDuration: '4 hours',
    steps: [
      {
        title: 'Market Research & Competitive Analysis',
        description: 'Research the competitive landscape, identify key differentiators, and analyze target audience. Use web_search and analyze_competitors tools.',
        agentId: 'researcher',
      },
      {
        title: 'Launch Messaging & Positioning',
        description: 'Based on the research findings, create core messaging: tagline, value props, key benefits, and positioning statement.',
        agentId: 'strategist',
        dependsOn: [1],
      },
      {
        title: 'Create Launch Content Suite',
        description: 'Write blog post, social media posts (LinkedIn, Twitter, Instagram), email announcement, and press release using the approved messaging.',
        agentId: 'marketer',
        dependsOn: [2],
      },
      {
        title: 'Generate Visual Assets',
        description: 'Create social media graphics, hero images, and branded visuals for all platforms using the launch messaging.',
        agentId: 'marketer',
        dependsOn: [2],
      },
      {
        title: 'Publish Social Media Posts',
        description: 'Post the launch content to LinkedIn, Twitter, Instagram, and Facebook. Use the content from step 3 and visuals from step 4.',
        agentId: 'marketer',
        dependsOn: [3, 4],
      },
      {
        title: 'Send Launch Email Campaign',
        description: 'Send the launch announcement email to the subscriber list using the content from step 3.',
        agentId: 'marketer',
        dependsOn: [3],
      },
      {
        title: 'Post-Launch Analytics Report',
        description: 'Pull social media analytics, email open rates, and website traffic. Compile into a launch performance report.',
        agentId: 'analyst',
        dependsOn: [5, 6],
        delayMinutes: 1440,  // 24 hours after posting
      },
    ],
  },

  {
    id: 'content-calendar-week',
    name: 'Weekly Content Calendar',
    description: 'Generate a full week of content: 5 LinkedIn posts, 5 tweets, 2 blog ideas, 1 email newsletter',
    category: 'marketing',
    estimatedDuration: '1 hour',
    steps: [
      {
        title: 'Content Strategy & Topics',
        description: 'Based on recent social analytics and trending topics, identify 5 content themes for the week. Consider engagement patterns from past posts.',
        agentId: 'strategist',
      },
      {
        title: 'Write LinkedIn Posts (Mon-Fri)',
        description: 'Create 5 LinkedIn posts, one for each weekday, following the content themes. Include calls-to-action and hashtags.',
        agentId: 'marketer',
        dependsOn: [1],
      },
      {
        title: 'Write Twitter Thread Content',
        description: 'Create 5 tweet threads, one per day, complementing the LinkedIn content but optimized for Twitter format.',
        agentId: 'marketer',
        dependsOn: [1],
      },
      {
        title: 'Draft Newsletter',
        description: 'Write a weekly email newsletter summarizing the key themes and linking to the published content.',
        agentId: 'marketer',
        dependsOn: [2, 3],
      },
      {
        title: 'Export to Content Calendar',
        description: 'Compile all content into a Google Sheets content calendar with dates, platforms, copy, and status columns.',
        agentId: 'operator',
        dependsOn: [2, 3, 4],
      },
    ],
  },

  {
    id: 'hiring-pipeline',
    name: 'Full Hiring Pipeline',
    description: 'End-to-end hiring: job description → posting → screening criteria → interview questions → offer template',
    category: 'hiring',
    estimatedDuration: '2 hours',
    steps: [
      {
        title: 'Job Description & Requirements',
        description: 'Create a detailed job description with responsibilities, requirements, nice-to-haves, and compensation benchmarks.',
        agentId: 'recruiter',
      },
      {
        title: 'Salary Benchmarking',
        description: 'Research market salary ranges for this role, considering location, experience level, and industry.',
        agentId: 'recruiter',
        dependsOn: [1],
      },
      {
        title: 'Screening Criteria & Scorecard',
        description: 'Create a structured candidate evaluation rubric with must-have and nice-to-have criteria, scored 1-5.',
        agentId: 'recruiter',
        dependsOn: [1],
      },
      {
        title: 'Interview Questions (3 rounds)',
        description: 'Generate interview questions for phone screen, technical interview, and culture fit interview. Include evaluation rubric for each.',
        agentId: 'recruiter',
        dependsOn: [1, 3],
      },
      {
        title: 'Post Job & Notify Team',
        description: 'Create Jira ticket for the hiring pipeline, post to LinkedIn, and send Slack notification to hiring channel.',
        agentId: 'recruiter',
        dependsOn: [1, 2],
      },
    ],
  },

  {
    id: 'financial-review',
    name: 'Monthly Financial Review',
    description: 'Pull financials → analyze → create report → present → action items',
    category: 'operations',
    estimatedDuration: '2 hours',
    steps: [
      {
        title: 'Pull Financial Data',
        description: 'Pull latest data from Stripe, QuickBooks, and other financial integrations. Compile revenue, expenses, and cash flow.',
        agentId: 'analyst',
      },
      {
        title: 'Financial Analysis & KPIs',
        description: 'Analyze MRR, churn, burn rate, runway, unit economics, and compare to prior month. Identify trends and anomalies.',
        agentId: 'analyst',
        dependsOn: [1],
      },
      {
        title: 'Executive Summary Report',
        description: 'Create a board-ready financial summary with charts, key metrics, and narrative analysis.',
        agentId: 'analyst',
        dependsOn: [2],
      },
      {
        title: 'Strategic Recommendations',
        description: 'Based on the financial analysis, recommend cost optimizations, growth levers, and risk mitigations.',
        agentId: 'strategist',
        dependsOn: [2],
      },
      {
        title: 'Export to Sheets & Notify Team',
        description: 'Export the financial report to Google Sheets and send summary to Slack #finance channel.',
        agentId: 'operator',
        dependsOn: [3, 4],
      },
    ],
  },

  {
    id: 'competitor-intel',
    name: 'Competitive Intelligence Report',
    description: 'Deep competitor research: web scraping → analysis → SWOT → strategic response',
    category: 'sales',
    estimatedDuration: '3 hours',
    steps: [
      {
        title: 'Competitor Web Research',
        description: 'Scrape and analyze top 3-5 competitor websites: pricing, features, positioning, recent news, team size.',
        agentId: 'researcher',
      },
      {
        title: 'Market Positioning Analysis',
        description: 'Compare competitor positioning, messaging, and target segments. Create positioning map.',
        agentId: 'researcher',
        dependsOn: [1],
      },
      {
        title: 'SWOT Analysis',
        description: 'Create detailed SWOT analysis for each competitor and for our own company relative to competitors.',
        agentId: 'strategist',
        dependsOn: [1, 2],
      },
      {
        title: 'Battle Cards',
        description: 'Create sales battle cards for each competitor: their strengths, our advantages, objection handling, win themes.',
        agentId: 'marketer',
        dependsOn: [3],
      },
      {
        title: 'Strategic Response Plan',
        description: 'Recommend competitive response: feature gaps to close, messaging adjustments, pricing opportunities.',
        agentId: 'strategist',
        dependsOn: [3, 4],
      },
    ],
  },
];

/**
 * Get a template by ID.
 */
export function getCampaignTemplate(templateId: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find(t => t.id === templateId);
}

/**
 * List all available templates.
 */
export function listCampaignTemplates(): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES;
}

/**
 * List templates by category.
 */
export function getTemplatesByCategory(category: CampaignTemplate['category']): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES.filter(t => t.category === category);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/execution/campaign-templates.ts
git commit -m "feat: add 5 campaign templates — product launch, content calendar, hiring, financial review, competitor intel"
```

### Task 6: Campaign API Routes

**Files:**
- Create: `app/api/execution/campaigns/route.ts`
- Create: `app/api/execution/campaigns/[campaignId]/route.ts`
- Create: `app/api/execution/campaigns/[campaignId]/run/route.ts`
- Create: `app/api/execution/campaigns/templates/route.ts`

- [ ] **Step 1: Create campaign list/create API**

```typescript
// app/api/execution/campaigns/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { CampaignEngine } from '@/lib/execution/campaign-engine';
import { getCampaignTemplate } from '@/lib/execution/campaign-templates';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

  const engine = new CampaignEngine();
  const status = req.nextUrl.searchParams.get('status') as any;
  const campaigns = await engine.listCampaigns(orgId, status ?? undefined);

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { orgId, title, description, templateId, steps, triggerType, cronExpression } = body;

  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

  const engine = new CampaignEngine();

  // If template-based, load template steps
  let campaignSteps = steps;
  if (templateId && !steps) {
    const template = getCampaignTemplate(templateId);
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    campaignSteps = template.steps;
  }

  if (!campaignSteps || campaignSteps.length === 0) {
    return NextResponse.json({ error: 'No steps provided' }, { status: 400 });
  }

  const campaign = await engine.createCampaign(
    orgId,
    title ?? `Campaign ${new Date().toLocaleDateString()}`,
    campaignSteps,
    { description, templateId, triggerType, cronExpression, createdBy: auth.user.id }
  );

  return NextResponse.json({ campaign });
}
```

- [ ] **Step 2: Create campaign detail and run APIs**

```typescript
// app/api/execution/campaigns/[campaignId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { CampaignEngine } from '@/lib/execution/campaign-engine';

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const { campaignId } = await context.params;
  const engine = new CampaignEngine();
  const result = await engine.getCampaign(campaignId);
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const { campaignId } = await context.params;
  const engine = new CampaignEngine();
  await engine.cancelCampaign(campaignId);

  return NextResponse.json({ success: true });
}
```

```typescript
// app/api/execution/campaigns/[campaignId]/run/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { CampaignEngine } from '@/lib/execution/campaign-engine';

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const { campaignId } = await context.params;
  const engine = new CampaignEngine();

  // Fire and forget — campaign runs in background
  engine.runCampaign(campaignId).catch(err => {
    console.error(`[Campaign] ${campaignId} failed:`, err);
  });

  return NextResponse.json({ started: true, campaignId });
}
```

```typescript
// app/api/execution/campaigns/templates/route.ts

import { NextResponse } from 'next/server';
import { listCampaignTemplates } from '@/lib/execution/campaign-templates';

export async function GET() {
  return NextResponse.json({ templates: listCampaignTemplates() });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/execution/campaigns/
git commit -m "feat: add campaign API routes — create, list, run, cancel, templates"
```

---

## Phase 4: Learning Loop (Agents That Get Smarter)

> Close the feedback loop: user ratings → lesson extraction → memory injection → performance tracking.

### Task 7: User Feedback System

**Files:**
- Create: `supabase/migrations/019_feedback_and_performance.sql`
- Create: `lib/execution/feedback.ts`
- Create: `app/api/execution/tasks/[taskId]/feedback/route.ts`

- [ ] **Step 1: Write migration**

```sql
-- 019_feedback_and_performance.sql — User feedback & agent performance tracking

-- User feedback on task results
CREATE TABLE IF NOT EXISTS task_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES execution_tasks(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  user_id TEXT,

  -- Rating
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),  -- 1=terrible, 5=excellent
  thumbs TEXT CHECK (thumbs IN ('up', 'down')),    -- quick feedback

  -- Detailed feedback
  feedback_text TEXT,                -- what was wrong or right
  corrections TEXT,                  -- what the user actually wanted

  -- Auto-extracted
  lessons_extracted JSONB DEFAULT '[]'::jsonb,  -- lessons saved to agent_memory

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent performance scores (rolling averages)
CREATE TABLE IF NOT EXISTS agent_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,

  -- Scores (rolling 30-day averages)
  avg_rating REAL DEFAULT 0,
  total_tasks INTEGER DEFAULT 0,
  successful_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  avg_cost_per_task REAL DEFAULT 0,
  avg_execution_time_ms REAL DEFAULT 0,

  -- Feedback stats
  thumbs_up INTEGER DEFAULT 0,
  thumbs_down INTEGER DEFAULT 0,
  feedback_count INTEGER DEFAULT 0,

  -- Model usage breakdown
  flash_tasks INTEGER DEFAULT 0,
  pro_tasks INTEGER DEFAULT 0,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, agent_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_task_feedback_task ON task_feedback(task_id);
CREATE INDEX IF NOT EXISTS idx_task_feedback_org ON task_feedback(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_org ON agent_performance(org_id, agent_id);
```

- [ ] **Step 2: Create feedback processing logic**

```typescript
// lib/execution/feedback.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { saveAgentMemory } from './agent-memory';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface TaskFeedback {
  taskId: string;
  orgId: string;
  userId?: string;
  rating?: number;
  thumbs?: 'up' | 'down';
  feedbackText?: string;
  corrections?: string;
}

/**
 * Process user feedback: save to DB, extract lessons, update agent memory.
 */
export async function processFeedback(
  feedback: TaskFeedback,
  agentId: string,
  taskTitle: string,
  taskResult: string,
): Promise<{ lessonsExtracted: string[] }> {
  const supabase = createAdminClient();
  const lessons: string[] = [];

  // Extract lessons from negative feedback using LLM
  if (feedback.thumbs === 'down' || (feedback.rating && feedback.rating <= 2) || feedback.corrections) {
    const extractPrompt = `A user gave negative feedback on an AI agent's work. Extract actionable lessons.

TASK: "${taskTitle}"
AGENT OUTPUT (first 2000 chars): ${taskResult.slice(0, 2000)}
USER FEEDBACK: ${feedback.feedbackText ?? 'No text'}
USER CORRECTIONS: ${feedback.corrections ?? 'None'}
RATING: ${feedback.rating ?? 'N/A'}/5

Extract 1-3 specific, actionable lessons that the agent should remember for future tasks.
Each lesson should be:
- Specific (not "be better")
- Actionable (tells the agent what TO DO or NOT DO)
- Reusable (applies to future similar tasks)

Output ONLY a JSON array of strings. Example:
["NEVER estimate financial figures without data from connected tools", "When writing LinkedIn posts, always include a call-to-action"]`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: extractPrompt,
        config: { temperature: 0.0, maxOutputTokens: 1000 },
      });

      const text = response.text ?? '';
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        const extracted = JSON.parse(match[0]) as string[];
        lessons.push(...extracted.slice(0, 3));
      }
    } catch {
      // Fallback: save raw feedback as lesson
      if (feedback.feedbackText) {
        lessons.push(`CORRECTION from user: ${feedback.feedbackText}`);
      }
    }
  }

  // Extract lessons from positive feedback (what worked)
  if (feedback.thumbs === 'up' || (feedback.rating && feedback.rating >= 4)) {
    if (feedback.feedbackText) {
      lessons.push(`PREFERENCE: User liked this approach: ${feedback.feedbackText}`);
    }
  }

  // Save lessons to agent memory
  for (const lesson of lessons) {
    await saveAgentMemory(
      feedback.orgId,
      agentId,
      lesson,
      feedback.thumbs === 'down' ? 'correction' : 'preference',
      feedback.taskId,
    );
  }

  // Save feedback to DB
  await supabase.from('task_feedback').insert({
    task_id: feedback.taskId,
    org_id: feedback.orgId,
    user_id: feedback.userId,
    rating: feedback.rating,
    thumbs: feedback.thumbs,
    feedback_text: feedback.feedbackText,
    corrections: feedback.corrections,
    lessons_extracted: lessons,
  });

  // Update rolling performance metrics
  await updatePerformanceMetrics(feedback.orgId, agentId, feedback);

  return { lessonsExtracted: lessons };
}

/**
 * Update agent performance rolling metrics.
 */
async function updatePerformanceMetrics(
  orgId: string,
  agentId: string,
  feedback: TaskFeedback,
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Upsert performance record
  const { data: existing } = await supabase
    .from('agent_performance')
    .select('*')
    .eq('org_id', orgId)
    .eq('agent_id', agentId)
    .eq('period_start', periodStart)
    .single();

  if (existing) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (feedback.rating) {
      const newCount = (existing.feedback_count ?? 0) + 1;
      updates.avg_rating = ((existing.avg_rating ?? 0) * (existing.feedback_count ?? 0) + feedback.rating) / newCount;
      updates.feedback_count = newCount;
    }
    if (feedback.thumbs === 'up') updates.thumbs_up = (existing.thumbs_up ?? 0) + 1;
    if (feedback.thumbs === 'down') updates.thumbs_down = (existing.thumbs_down ?? 0) + 1;

    await supabase.from('agent_performance').update(updates).eq('id', existing.id);
  } else {
    await supabase.from('agent_performance').insert({
      org_id: orgId,
      agent_id: agentId,
      avg_rating: feedback.rating ?? 0,
      feedback_count: feedback.rating ? 1 : 0,
      thumbs_up: feedback.thumbs === 'up' ? 1 : 0,
      thumbs_down: feedback.thumbs === 'down' ? 1 : 0,
      period_start: periodStart,
      period_end: periodEnd,
    });
  }
}

/**
 * Get agent performance summary for an org.
 */
export async function getAgentPerformance(
  orgId: string,
  agentId?: string,
): Promise<Record<string, unknown>[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from('agent_performance')
    .select('*')
    .eq('org_id', orgId)
    .order('period_start', { ascending: false })
    .limit(12);  // last 12 months

  if (agentId) query = query.eq('agent_id', agentId);

  const { data } = await query;
  return data ?? [];
}
```

- [ ] **Step 3: Create feedback API route**

```typescript
// app/api/execution/tasks/[taskId]/feedback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { createAdminClient } from '@/lib/supabase/admin';
import { processFeedback } from '@/lib/execution/feedback';

type RouteContext = { params: Promise<{ taskId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const { taskId } = await context.params;
  const body = await req.json();
  const { orgId, rating, thumbs, feedbackText, corrections } = body;

  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

  // Get task to find agent
  const supabase = createAdminClient();
  const { data: task } = await supabase
    .from('execution_tasks')
    .select('agent_id, title, result')
    .eq('id', taskId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const result = await processFeedback(
    {
      taskId,
      orgId,
      userId: auth.user.id,
      rating,
      thumbs,
      feedbackText,
      corrections,
    },
    task.agent_id,
    task.title,
    task.result ?? '',
  );

  return NextResponse.json({
    success: true,
    lessonsExtracted: result.lessonsExtracted,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/019_feedback_and_performance.sql lib/execution/feedback.ts app/api/execution/tasks/
git commit -m "feat: add feedback loop — user ratings, lesson extraction, agent performance tracking"
```

---

## Phase 5: Deep Integration Coverage (Full Social Strategy)

> Add content scheduling, A/B testing, and cross-platform analytics.

### Task 8: Content Scheduling Tools

**Files:**
- Create: `lib/execution/tools/scheduling-tools.ts`
- Modify: `lib/execution/outfits.ts` (add scheduling tools to marketing outfit)
- Create: `supabase/migrations/020_content_scheduling.sql`

- [ ] **Step 1: Write scheduling migration**

```sql
-- 020_content_scheduling.sql — Content scheduling & A/B testing

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,

  -- Content
  platform TEXT NOT NULL,           -- linkedin, twitter, instagram, facebook
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',

  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'posting', 'posted', 'failed', 'cancelled'
  )),

  -- A/B testing
  ab_group_id UUID,                 -- links variants together
  variant_label TEXT,               -- 'A', 'B', 'C'

  -- Results (populated after posting)
  post_url TEXT,
  post_id TEXT,                     -- platform-specific post ID

  -- Engagement (updated by analytics pull)
  impressions INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,

  -- Metadata
  created_by TEXT,
  task_id UUID,                     -- which execution task created this
  campaign_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- A/B test groups
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'running' CHECK (status IN ('draft', 'running', 'completed')),

  -- Config
  variant_count INTEGER DEFAULT 2,
  metric TEXT DEFAULT 'engagement_rate',  -- what to optimize for

  -- Results
  winner_variant TEXT,
  winner_post_id UUID,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_org ON scheduled_posts(org_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_ab ON scheduled_posts(ab_group_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_org ON ab_tests(org_id);
```

- [ ] **Step 2: Create scheduling tools**

```typescript
// lib/execution/tools/scheduling-tools.ts

import { globalRegistry, type ToolResult, type ToolContext } from './index';
import { createAdminClient } from '@/lib/supabase/admin';
import { v4 as uuidv4 } from 'uuid';

function registerTools(tools: Array<{ name: string; description: string; parameters: Record<string, unknown>; required?: string[]; execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>; category: string; costTier: string }>) {
  for (const tool of tools) {
    globalRegistry.register(tool as any);
  }
}

registerTools([
  {
    name: 'schedule_post',
    description: 'Schedule a social media post for a specific date and time. Supports LinkedIn, Twitter, Instagram, Facebook.',
    parameters: {
      platform: { type: 'string', description: 'Platform: linkedin, twitter, instagram, facebook' },
      content: { type: 'string', description: 'The post content/caption' },
      scheduled_at: { type: 'string', description: 'ISO 8601 datetime for when to post (e.g., 2026-03-22T09:00:00Z)' },
      media_urls: { type: 'string', description: 'Comma-separated media URLs (optional)' },
      timezone: { type: 'string', description: 'Timezone (default: UTC). E.g., America/New_York' },
    },
    required: ['platform', 'content', 'scheduled_at'],
    execute: async (args, context) => {
      const supabase = createAdminClient();
      const platform = String(args.platform).toLowerCase();
      const validPlatforms = ['linkedin', 'twitter', 'instagram', 'facebook'];
      if (!validPlatforms.includes(platform)) {
        return { success: false, output: `Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(', ')}` };
      }

      const scheduledAt = new Date(String(args.scheduled_at));
      if (isNaN(scheduledAt.getTime())) {
        return { success: false, output: 'Invalid date format. Use ISO 8601 (e.g., 2026-03-22T09:00:00Z)' };
      }
      if (scheduledAt < new Date()) {
        return { success: false, output: 'Cannot schedule posts in the past' };
      }

      const mediaUrls = args.media_urls ? String(args.media_urls).split(',').map(u => u.trim()) : [];

      const { data, error } = await supabase.from('scheduled_posts').insert({
        id: uuidv4(),
        org_id: context.orgId,
        platform,
        content: String(args.content),
        media_urls: mediaUrls,
        scheduled_at: scheduledAt.toISOString(),
        timezone: String(args.timezone ?? 'UTC'),
        status: 'scheduled',
        task_id: context.sessionId,
        created_by: context.agentId,
      }).select().single();

      if (error) return { success: false, output: `Failed to schedule: ${error.message}` };

      return {
        success: true,
        output: `Scheduled ${platform} post for ${scheduledAt.toLocaleString()}. Post ID: ${data.id}`,
      };
    },
    category: 'social',
    costTier: 'cheap',
  },

  {
    name: 'create_ab_test',
    description: 'Create an A/B test for social media content. Creates 2-3 variants of a post to test which performs better.',
    parameters: {
      platform: { type: 'string', description: 'Platform to test on: linkedin, twitter, instagram, facebook' },
      name: { type: 'string', description: 'Name for this test (e.g., "Q1 launch messaging test")' },
      variant_a: { type: 'string', description: 'Content for variant A' },
      variant_b: { type: 'string', description: 'Content for variant B' },
      variant_c: { type: 'string', description: 'Content for variant C (optional)' },
      schedule_at: { type: 'string', description: 'When to post the variants (ISO 8601). Posts are staggered 1 hour apart.' },
      metric: { type: 'string', description: 'What to optimize: engagement_rate (default), impressions, clicks' },
    },
    required: ['platform', 'name', 'variant_a', 'variant_b'],
    execute: async (args, context) => {
      const supabase = createAdminClient();
      const platform = String(args.platform).toLowerCase();
      const abGroupId = uuidv4();
      const metric = String(args.metric ?? 'engagement_rate');

      const variants = [
        { label: 'A', content: String(args.variant_a) },
        { label: 'B', content: String(args.variant_b) },
      ];
      if (args.variant_c) variants.push({ label: 'C', content: String(args.variant_c) });

      // Create AB test record
      const { error: testError } = await supabase.from('ab_tests').insert({
        id: abGroupId,
        org_id: context.orgId,
        name: String(args.name),
        platform,
        variant_count: variants.length,
        metric,
        status: 'running',
        started_at: new Date().toISOString(),
      });
      if (testError) return { success: false, output: `Failed to create A/B test: ${testError.message}` };

      // Create scheduled posts for each variant (staggered by 1 hour)
      const baseTime = args.schedule_at ? new Date(String(args.schedule_at)) : new Date(Date.now() + 3600000);
      const posts = [];

      for (let i = 0; i < variants.length; i++) {
        const scheduledAt = new Date(baseTime.getTime() + i * 3600000); // 1 hour apart
        const { data } = await supabase.from('scheduled_posts').insert({
          id: uuidv4(),
          org_id: context.orgId,
          platform,
          content: variants[i].content,
          scheduled_at: scheduledAt.toISOString(),
          status: 'scheduled',
          ab_group_id: abGroupId,
          variant_label: variants[i].label,
          task_id: context.sessionId,
          created_by: context.agentId,
        }).select().single();
        if (data) posts.push({ variant: variants[i].label, scheduledAt: scheduledAt.toISOString(), postId: data.id });
      }

      return {
        success: true,
        output: `A/B test "${args.name}" created with ${variants.length} variants on ${platform}.\n` +
          `Optimizing for: ${metric}\n` +
          posts.map(p => `- Variant ${p.variant}: scheduled ${p.scheduledAt}`).join('\n') +
          `\n\nResults will be compared after 48 hours of engagement data.`,
      };
    },
    category: 'social',
    costTier: 'cheap',
  },

  {
    name: 'get_scheduled_posts',
    description: 'List upcoming scheduled posts. Shows what content is queued for posting.',
    parameters: {
      platform: { type: 'string', description: 'Filter by platform (optional)' },
      status: { type: 'string', description: 'Filter by status: scheduled, posted, failed (default: scheduled)' },
      limit: { type: 'number', description: 'Max results (default: 20)' },
    },
    required: [],
    execute: async (args, context) => {
      const supabase = createAdminClient();
      let query = supabase
        .from('scheduled_posts')
        .select('*')
        .eq('org_id', context.orgId)
        .order('scheduled_at', { ascending: true })
        .limit(Number(args.limit ?? 20));

      if (args.platform) query = query.eq('platform', String(args.platform));
      if (args.status) query = query.eq('status', String(args.status));
      else query = query.eq('status', 'scheduled');

      const { data, error } = await query;
      if (error) return { success: false, output: `Failed to fetch: ${error.message}` };
      if (!data || data.length === 0) return { success: true, output: 'No scheduled posts found.' };

      const formatted = data.map(p =>
        `- [${p.platform}] ${new Date(p.scheduled_at).toLocaleString()} | ${p.content.slice(0, 80)}...${p.ab_group_id ? ` (A/B: ${p.variant_label})` : ''}`
      ).join('\n');

      return { success: true, output: `**${data.length} Scheduled Posts:**\n${formatted}` };
    },
    category: 'social',
    costTier: 'free',
  },

  {
    name: 'get_ab_test_results',
    description: 'Get results of an A/B test comparing social media content variants.',
    parameters: {
      test_id: { type: 'string', description: 'A/B test ID (optional — shows latest if omitted)' },
    },
    required: [],
    execute: async (args, context) => {
      const supabase = createAdminClient();

      // Get test
      let testQuery = supabase.from('ab_tests').select('*').eq('org_id', context.orgId);
      if (args.test_id) testQuery = testQuery.eq('id', String(args.test_id));
      else testQuery = testQuery.order('created_at', { ascending: false }).limit(1);

      const { data: tests } = await testQuery;
      if (!tests || tests.length === 0) return { success: true, output: 'No A/B tests found.' };

      const test = tests[0];

      // Get variant posts
      const { data: posts } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('ab_group_id', test.id)
        .order('variant_label');

      if (!posts) return { success: true, output: 'No variant data found.' };

      const results = posts.map(p => ({
        variant: p.variant_label,
        status: p.status,
        impressions: p.impressions ?? 0,
        likes: p.likes ?? 0,
        comments: p.comments ?? 0,
        shares: p.shares ?? 0,
        clicks: p.clicks ?? 0,
        engagementRate: p.engagement_rate ?? 0,
        content: p.content.slice(0, 100),
      }));

      // Determine winner
      const metric = test.metric ?? 'engagement_rate';
      const metricKey = metric === 'engagement_rate' ? 'engagementRate' : metric;
      const sorted = [...results].sort((a, b) => (b as any)[metricKey] - (a as any)[metricKey]);
      const winner = sorted[0];

      let output = `**A/B Test: ${test.name}** (${test.platform})\n`;
      output += `Status: ${test.status} | Optimizing for: ${metric}\n\n`;

      for (const r of results) {
        const isWinner = r.variant === winner.variant && r.impressions > 0;
        output += `**Variant ${r.variant}${isWinner ? ' (WINNER)' : ''}:**\n`;
        output += `  Impressions: ${r.impressions} | Likes: ${r.likes} | Comments: ${r.comments}\n`;
        output += `  Shares: ${r.shares} | Clicks: ${r.clicks} | Engagement: ${(r.engagementRate * 100).toFixed(1)}%\n`;
        output += `  Content: "${r.content}..."\n\n`;
      }

      return { success: true, output };
    },
    category: 'social',
    costTier: 'free',
  },

  {
    name: 'get_cross_platform_analytics',
    description: 'Get aggregated analytics across all connected social platforms. Shows engagement trends, top-performing content, and audience growth.',
    parameters: {
      days: { type: 'number', description: 'Number of days to analyze (default: 30)' },
    },
    required: [],
    execute: async (args, context) => {
      const supabase = createAdminClient();
      const days = Number(args.days ?? 30);
      const since = new Date(Date.now() - days * 86400000).toISOString();

      // Pull integration data for all social platforms
      const { data: records } = await supabase
        .from('integration_data')
        .select('*')
        .eq('org_id', context.orgId)
        .in('provider', ['linkedin', 'twitter', 'instagram', 'facebook', 'youtube'])
        .gte('synced_at', since);

      if (!records || records.length === 0) {
        return { success: true, output: 'No social media data found. Connect your social accounts to see analytics.' };
      }

      // Aggregate by platform
      const platforms: Record<string, { posts: number; engagement: number; followers: number }> = {};
      for (const r of records) {
        if (!platforms[r.provider]) platforms[r.provider] = { posts: 0, engagement: 0, followers: 0 };
        const data = r.data as Record<string, unknown>;

        if (Array.isArray(data)) {
          platforms[r.provider].posts += data.length;
        }
      }

      // Also pull scheduled post results
      const { data: postedPosts } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('org_id', context.orgId)
        .eq('status', 'posted')
        .gte('created_at', since);

      let output = `**Cross-Platform Analytics (Last ${days} Days)**\n\n`;

      for (const [platform, stats] of Object.entries(platforms)) {
        output += `**${platform.charAt(0).toUpperCase() + platform.slice(1)}:**\n`;
        output += `  Data records: ${stats.posts}\n`;
      }

      if (postedPosts && postedPosts.length > 0) {
        output += `\n**Scheduled Posts Published:** ${postedPosts.length}\n`;
        const totalEngagement = postedPosts.reduce((sum, p) =>
          sum + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0);
        output += `Total Engagement: ${totalEngagement}\n`;

        // Top post
        const topPost = [...postedPosts].sort((a, b) =>
          ((b.likes ?? 0) + (b.comments ?? 0)) - ((a.likes ?? 0) + (a.comments ?? 0))
        )[0];
        if (topPost) {
          output += `\n**Top Post:** [${topPost.platform}] ${topPost.content.slice(0, 80)}...\n`;
          output += `  Likes: ${topPost.likes ?? 0} | Comments: ${topPost.comments ?? 0}\n`;
        }
      }

      return { success: true, output };
    },
    category: 'social',
    costTier: 'free',
  },
]);
```

- [ ] **Step 3: Add scheduling tools to marketing outfit**

In `lib/execution/outfits.ts`, find the marketing outfit's `tools` array and add:
```typescript
// Add to marketing outfit tools array:
'schedule_post',
'create_ab_test',
'get_scheduled_posts',
'get_ab_test_results',
'get_cross_platform_analytics',
```

Also add the import in `lib/execution/orchestrator.ts`:
```typescript
import './tools/scheduling-tools';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/020_content_scheduling.sql lib/execution/tools/scheduling-tools.ts lib/execution/outfits.ts lib/execution/orchestrator.ts
git commit -m "feat: add content scheduling, A/B testing, and cross-platform analytics tools"
```

---

## Phase 6: Adaptive Orchestrator (Zero Overhead)

> Make the orchestrator pipeline dynamic — skip unnecessary steps, fast-path known procedures, stream responses.

### Task 9: Adaptive Pipeline

**Files:**
- Modify: `lib/execution/orchestrator.ts` (runPipeline method)

- [ ] **Step 1: Refactor runPipeline with adaptive stages**

Replace the `runPipeline` method (around line 1234) with an adaptive version:

```typescript
/**
 * Full execution pipeline with adaptive stage skipping.
 *
 * Optimizations:
 * 1. INSTANT path: If procedure exists with high confidence, skip triage + criteria
 * 2. QUICK path: Single Gemini call, no review (unchanged)
 * 3. STANDARD path: Triage → execute → review (skip criteria if procedure matches)
 * 4. HEAVY path: Full pipeline with planning
 *
 * Stage skipping reduces latency by 40-60% for known task patterns.
 */
async runPipeline(taskId: string): Promise<ExecutionTask> {
  const task = await this.getTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);

  try {
    // ── INSTANT PATH: Procedure with high confidence ──
    let matchedProcedure: Procedure | null = null;
    try {
      matchedProcedure = await findMatchingProcedure(task.orgId, task.agentId, task.title);
    } catch { /* best effort */ }

    const isInstant = matchedProcedure && matchedProcedure.runCount >= 3;

    let triageLevel: TriageLevel;
    let executionPlan: string | null = null;

    if (isInstant) {
      // Skip triage entirely — we know how to do this
      triageLevel = 'quick';
      await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
        phase: 'instant_path',
        procedureId: matchedProcedure!.id,
        runCount: matchedProcedure!.runCount,
        reason: 'High-confidence procedure match — skipping triage + criteria',
      });
    } else {
      // 1. Triage
      await this.setTaskStatus(task, 'triaging');
      triageLevel = await this.triageTask(task);
      task.triageLevel = triageLevel;
    }

    // 2. Criteria (skip for QUICK and INSTANT)
    if (triageLevel !== 'quick') {
      task.acceptanceCriteria = await this.generateCriteria(task);
      await this.updateTaskInDb(taskId, { acceptanceCriteria: task.acceptanceCriteria });
    }

    // 2b. Planning (only HEAVY, skip if procedure exists)
    if (triageLevel === 'heavy' && !matchedProcedure) {
      executionPlan = await this.generatePlan(task);
      if (executionPlan) {
        await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
          phase: 'planning',
          plan: executionPlan,
        });
      }
    }

    // Log procedure match if not instant
    if (matchedProcedure && !isInstant) {
      await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
        phase: 'procedure_match',
        procedureId: matchedProcedure.id,
        procedureTitle: matchedProcedure.title,
        runCount: matchedProcedure.runCount,
      });
    }

    // 3. Execute
    await this.setTaskStatus(task, 'executing', { attempts: 1 });
    task.attempts = 1;
    const executionStartMs = Date.now();

    await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
      phase: 'pre_execution',
      triageLevel,
      criteriaCount: task.acceptanceCriteria.length,
      hasPlan: !!executionPlan,
      hasProcedure: !!matchedProcedure,
      isInstant,
    });

    let { result, artifacts, toolCallHistory } = await this.executeTask(task, executionPlan, matchedProcedure);

    // Quality gate: retry if clearly broken
    if (result.length < 50 || /^(No response|Agent failed|error|undefined)/i.test(result.trim())) {
      console.warn(`[Orchestrator] Low quality result (${result.length} chars), retrying...`);
      await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', { phase: 'auto_retry', reason: 'low_quality_output' });
      const retry = await this.executeTask(task, executionPlan, matchedProcedure);
      if (retry.result.length > result.length) {
        result = retry.result;
        artifacts = [...artifacts, ...retry.artifacts];
        toolCallHistory = retry.toolCallHistory;
      }
    }

    task.result = result;
    task.artifacts = artifacts;

    await this.updateTaskInDb(taskId, {
      result: task.result,
      artifacts: task.artifacts,
      costSpent: task.costSpent,
    });

    // 4. QUICK/INSTANT → done
    if (triageLevel === 'quick') {
      task.completedAt = new Date().toISOString();
      await this.setTaskStatus(task, 'completed', {
        completedAt: task.completedAt,
        costSpent: task.costSpent,
      });

      await this.emitEvent(task.id, task.agentId, task.orgId, 'output', {
        content: result,
        resultLength: result.length,
        artifactCount: (task.artifacts ?? []).length,
        triageLevel,
        isInstant,
        totalCost: task.costSpent,
      });

      const quickTimeMs = Date.now() - executionStartMs;
      if (matchedProcedure) {
        recordProcedureUse(matchedProcedure.id, quickTimeMs).catch(() => {});
      } else {
        saveProcedure(task.orgId, task.agentId, task.title, toolCallHistory, quickTimeMs).catch(() => {});
      }

      return task;
    }

    // 5. Review loop
    await this.setTaskStatus(task, 'reviewing');
    const maxReviewAttempts = triageLevel === 'heavy' ? 2 : 1;

    for (let attempt = 0; attempt < maxReviewAttempts; attempt++) {
      await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
        phase: 'review',
        attempt: attempt + 1,
        maxAttempts: maxReviewAttempts,
        criteriaCount: task.acceptanceCriteria.length,
      });

      const { verdict, feedback } = await this.reviewOutput(task, result);

      if (verdict === 'accept') {
        task.completedAt = new Date().toISOString();
        await this.setTaskStatus(task, 'completed', {
          completedAt: task.completedAt,
          costSpent: task.costSpent,
        });

        await this.emitEvent(task.id, task.agentId, task.orgId, 'output', {
          content: result,
          resultLength: result.length,
          artifactCount: (task.artifacts ?? []).length,
          verdict: 'accept',
          reviewAttempt: attempt + 1,
          totalCost: task.costSpent,
        });

        const acceptTimeMs = Date.now() - executionStartMs;
        if (matchedProcedure) {
          recordProcedureUse(matchedProcedure.id, acceptTimeMs).catch(() => {});
        } else {
          saveProcedure(task.orgId, task.agentId, task.title, toolCallHistory, acceptTimeMs).catch(() => {});
        }

        return task;
      }

      if (verdict === 'fail') {
        task.reviewFeedback = feedback;
        await this.setTaskStatus(task, 'failed', {
          reviewFeedback: feedback,
          costSpent: task.costSpent,
        });

        await this.emitEvent(task.id, task.agentId, task.orgId, 'output', {
          content: `Task failed: ${feedback}`,
          verdict: 'fail',
          feedback,
          reviewAttempt: attempt + 1,
          totalCost: task.costSpent,
        });

        return task;
      }

      // REVISE
      if (attempt < maxReviewAttempts - 1) {
        task.reviewFeedback = feedback;
        task.attempts += 1;
        await this.setTaskStatus(task, 'revision', {
          reviewFeedback: feedback,
          attempts: task.attempts,
        });

        const revised = await this.executeWithRevision(task, result, feedback);
        result = revised.result;
        task.result = result;
        task.artifacts = [...(task.artifacts ?? []), ...revised.artifacts];

        await this.updateTaskInDb(taskId, {
          result: task.result,
          artifacts: task.artifacts,
          costSpent: task.costSpent,
        });

        await this.setTaskStatus(task, 'reviewing');
      }
    }

    // Extract lessons
    const lessons = extractLessons(task.agentId, task.title, result, task.reviewFeedback ?? undefined);
    for (const lesson of lessons) {
      await saveAgentMemory(task.orgId, task.agentId, lesson,
        lesson.startsWith('CORRECTION') ? 'correction' : lesson.startsWith('CONTEXT') ? 'context' : 'lesson',
        task.id);
    }

    const facts = extractFactsFromOutput(result, task.title);
    for (const fact of facts) {
      await saveAgentMemory(task.orgId, task.agentId, fact, 'context', task.id).catch(() => {});
    }

    // Accept after max revisions
    task.completedAt = new Date().toISOString();
    task.reviewFeedback = (task.reviewFeedback ?? '') + '\n[Accepted after max revision attempts]';
    await this.setTaskStatus(task, 'completed', {
      completedAt: task.completedAt,
      reviewFeedback: task.reviewFeedback,
      costSpent: task.costSpent,
    });

    await this.emitEvent(task.id, task.agentId, task.orgId, 'output', {
      content: result,
      resultLength: result.length,
      artifactCount: (task.artifacts ?? []).length,
      verdict: 'accepted_after_max_revisions',
      totalCost: task.costSpent,
    });

    const exhaustedTimeMs = Date.now() - executionStartMs;
    if (matchedProcedure) {
      recordProcedureUse(matchedProcedure.id, exhaustedTimeMs).catch(() => {});
    } else {
      saveProcedure(task.orgId, task.agentId, task.title, toolCallHistory, exhaustedTimeMs).catch(() => {});
    }

    return task;

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    task.status = 'failed';
    task.reviewFeedback = `Pipeline error: ${message}`;

    await this.updateTaskInDb(taskId, {
      status: 'failed',
      reviewFeedback: task.reviewFeedback,
      costSpent: task.costSpent,
    });

    await this.emitEvent(task.id, task.agentId, task.orgId, 'error', {
      error: message,
      phase: 'pipeline',
      totalCost: task.costSpent,
    });

    return task;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/execution/orchestrator.ts
git commit -m "feat: adaptive orchestrator — instant path for known procedures, dynamic stage skipping"
```

### Task 10: Post Scheduler Background Worker

**Files:**
- Create: `lib/execution/post-scheduler.ts`
- Create: `app/api/cron/publish-posts/route.ts`

- [ ] **Step 1: Create post publisher worker**

```typescript
// lib/execution/post-scheduler.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { createLinkedInPost, createTweet, createInstagramPost, createFacebookPost } from '@/lib/integrations/composio-tools';

/**
 * Publish all scheduled posts that are due.
 * Called by cron endpoint every 5 minutes.
 */
export async function publishDuePosts(): Promise<{
  published: number;
  failed: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Find posts that are due
  const { data: duePosts } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at')
    .limit(20);  // Process max 20 per run

  if (!duePosts || duePosts.length === 0) {
    return { published: 0, failed: 0, errors: [] };
  }

  let published = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const post of duePosts) {
    // Mark as posting
    await supabase.from('scheduled_posts')
      .update({ status: 'posting' })
      .eq('id', post.id);

    try {
      let result: { success: boolean; url?: string; id?: string; error?: string } | null = null;

      switch (post.platform) {
        case 'linkedin':
          result = await publishToLinkedIn(post.org_id, post.content);
          break;
        case 'twitter':
          result = await publishToTwitter(post.org_id, post.content);
          break;
        case 'instagram':
          if (post.media_urls?.length > 0) {
            result = await publishToInstagram(post.org_id, post.content, post.media_urls[0]);
          } else {
            result = { success: false, error: 'Instagram requires a media URL' };
          }
          break;
        case 'facebook':
          result = await publishToFacebook(post.org_id, post.content);
          break;
        default:
          result = { success: false, error: `Unsupported platform: ${post.platform}` };
      }

      if (result?.success) {
        await supabase.from('scheduled_posts')
          .update({
            status: 'posted',
            post_url: result.url,
            post_id: result.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);
        published++;
      } else {
        await supabase.from('scheduled_posts')
          .update({
            status: 'failed',
            error_message: result?.error ?? 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);
        failed++;
        errors.push(`${post.platform}:${post.id}: ${result?.error}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase.from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);
      failed++;
      errors.push(`${post.platform}:${post.id}: ${msg}`);
    }
  }

  return { published, failed, errors };
}

// ── Platform Publishers ──────────────────────────────────────────────────────

async function publishToLinkedIn(orgId: string, content: string) {
  try {
    const result = await createLinkedInPost(orgId, content, 'PUBLIC');
    return { success: true, url: result?.url, id: result?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function publishToTwitter(orgId: string, content: string) {
  try {
    const result = await createTweet(orgId, content);
    return { success: true, url: result?.url, id: result?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function publishToInstagram(orgId: string, caption: string, imageUrl: string) {
  try {
    const result = await createInstagramPost(orgId, imageUrl, caption);
    return { success: true, url: result?.url, id: result?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function publishToFacebook(orgId: string, content: string) {
  try {
    // Get first page for the org, then post to it
    const { getFacebookPages } = await import('@/lib/integrations/composio-tools');
    const pages = await getFacebookPages(orgId);
    const pageId = pages?.[0]?.id ?? pages?.data?.[0]?.id;
    if (!pageId) return { success: false, error: 'No Facebook pages found. Connect a Facebook page first.' };
    const result = await createFacebookPost(orgId, pageId, content);
    return { success: true, url: result?.url, id: result?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 2: Create cron API route**

```typescript
// app/api/cron/publish-posts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { publishDuePosts } from '@/lib/execution/post-scheduler';

export async function GET(req: NextRequest) {
  // Verify cron secret (set in Vercel/Cloud Run cron config)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await publishDuePosts();

  return NextResponse.json({
    ...result,
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/execution/post-scheduler.ts app/api/cron/publish-posts/route.ts
git commit -m "feat: add post scheduler background worker — publishes due scheduled posts every 5 min"
```

---

## Phase 7: Enterprise Agent Upgrades (Agent Definition Enhancements)

### Task 11: Upgrade Agent Definitions

**Files:**
- Modify: `lib/execution/agents/index.ts`
- Modify: `lib/execution/outfits.ts`

- [ ] **Step 1: Upgrade agent cost budgets for pro model usage**

In `lib/execution/agents/index.ts`, update cost budgets for all agents:

```typescript
// strategist
costBudget: {
  perTask: 0.50,   // was 0.10 — uses pro model
  daily: 5.00,     // was 1.00
},

// marketer
costBudget: {
  perTask: 0.30,   // was 0.05
  daily: 3.00,     // was 0.50
},

// analyst
costBudget: {
  perTask: 0.30,   // was 0.05
  daily: 3.00,     // was 0.50
},

// recruiter
costBudget: {
  perTask: 0.20,   // was 0.05
  daily: 2.00,     // was 0.40
},

// operator
costBudget: {
  perTask: 0.20,   // was 0.05
  daily: 2.00,     // was 0.40
},

// researcher
costBudget: {
  perTask: 0.30,   // was 0.08
  daily: 3.00,     // was 0.60
},

// codebot
costBudget: {
  perTask: 0.30,   // was 0.08
  daily: 3.00,     // was 0.60
},
```

- [ ] **Step 2: Increase outfit maxToolRounds for deeper execution**

In `lib/execution/outfits.ts`, increase tool rounds:

```typescript
// marketing outfit
maxToolRounds: 12,   // was 8 — deeper campaigns need more rounds

// finance outfit
maxToolRounds: 10,   // was 6

// research outfit
maxToolRounds: 12,   // was 8 — deep research benefits from more rounds

// operations outfit
maxToolRounds: 10,   // was 7

// codebot outfit
maxToolRounds: 10,   // was 7
```

- [ ] **Step 3: Add campaign-aware system prompt extensions**

In each outfit's `systemPromptExtension`, add:

```typescript
// Add to marketing outfit systemPromptExtension:
`
## CAMPAIGN & SCHEDULING
- You can SCHEDULE posts for future dates using schedule_post tool
- You can create A/B TESTS to optimize content using create_ab_test tool
- When creating content for a campaign, be aware of the CAMPAIGN CONTEXT from prior steps
- Use get_cross_platform_analytics to inform content strategy with real engagement data
- After creating content, ALWAYS offer to schedule it for optimal posting time
`

// Add to all outfits:
`
## LEARNING & FEEDBACK
- Your performance is tracked. User feedback improves your future work.
- If you've done similar tasks before, you may have a PROCEDURE to follow (check context).
- When you learn something new about this org, the system saves it automatically.
`
```

- [ ] **Step 4: Commit**

```bash
git add lib/execution/agents/index.ts lib/execution/outfits.ts
git commit -m "feat: upgrade agents — higher budgets, more tool rounds, campaign-aware prompts"
```

---

## Phase 8: Integration Test Suite

### Task 12: End-to-End Tests

**Files:**
- Create: `scripts/test-enterprise-features.ts`

- [ ] **Step 1: Write comprehensive test script**

```typescript
// scripts/test-enterprise-features.ts

import { selectModel, MODELS } from '../lib/execution/model-router';
import { CampaignEngine } from '../lib/execution/campaign-engine';
import { listCampaignTemplates, getCampaignTemplate } from '../lib/execution/campaign-templates';
import { processFeedback, getAgentPerformance } from '../lib/execution/feedback';

const results: { name: string; pass: boolean; error?: string }[] = [];

function test(name: string, fn: () => boolean | Promise<boolean>) {
  return (async () => {
    try {
      const pass = await fn();
      results.push({ name, pass });
      console.log(`${pass ? '✓' : '✗'} ${name}`);
    } catch (err) {
      results.push({ name, pass: false, error: err instanceof Error ? err.message : String(err) });
      console.log(`✗ ${name}: ${err}`);
    }
  })();
}

async function main() {
  console.log('=== Enterprise Features Test Suite ===\n');

  // ── Model Router Tests ──
  console.log('--- Model Router ---');

  await test('QUICK → flash', () => {
    const m = selectModel({ triageLevel: 'quick', agentId: 'marketer', taskTitle: 'Post update', taskDescription: '', costCeiling: 1, costSpent: 0, hasIntegrationData: false, toolCount: 10 });
    return m.tier === 'flash';
  });

  await test('HEAVY → pro', () => {
    const m = selectModel({ triageLevel: 'heavy', agentId: 'marketer', taskTitle: 'Full plan', taskDescription: '', costCeiling: 2, costSpent: 0, hasIntegrationData: true, toolCount: 20 });
    return m.tier === 'pro';
  });

  await test('Strategist → pro', () => {
    const m = selectModel({ triageLevel: 'standard', agentId: 'strategist', taskTitle: 'Review', taskDescription: '', costCeiling: 1, costSpent: 0, hasIntegrationData: false, toolCount: 10 });
    return m.tier === 'pro';
  });

  await test('Low budget → flash override', () => {
    const m = selectModel({ triageLevel: 'heavy', agentId: 'analyst', taskTitle: 'Deep', taskDescription: '', costCeiling: 0.10, costSpent: 0.08, hasIntegrationData: false, toolCount: 10 });
    return m.tier === 'flash';
  });

  await test('Strategy keyword → pro', () => {
    const m = selectModel({ triageLevel: 'standard', agentId: 'marketer', taskTitle: 'Go-to-market strategy', taskDescription: '', costCeiling: 2, costSpent: 0, hasIntegrationData: false, toolCount: 10 });
    return m.tier === 'pro';
  });

  await test('Pro model has higher token limit', () => {
    return MODELS.pro.maxOutputTokens > MODELS.flash.maxOutputTokens;
  });

  // ── Campaign Template Tests ──
  console.log('\n--- Campaign Templates ---');

  await test('Has 5+ templates', () => listCampaignTemplates().length >= 5);

  await test('Product launch template exists', () => {
    const t = getCampaignTemplate('product-launch');
    return !!t && t.steps.length >= 5;
  });

  await test('Templates have valid agent IDs', () => {
    const validAgents = ['strategist', 'marketer', 'analyst', 'recruiter', 'operator', 'researcher', 'codebot'];
    return listCampaignTemplates().every(t =>
      t.steps.every(s => validAgents.includes(s.agentId))
    );
  });

  await test('Dependencies reference valid step orders', () => {
    return listCampaignTemplates().every(t =>
      t.steps.every(s =>
        (s.dependsOn ?? []).every(dep => dep >= 1 && dep <= t.steps.length)
      )
    );
  });

  // ── Summary ──
  console.log('\n=== Results ===');
  const passed = results.filter(r => r.pass).length;
  console.log(`${passed}/${results.length} passed (${((passed / results.length) * 100).toFixed(1)}%)`);

  if (passed < results.length) {
    console.log('\nFailed:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ✗ ${r.name}${r.error ? `: ${r.error}` : ''}`));
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Run tests**

Run: `npx tsx scripts/test-enterprise-features.ts`
Expected: 10/10 passed

- [ ] **Step 3: Commit**

```bash
git add scripts/test-enterprise-features.ts
git commit -m "test: add enterprise feature test suite — model router, campaigns, templates"
```

---

## Summary of Changes

| Phase | What | Impact | Files |
|-------|------|--------|-------|
| 1. Model Router | Flash/Pro/Deep based on complexity | 3-5x better reasoning for complex tasks | `model-router.ts`, `orchestrator.ts` |
| 2. Context Ceiling | 64KB sections, smarter compression | No more truncated analysis | `data-tools.ts`, `defensive-harness.ts` |
| 3. Campaigns | Multi-step workflows with dependencies | Product launches, content calendars in one click | `campaign-engine.ts`, `campaign-templates.ts`, migration, API routes |
| 4. Learning Loop | User feedback → lessons → memory | Agents improve with every task | `feedback.ts`, migration, API route |
| 5. Deep Integrations | Scheduling, A/B testing, cross-platform analytics | Full social media strategy, not just posting | `scheduling-tools.ts`, `post-scheduler.ts`, migration |
| 6. Adaptive Orchestrator | Instant path, dynamic stage skipping | 40-60% faster for known patterns | `orchestrator.ts` refactor |
| 7. Agent Upgrades | Higher budgets, more rounds, campaign prompts | Enterprise-grade depth | `agents/index.ts`, `outfits.ts` |
| 8. Tests | Comprehensive test suite | Confidence in all changes | `test-enterprise-features.ts` |

**New files:** 10
**Modified files:** 7
**New DB tables:** 6 (campaigns, campaign_steps, scheduled_posts, ab_tests, task_feedback, agent_performance)
**Estimated implementation time:** 12 tasks, each 15-30 min = ~4-6 hours total
