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

async function quickGenerate(prompt: string): Promise<string> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 0.2, maxOutputTokens: 2000 },
  });
  return response.text ?? '';
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class Orchestrator {
  private deliverables: Record<string, unknown> | undefined;

  constructor(deliverables?: Record<string, unknown>) {
    this.deliverables = deliverables;
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
    const prompt = `Classify this task's complexity level.

Task: "${task.title}"
Description: "${task.description}"
Priority: ${task.priority}

Respond with EXACTLY one word:
- QUICK: Simple, single-output task (e.g., create one document, generate one invoice, look up one thing). Low risk of error.
- STANDARD: Moderate complexity (e.g., multi-section report, campaign with variants, analysis). Needs review.
- HEAVY: Complex, multi-step task (e.g., comprehensive strategy, multi-channel campaign, financial model with scenarios). Needs thorough review.

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
      'The content is specific to the business (not generic filler).',
      'Any data or numbers referenced are plausible and internally consistent.',
    ];
  }

  /**
   * Execute a task using the assigned agent with its outfit tools.
   * Runs a multi-turn tool-calling loop.
   * Emits tool_call, tool_result, and thinking events throughout.
   * Records per-call costs to execution_costs.
   */
  async executeTask(task: ExecutionTask): Promise<{ result: string; artifacts: TaskArtifact[] }> {
    const agent = getAgent(task.agentId);
    if (!agent) {
      throw new Error(`Unknown agent: ${task.agentId}`);
    }

    const outfit = OUTFITS[agent.defaultOutfit];
    if (!outfit) {
      throw new Error(`Unknown outfit: ${agent.defaultOutfit}`);
    }

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(agent, task);

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

    // Initial user message
    const userPrompt = this.buildTaskPrompt(task);
    conversationHistory.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });

    let maxRounds = outfit.maxToolRounds;
    let finalResponse = '';

    for (let round = 0; round < maxRounds; round++) {
      const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: conversationHistory as Array<{ role: 'user' | 'model'; parts: { text: string }[] }>,
        config: {
          temperature: 0.4,
          maxOutputTokens: 4000,
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
        const { name, args } = fc.functionCall;

        // Emit tool_call event
        await this.emitEvent(task.id, task.agentId, task.orgId, 'tool_call', {
          tool: name,
          args,
          round,
        });

        // Execute the tool
        const toolResult = await globalRegistry.execute(name, args, toolContext);

        // Collect artifacts
        if (toolResult.artifacts) {
          allArtifacts.push(...toolResult.artifacts);
        }

        // Track cost from tool cost tracker
        task.costSpent = costTracker.totalSpent;

        // Emit tool_result event
        await this.emitEvent(task.id, task.agentId, task.orgId, 'tool_result', {
          tool: name,
          outputSummary: toolResult.output.slice(0, 500),
          artifactCount: toolResult.artifacts?.length ?? 0,
          round,
        });

        functionResponses.push({
          functionResponse: {
            name,
            response: {
              output: toolResult.output.slice(0, 8000), // Truncate to keep context manageable
            },
          },
        });
      }

      // Add function responses to history
      conversationHistory.push({
        role: 'user',
        parts: functionResponses,
      });

      // Check cost ceiling
      if (!costTracker.canAfford(0.001)) {
        conversationHistory.push({
          role: 'user',
          parts: [{ text: 'SYSTEM: Budget limit reached. Please provide your final response with the information gathered so far.' }],
        });
        maxRounds = round + 2; // Allow one more round for the final response
      }
    }

    return { result: finalResponse, artifacts: allArtifacts };
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

    const prompt = `You are a quality reviewer. Evaluate this task output against the acceptance criteria.

TASK: "${task.title}"
DESCRIPTION: "${task.description}"

ACCEPTANCE CRITERIA:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

OUTPUT TO REVIEW:
${output.slice(0, 6000)}

For each criterion, determine if it is MET or NOT MET with a brief explanation.

Then provide your VERDICT:
- ACCEPT: All criteria met or the output is clearly high quality despite minor gaps.
- REVISE: Some criteria not met, but fixable. Provide specific feedback.
- FAIL: Fundamentally inadequate output that cannot be fixed with revision.

Output format:
CRITERIA EVALUATION:
1. [MET/NOT MET] - [explanation]
2. [MET/NOT MET] - [explanation]
...

VERDICT: [ACCEPT/REVISE/FAIL]

FEEDBACK: [If REVISE, specific instructions for improvement. If FAIL, explain why.]`;

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
      // 1. Triage
      await this.setTaskStatus(task, 'triaging');
      const triageLevel = await this.triageTask(task);

      // 2. Generate acceptance criteria
      task.acceptanceCriteria = await this.generateCriteria(task);
      await this.updateTaskInDb(taskId, { acceptanceCriteria: task.acceptanceCriteria });

      // 3. Execute
      await this.setTaskStatus(task, 'executing', { attempts: 1 });
      task.attempts = 1;

      await this.emitEvent(task.id, task.agentId, task.orgId, 'thinking', {
        phase: 'pre_execution',
        triageLevel,
        criteriaCount: task.acceptanceCriteria.length,
      });

      let { result, artifacts } = await this.executeTask(task);
      task.result = result;
      task.artifacts = artifacts;

      // Persist result and artifacts after execution
      await this.updateTaskInDb(taskId, {
        result: task.result,
        artifacts: task.artifacts,
        costSpent: task.costSpent,
      });

      // 4. Review (skip for QUICK tasks)
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

        return task;
      }

      // 5. Review loop
      await this.setTaskStatus(task, 'reviewing');

      const maxReviewAttempts = triageLevel === 'heavy' ? 3 : 2;

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
    if (hasDeliverables) {
      parts.push(`--- Data Access ---
You have business analysis data available via the query_analysis tool.
1. FIRST: Call query_analysis(section: "list_sections") to discover what data exists.
2. Use query_analysis(section: "search", query: "...") to find relevant data.
3. Ground ALL content in the company's actual data. Reference specific numbers and insights.
4. If web_search fails, adapt: use scrape_website or query_analysis instead.`);
    } else {
      parts.push(`--- Data Access ---
No business analysis data is loaded. This means:
1. The task title and description are your PRIMARY context. Extract every detail: company, industry, product, audience.
2. Do NOT call query_analysis - there is no data to query. Go straight to your domain tools.
3. Use web_search to gather real market data if needed.
4. NEVER produce generic placeholder content. Be specific with the information given.`);
    }

    // ═══ 6. BEHAVIORAL RULES (BetterBot-style) ═══
    parts.push(`--- Rules ---

JUST DO IT:
- When given a task, EXECUTE IT. Don't ask "would you like me to..." before starting. Start working immediately.
- Lead with your output. Show the work first, then explain your choices.
- If a tool fails, don't announce the failure - just try a different approach silently.
- Never repeat a failed tool call. Adapt and use alternative tools.
- One strong deliverable is better than multiple weak ones.

CONVERSATIONAL OUTPUT:
- You are talking to a REAL PERSON in a chat interface. Write like a talented colleague presenting their work.
- Lead with a brief 1-2 sentence summary of what you did.
- Present your work using clean markdown: ## headers, **bold**, > blockquotes for featured content, tables for data.
- After presenting, ALWAYS offer 2-3 concrete next steps: "Would you like me to..."
- If you can take action via integrations (post to social, push to sheets, create issues), offer to do so.
- Be confident. You are an expert. Present your work with conviction.
- NEVER dump raw content without context. Always introduce it, present it clearly, then offer to do more.

QUALITY BAR:
- Your output must be ready to use immediately - not a draft or template.
- Be specific to the company, industry, and audience. No generic filler.
- Use real data, real examples, and specific recommendations.
- End every response with a clear "Next Steps" section.

ANTI-HALLUCINATION:
- NEVER invent statistics, case studies, testimonials, or quotes that don't exist.
- NEVER make up company names, product features, or customer stories.
- If you use numbers (market size, growth rates), use well-known industry benchmarks or label them as estimates.
- If you don't know something, say so and offer to research it.
- Clearly distinguish between facts and recommendations.`);

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
      if (lower.includes('post') || lower.includes('social') || lower.includes('linkedin') || lower.includes('twitter') || lower.includes('content')) {
        triggers.push('SOCIAL POSTING: After creating content, offer to post directly. Call check_connection for linkedin/twitter first. If connected, ask "Want me to post this now?" If not, guide them to connect accounts.');
      }
      if (lower.includes('email') || lower.includes('campaign')) {
        triggers.push('EMAIL: After creating email content, offer to send via Gmail if connected. Call check_connection for gmail.');
      }
    }

    // Analyst: auto-offer sheets export
    if (agent.id === 'analyst') {
      if (lower.includes('budget') || lower.includes('forecast') || lower.includes('projection') || lower.includes('financial')) {
        triggers.push('SPREADSHEET: After creating financial data, offer to export to Google Sheets. Call check_connection for google_sheets. If connected, offer "Want me to push this to your Google Sheets?"');
      }
    }

    // Recruiter: auto-offer LinkedIn posting
    if (agent.id === 'recruiter') {
      if (lower.includes('job') || lower.includes('posting') || lower.includes('hire')) {
        triggers.push('JOB POSTING: After creating a job posting, offer to publish it on LinkedIn. Call check_connection for linkedin.');
      }
    }

    // Operator: auto-offer Jira/project tools
    if (agent.id === 'operator') {
      if (lower.includes('project') || lower.includes('plan') || lower.includes('task') || lower.includes('milestone')) {
        triggers.push('PROJECT MANAGEMENT: After creating a plan, offer to create Jira tickets for the milestones. Call check_connection for jira.');
      }
    }

    // CodeBot: auto-offer GitHub actions
    if (agent.id === 'codebot') {
      if (lower.includes('issue') || lower.includes('bug') || lower.includes('feature')) {
        triggers.push('GITHUB: Offer to create a GitHub issue with the findings. Call check_connection for github first.');
      }
    }

    // Universal: revision context
    if (task.reviewFeedback) {
      triggers.push(`REVISION NEEDED: Previous attempt had issues: ${task.reviewFeedback}. Address ALL feedback and produce an improved version.`);
    }

    return triggers;
  }

  private buildTaskPrompt(task: ExecutionTask): string {
    // BetterBot-style: direct, action-oriented, no hedging
    let prompt = `Execute this now: **${task.title}**`;

    if (task.description) {
      prompt += `\n\n${task.description}`;
    }

    if (task.acceptanceCriteria.length > 0) {
      prompt += `\n\nSuccess criteria:\n`;
      prompt += task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
    }

    prompt += `\n\nUse your tools, produce the deliverable, and present it conversationally with next steps.`;

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
 */
export function createOrchestrator(deliverables?: Record<string, unknown>): Orchestrator {
  return new Orchestrator(deliverables);
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
  options?: { priority?: TaskPriority; costCeiling?: number }
): Promise<ExecutionTask> {
  const orchestrator = createOrchestrator(deliverables);

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
