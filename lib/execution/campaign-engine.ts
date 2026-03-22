/**
 * Campaign Engine — Multi-step coordinated agent campaigns
 *
 * Architecture principles:
 * 1. Parallel dispatch: Steps without dependencies run concurrently
 * 2. Fresh context per step: Each step gets only relevant prior results
 * 3. Two-stage verification: Steps complete → verify → retry if needed
 * 4. Plan execution with checkpoints: Track progress, allow pause/resume
 */

import { v4 as uuidv4 } from 'uuid';
import { createAdminClient } from '@/lib/supabase/admin';
import { Orchestrator } from './orchestrator';

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface StepInput {
  stepOrder: number;
  title: string;
  description?: string;
  agentId: string;
  /** 1-indexed order numbers of steps this step depends on */
  dependsOn?: number[];
  condition?: string;
  delayMinutes?: number;
  timeoutMinutes?: number;
  maxRetries?: number;
}

export interface CreateCampaignOptions {
  description?: string;
  templateId?: string;
  triggerType?: Campaign['triggerType'];
  cronExpression?: string;
  timezone?: string;
  sharedContext?: Record<string, unknown>;
  createdBy?: string;
}

// ── DB Mappers ─────────────────────────────────────────────────────────────────

function dbToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    title: row.title as string,
    description: (row.description as string) ?? undefined,
    templateId: (row.template_id as string) ?? undefined,
    status: (row.status as Campaign['status']) ?? 'draft',
    triggerType: (row.trigger_type as Campaign['triggerType']) ?? 'manual',
    cronExpression: (row.cron_expression as string) ?? undefined,
    timezone: (row.timezone as string) ?? 'UTC',
    totalSteps: (row.total_steps as number) ?? 0,
    completedSteps: (row.completed_steps as number) ?? 0,
    currentStepId: (row.current_step_id as string) ?? undefined,
    sharedContext: (row.shared_context as Record<string, unknown>) ?? {},
    createdBy: (row.created_by as string) ?? undefined,
    startedAt: (row.started_at as string) ?? undefined,
    completedAt: (row.completed_at as string) ?? undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

function dbToStep(row: Record<string, unknown>): CampaignStep {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    orgId: row.org_id as string,
    stepOrder: (row.step_order as number) ?? 0,
    title: row.title as string,
    description: (row.description as string) ?? undefined,
    agentId: row.agent_id as string,
    dependsOn: (row.depends_on as string[]) ?? [],
    condition: (row.condition as string) ?? undefined,
    status: (row.status as CampaignStep['status']) ?? 'pending',
    taskId: (row.task_id as string) ?? undefined,
    resultSummary: (row.result_summary as string) ?? undefined,
    delayMinutes: (row.delay_minutes as number) ?? 0,
    timeoutMinutes: (row.timeout_minutes as number) ?? 30,
    retryCount: (row.retry_count as number) ?? 0,
    maxRetries: (row.max_retries as number) ?? 2,
    startedAt: (row.started_at as string) ?? undefined,
    completedAt: (row.completed_at as string) ?? undefined,
  };
}

// ── Campaign Engine ────────────────────────────────────────────────────────────

export class CampaignEngine {
  /**
   * Create a campaign with steps. Steps' dependsOn arrays use 1-indexed order
   * numbers which are resolved to UUIDs during creation.
   */
  async createCampaign(
    orgId: string,
    title: string,
    steps: StepInput[],
    options: CreateCampaignOptions = {}
  ): Promise<Campaign> {
    const supabase = createAdminClient();
    const campaignId = uuidv4();

    // Generate all step UUIDs upfront so we can resolve dependsOn
    const stepIds: string[] = steps.map(() => uuidv4());

    // Insert campaign
    const { data: campaignRow, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        id: campaignId,
        org_id: orgId,
        title,
        description: options.description ?? null,
        template_id: options.templateId ?? null,
        status: 'draft',
        trigger_type: options.triggerType ?? 'manual',
        cron_expression: options.cronExpression ?? null,
        timezone: options.timezone ?? 'UTC',
        total_steps: steps.length,
        completed_steps: 0,
        shared_context: options.sharedContext ?? {},
        created_by: options.createdBy ?? null,
      })
      .select()
      .single();

