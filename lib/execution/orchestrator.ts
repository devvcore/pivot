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
 */

import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
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

// ── Task Store (in-memory for now; swap for DB later) ─────────────────────────

const taskStore = new Map<string, ExecutionTask>();

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class Orchestrator {
  private deliverables: Record<string, unknown> | undefined;

  constructor(deliverables?: Record<string, unknown>) {
    this.deliverables = deliverables;
  }

  /**
   * Submit a task into the execution pipeline.
   * Returns the task ID for tracking.
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

    taskStore.set(task.id, task);
    return task.id;
  }

  /**
   * Get a task by ID.
   */
  getTask(taskId: string): ExecutionTask | undefined {
    return taskStore.get(taskId);
  }

  /**
   * List all tasks, optionally filtered by status.
   */
  listTasks(filters?: { orgId?: string; status?: TaskStatus; agentId?: string }): ExecutionTask[] {
    let tasks = Array.from(taskStore.values());
    if (filters?.orgId) tasks = tasks.filter(t => t.orgId === filters.orgId);
    if (filters?.status) tasks = tasks.filter(t => t.status === filters.status);
    if (filters?.agentId) tasks = tasks.filter(t => t.agentId === filters.agentId);
    return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

        // Execute the tool
        const toolResult = await globalRegistry.execute(name, args, toolContext);

        // Collect artifacts
        if (toolResult.artifacts) {
          allArtifacts.push(...toolResult.artifacts);
        }

        // Track cost
        task.costSpent = costTracker.totalSpent;

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
   * Full execution pipeline: triage -> criteria -> execute -> review -> (revise?) -> complete
   */
  async runPipeline(taskId: string): Promise<ExecutionTask> {
    const task = taskStore.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    try {
      // 1. Triage
      task.status = 'triaging';
      taskStore.set(taskId, task);
      const triageLevel = await this.triageTask(task);

      // 2. Generate acceptance criteria
      task.acceptanceCriteria = await this.generateCriteria(task);
      taskStore.set(taskId, task);

      // 3. Execute
      task.status = 'executing';
      task.attempts = 1;
      taskStore.set(taskId, task);

      let { result, artifacts } = await this.executeTask(task);
      task.result = result;
      task.artifacts = artifacts;

      // 4. Review (skip for QUICK tasks)
      if (triageLevel === 'quick') {
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        taskStore.set(taskId, task);
        return task;
      }

      // 5. Review loop
      task.status = 'reviewing';
      taskStore.set(taskId, task);

      const maxReviewAttempts = triageLevel === 'heavy' ? 3 : 2;

      for (let attempt = 0; attempt < maxReviewAttempts; attempt++) {
        const { verdict, feedback } = await this.reviewOutput(task, result);

        if (verdict === 'accept') {
          task.status = 'completed';
          task.completedAt = new Date().toISOString();
          taskStore.set(taskId, task);
          return task;
        }

        if (verdict === 'fail') {
          task.status = 'failed';
          task.reviewFeedback = feedback;
          taskStore.set(taskId, task);
          return task;
        }

        // REVISE
        if (attempt < maxReviewAttempts - 1) {
          task.status = 'revision';
          task.reviewFeedback = feedback;
          task.attempts += 1;
          taskStore.set(taskId, task);

          // Re-execute with feedback
          const revised = await this.executeWithRevision(task, result, feedback);
          result = revised.result;
          task.result = result;
          task.artifacts = [...(task.artifacts ?? []), ...revised.artifacts];

          task.status = 'reviewing';
          taskStore.set(taskId, task);
        }
      }

      // Exhausted revision attempts — accept what we have
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.reviewFeedback = (task.reviewFeedback ?? '') + '\n[Accepted after max revision attempts]';
      taskStore.set(taskId, task);
      return task;

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      task.status = 'failed';
      task.reviewFeedback = `Pipeline error: ${message}`;
      taskStore.set(taskId, task);
      return task;
    }
  }

  // ── Private Helpers ──────────────────────────────────────────────────────────

  private buildSystemPrompt(agent: AgentDefinition, task: ExecutionTask): string {
    const outfitPrompt = getOutfitSystemPrompt(agent.defaultOutfit);

    return `${agent.systemPrompt}

${outfitPrompt}

CURRENT TASK:
Title: ${task.title}
Description: ${task.description}
Priority: ${task.priority}
Budget: $${task.costCeiling.toFixed(2)} remaining

ACCEPTANCE CRITERIA:
${task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

INSTRUCTIONS:
- Use the available tools to complete this task thoroughly.
- Reference the business analysis data (query_analysis tool) to ground your work in real data.
- Produce a complete, polished deliverable — not a draft or outline.
- If you cannot complete a step, explain why and what you did instead.
- End with a clear, formatted final response that includes all deliverables.`;
  }

  private buildTaskPrompt(task: ExecutionTask): string {
    let prompt = `Please complete this task:\n\n**${task.title}**\n\n${task.description}`;

    if (task.acceptanceCriteria.length > 0) {
      prompt += `\n\nYour output must meet these criteria:\n`;
      prompt += task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
    }

    prompt += `\n\nUse the available tools to research, create content, and produce deliverables. Provide a comprehensive, finished result.`;

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
 * Quick task execution — submit and run in one step.
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
