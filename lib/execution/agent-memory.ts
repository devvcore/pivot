/**
 * Agent Memory — Persistent per-agent learning across tasks
 *
 * After each successful task, the orchestrator can save lessons.
 * Before each task, relevant memories are loaded into context.
 * Memories decay over time if unused.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface AgentMemory {
  id: string;
  orgId: string;
  agentId: string;
  memoryType: 'lesson' | 'preference' | 'context' | 'correction';
  content: string;
  sourceTaskId?: string;
  relevanceScore: number;
  useCount: number;
  createdAt: string;
  lastUsedAt: string;
}

/**
 * Load relevant memories for an agent before task execution.
 * Returns top 10 most relevant memories (by score * recency).
 */
export async function loadAgentMemories(
  orgId: string,
  agentId: string,
  limit = 10,
): Promise<AgentMemory[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('agent_memory')
      .select('*')
      .eq('org_id', orgId)
      .eq('agent_id', agentId)
      .eq('expired', false)
      .order('relevance_score', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      orgId: String(row.org_id),
      agentId: String(row.agent_id),
      memoryType: row.memory_type as AgentMemory['memoryType'],
      content: String(row.content),
      sourceTaskId: row.source_task_id ? String(row.source_task_id) : undefined,
      relevanceScore: Number(row.relevance_score ?? 1),
      useCount: Number(row.use_count ?? 0),
      createdAt: String(row.created_at),
      lastUsedAt: String(row.last_used_at),
    }));
  } catch {
    return [];
  }
}

/**
 * Format memories as context for the agent's system prompt.
 */
export function formatMemoriesAsContext(memories: AgentMemory[]): string {
  if (memories.length === 0) return '';

  const lines = ['--- Agent Memory (lessons from past tasks) ---'];
  for (const mem of memories) {
    const tag = mem.memoryType === 'correction' ? '⚠️' :
                mem.memoryType === 'lesson' ? '💡' :
                mem.memoryType === 'preference' ? '👤' : '📌';
    lines.push(`${tag} ${mem.content}`);
  }
  lines.push('Use these memories to avoid past mistakes and apply learned patterns.');
  return lines.join('\n');
}

/**
 * Save a new memory after task completion.
 */
export async function saveAgentMemory(
  orgId: string,
  agentId: string,
  content: string,
  memoryType: AgentMemory['memoryType'] = 'lesson',
  sourceTaskId?: string,
): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Check for duplicate (same content, same agent)
    const { data: existing } = await supabase
      .from('agent_memory')
      .select('id')
      .eq('org_id', orgId)
      .eq('agent_id', agentId)
      .eq('content', content)
      .limit(1);

    if (existing && existing.length > 0) return; // Already saved

    await supabase.from('agent_memory').insert({
      org_id: orgId,
      agent_id: agentId,
      memory_type: memoryType,
      content,
      source_task_id: sourceTaskId,
    });
  } catch (err) {
    console.warn('[AgentMemory] Failed to save:', err instanceof Error ? err.message : err);
  }
}

/**
 * Mark memories as used (bump use_count and last_used_at).
 */
export async function touchMemories(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return;
  try {
    const supabase = createAdminClient();
    for (const id of memoryIds) {
      // Simple update — increment isn't available without a custom RPC
      await supabase
        .from('agent_memory')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', id);
    }
  } catch { /* best effort */ }
}

/**
 * Extract lessons from a completed task using the agent's output and review feedback.
 * Returns 0-3 lessons worth saving.
 */
export function extractLessons(
  agentId: string,
  taskTitle: string,
  output: string,
  reviewFeedback?: string,
): string[] {
  const lessons: string[] = [];

  // If review caught hallucinations, save as correction
  if (reviewFeedback?.toLowerCase().includes('hallucin')) {
    lessons.push(`CORRECTION: Review flagged hallucination in "${taskTitle.slice(0, 50)}". Always cite sources for data claims.`);
  }

  // If review caught ungrounded claims
  if (reviewFeedback?.toLowerCase().includes('ungrounded') || reviewFeedback?.toLowerCase().includes('fabricat')) {
    lessons.push(`CORRECTION: Data claims must have [source] tags. Don't present estimates as facts.`);
  }

  // If tool returned connect marker, remember which service isn't connected
  const connectMatches = output.match(/\[connect:([a-z_]+)\]/g);
  if (connectMatches) {
    for (const match of connectMatches) {
      const provider = match.replace('[connect:', '').replace(']', '');
      lessons.push(`CONTEXT: ${provider} is not connected for this org. Show content but include [connect:${provider}] marker.`);
    }
  }

  return lessons.slice(0, 3);
}

/**
 * Silent fact extraction from task output — learns business context without announcing.
 * Extracts client names, project details, dollar amounts, and key decisions.
 */
export function extractFactsFromOutput(
  output: string,
  taskTitle: string,
): string[] {
  const facts: string[] = [];

  // Extract client/customer names mentioned alongside dollar amounts
  const clientPayments = output.match(/(\w[\w\s]{2,30})\s*[\(—–-]\s*\$[\d,.]+/g);
  if (clientPayments) {
    for (const match of clientPayments.slice(0, 3)) {
      facts.push(`CONTEXT: Client reference from "${taskTitle.slice(0, 40)}": ${match.trim()}`);
    }
  }

  // Extract email addresses mentioned
  const emails = output.match(/[\w.-]+@[\w.-]+\.\w{2,}/g);
  if (emails) {
    const uniqueEmails = [...new Set(emails)].slice(0, 3);
    for (const email of uniqueEmails) {
      facts.push(`CONTEXT: Contact email found: ${email}`);
    }
  }

  // Extract key dollar amounts with labels
  const amounts = output.match(/(?:MRR|ARR|revenue|cost|budget|runway|burn rate|total)[:\s]*\$[\d,.]+[KMB]?/gi);
  if (amounts) {
    for (const amount of amounts.slice(0, 2)) {
      facts.push(`CONTEXT: Business metric: ${amount.trim()}`);
    }
  }

  // Extract decisions or commitments
  const decisions = output.match(/(?:decided to|will|plan to|committed to|agreed to)\s+[^.]{10,60}\./gi);
  if (decisions) {
    facts.push(`CONTEXT: Decision from "${taskTitle.slice(0, 30)}": ${decisions[0].trim()}`);
  }

  return facts.slice(0, 5);
}
