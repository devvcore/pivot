/**
 * Pre-Execution Clarifier — Asks smart clarifying questions before running a task.
 *
 * Like Claude Code: analyzes the task, identifies ambiguities, generates
 * questions with clickable options. The agent waits for answers before executing.
 *
 * Flow:
 * 1. User submits task
 * 2. Clarifier analyzes task → generates 1-3 questions with options
 * 3. Questions emitted as `clarification_request` events
 * 4. UI renders questions with clickable buttons
 * 5. User responds → stored in execution_clarifications table
 * 6. Agent executes with enriched context from responses
 */

import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/admin';
import { v4 as uuidv4 } from 'uuid';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClarificationQuestion {
  id: string;
  question: string;
  options: ClarificationOption[];
  context?: string; // Why this question matters
}

export interface ClarificationOption {
  label: string;
  value: string;
  description?: string; // Short helper text
}

export interface ClarificationResult {
  needsClarification: boolean;
  questions: ClarificationQuestion[];
}

// ── Prompt ─────────────────────────────────────────────────────────────────────

const CLARIFICATION_PROMPT = `You are a pre-execution analyst for an AI agent system. Before the agent runs a task, you identify critical ambiguities that would significantly affect the output quality.

RULES:
- Generate 0-3 questions MAX. Zero is fine if the task is clear enough.
- Each question has 2-4 clickable options (the user will click one, not type).
- Only ask about things that MATERIALLY change the output. Don't ask about preferences that don't matter.
- Options should cover the most common choices. Include an "other" option if needed.
- Questions should be SHORT (one sentence). Options should be SHORT (2-5 words each).
- NEVER ask about things the agent can figure out from context or tools.
- NEVER ask generic questions like "what format do you want?" unless format truly matters.

GOOD questions: tone/audience, scope (specific product vs all), time period, platform-specific needs
BAD questions: "should I include an intro?", "how many words?", "what color?"

Output JSON:
{
  "needsClarification": true/false,
  "questions": [
    {
      "question": "Who is the target audience for this?",
      "options": [
        {"label": "Customers", "value": "customers", "description": "External clients"},
        {"label": "Team/Internal", "value": "internal", "description": "Your team members"},
        {"label": "Investors", "value": "investors", "description": "Current or potential investors"},
        {"label": "General public", "value": "public"}
      ],
      "context": "The tone and depth will differ significantly based on audience"
    }
  ]
}

If the task is clear enough to execute well without questions, output:
{"needsClarification": false, "questions": []}`;

// ── Main Functions ────────────────────────────────────────────────────────────

/**
 * Analyze a task and generate clarification questions if needed.
 * Returns quickly (~500ms) — uses Flash with minimal tokens.
 */
export async function generateClarifications(
  taskTitle: string,
  taskDescription: string,
  agentId: string,
): Promise<ClarificationResult> {
  const empty: ClarificationResult = { needsClarification: false, questions: [] };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return empty;

  // Skip clarification for very short/simple tasks
  const fullText = `${taskTitle} ${taskDescription}`.toLowerCase();
  if (fullText.length < 20) return empty;

  // Skip for tasks that are clearly specific enough
  const specificPatterns = [
    /post.*to.*linkedin/i,
    /send.*email.*to/i,
    /create.*jira.*ticket/i,
    /pull.*data.*from/i,
    /check.*status/i,
    /what.*is.*my/i,
    /how.*much/i,
    /show.*me/i,
  ];
  if (specificPatterns.some(p => p.test(fullText))) return empty;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Task: "${taskTitle}"\nDescription: "${taskDescription}"\nAgent: ${agentId}\n\nAnalyze and output JSON:`,
      config: {
        temperature: 0,
        maxOutputTokens: 500,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: CLARIFICATION_PROMPT,
      },
    });

    const text = response.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return empty;

    const parsed = JSON.parse(match[0]);
    if (!parsed.needsClarification || !parsed.questions?.length) return empty;

    // Assign IDs to questions
    const questions: ClarificationQuestion[] = parsed.questions
      .slice(0, 3)
      .map((q: any) => ({
        id: uuidv4(),
        question: q.question,
        options: (q.options ?? []).slice(0, 4).map((o: any) => ({
          label: typeof o === 'string' ? o : o.label,
          value: typeof o === 'string' ? o.toLowerCase() : o.value,
          description: typeof o === 'string' ? undefined : o.description,
        })),
        context: q.context,
      }));

    return { needsClarification: questions.length > 0, questions };
  } catch (err) {
    console.warn('[Clarifier] Failed to generate questions:', err instanceof Error ? err.message : err);
    return empty;
  }
}

/**
 * Save clarification questions to DB and emit events.
 */
export async function saveClarifications(
  taskId: string,
  orgId: string,
  agentId: string,
  questions: ClarificationQuestion[],
): Promise<void> {
  const supabase = createAdminClient();

  for (const q of questions) {
    await supabase.from('execution_clarifications').insert({
      id: q.id,
      task_id: taskId,
      org_id: orgId,
      agent_id: agentId,
      question: q.question,
      options: q.options,
      context: q.context,
      status: 'pending',
    });
  }

  // Emit clarification_request event so the UI can render it
  await supabase.from('execution_events').insert({
    task_id: taskId,
    agent_id: agentId,
    org_id: orgId,
    event_type: 'thinking',
    data: {
      phase: 'clarification_request',
      questions: questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options,
        context: q.context,
      })),
    },
  });
}

/**
 * Submit a user's response to a clarification question.
 */
export async function respondToClarification(
  clarificationId: string,
  response: string,
): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from('execution_clarifications').update({
    user_response: response,
    status: 'responded',
    responded_at: new Date().toISOString(),
  }).eq('id', clarificationId);
}

/**
 * Check if all clarifications for a task have been answered.
 */
export async function allClarificationsAnswered(taskId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('execution_clarifications')
    .select('status')
    .eq('task_id', taskId);

  if (!data || data.length === 0) return true;
  return data.every(c => c.status === 'responded' || c.status === 'skipped' || c.status === 'timeout');
}

/**
 * Get all clarification responses for a task, formatted as context for the agent.
 */
export async function getClarificationContext(taskId: string): Promise<string> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('execution_clarifications')
    .select('question, user_response, options')
    .eq('task_id', taskId)
    .eq('status', 'responded');

  if (!data || data.length === 0) return '';

  const lines = data.map(c => {
    const selectedOption = (c.options as ClarificationOption[])?.find(o => o.value === c.user_response);
    const label = selectedOption?.label ?? c.user_response;
    return `Q: ${c.question}\nA: ${label}`;
  });

  return `\n--- USER PREFERENCES (from clarification) ---\n${lines.join('\n\n')}\n--- END PREFERENCES ---`;
}

/**
 * Wait for all clarifications to be answered (poll with timeout).
 */
export async function waitForClarifications(
  taskId: string,
  timeoutMs: number = 120_000, // 2 minutes
  pollIntervalMs: number = 2_000,
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const allDone = await allClarificationsAnswered(taskId);
    if (allDone) return true;
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout: skip remaining clarifications
  const supabase = createAdminClient();
  await supabase
    .from('execution_clarifications')
    .update({ status: 'timeout' })
    .eq('task_id', taskId)
    .eq('status', 'pending');

  return false;
}