    if (campaignError) {
      throw new Error(`Failed to create campaign: ${campaignError.message}`);
    }

    // Insert steps with resolved dependency UUIDs
    const stepRows = steps.map((step, idx) => ({
      id: stepIds[idx],
      campaign_id: campaignId,
      org_id: orgId,
      step_order: step.stepOrder,
      title: step.title,
      description: step.description ?? null,
      agent_id: step.agentId,
      depends_on: (step.dependsOn ?? []).map((orderNum) => {
        const resolvedId = stepIds[orderNum - 1];
        if (!resolvedId) {
          throw new Error(
            `Step "${step.title}" depends on step ${orderNum} which doesn't exist (only ${steps.length} steps)`
          );
        }
        return resolvedId;
      }),
      condition: step.condition ?? null,
      status: 'pending',
      delay_minutes: step.delayMinutes ?? 0,
      timeout_minutes: step.timeoutMinutes ?? 30,
      max_retries: step.maxRetries ?? 2,
    }));

    const { error: stepsError } = await supabase.from('campaign_steps').insert(stepRows);

    if (stepsError) {
      // Clean up campaign if steps failed
      await supabase.from('campaigns').delete().eq('id', campaignId);
      throw new Error(`Failed to create campaign steps: ${stepsError.message}`);
    }

