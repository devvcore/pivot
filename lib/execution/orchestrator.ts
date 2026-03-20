/**
 * Task Orchestrator — Execute, review, revise pipeline
 *
 * Based on BetterBot's orchestrator pattern:
 * 1. Triage task complexity (QUICK / STANDARD / HEAVY)
 * 2. Generate acceptance criteria (3-7 testable items)
 * 3. Spawn agent with appropriate outfit
 * 4. Execute task (agent uses tools in a multi-turn loop)
 * 5. Review output against criteria (using quick model)
 * 6. If REVISE: send feedback, re-execute (max 3 attempts)
 * 7. If ACCEPT: mark complete, return artifacts
 * 8. If FAIL: escalate or notify user
 *
 * Production-ready: Supabase-backed task store, event emission, cost tracking.
 */

import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAgent, type AgentDefinition } from './agents/index';
import { OUTFITS, getOutfitSystemPrompt } from './outfits';
import { globalRegistry, createCostTracker, type ToolContext, type ToolResult } from './tools/index';
import { loadAgentMemories, formatMemoriesAsContext, saveAgentMemory, extractLessons, extractFactsFromOutput } from './agent-memory';
import { findMatchingProcedure, saveProcedure, recordProcedureUse, formatProcedureAsContext, type Procedure } from './procedures';
import { fuzzyMatchTool, correctArgs, coerceArgs, detectLazyResponse, extractToolOutputsFromHistory } from './defensive-harness';
import { loadDirectives, formatDirectivesAsContext, checkDirectiveViolation, type Directive } from './directives';
import { needsApproval, getToolTier, describeToolAction, assessRiskLevel } from './tool-tiers';

// Import tool modules to ensure they self-register
import './tools/web-tools';
import './tools/communication-tools';
import './tools/marketing-tools';
import './tools/finance-tools';
import './tools/hr-tools';
import './tools/operations-tools';
import './tools/data-tools';
import './tools/social-tools';
import './tools/github-action-tools';
import './tools/productivity-tools';
import './tools/media-tools';
import './tools/crm-tools';
import './tools/pm-tools';

const FLASH_MODEL = 'gemini-2.5-flash';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type TaskStatus =
  | 'queued'
  | 'triaging'
  | 'executing'
  | 'reviewing'
  | 'revision'
  | 'awaiting_approval'
  | 'completed'
  | 'failed';

export type TriageLevel = 'quick' | 'standard' | 'heavy';

export interface TaskArtifact {
  type: string;
  name: string;
  content: string;
}

export interface ExecutionTask {
  id: string;
  orgId: string;
  title: string;
  description: string;
  agentId: string;
  priority: TaskPriority;
  status: TaskStatus;
  acceptanceCriteria: string[];
  attempts: number;
  maxAttempts: number;
  result?: string;
  artifacts?: TaskArtifact[];
  reviewFeedback?: string;
  costSpent: number;
  costCeiling: number;
  createdAt: string;
  completedAt?: string;
}

export type TaskInput = Omit<ExecutionTask, 'id' | 'status' | 'attempts' | 'costSpent' | 'createdAt'>;

interface AgentMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface FunctionCallPart {
  functionCall: { name: string; args: Record<string, unknown> };
}

interface FunctionResponsePart {
  functionResponse: { name: string; response: { output: string } };
}

// ── DB Status Mapping ─────────────────────────────────────────────────────────
// TypeScript uses fine-grained statuses; DB CHECK constraint has a smaller set.
// Map between them so DB writes don't violate the constraint.

const STATUS_TO_DB: Record<TaskStatus, string> = {
  queued: 'queued',
  triaging: 'in_progress',
  executing: 'in_progress',
  reviewing: 'review',
  revision: 'revision',
  awaiting_approval: 'review',
  completed: 'completed',
  failed: 'failed',
};

const DB_TO_STATUS: Record<string, TaskStatus> = {
  queued: 'queued',
  in_progress: 'executing',
  review: 'reviewing',
  revision: 'revision',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'failed',
};

// ── DB <-> TypeScript Mappers ─────────────────────────────────────────────────

function dbToTask(row: Record<string, unknown>): ExecutionTask {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    agentId: row.agent_id as string,
    priority: (row.priority as TaskPriority) ?? 'medium',
    status: DB_TO_STATUS[row.status as string] ?? 'queued',
    acceptanceCriteria: (row.acceptance_criteria as string[]) ?? [],
    attempts: (row.attempts as number) ?? 0,
    maxAttempts: (row.max_attempts as number) ?? 3,
    result: (row.result as string) ?? undefined,
    artifacts: (row.artifacts as TaskArtifact[]) ?? undefined,
    reviewFeedback: (row.review_feedback as string) ?? undefined,
    costSpent: (row.cost_spent as number) ?? 0,
    costCeiling: (row.cost_ceiling as number) ?? 1.0,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    completedAt: (row.completed_at as string) ?? undefined,
  };
}

