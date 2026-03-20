/**
 * Procedure Learning System — Save and replay successful multi-step task patterns
 *
 * After a successful task with 3+ tool calls, the system extracts the tool-call
 * sequence as a reusable "procedure." Before future tasks, it checks for matching
 * procedures and injects them as execution guidance.
 *
 * Inspired by BetterBot's procedure-learner.js.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProcedureStep {
  /** Tool name (e.g., "query_integration_data", "web_search") */
  toolName: string;
  /** Template for tool args with {{variable}} placeholders */
  argsTemplate: Record<string, unknown>;
  /** Human-readable description of what this step does */
  description: string;
}

export interface Procedure {
  id: string;
  orgId: string;
  agentId: string;
  title: string;
  triggerPhrases: string[];
  steps: ProcedureStep[];
  runCount: number;
  avgTimeMs: number;
  createdAt: string;
  lastUsedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalize a string for fuzzy comparison: lowercase, strip punctuation, collapse whitespace */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract keywords from a string (words with 3+ chars) */
function extractKeywords(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter(w => w.length >= 3);
}

/**
 * Score how well a task title matches a set of trigger phrases.
 * Returns 0-1 where 1 is a perfect match.
 */
function matchScore(taskTitle: string, triggerPhrases: string[]): number {
  const taskNorm = normalize(taskTitle);
  const taskKeywords = extractKeywords(taskTitle);

  let bestScore = 0;

  for (const phrase of triggerPhrases) {
    const phraseNorm = normalize(phrase);

    // Exact normalized match
    if (taskNorm === phraseNorm) return 1.0;

    // Substring containment
    if (taskNorm.includes(phraseNorm) || phraseNorm.includes(taskNorm)) {
      bestScore = Math.max(bestScore, 0.85);
      continue;
    }

    // Keyword overlap (Jaccard-like)
    const phraseKeywords = extractKeywords(phrase);
    if (phraseKeywords.length === 0) continue;

    const overlap = taskKeywords.filter(w => phraseKeywords.includes(w)).length;
    const union = new Set([...taskKeywords, ...phraseKeywords]).size;
    const jaccard = union > 0 ? overlap / union : 0;

    // Weight by how many of the phrase's keywords are present
    const recall = phraseKeywords.length > 0 ? overlap / phraseKeywords.length : 0;

    const score = jaccard * 0.4 + recall * 0.6;
    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}

/**
 * Templatize tool args: replace specific values with {{variable}} placeholders
 * where appropriate. Keeps the structure but generalizes concrete values.
 */
function templatizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const template: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      // Keep short enum-like values (provider names, sections, etc.)
      if (value.length <= 30 && !value.includes(' ')) {
        template[key] = value;
      } else {
        // Replace long strings with a placeholder
        template[key] = `{{${key}}}`;
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      template[key] = value;
    } else {
      template[key] = `{{${key}}}`;
    }
  }

  return template;
}

// ── DB row mapper ─────────────────────────────────────────────────────────────