    return dbToCampaign(campaignRow as Record<string, unknown>);
  }

  /**
   * Run a campaign: find ready steps, execute in parallel, handle retries,
   * track progress. Loops until all done or a terminal failure occurs.
   */
  async runCampaign(campaignId: string): Promise<Campaign> {
    const supabase = createAdminClient();

    // Mark campaign as running
    await supabase
      .from('campaigns')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', campaignId);

    console.log(`[CampaignEngine] Starting campaign ${campaignId}`);

    // Main execution loop
    let iteration = 0;
    const MAX_ITERATIONS = 100; // safety guard

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      // Reload campaign to check for pause/cancel signals
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

      if (campaign.status === 'paused') {
        console.log(`[CampaignEngine] Campaign ${campaignId} is paused — stopping loop`);
        return campaign;
      }
      if (campaign.status === 'cancelled') {
        console.log(`[CampaignEngine] Campaign ${campaignId} was cancelled`);
        return campaign;
      }

      // Load all steps
      const { data: stepRows, error: stepsError } = await supabase
        .from('campaign_steps')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('step_order', { ascending: true });

      if (stepsError) throw new Error(`Failed to load steps: ${stepsError.message}`);

      const allSteps = (stepRows ?? []).map((r) => dbToStep(r as Record<string, unknown>));

      // Check terminal conditions
      const failed = allSteps.filter((s) => s.status === 'failed');
      const completed = allSteps.filter((s) => s.status === 'completed' || s.status === 'skipped');
      const active = allSteps.filter((s) => s.status !== 'failed' && s.status !== 'skipped');

      if (failed.length > 0 && completed.length + failed.length === allSteps.length) {
        // All done but some failed
        await supabase
          .from('campaigns')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            completed_steps: completed.length,
          })
          .eq('id', campaignId);
        return (await this.getCampaign(campaignId))!;
      }

      if (active.every((s) => s.status === 'completed' || s.status === 'skipped')) {
        // All steps done
        await supabase
          .from('campaigns')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_steps: allSteps.length,
          })
          .eq('id', campaignId);
        console.log(`[CampaignEngine] Campaign ${campaignId} completed`);
        return (await this.getCampaign(campaignId))!;
      }

      // Find steps that are ready to run:
      // - Not already completed/failed/skipped/running
      // - All dependencies are completed
      const completedIds = new Set(
        allSteps.filter((s) => s.status === 'completed' || s.status === 'skipped').map((s) => s.id)
      );

      const readySteps = allSteps.filter((step) => {
        if (!['pending', 'waiting'].includes(step.status)) return false;
        return step.dependsOn.every((depId) => completedIds.has(depId));
      });

      if (readySteps.length === 0) {
        // No ready steps — check if anything is still running
        const running = allSteps.filter((s) => s.status === 'running');
        if (running.length === 0) {
          // Deadlock: steps are pending but deps will never complete
          console.error(`[CampaignEngine] Deadlock detected in campaign ${campaignId}`);
          await supabase
            .from('campaigns')
            .update({ status: 'failed', completed_at: new Date().toISOString() })
            .eq('id', campaignId);
          return (await this.getCampaign(campaignId))!;
        }
        // Still running — wait a moment and re-check
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      // Build prior results map for context injection
      const priorResults = allSteps
        .filter((s) => s.status === 'completed' && s.resultSummary)
        .map((s) => ({ title: s.title, summary: s.resultSummary! }));

      // Mark all ready steps as running
      await supabase
        .from('campaign_steps')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .in(
          'id',
          readySteps.map((s) => s.id)
        );

      // Update campaign's current step pointer to first ready step
      await supabase
        .from('campaigns')
        .update({ current_step_id: readySteps[0].id })
        .eq('id', campaignId);

      console.log(
        `[CampaignEngine] Executing ${readySteps.length} step(s) in parallel: ${readySteps.map((s) => s.title).join(', ')}`
      );

      // Execute all ready steps in parallel
      const results = await Promise.allSettled(
        readySteps.map((step) => this.executeStep(step, priorResults))
      );

      // Process results
      let batchCompleted = 0;
      for (let i = 0; i < readySteps.length; i++) {
        const step = readySteps[i];
        const result = results[i];

        if (result.status === 'fulfilled') {
          const outcome = result.value;

          if (outcome.status === 'waiting') {
            // Delay step — leave as 'waiting' for cron pickup
            await supabase
              .from('campaign_steps')
              .update({ status: 'waiting' })
              .eq('id', step.id);
          } else if (outcome.status === 'completed') {
            await supabase
              .from('campaign_steps')
              .update({
                status: 'completed',
                task_id: outcome.taskId ?? null,
                result_summary: outcome.summary ?? null,
                completed_at: new Date().toISOString(),
              })
              .eq('id', step.id);
            batchCompleted++;
          } else {
            // Failed outcome
            await this.handleStepFailure(step, outcome.error ?? 'Step execution returned failure');
          }
        } else {
          // Promise rejected
          await this.handleStepFailure(step, result.reason instanceof Error ? result.reason.message : String(result.reason));
        }
      }

      // Update campaign progress after batch
      const { data: freshSteps } = await supabase
        .from('campaign_steps')
        .select('status')
        .eq('campaign_id', campaignId);

      const newCompleted = (freshSteps ?? []).filter(
        (s) => s.status === 'completed' || s.status === 'skipped'
      ).length;

      await supabase
        .from('campaigns')
        .update({ completed_steps: newCompleted })
        .eq('id', campaignId);

      console.log(`[CampaignEngine] Batch done. ${newCompleted}/${allSteps.length} steps complete`);
    }

    // Safety: exceeded max iterations
    console.error(`[CampaignEngine] Campaign ${campaignId} exceeded max iterations`);
    await supabase
      .from('campaigns')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', campaignId);
    return (await this.getCampaign(campaignId))!;
  }

  /**
   * Handle step failure with retry logic.
   */
  private async handleStepFailure(step: CampaignStep, errorMsg: string): Promise<void> {
    const supabase = createAdminClient();
    const newRetryCount = step.retryCount + 1;

    if (newRetryCount <= step.maxRetries) {
      console.log(
        `[CampaignEngine] Step "${step.title}" failed (attempt ${newRetryCount}/${step.maxRetries + 1}), retrying...`
      );
      await supabase
        .from('campaign_steps')
        .update({ status: 'pending', retry_count: newRetryCount })
        .eq('id', step.id);
    } else {
      console.error(
        `[CampaignEngine] Step "${step.title}" permanently failed after ${newRetryCount} attempts: ${errorMsg}`
      );
      await supabase
        .from('campaign_steps')
        .update({
          status: 'failed',
          result_summary: `Failed: ${errorMsg}`,
          completed_at: new Date().toISOString(),
          retry_count: newRetryCount,
        })
        .eq('id', step.id);
    }
  }

  /**
   * Execute a single campaign step.
   * - Handles delays (inline ≤5min, 'waiting' for longer)
   * - Builds context from prior step results
   * - Submits as execution task via orchestrator
   * - Summarizes result for downstream steps
   */
  async executeStep(
    step: CampaignStep,
    priorResults: Array<{ title: string; summary: string }>
  ): Promise<{ status: 'completed' | 'failed' | 'waiting'; taskId?: string; summary?: string; error?: string }> {
    // Handle delay
    if (step.delayMinutes > 0) {
      const INLINE_DELAY_THRESHOLD = 5; // minutes
      if (step.delayMinutes <= INLINE_DELAY_THRESHOLD) {
        console.log(`[CampaignEngine] Waiting ${step.delayMinutes}min before step "${step.title}"`);
        await new Promise((r) => setTimeout(r, step.delayMinutes * 60 * 1000));
      } else {
        console.log(
          `[CampaignEngine] Step "${step.title}" has ${step.delayMinutes}min delay — marking as waiting for cron`
        );
        return { status: 'waiting' };
      }
    }

    // Build description with prior campaign context
    let fullDescription = step.description ?? step.title;

    if (priorResults.length > 0) {
      const priorContext = priorResults
        .map((r) => `**${r.title}**: ${r.summary}`)
        .join('\n\n');
      fullDescription = `${fullDescription}\n\n--- PRIOR CAMPAIGN STEPS ---\n${priorContext}`;
    }

    try {
      const orchestrator = new Orchestrator();

      const taskId = await orchestrator.submitTask({
        orgId: step.orgId,
        title: step.title,
        description: fullDescription,
        agentId: step.agentId,
        priority: 'medium',
        acceptanceCriteria: [],
        maxAttempts: 1, // Campaign engine handles retries
        costCeiling: 2.0,
      });

      console.log(`[CampaignEngine] Step "${step.title}" submitted as task ${taskId}`);

      const result = await orchestrator.runPipeline(taskId);

      if (result.status === 'completed') {
        // Summarize the result for downstream steps (cap at 500 chars)
        const summary = result.result
          ? result.result.slice(0, 500) + (result.result.length > 500 ? '...' : '')
          : 'Step completed successfully';

        return { status: 'completed', taskId, summary };
      } else {
        return {
          status: 'failed',
          taskId,
          error: result.result ?? `Task ended with status: ${result.status}`,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[CampaignEngine] Step "${step.title}" threw an error: ${msg}`);
      return { status: 'failed', error: msg };
    }
  }

  /**
   * Get a campaign with all its steps.
   */
  async getCampaign(campaignId: string): Promise<Campaign | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (error || !data) return null;
    return dbToCampaign(data as Record<string, unknown>);
  }

  /**
   * Get all steps for a campaign.
   */
  async getCampaignSteps(campaignId: string): Promise<CampaignStep[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('step_order', { ascending: true });

    if (error) throw new Error(`Failed to load steps: ${error.message}`);
    return (data ?? []).map((r) => dbToStep(r as Record<string, unknown>));
  }

  /**
   * List campaigns for an org, optionally filtered by status.
   */
  async listCampaigns(orgId: string, status?: Campaign['status']): Promise<Campaign[]> {
    const supabase = createAdminClient();
    let query = supabase
      .from('campaigns')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list campaigns: ${error.message}`);
    return (data ?? []).map((r) => dbToCampaign(r as Record<string, unknown>));
  }

  /**
   * Pause a running campaign. The execution loop checks this flag and stops.
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', campaignId);

    if (error) throw new Error(`Failed to pause campaign: ${error.message}`);
    console.log(`[CampaignEngine] Campaign ${campaignId} paused`);
  }

  /**
   * Resume a paused campaign by setting status back to running and re-executing.
   */
  async resumeCampaign(campaignId: string): Promise<Campaign> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'running' })
      .eq('id', campaignId);

    if (error) throw new Error(`Failed to resume campaign: ${error.message}`);
    console.log(`[CampaignEngine] Campaign ${campaignId} resumed`);

    return this.runCampaign(campaignId);
  }

  /**
   * Cancel a campaign. Marks it cancelled; any running steps will complete
   * but no new steps will be dispatched.
   */
  async cancelCampaign(campaignId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', campaignId);

    if (error) throw new Error(`Failed to cancel campaign: ${error.message}`);
    console.log(`[CampaignEngine] Campaign ${campaignId} cancelled`);
  }
}