function taskToDb(task: Partial<ExecutionTask>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (task.id !== undefined) db.id = task.id;
  if (task.orgId !== undefined) db.org_id = task.orgId;
  if (task.title !== undefined) db.title = task.title;
  if (task.description !== undefined) db.description = task.description;
  if (task.agentId !== undefined) db.agent_id = task.agentId;
  if (task.priority !== undefined) db.priority = task.priority;
  if (task.status !== undefined) db.status = STATUS_TO_DB[task.status] ?? task.status;
  if (task.acceptanceCriteria !== undefined) db.acceptance_criteria = task.acceptanceCriteria;
  if (task.attempts !== undefined) db.attempts = task.attempts;
  if (task.maxAttempts !== undefined) db.max_attempts = task.maxAttempts;
  if (task.result !== undefined) db.result = task.result;
  if (task.artifacts !== undefined) db.artifacts = task.artifacts;
  if (task.reviewFeedback !== undefined) db.review_feedback = task.reviewFeedback;
  if (task.costSpent !== undefined) db.cost_spent = task.costSpent;
  if (task.costCeiling !== undefined) db.cost_ceiling = task.costCeiling;
  if (task.createdAt !== undefined) db.created_at = task.createdAt;
  if (task.completedAt !== undefined) db.completed_at = task.completedAt;
  return db;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenAI({ apiKey });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('503');
      if (!isRetryable || attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000;
      console.warn(`[Orchestrator] Retry ${attempt + 1}/${maxRetries}: ${msg.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}

async function quickGenerate(prompt: string): Promise<string> {
  return withRetry(async () => {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt,
      config: { temperature: 0.0, maxOutputTokens: 4000 },
    });
    return response.text ?? '';
  });
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class Orchestrator {
  private deliverables: Record<string, unknown> | undefined;
  private isBackground: boolean;

  constructor(deliverables?: Record<string, unknown>, isBackground = false) {
    this.deliverables = deliverables;
    this.isBackground = isBackground;
  }

  // ── Event Emission ────────────────────────────────────────────────────────────

  /**
   * Emit an event to the execution_events table.
   * Fails silently -- events are observability, not control flow.
   */
  private async emitEvent(
    taskId: string,
    agentId: string,
    orgId: string,
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from('execution_events').insert({
        task_id: taskId,
        agent_id: agentId,
        org_id: orgId,
        event_type: eventType,
        data,
      });
      if (error) {
        console.warn(`[Orchestrator] Event emission failed (${eventType}):`, error.message);
      }
    } catch (err) {
      console.warn(`[Orchestrator] Event emission error (${eventType}):`, err);
    }
  }

  // ── Approval Gate ────────────────────────────────────────────────────────────

  /**
   * Request approval for an ACT/DESTRUCTIVE tool call in background mode.
   * Creates an approval row in execution_approvals, emits an event,
   * then polls for up to 5 minutes (every 10s) for a decision.
   *
   * Returns: 'approved' | 'rejected' | 'timeout'
   */
  private async requestApproval(
    task: ExecutionTask,
    toolName: string,
    toolArgs: Record<string, unknown>
  ): Promise<'approved' | 'rejected' | 'timeout'> {
    const supabase = createAdminClient();
    const actionDescription = describeToolAction(toolName, toolArgs);
    const riskLevel = assessRiskLevel(toolName, toolArgs);
    const tier = getToolTier(toolName);

    // 1. Insert approval request
    const { data: approval, error: insertError } = await supabase
      .from('execution_approvals')
      .insert({
        task_id: task.id,
        org_id: task.orgId,
        agent_id: task.agentId,
        action_description: actionDescription,
        reasoning: `Agent "${task.agentId}" wants to execute ${toolName} (tier: ${tier}) during background/scheduled run.`,
        risk_level: riskLevel,
        preview: { toolName, toolArgs, tier },
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !approval) {
      console.error('[Orchestrator] Approval insert failed:', insertError?.message);
      // Fail-safe: if we can't create an approval, block the action
      return 'timeout';
    }

    const approvalId = (approval as Record<string, unknown>).id as string;

    // 2. Update task status to awaiting_approval
    await this.setTaskStatus(task, 'awaiting_approval');

    // 3. Emit approval_request event (dashboard can subscribe to this)
    await this.emitEvent(task.id, task.agentId, task.orgId, 'approval_request', {
      approvalId,
      toolName,
      toolArgs,
      actionDescription,
      riskLevel,
      tier,
    });

    // 4. Poll for approval decision (max 5 minutes, every 10 seconds)
    const MAX_WAIT_MS = 5 * 60 * 1000;
    const POLL_INTERVAL_MS = 10 * 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT_MS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

      const { data: updated, error: fetchError } = await supabase
        .from('execution_approvals')
        .select('status')
        .eq('id', approvalId)
        .single();

      if (fetchError) {
        console.warn('[Orchestrator] Approval poll error:', fetchError.message);
        continue;
      }

      const status = (updated as Record<string, unknown>)?.status as string;

      if (status === 'approved') {
        // Resume executing status
        await this.setTaskStatus(task, 'executing');
        return 'approved';
      } else if (status === 'rejected' || status === 'revision_requested') {
        await this.setTaskStatus(task, 'executing');
        return 'rejected';
      }
      // Still 'pending' → keep polling
    }

    // 5. Timeout — mark the approval as timed out
    await supabase
      .from('execution_approvals')
      .update({ status: 'rejected', feedback: 'Auto-rejected: approval timed out after 5 minutes' })
      .eq('id', approvalId);

    await this.setTaskStatus(task, 'executing');
    return 'timeout';
  }

  // ── Cost Tracking to Supabase ─────────────────────────────────────────────────

  /**
   * Record a model call's cost to the execution_costs table.
   * Fails silently -- cost recording is best-effort.
   */
  private async recordCost(
    orgId: string,
    agentId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
    taskId: string
  ): Promise<void> {
    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from('execution_costs').insert({
        org_id: orgId,
        agent_id: agentId,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        task_id: taskId,
      });
      if (error) {
        console.warn('[Orchestrator] Cost recording failed:', error.message);
      }
    } catch (err) {
      console.warn('[Orchestrator] Cost recording error:', err);
    }
  }

  // ── Task DB Helpers ───────────────────────────────────────────────────────────

  /**
   * Persist a partial update to the task row in Supabase.
   */
  private async updateTaskInDb(
    taskId: string,
    updates: Partial<ExecutionTask>
  ): Promise<void> {
    try {
      const supabase = createAdminClient();
      const dbUpdates = taskToDb(updates);
      dbUpdates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('execution_tasks')
        .update(dbUpdates)
        .eq('id', taskId);

      if (error) {
        console.error(`[Orchestrator] Task update failed (${taskId}):`, error.message);
      }
    } catch (err) {
      console.error(`[Orchestrator] Task update error (${taskId}):`, err);
    }
  }

  /**
   * Update task status in DB and emit a status_change event.
   */
  private async setTaskStatus(
    task: ExecutionTask,
    newStatus: TaskStatus,
    extra?: Partial<ExecutionTask>
  ): Promise<void> {
    const oldStatus = task.status;
    task.status = newStatus;

    // Apply extra fields to the in-memory task object
    if (extra) {
      Object.assign(task, extra);
    }

    const updates: Partial<ExecutionTask> = { status: newStatus, ...extra };
    await this.updateTaskInDb(task.id, updates);

    await this.emitEvent(task.id, task.agentId, task.orgId, 'status_change', {
      from: oldStatus,
      to: newStatus,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /**
   * Submit a task into the execution pipeline.
   * INSERTs into Supabase execution_tasks and returns the UUID.
   */
  async submitTask(input: TaskInput): Promise<string> {
    const task: ExecutionTask = {
      ...input,
      id: uuidv4(),
      status: 'queued',
      attempts: 0,
      costSpent: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      const supabase = createAdminClient();
      const dbRow = taskToDb(task);
      const { error } = await supabase.from('execution_tasks').insert(dbRow);

      if (error) {
        console.error('[Orchestrator] Task insert failed:', error.message);
      }
    } catch (err) {
      console.error('[Orchestrator] Task insert error:', err);
    }

    return task.id;
  }

  /**
   * Get a task by ID from Supabase.
   */
  async getTask(taskId: string): Promise<ExecutionTask | undefined> {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('execution_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error || !data) {
        console.warn(`[Orchestrator] Task not found (${taskId}):`, error?.message);
        return undefined;
      }

      return dbToTask(data as Record<string, unknown>);
    } catch (err) {
      console.error(`[Orchestrator] getTask error (${taskId}):`, err);
      return undefined;
    }
  }

  /**
   * List tasks from Supabase, optionally filtered by org, status, or agent.
   */
  async listTasks(filters?: {
    orgId?: string;
    status?: TaskStatus;
    agentId?: string;
  }): Promise<ExecutionTask[]> {
    try {
      const supabase = createAdminClient();
      let query = supabase
        .from('execution_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.orgId) {
        query = query.eq('org_id', filters.orgId);
      }
      if (filters?.status) {
        query = query.eq('status', STATUS_TO_DB[filters.status] ?? filters.status);
      }
      if (filters?.agentId) {
        query = query.eq('agent_id', filters.agentId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Orchestrator] listTasks failed:', error.message);
        return [];
      }

      return (data ?? []).map((row: Record<string, unknown>) => dbToTask(row));
    } catch (err) {
      console.error('[Orchestrator] listTasks error:', err);
      return [];
    }
  }

  /**
   * Triage: determine task complexity.
   * QUICK = simple, skip review (e.g., generate a single document)
   * STANDARD = normal flow with review
   * HEAVY = complex multi-step, needs thorough review
   */
  async triageTask(task: ExecutionTask): Promise<TriageLevel> {
    const prompt = `Classify this task's complexity level. Bias towards QUICK — most single-turn requests are QUICK.

Task: "${task.title}"
Description: "${task.description}"

Respond with EXACTLY one word:
- QUICK: Most tasks. Single deliverable, lookup, sending something, creating one item, research, analysis. DEFAULT to this.
- STANDARD: Multi-part deliverables that need cross-referencing (e.g., full strategy with budget AND timeline AND staffing).
- HEAVY: Only for tasks that explicitly require multiple complex interconnected outputs.

Response:`;

    const result = await quickGenerate(prompt);
    const level = result.trim().toLowerCase();

    if (level.includes('quick')) return 'quick';
    if (level.includes('heavy')) return 'heavy';
    return 'standard';
  }

  /**
   * Generate acceptance criteria for a task.
   * Returns 3-7 testable criteria.
   */
  async generateCriteria(task: ExecutionTask): Promise<string[]> {
    if (task.acceptanceCriteria.length > 0) {
      return task.acceptanceCriteria; // User provided their own
    }

    const prompt = `Generate 3-7 specific, testable acceptance criteria for this task.

Task: "${task.title}"
Description: "${task.description}"
Agent: ${task.agentId}

Each criterion must be:
- Specific and measurable (not vague)
- Binary — either met or not met
- Focused on quality and completeness

Output ONLY a JSON array of strings, no other text. Example:
["The document includes at least 5 sections", "All financial numbers are internally consistent"]`;

    const result = await quickGenerate(prompt);

    try {
      const match = result.match(/\[[\s\S]*\]/);
      if (match) {
        const criteria = JSON.parse(match[0]) as string[];
        return criteria.slice(0, 7);
      }
    } catch {
      // Fallback to generic criteria
    }

    return [
      'The output is complete and addresses all aspects of the task description.',
      'The output is well-structured with clear sections and formatting.',
      'The content is specific to this company — references actual business details, not generic placeholders.',
      'All statistics, metrics, and numbers are either sourced from analysis data, labeled as estimates, or cited from known benchmarks.',
      'No fabricated company names, case studies, testimonials, or quotes appear in the output.',
      'The output ends with concrete, actionable next steps.',
    ];
  }

  /**
   * Execute a task using the assigned agent with its outfit tools.
   * Runs a multi-turn tool-calling loop.
   * Emits tool_call, tool_result, and thinking events throughout.
   * Records per-call costs to execution_costs.
   */
  async executeTask(task: ExecutionTask, executionPlan?: string | null, procedure?: Procedure | null): Promise<{ result: string; artifacts: TaskArtifact[]; toolCallHistory: Array<{ name: string; args: Record<string, unknown> }> }> {
    const agent = getAgent(task.agentId);
    if (!agent) {
      throw new Error(`Unknown agent: ${task.agentId}`);
    }

    const outfit = OUTFITS[agent.defaultOutfit];
    if (!outfit) {
      throw new Error(`Unknown outfit: ${agent.defaultOutfit}`);
    }

    // Load persistent agent memory + org directives in parallel
    const [memories, orgDirectives] = await Promise.all([
      loadAgentMemories(task.orgId, task.agentId, 8),
      loadDirectives(task.orgId),
    ]);
    const memoryContext = formatMemoriesAsContext(memories);
    const directivesContext = formatDirectivesAsContext(orgDirectives);

    // Build system prompt (with directives, memory, and procedure appended)
    let systemPrompt = this.buildSystemPrompt(agent, task);
    // Directives go BEFORE behavioral rules (injected right after domain knowledge)
    if (directivesContext) {
      systemPrompt += '\n\n' + directivesContext;
    }
    if (memoryContext) {
      systemPrompt += '\n\n' + memoryContext;
    }
    if (procedure) {
      systemPrompt += '\n\n' + formatProcedureAsContext(procedure);
    }

    // Track tool calls for procedure learning
    const toolCallHistory: Array<{ name: string; args: Record<string, unknown> }> = [];

    // Get tool definitions for this outfit
    const tools = globalRegistry.getByNames(outfit.tools);
    const functionDeclarations = globalRegistry.toGeminiFunctionDeclarations(outfit.tools);

    // Create cost tracker
    const costTracker = createCostTracker(task.costCeiling);

    // Create tool context
    const toolContext: ToolContext = {
      orgId: task.orgId,
      agentId: task.agentId,
      sessionId: task.id,
      deliverables: this.deliverables,
      costTracker,
    };

    // Emit thinking event at start of execution
    await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
      phase: 'execution_start',
      systemPrompt: systemPrompt.slice(0, 500),
      toolCount: functionDeclarations.length,
    });

    // Run multi-turn agent loop
    const ai = getGemini();
    const allArtifacts: TaskArtifact[] = [];
    const conversationHistory: Array<{ role: string; parts: unknown[] }> = [];

    // Initial user message (with execution plan if available)
    const userPrompt = this.buildTaskPrompt(task, executionPlan);
    conversationHistory.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });

    let maxRounds = outfit.maxToolRounds;
    let finalResponse = '';

    // Loop guard: detect repeated tool calls (BetterBot-style)
    const toolCallCounts = new Map<string, number>();  // tool_name -> count
    const toolSigCounts = new Map<string, number>();   // tool_name+args -> count

    for (let round = 0; round < maxRounds; round++) {
      const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: conversationHistory as Array<{ role: 'user' | 'model'; parts: { text: string }[] }>,
        config: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          systemInstruction: systemPrompt,
          tools: functionDeclarations.length > 0
            ? [{ functionDeclarations }]
            : undefined,
          toolConfig: functionDeclarations.length > 0
            ? { functionCallingMode: 'AUTO' }
            : undefined,
        } as Record<string, unknown>,
      });

      // Track cost for this model call
      const usageMetadata = (response as unknown as Record<string, unknown>).usageMetadata as
        | { promptTokenCount?: number; candidatesTokenCount?: number }
        | undefined;
      const inputTokens = usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
      // Gemini Flash pricing: $0.15/M input, $0.60/M output
      const callCost = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;

      if (inputTokens > 0 || outputTokens > 0) {
        await this.recordCost(
          task.orgId,
          task.agentId,
          FLASH_MODEL,
          inputTokens,
          outputTokens,
          callCost,
          task.id
        );
        task.costSpent += callCost;
      }

      // Check if we have function calls
      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        finalResponse = response.text ?? 'No response generated.';
        break;
      }

      const parts = candidate.content.parts;
      const functionCalls: FunctionCallPart[] = [];
      let textContent = '';

      for (const part of parts) {
        const p = part as Record<string, unknown>;
        if (p.functionCall) {
          functionCalls.push(p as unknown as FunctionCallPart);
        }
        if (p.text) {
          textContent += String(p.text);
        }
      }

      // Add model response to history
      conversationHistory.push({
        role: 'model',
        parts,
      });

      // If no function calls, this is the final response
      if (functionCalls.length === 0) {
        finalResponse = textContent;
        break;
      }

      // Execute function calls
      const functionResponses: FunctionResponsePart[] = [];

      for (const fc of functionCalls) {
        let { name, args } = fc.functionCall;

        // Defensive harness: fuzzy-match hallucinated tool names
        if (!globalRegistry.get(name)) {
          const matched = fuzzyMatchTool(name, outfit.tools);
          if (matched) {
            console.warn(`[DefensiveHarness] Fuzzy-matched tool "${name}" → "${matched}"`);
            await this.emitEvent(task.id, task.agentId, task.orgId, 'tool_call', {
              tool: name,
              correctedTo: matched,
              round,
              harness: 'fuzzy_match',
            });
            name = matched;
          }
        }

        // Defensive harness: correct misspelled arg names + coerce types
        const toolDef = globalRegistry.get(name);
        if (toolDef) {
          const expectedParams = Object.keys(toolDef.parameters);
          args = correctArgs(name, args as Record<string, unknown>, expectedParams);
          const typeSchema: Record<string, string> = {};
          for (const [pName, pDef] of Object.entries(toolDef.parameters)) {
            typeSchema[pName] = pDef.type;
          }
          args = coerceArgs(args, typeSchema);
        }

        // Loop guard: track call frequency
        const sig = `${name}:${JSON.stringify(args)}`;
        toolCallCounts.set(name, (toolCallCounts.get(name) ?? 0) + 1);
        toolSigCounts.set(sig, (toolSigCounts.get(sig) ?? 0) + 1);

        const nameCount = toolCallCounts.get(name) ?? 0;
        const sigCount = toolSigCounts.get(sig) ?? 0;

        // Block exact duplicate calls (same tool + same args called 2+ times)
        if (sigCount >= 2) {
          functionResponses.push({
            functionResponse: {
              name,
              response: { output: `DUPLICATE: You already called ${name} with these exact arguments. Use the data you have and write your response NOW.` },
            },
          });
          continue;
        }

        // Block same tool called too many times (3+)
        // Allow more calls for research tools (scrape_website, web_search) — needed for multi-client personalization
        const isResearchTool = ['scrape_website', 'web_search', 'query_integration_data'].includes(name);
        const maxNameCalls = isResearchTool ? 6 : 4;
        if (nameCount >= maxNameCalls) {
          functionResponses.push({
            functionResponse: {
              name,
              response: { output: `ENOUGH: You have called ${name} ${nameCount} times. Write your final response with the data you have.` },
            },
          });
          continue;
        }

        // Directive violation check — block 'never' directives before execution
        const violation = checkDirectiveViolation(name, args as Record<string, unknown>, orgDirectives);
        if (violation.violated) {
          await this.emitEvent(task.id, task.agentId, task.orgId, 'tool_call', {
            tool: name,
            args,
            round,
            blocked: true,
            reason: violation.directive,
          });
          functionResponses.push({
            functionResponse: {
              name,
              response: { output: violation.directive },
            },
          });
          continue;
        }

        // ── Approval gate: ACT/DESTRUCTIVE tools need approval in background mode ──
        if (needsApproval(name, this.isBackground)) {
          const approvalResult = await this.requestApproval(task, name, args as Record<string, unknown>);
          if (approvalResult === 'rejected') {
            functionResponses.push({
              functionResponse: {
                name,
                response: { output: `ACTION BLOCKED: The user rejected this ${name} action. Do NOT retry. Explain that the action was not taken and offer alternatives.` },
              },
            });
            continue;
          } else if (approvalResult === 'timeout') {
            functionResponses.push({
              functionResponse: {
                name,
                response: { output: `APPROVAL TIMED OUT: No response within 5 minutes for ${name}. The action was NOT executed. Mention this in your response and suggest the user can re-trigger it.` },
              },
            });
            continue;
          }
          // 'approved' → fall through to execute
        }

        // Emit tool_call event
        await this.emitEvent(task.id, task.agentId, task.orgId, 'tool_call', {
          tool: name,
          args,
          round,
          tier: getToolTier(name),
        });

        // Record for procedure learning
        toolCallHistory.push({ name, args: args as Record<string, unknown> });

        // Execute the tool
        let toolResult: ToolResult;
        try {
          toolResult = await globalRegistry.execute(name, args, toolContext);
        } catch (toolErr) {
          const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
          functionResponses.push({
            functionResponse: {
              name,
              response: { output: `TOOL ERROR: ${name} threw an exception: ${errMsg}. Try a different approach or write your response with available data.` },
            },
          });
          continue;
        }

        // Collect artifacts
        if (toolResult.artifacts) {
          allArtifacts.push(...toolResult.artifacts);
        }

        // Track cost from tool cost tracker
        task.costSpent = costTracker.totalSpent;

        const outputStr = typeof toolResult.output === 'string' ? toolResult.output : JSON.stringify(toolResult.output ?? '');

        // Emit tool_result event
        await this.emitEvent(task.id, task.agentId, task.orgId, 'tool_result', {
          tool: name,
          outputSummary: outputStr.slice(0, 500),
          success: toolResult.success,
          artifactCount: toolResult.artifacts?.length ?? 0,
          round,
        });

        // Annotate failed tool results so agent knows to try alternatives
        let finalOutput = outputStr.slice(0, 50000); // Gemini Flash has 1M context — use more of it
        if (finalOutput.includes('[connect:')) {
          // Connect markers MUST be passed through verbatim — add explicit instruction
          finalOutput = `${finalOutput}\n\nIMPORTANT: You MUST include the [connect:...] marker EXACTLY as shown above in your response. Copy it verbatim on its own line. The UI renders it as a clickable connection button.`;
        } else if (!toolResult.success) {
          finalOutput = `NOTE: This tool call did not succeed. ${finalOutput}`;
        }

        functionResponses.push({
          functionResponse: {
            name,
            response: { output: finalOutput },
          },
        });
      }

      // Context compaction: compress old tool results to prevent context bloat
      // After 3+ tool rounds, truncate earlier tool results to summaries
      if (round >= 3) {
        for (let h = 0; h < conversationHistory.length - 4; h++) {
          const msg = conversationHistory[h];
          if (msg.role === 'user' && Array.isArray(msg.parts)) {
            for (let pi = 0; pi < msg.parts.length; pi++) {
              const p = msg.parts[pi] as Record<string, unknown>;
              const fr = p?.functionResponse as Record<string, unknown> | undefined;
              if (fr?.response) {
                const resp = fr.response as Record<string, unknown>;
                const output = resp.output;
                if (typeof output === 'string' && output.length > 500) {
                  resp.output = output.slice(0, 300) + '\n...[truncated — use this data in your response]';
                }
              }
            }
          }
        }
      }

      // Add function responses to history
      conversationHistory.push({
        role: 'user',
        parts: functionResponses,
      });

      // Manus-style todo.md attention mechanism: re-inject task goals after every 2 rounds
      // This prevents the agent from "losing focus" as conversation grows
      if (round > 0 && round % 2 === 0 && functionCalls.length > 0) {
        const toolsSoFar = [...toolCallCounts.keys()].join(', ');
        const progressReminder = round === 2
          ? `PROGRESS CHECK — You've called: ${toolsSoFar}. Your task: "${task.title}". Do you have ENOUGH data to write a high-quality response? If yes, WRITE IT NOW. If you need one more specific piece of data, get it and then write.`
          : `FOCUS REMINDER — Task: "${task.title}". You've used ${round} tool rounds (${toolsSoFar}). Write your deliverable NOW with what you have. Do NOT call more tools.`;
        conversationHistory.push({
          role: 'user',
          parts: [{ text: `SYSTEM: ${progressReminder}` }],
        });
      }

      // Check cost ceiling
      if (!costTracker.canAfford(0.001)) {
        conversationHistory.push({
          role: 'user',
          parts: [{ text: 'SYSTEM: Budget limit reached. Please provide your final response with the information gathered so far.' }],
        });
        maxRounds = round + 2; // Allow one more round for the final response
      }
    }

    // Safety net: if the loop exhausted all rounds without producing a text response,
    // force one final "synthesize" call so the agent summarizes what it found.
    if (!finalResponse.trim()) {
      conversationHistory.push({
        role: 'user',
        parts: [{ text: 'SYSTEM: You have used all available tool rounds. Provide your FINAL comprehensive response now using ALL the information you gathered from your tool calls. Synthesize everything into a well-structured deliverable. Do NOT call any more tools — just write your answer.' }],
      });

      try {
        const synthResponse = await ai.models.generateContent({
          model: FLASH_MODEL,
          contents: conversationHistory as Array<{ role: 'user' | 'model'; parts: { text: string }[] }>,
          config: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            systemInstruction: systemPrompt,
            // No tools — force pure text output
          } as Record<string, unknown>,
        });
        finalResponse = synthResponse.text ?? '';
      } catch (err) {
        console.error('[Orchestrator] Forced synthesis failed:', err instanceof Error ? err.message : err);
        finalResponse = 'The agent gathered research data but failed to synthesize a final response. Please try again.';
      }
    }

    // Defensive harness: detect lazy response and re-generate with tool context
    const toolOutputs = extractToolOutputsFromHistory(conversationHistory);
    if (toolOutputs.length > 0 && detectLazyResponse(finalResponse, toolOutputs)) {
      console.warn(`[DefensiveHarness] Lazy response detected (${finalResponse.length} chars). Re-generating with tool context.`);
      await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
        phase: 'lazy_response_recovery',
        originalLength: finalResponse.length,
        toolOutputCount: toolOutputs.length,
      });

      // Append tool outputs as context and ask for a real response
      const toolSummary = toolOutputs
        .map((o, i) => `--- Tool Result ${i + 1} ---\n${o.slice(0, 3000)}`)
        .join('\n\n');
      conversationHistory.push({
        role: 'user',
        parts: [{ text: `SYSTEM: Your response was too brief and did not use the tool data you gathered. Here is a summary of ALL tool outputs:\n\n${toolSummary}\n\nNow write a COMPLETE, DETAILED response that synthesizes this data. Address the task fully: "${task.title}". Minimum 200 words.` }],
      });

      try {
        const regenResponse = await ai.models.generateContent({
          model: FLASH_MODEL,
          contents: conversationHistory as Array<{ role: 'user' | 'model'; parts: { text: string }[] }>,
          config: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            systemInstruction: systemPrompt,
          } as Record<string, unknown>,
        });
        const regenText = regenResponse.text ?? '';
        if (regenText.length > finalResponse.length) {
          finalResponse = regenText;
        }
      } catch (err) {
        console.error('[DefensiveHarness] Lazy response recovery failed:', err instanceof Error ? err.message : err);
      }
    }

    // Post-processing: inject any [connect:X] markers that tools returned but agent didn't pass through
    finalResponse = this.injectMissedConnectMarkers(finalResponse, conversationHistory);

    return { result: finalResponse, artifacts: allArtifacts, toolCallHistory };
  }

  /**
   * Scan conversation history for [connect:X] markers in tool results that
   * the agent didn't copy into its final response. Inject them.
   */
  private injectMissedConnectMarkers(response: string, history: Array<{ role: string; parts: unknown[] }>): string {
    const connectRe = /\[connect:([a-z_]+)\]/g;

    // Find all connect markers from tool results in history
    const toolMarkers = new Set<string>();
    for (const msg of history) {
      if (msg.role !== 'user') continue;
      for (const part of msg.parts) {
        const p = part as Record<string, unknown>;
        const fr = p?.functionResponse as Record<string, unknown> | undefined;
        const respObj = fr?.response as Record<string, unknown> | undefined;
        const output = respObj?.output;
        if (typeof output === 'string') {
          let match: RegExpExecArray | null;
          const re = new RegExp(connectRe.source, 'g');
          while ((match = re.exec(output)) !== null) {
            toolMarkers.add(match[0]); // e.g. "[connect:linkedin]"
          }
        }
      }
    }

    if (toolMarkers.size === 0) return response;

    // Check which markers are already in the response
    const responseMarkers = new Set<string>();
    let m: RegExpExecArray | null;
    const re2 = new RegExp(connectRe.source, 'g');
    while ((m = re2.exec(response)) !== null) {
      responseMarkers.add(m[0]);
    }

    // Inject missing markers
    const missing = [...toolMarkers].filter(marker => !responseMarkers.has(marker));
    if (missing.length === 0) return response;

    return response + '\n\n' + missing.join('\n');
  }

  /**
   * Review task output against acceptance criteria.
   * Returns 'accept', 'revise', or 'fail'.
   */
  async reviewOutput(
    task: ExecutionTask,
    output: string
  ): Promise<{ verdict: 'accept' | 'revise' | 'fail'; feedback: string }> {
    const criteria = task.acceptanceCriteria;

    const prompt = `You are a strict quality reviewer. Evaluate this task output against the acceptance criteria AND check for hallucinations.

TASK: "${task.title}"
DESCRIPTION: "${task.description}"

ACCEPTANCE CRITERIA:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

OUTPUT TO REVIEW:
${output.slice(0, 16000)}

EVALUATION STEPS:

1. For each acceptance criterion, determine if it is MET or NOT MET with a brief explanation.

2. HALLUCINATION CHECK (critical):
   - Does the output contain invented statistics or financial numbers not from tool output?
   - Does it have fabricated expense breakdowns (e.g. "Operations: $500, Marketing: $300")?
   - Does it show an "estimated burn rate" or fabricated monthly expenses?
   - Does it reference fake company names, case studies, testimonials, or customer IDs?
   - Does it quote people who weren't mentioned in the task?
   - Does it present made-up data as factual?
   - Does it contain tables with fabricated category allocations?
   - If ANY hallucination or fabricated number is found, verdict must be REVISE with specific callouts.

3. GROUNDING CHECK:
   - Is the output specific to THIS company, or could it apply to any business?
   - Are recommendations backed by data from the analysis or clearly labeled as general advice?
   - Does the output include [source: ...] or [from ...] citations for data points?
   - Are numbers traceable to a specific tool result or user input?
   - Any number without a source citation should be flagged as potentially ungrounded.

Then provide your VERDICT:
- ACCEPT: All criteria met, no hallucinations, output is grounded, specific, and production-ready.
- REVISE: Some criteria not met OR hallucinations detected OR output is generic. Provide specific, actionable feedback.
- FAIL: Fundamentally inadequate, heavily hallucinated, or completely off-topic.

QUALITY DIMENSIONS (score each 1-5):
- Accuracy: Are facts correct? Numbers sourced?
- Specificity: Company-specific or could apply to anyone?
- Actionability: Can the user act on this immediately?
- Structure: Well-organized with headers, tables, bold key points?
- Completeness: All aspects of the task addressed?

Output format:
CRITERIA EVALUATION:
1. [MET/NOT MET] - [explanation]
2. [MET/NOT MET] - [explanation]
...

HALLUCINATION CHECK: [CLEAN/ISSUES FOUND] - [details]

QUALITY SCORES: Accuracy=[1-5] Specificity=[1-5] Actionability=[1-5] Structure=[1-5] Completeness=[1-5]

VERDICT: [ACCEPT/REVISE/FAIL]

FEEDBACK: [If REVISE, list exactly what to fix with specific instructions. If ACCEPT with quality scores below 4, note what could be improved next time.]`;

    const result = await quickGenerate(prompt);

    const verdictMatch = result.match(/VERDICT:\s*(ACCEPT|REVISE|FAIL)/i);
    const feedbackMatch = result.match(/FEEDBACK:\s*([\s\S]*?)$/i);

    const verdict = (verdictMatch?.[1]?.toLowerCase() ?? 'revise') as 'accept' | 'revise' | 'fail';
    const feedback = feedbackMatch?.[1]?.trim() ?? result;

    return { verdict, feedback };
  }

  /**
   * Full execution pipeline: triage -> criteria -> execute -> review -> (revise?) -> complete.
   * Reads/writes all state through Supabase. Emits events at every stage.
   */
  async runPipeline(taskId: string): Promise<ExecutionTask> {
    const task = await this.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    try {
      // 1. Triage — fast classification (single Gemini call)
      await this.setTaskStatus(task, 'triaging');
      const triageLevel = await this.triageTask(task);

      // 2. Generate acceptance criteria (skip for QUICK — saves a Gemini call)
      if (triageLevel !== 'quick') {
        task.acceptanceCriteria = await this.generateCriteria(task);
        await this.updateTaskInDb(taskId, { acceptanceCriteria: task.acceptanceCriteria });
      }

      // 2b. Planning phase for STANDARD/HEAVY — helps agent think before acting
      let executionPlan: string | null = null;
      if (triageLevel !== 'quick') {
        executionPlan = await this.generatePlan(task);
        if (executionPlan) {
          await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
            phase: 'planning',
            plan: executionPlan,
          });
        }
      }

      // 2c. Procedure lookup — check if we've done this type of task before
      let matchedProcedure: Procedure | null = null;
      try {
        matchedProcedure = await findMatchingProcedure(task.orgId, task.agentId, task.title);
        if (matchedProcedure) {
          await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
            phase: 'procedure_match',
            procedureId: matchedProcedure.id,
            procedureTitle: matchedProcedure.title,
            runCount: matchedProcedure.runCount,
          });
        }
      } catch {
        /* procedure lookup is best-effort */
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
      });

      let { result, artifacts, toolCallHistory } = await this.executeTask(task, executionPlan, matchedProcedure);

      // Quality gate: if result is too short or clearly broken, retry ONCE
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

      // Persist result and artifacts after execution
      await this.updateTaskInDb(taskId, {
        result: task.result,
        artifacts: task.artifacts,
        costSpent: task.costSpent,
      });

      // 4. QUICK tasks → done immediately (no review, no revision)
      if (triageLevel === 'quick') {
        task.completedAt = new Date().toISOString();
        await this.setTaskStatus(task, 'completed', {
          completedAt: task.completedAt,
          costSpent: task.costSpent,
        });

        await this.emitEvent(task.id, task.agentId, task.orgId, 'output', {
          content: result,
          resultLength: result.length,
          artifactCount: artifacts.length,
          triageLevel,
          totalCost: task.costSpent,
        });

        // Save procedure from successful QUICK task
        const quickTimeMs = Date.now() - executionStartMs;
        if (matchedProcedure) {
          recordProcedureUse(matchedProcedure.id, quickTimeMs).catch(() => {});
        } else {
          saveProcedure(task.orgId, task.agentId, task.title, toolCallHistory, quickTimeMs).catch(() => {});
        }

        return task;
      }

      // 5. Review loop (STANDARD: 1 revision max, HEAVY: 2)
      await this.setTaskStatus(task, 'reviewing');

      const maxReviewAttempts = triageLevel === 'heavy' ? 2 : 1;

      for (let attempt = 0; attempt < maxReviewAttempts; attempt++) {
        // Emit thinking event for review phase
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

          // Save procedure from reviewed+accepted task
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

          // Re-execute with feedback
          const revised = await this.executeWithRevision(task, result, feedback);
          result = revised.result;
          task.result = result;
          task.artifacts = [...(task.artifacts ?? []), ...revised.artifacts];

          // Persist revised result
          await this.updateTaskInDb(taskId, {
            result: task.result,
            artifacts: task.artifacts,
            costSpent: task.costSpent,
          });

          await this.setTaskStatus(task, 'reviewing');
        }
      }

      // Extract and save lessons from the review process
      const lessons = extractLessons(task.agentId, task.title, result, task.reviewFeedback ?? undefined);
      for (const lesson of lessons) {
        await saveAgentMemory(task.orgId, task.agentId, lesson,
          lesson.startsWith('CORRECTION') ? 'correction' : lesson.startsWith('CONTEXT') ? 'context' : 'lesson',
          task.id);
      }

      // Silent fact extraction from output (Ultron pattern — learns without announcing)
      const facts = extractFactsFromOutput(result, task.title);
      for (const fact of facts) {
        await saveAgentMemory(task.orgId, task.agentId, fact, 'context', task.id).catch(() => {});
      }

      // Exhausted revision attempts -- accept what we have
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

      // Save procedure even from exhausted-revision completion (still useful pattern)
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

  // ── Private Helpers ──────────────────────────────────────────────────────────

  /**
   * Build system prompt using BetterBot architecture:
   * Identity → Situational Awareness → Context → Domain Knowledge → Rules
   */
  private buildSystemPrompt(agent: AgentDefinition, task: ExecutionTask): string {
    const outfit = OUTFITS[agent.defaultOutfit];
    const outfitPrompt = getOutfitSystemPrompt(agent.defaultOutfit);
    const hasDeliverables = !!this.deliverables && Object.keys(this.deliverables).length > 0;
    const now = new Date();
    const parts: string[] = [];

    // ═══ 1. IDENTITY ═══
    parts.push(agent.systemPrompt);

    // ═══ 2. SITUATIONAL AWARENESS ═══
    parts.push(`--- Situational Awareness ---
Time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}, ${now.toLocaleDateString('en-US', { weekday: 'long' })}, ${now.toISOString().split('T')[0]}
Agent: ${agent.name} (${agent.id}) | Outfit: ${agent.defaultOutfit}
Task Priority: ${task.priority} | Budget: $${task.costCeiling.toFixed(2)} remaining
Attempt: ${task.attempts + 1}/${task.maxAttempts}`);

    // ═══ 3. CURRENT TASK CONTEXT ═══
    parts.push(`--- Current Task ---
Title: ${task.title}
Description: ${task.description}

Acceptance Criteria:
${task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`);

    // ═══ 4. DOMAIN KNOWLEDGE (outfit-specific) ═══
    parts.push(`--- Domain Knowledge ---\n${outfitPrompt}`);

    // ═══ 5. DATA STRATEGY ═══
    const hasIntegrationData = !!this.deliverables?.['__integrationData'];
    const integrationProviders = (this.deliverables?.['__integrationProviders'] as string[]) ?? [];

    if (hasDeliverables) {
      let dataPrompt = `--- Data Access ---
You have business analysis data available via the query_analysis tool.
1. FIRST: Call query_analysis(section: "list_sections") to discover what data exists.
2. Use query_analysis(section: "search", query: "...") to find relevant data across all sections.
3. Ground ALL content in the company's actual data. Reference specific numbers and insights.
4. If web_search fails, adapt: use scrape_website or query_analysis instead.`;

      if (hasIntegrationData) {
        dataPrompt += `\n\nLIVE INTEGRATION DATA AVAILABLE from: ${integrationProviders.join(', ')}
- **USE query_integration_data tool** to pull REAL live data from connected services (Stripe, Slack, Gmail, etc.)
  - query_integration_data(provider: "stripe") → real payment/customer data
  - query_integration_data(provider: "slack") → real channel/team data
  - query_integration_data() → list ALL available integration data
- You can also use query_analysis(section: "search", query: "...") for data baked into the analysis.
- ALWAYS PREFER query_integration_data for real-time metrics over estimates.
- Cite sources: "[from Stripe]", "[from Gmail]", etc.
- This is LIVE data from the user's connected accounts — treat it as ground truth.`;
      }
      parts.push(dataPrompt);
    } else {
      parts.push(`--- Data Access ---
No business analysis data is loaded. This means:
1. The task title and description are your PRIMARY context. Extract every detail: company, industry, product, audience.
2. Do NOT call query_analysis - there is no data to query.
3. CREATE YOUR DELIVERABLE DIRECTLY using the information in the task. Your #1 job is producing the content/analysis/plan — not searching for data.
4. You CAN use query_integration_data to pull LIVE data from connected services (Stripe, Slack, Gmail, etc.) if relevant.
5. You CAN use web_search for real market data if needed (1-2 searches max).
6. NEVER produce generic placeholder content. Be specific with the information given.
7. Action tools (post_to_linkedin, write_to_google_sheets, send_email, etc.) check connections internally. Do NOT call check_connection separately.
8. If you don't have data for something, say "I don't have that data." Do NOT estimate, fabricate, or make up numbers.`);
    }

    // ═══ 6. BEHAVIORAL RULES (BetterBot-style) ═══
    parts.push(`--- Rules ---

EXECUTION MINDSET — YOU ARE A DOER:
- Execute the task. The request IS your permission. NEVER ask "would you like me to..."
- Lead with the OUTPUT, not the process. Show the deliverable, then briefly explain.
- One excellent deliverable beats three mediocre ones. Focus.

NO TEMPLATES — ABSOLUTE RULE:
- NEVER use [Client Name], [Company Name], [mention project], [insert X], or ANY placeholder brackets.
- You have tools. USE THEM. Look up the actual client name from Stripe. Scrape their website for details. Search the web for their company.
- If you're writing an email to a client, it must contain THEIR ACTUAL NAME, their actual company, their actual project — not placeholders.
- If you have 3 clients in Stripe, draft 3 SEPARATE personalized emails with real names and real context.
- If you don't have a piece of information, call a tool to find it. scrape_website on their domain. web_search their company name.
- ONLY if a tool search truly returns nothing should you leave a detail as "[unknown — ask user]".
- Templates are USELESS to the user. They can write templates themselves. YOUR value is PERSONALIZATION using real data.

THINK → RESEARCH → PERSONALIZE → DELIVER:
1. THINK: What does the user need? Who is it for? What data do I need?
2. RESEARCH: Pull client data from Stripe/integrations. Scrape their website. Search the web. Build a profile.
3. PERSONALIZE: Use the research to fill in EVERY detail. Real names, real companies, real projects, real numbers.
4. DELIVER: Write the output with zero placeholders. Every field filled with real data.

TOOL USAGE — BE THOROUGH, NOT LAZY:
- For PERSONALIZED content (emails, outreach, proposals): use 4-6 tool calls. Research each client.
  - query_integration_data(stripe) → get client names, emails, payment history
  - scrape_website(clientDomain) → understand their business, find their name, products
  - web_search(clientName + company) → find recent news, social presence
  - THEN write the personalized content with ALL this context
- For SIMPLE tasks (analysis, strategy): 2-4 tool calls is enough.
- NEVER stop at generic when you could personalize with one more tool call.
- After EVERY tool result: "Can I make this MORE specific?" If yes, keep going.

FAIL-FAST RECOVERY:
- Tool fails → try ONE alternative → write with available data. Never retry the same call.
- Tool returns no data → say "no data found" → proceed with task description context.
- Connection not available → include [connect:provider] verbatim → still produce the deliverable.
- After 2 failed tools, STOP trying tools and write your best answer from context.

CONTENT + ACTION — BOTH REQUIRED:
- Your #1 priority is producing the DELIVERABLE (content, analysis, plan, posting, etc.) in your response text.
- WRITE the actual content (posts, emails, job postings, budgets, plans) DIRECTLY in your response.
- Do NOT delegate content creation to tools like create_social_post, create_ad_copy. Write it yourself.
- The ORDER is: (1) gather data if needed, (2) WRITE your deliverable, (3) call action tools to publish.
- MANDATORY: When the user asks to POST/SEND/CREATE something, you MUST call the action tool. ALWAYS. No exceptions.
  - "Post to LinkedIn" → MUST call post_to_linkedin
  - "Send email" → MUST call send_email
  - "Create Jira ticket" → MUST call create_jira_ticket
  - "List GitHub repos" → MUST call github_list_repos
  - Even if you think it might fail, CALL THE TOOL. The tool handles connections internally.
- If the tool returns [connect:provider], include it VERBATIM in your response AND still show your content.
- If a send/post tool fails, report the failure clearly. Do NOT pretend you sent it.
- NEVER skip a tool call because you think the service isn't connected. The tools handle this.

FOLLOW-UP CONTEXT — CRITICAL:
- If the CONVERSATION CONTEXT contains a previous message where content was created (e.g. an Instagram post, email draft, LinkedIn post), and the user now says "post it" or "send it" or "post to instagram" — use the EXISTING content from context. Do NOT create brand new content.
- Look for the most recent relevant content in the conversation context and use it directly.
- Example: if context shows you previously created an Instagram caption, and user says "post to instagram", call post_to_instagram with that existing caption. Don't write a new one.
- When the user says "post to X", call the posting tool directly with the content from context. The tool checks connections internally and returns [connect:X] if not connected.

OUTPUT QUALITY — THE BAR IS HIGH:
- You are talking to a REAL PERSON. Write like the best consultant they've ever hired.
- STRUCTURE: ## Header → Key Insight → Supporting Data → Action Items
- FORMAT: **Bold** key numbers/findings. | Tables | for comparisons. > Blockquotes for featured content.
- LENGTH: 300-500 words. Dense > long. If asked for "comprehensive", max 600. NEVER exceed 600.
- SPECIFICITY: Every claim must reference THIS company's data, not generic advice. "Your Stripe shows $X MRR" not "MRR is important."
- NUMBERS: Always show the actual number from data, not vague statements. "$4,200 MRR from 12 paying customers" not "moderate revenue."
- TABLES: Max 5 rows. If more exist, show "Top 5 of X" with a note.
- NO FILLER: Never repeat information. Never list capabilities. Never describe process. Show results.
- OPENING LINE: Start with the most important finding or deliverable. No preamble.
- CLOSING: 2-3 specific next steps YOU can do. "Want me to create a LinkedIn post from this?" not "Consider social media."

PROACTIVE ACTION SUGGESTIONS — ALWAYS DO THIS:
- End EVERY response with 2-3 specific, ready-to-execute next steps
- Frame them as things YOU will do: "Want me to draft a LinkedIn post about this?" not "You could post on LinkedIn"
- Be specific: "I'll create an upsell email to your 2 hosting clients" not "Consider email marketing"
- If the task involves analysis, suggest actions: posting, emailing, creating tickets, exporting to sheets
- If the task involves content, suggest distribution: "Want me to post this to LinkedIn/Twitter?"
- If the task involves hiring, suggest: "Want me to post this job to LinkedIn?"
- Make the user feel like they have a team working for them, not a chatbot answering questions.

QUALITY BAR:
- Your output must be ready to use immediately - not a draft or template.
- Be specific to the company, industry, and audience. No generic filler.
- Use real data, real examples, and specific recommendations.
- End every response with a clear "Next Steps" section.

DATA-FIRST — USE WHAT YOU HAVE:
- You have access to query_analysis (business report data) and query_integration_data (live Stripe, Gmail, etc.).
- BEFORE saying "I don't have that data" or asking the user for info, call your tools.
- If asked about MRR, revenue, expenses, customers — call query_integration_data(provider: "stripe") FIRST.
- If asked about health score, runway, strategy — call query_analysis FIRST.
- NEVER say "please provide your financials" when you have query_integration_data available.
- NEVER say "data not available" without calling at least one tool first.
- If the user corrects you ("my burn rate is actually $X"), accept their correction immediately. Don't argue with the business owner about their own numbers.

ANTI-HALLUCINATION — ABSOLUTE RULE:
- NEVER invent financial numbers. No fake expense breakdowns. No estimated category allocations. No estimated burn rates.
- NEVER create tables with made-up categories (e.g. "Operations: $500, Marketing: $300").
- NEVER invent customer IDs, transaction IDs, payment amounts, or dates.
- Every number you show MUST come from tool output, the user's own words, or clearly labeled industry benchmarks.
- If you don't have data, say so clearly. NEVER fabricate.
- VIOLATING THIS RULE DESTROYS USER TRUST.

SOURCE CITATIONS — MANDATORY:
- Every factual claim and number MUST have an inline source tag.
- Format: "Revenue was **$4,200** [from Stripe]" or "Industry average is 15-20% [industry benchmark]"
- Valid sources: [from Stripe], [from Gmail], [from GitHub], [from Salesforce], [from analysis report], [from task description], [industry benchmark], [from web search]
- If you cannot cite a source for a number, DO NOT include it.
- This is not optional. Every data point needs a source.

SELF-CHECK — BEFORE YOUR FINAL RESPONSE:
- Before writing your answer, mentally verify:
  1. Did I address ALL parts of the request?
  2. Does every number have a [source] tag?
  3. Am I being specific to THIS company, not generic?
  4. Is my response under 500 words?
  5. Did I end with actionable next steps?
- If any check fails, fix it before responding.

INLINE CONNECTIONS — MANDATORY:
- When ANY tool returns a string containing "[connect:XXXX]" (e.g. "[connect:linkedin]", "[connect:github]", "[connect:jira]"), you MUST copy that exact marker into your response. This is critical — the UI renders it as a clickable connection button.
- NEVER paraphrase, explain, or replace the marker. Output it verbatim on its own line.
- NEVER say "go to Settings", "connect via Integrations", "click the connection panel", or give any setup instructions.
- Keep it short and natural around the marker.
- CORRECT: "I'd love to post that to LinkedIn for you!\n\n[connect:linkedin]\n\nOnce connected, I'll post it right away."
- WRONG: "LinkedIn isn't connected yet. Please connect it in your Integration settings."`);

    // ═══ 7. PROACTIVE TRIGGERS ═══
    const triggers = this.getProactiveTriggers(agent, task);
    if (triggers.length > 0) {
      parts.push(`--- Proactive Triggers ---\n${triggers.join('\n')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * BetterBot-style proactive triggers — auto-detect patterns and inject coaching.
   */
  private getProactiveTriggers(agent: AgentDefinition, task: ExecutionTask): string[] {
    const triggers: string[] = [];
    const lower = task.title.toLowerCase() + ' ' + (task.description ?? '').toLowerCase();

    // Marketing: auto-offer posting
    if (agent.id === 'marketer') {
      if (lower.includes('post') || lower.includes('social') || lower.includes('linkedin') || lower.includes('twitter') || lower.includes('instagram') || lower.includes('facebook') || lower.includes('content')) {
        triggers.push('SOCIAL POSTING: After creating content, offer to post directly. Call the posting tool (post_to_linkedin, post_to_twitter, etc.) — it checks connections internally.');
      }
      if (lower.includes('instagram') || lower.includes('ig') || lower.includes('insta')) {
        triggers.push('INSTAGRAM: If the user uploaded an image, use the uploaded image URL with post_to_instagram. Do NOT ask the user for an image URL — use the attachment URL from the task description.');
      }
      if (lower.includes('facebook') || lower.includes('fb')) {
        triggers.push('FACEBOOK: Use post_to_facebook to publish. If the user uploaded a photo, use the attachment URL.');
      }
      if (lower.includes('email') || lower.includes('campaign')) {
        triggers.push('EMAIL: After creating email content, offer to send via send_email. The tool checks Gmail connection internally.');
      }
    }

    // Analyst: auto-offer sheets export
    if (agent.id === 'analyst') {
      if (lower.includes('budget') || lower.includes('forecast') || lower.includes('projection') || lower.includes('financial')) {
        triggers.push('SPREADSHEET: After creating financial data, offer to export to Google Sheets. Call write_to_google_sheets directly — it checks the connection internally.');
      }
    }

    // Recruiter: auto-offer LinkedIn posting
    if (agent.id === 'recruiter') {
      if (lower.includes('job') || lower.includes('posting') || lower.includes('hire')) {
        triggers.push('JOB POSTING: After creating a job posting, offer to publish it on LinkedIn. Call post_to_linkedin directly — it checks the connection internally.');
      }
    }

    // Operator: auto-offer Jira/project tools
    if (agent.id === 'operator') {
      if (lower.includes('project') || lower.includes('plan') || lower.includes('task') || lower.includes('milestone')) {
        triggers.push('PROJECT MANAGEMENT: After creating a plan, offer to create Jira tickets for the milestones. Call create_jira_ticket directly — it checks the connection internally.');
      }
    }

    // CodeBot: auto-offer GitHub actions
    if (agent.id === 'codebot') {
      if (lower.includes('issue') || lower.includes('bug') || lower.includes('feature')) {
        triggers.push('GITHUB: Offer to create a GitHub issue with the findings. Call github_create_issue directly — it checks the connection internally.');
      }
    }

    // Strategist: proactive action dispatch
    if (agent.id === 'strategist') {
      triggers.push('STRATEGY IN ACTION: After providing strategic analysis, suggest concrete actions other agents can take. Examples: "Want me to have the marketer draft a LinkedIn post about this?", "Should the recruiter create a job listing for that engineer role?", "I can have the analyst model this financially." Make the user feel like they have a team.');
      if (lower.includes('competitor') || lower.includes('market') || lower.includes('research')) {
        triggers.push('RESEARCH: After analysis, offer to go deeper. "Want me to research [specific competitor] in detail?" or "Should I analyze their pricing strategy?"');
      }
    }

    // Researcher: proactive follow-ups
    if (agent.id === 'researcher') {
      triggers.push('RESEARCH FOLLOW-UP: After delivering research, suggest specific actions: "Want the marketer to create content based on these findings?" or "Should the strategist build a competitive response plan?"');
    }

    // Analyst: always offer actionable follow-ups
    if (agent.id === 'analyst') {
      triggers.push('DATA TO ACTION: After any analysis, suggest next steps: "Want me to export this to Google Sheets?", "Should I model a 6-month projection?", "Want the marketer to create a report for stakeholders?"');
    }

    // Universal: revision context
    if (task.reviewFeedback) {
      triggers.push(`REVISION NEEDED: Previous attempt had issues: ${task.reviewFeedback}. Address ALL feedback and produce an improved version.`);
    }

    return triggers;
  }

  /**
   * Generate a lightweight execution plan for STANDARD/HEAVY tasks.
   * Helps the agent think before acting — inspired by Claude Code's internal reasoning.
   */
  private async generatePlan(task: ExecutionTask): Promise<string | null> {
    const prompt = `You are planning tool usage for an AI agent task. Output a brief plan (3-5 bullet points) listing:
1. What information do I need? (and which tool to get it)
2. What is the deliverable? (exact format: email, table, analysis, etc.)
3. What's my tool call sequence? (ordered list, max 4 calls)

Task: "${task.title}"
Description: "${task.description}"
Available tools: query_analysis, query_integration_data, web_search, scrape_website, send_email, post_to_linkedin, post_to_twitter, write_to_google_sheets, create_jira_ticket, github_create_issue

Output ONLY the bullet-point plan, nothing else. Be specific.`;

    try {
      const plan = await quickGenerate(prompt);
      return plan.trim();
    } catch {
      return null;
    }
  }

  private buildTaskPrompt(task: ExecutionTask, executionPlan?: string | null): string {
    // BetterBot-style: direct, action-oriented, no hedging
    let prompt = `Execute this now: **${task.title}**`;

    if (task.description) {
      prompt += `\n\n${task.description}`;
    }

    if (task.acceptanceCriteria.length > 0) {
      prompt += `\n\nSuccess criteria:\n`;
      prompt += task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
    }

    // Check for user-uploaded attachments in the description
    if (task.description?.includes('USER ATTACHMENTS')) {
      prompt += `\n\nIMPORTANT: The user has uploaded files. The URLs above are PUBLIC and ready to use.
- For Instagram posting: pass the image URL directly to post_to_instagram as image_url
- For Facebook posting: pass it to post_to_facebook
- For email attachments: reference the URLs in the email body
- Use the files as the user intends — don't ask for files again, you already have them.`;
    }

    // Inject execution plan for STANDARD/HEAVY tasks
    if (executionPlan) {
      prompt += `\n\n--- Execution Plan (follow this) ---\n${executionPlan}\n\nFollow this plan. Gather data first, then produce the deliverable. Do NOT deviate unless a tool fails.`;
    }

    prompt += `\n\nUse your tools, produce the deliverable, and present it conversationally. Keep your response under 500 words. End with 2-3 short next step bullets.`;

    return prompt;
  }

  private async executeWithRevision(
    task: ExecutionTask,
    previousOutput: string,
    feedback: string
  ): Promise<{ result: string; artifacts: TaskArtifact[] }> {
    // Create a modified task with revision context
    const revisedTask: ExecutionTask = {
      ...task,
      description: `${task.description}

--- REVISION REQUIRED ---
Previous output had these issues:
${feedback}

Previous output (for reference):
${previousOutput.slice(0, 3000)}

Please address all the feedback above and produce an improved version.`,
    };

    return this.executeTask(revisedTask);
  }
}

// ── Convenience Functions ─────────────────────────────────────────────────────

/**
 * Create an orchestrator with deliverables loaded.
 * @param deliverables - Business analysis data and integration data
 * @param isBackground - If true, ACT-tier tools require approval before execution
 */
export function createOrchestrator(deliverables?: Record<string, unknown>, isBackground = false): Orchestrator {
  return new Orchestrator(deliverables, isBackground);
}

/**
 * Quick task execution -- submit and run in one step.
 */
export async function executeQuickTask(
  orgId: string,
  title: string,
  description: string,
  agentId: string,
  deliverables?: Record<string, unknown>,
  options?: { priority?: TaskPriority; costCeiling?: number; isBackground?: boolean }
): Promise<ExecutionTask> {
  const orchestrator = createOrchestrator(deliverables, options?.isBackground ?? false);

  const taskId = await orchestrator.submitTask({
    orgId,
    title,
    description,
    agentId,
    priority: options?.priority ?? 'medium',
    acceptanceCriteria: [],
    maxAttempts: 3,
    costCeiling: options?.costCeiling ?? 0.20,
  });

  return orchestrator.runPipeline(taskId);
}