function dbToProcedure(row: Record<string, unknown>): Procedure {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    agentId: String(row.agent_id),
    title: String(row.title),
    triggerPhrases: (row.trigger_phrases as string[]) ?? [],
    steps: (row.steps as ProcedureStep[]) ?? [],
    runCount: Number(row.run_count ?? 0),
    avgTimeMs: Number(row.avg_time_ms ?? 0),
    createdAt: String(row.created_at),
    lastUsedAt: String(row.last_used_at),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Find a matching procedure for a given task title.
 * Returns the best match if score >= 0.5, or null.
 */
export async function findMatchingProcedure(
  orgId: string,
  agentId: string,
  taskTitle: string,
): Promise<Procedure | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('procedures')
      .select('*')
      .eq('org_id', orgId)
      .eq('agent_id', agentId)
      .order('run_count', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return null;

    let bestProcedure: Procedure | null = null;
    let bestScore = 0;

    for (const row of data) {
      const proc = dbToProcedure(row as Record<string, unknown>);
      const score = matchScore(taskTitle, proc.triggerPhrases);

      if (score > bestScore) {
        bestScore = score;
        bestProcedure = proc;
      }
    }

    // Threshold: require at least 50% match confidence
    if (bestScore < 0.5) return null;

    return bestProcedure;
  } catch (err) {
    console.warn('[Procedures] findMatchingProcedure error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Save a procedure extracted from a successful task execution.
 * Only saves if there were 3+ meaningful tool calls.
 */
export async function saveProcedure(
  orgId: string,
  agentId: string,
  taskTitle: string,
  toolCallHistory: Array<{ name: string; args: Record<string, unknown> }>,
  executionTimeMs: number,
): Promise<void> {
  try {
    // Filter out system/guard responses — only real tool calls
    const meaningfulCalls = toolCallHistory.filter(
      tc => !tc.name.startsWith('__') && tc.name !== 'check_connection',
    );

    if (meaningfulCalls.length < 3) return; // Too simple to save

    // Deduplicate consecutive identical calls
    const deduped: typeof meaningfulCalls = [];
    for (const call of meaningfulCalls) {
      const prev = deduped[deduped.length - 1];
      if (prev && prev.name === call.name && JSON.stringify(prev.args) === JSON.stringify(call.args)) {
        continue; // Skip exact duplicate
      }
      deduped.push(call);
    }

    // Build steps
    const steps: ProcedureStep[] = deduped.map((call, i) => ({
      toolName: call.name,
      argsTemplate: templatizeArgs(call.args),
      description: `Step ${i + 1}: Call ${call.name}`,
    }));

    // Generate trigger phrases from the task title
    const triggerPhrases = generateTriggerPhrases(taskTitle);

    const supabase = createAdminClient();

    // Check for existing procedure with overlapping triggers (same agent, same org)
    const { data: existing } = await supabase
      .from('procedures')
      .select('id, trigger_phrases, run_count, avg_time_ms')
      .eq('org_id', orgId)
      .eq('agent_id', agentId)
      .limit(50);

    if (existing && existing.length > 0) {
      // Check if any existing procedure is essentially the same task pattern
      for (const row of existing) {
        const existingPhrases = (row.trigger_phrases as string[]) ?? [];
        const score = matchScore(taskTitle, existingPhrases);

        if (score >= 0.7) {
          // Update existing procedure: merge triggers, update stats
          const mergedPhrases = [...new Set([...existingPhrases, ...triggerPhrases])].slice(0, 10);
          const oldCount = Number(row.run_count ?? 0);
          const oldAvg = Number(row.avg_time_ms ?? 0);
          const newAvg = Math.round((oldAvg * oldCount + executionTimeMs) / (oldCount + 1));

          await supabase
            .from('procedures')
            .update({
              trigger_phrases: mergedPhrases,
              steps, // Update with latest steps (may be refined)
              run_count: oldCount + 1,
              avg_time_ms: newAvg,
              last_used_at: new Date().toISOString(),
            })
            .eq('id', row.id);

          return;
        }
      }
    }

    // Insert new procedure
    await supabase.from('procedures').insert({
      org_id: orgId,
      agent_id: agentId,
      title: taskTitle.slice(0, 200),
      trigger_phrases: triggerPhrases,
      steps,
      run_count: 1,
      avg_time_ms: executionTimeMs,
    });
  } catch (err) {
    console.warn('[Procedures] saveProcedure error:', err instanceof Error ? err.message : err);
  }
}

/**
 * Record that a procedure was used (bump run_count, update avg_time_ms).
 */
export async function recordProcedureUse(
  procedureId: string,
  executionTimeMs: number,
): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Fetch current stats
    const { data } = await supabase
      .from('procedures')
      .select('run_count, avg_time_ms')
      .eq('id', procedureId)
      .single();

    if (!data) return;

    const oldCount = Number(data.run_count ?? 0);
    const oldAvg = Number(data.avg_time_ms ?? 0);
    const newAvg = Math.round((oldAvg * oldCount + executionTimeMs) / (oldCount + 1));

    await supabase
      .from('procedures')
      .update({
        run_count: oldCount + 1,
        avg_time_ms: newAvg,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', procedureId);
  } catch {
    /* best effort */
  }
}

/**
 * Format a procedure as context to inject into the agent's system prompt.
 */
export function formatProcedureAsContext(procedure: Procedure): string {
  const lines: string[] = [
    `--- Known Procedure: "${procedure.title}" ---`,
    `You've successfully completed this type of task ${procedure.runCount} time(s) before (avg ${Math.round(procedure.avgTimeMs / 1000)}s).`,
    `Follow these steps:`,
  ];

  for (let i = 0; i < procedure.steps.length; i++) {
    const step = procedure.steps[i];
    const argsStr = Object.entries(step.argsTemplate)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(', ');
    lines.push(`  ${i + 1}. ${step.toolName}(${argsStr})`);
  }

  lines.push('');
  lines.push('Adapt the arguments to the current task. Skip steps that don\'t apply. Add steps if needed.');
  lines.push('This is GUIDANCE, not a rigid script. Use your judgment.');

  return lines.join('\n');
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Generate trigger phrases from a task title.
 * Creates the original title plus simplified variants.
 */
function generateTriggerPhrases(title: string): string[] {
  const phrases: string[] = [title];

  // Add a normalized version
  const norm = normalize(title);
  if (norm !== title.toLowerCase()) {
    phrases.push(norm);
  }

  // Add a version without common filler words
  const fillers = ['please', 'can you', 'i need', 'i want', 'help me', 'create a', 'make a', 'generate a', 'write a', 'build a', 'draft a'];
  let stripped = norm;
  for (const filler of fillers) {
    stripped = stripped.replace(new RegExp(`^${filler}\\s+`, 'i'), '');
  }
  if (stripped !== norm && stripped.length > 5) {
    phrases.push(stripped);
  }

  return [...new Set(phrases)].slice(0, 5);
}
