/**
 * Context Compaction System
 *
 * When conversation context exceeds limits, compact older messages
 * into a summary while preserving recent turns.
 *
 * Also extracts graph entities from compaction summaries
 * for the knowledge graph.
 */

import { createProvider } from './provider';
import type { ChatMessage, GraphNode, GraphNodeType } from './types';

// ── Constants ────────────────────────────────────────────────────────────────────

const DEFAULT_RECENT_TURNS = 6; // Keep last N user+assistant pairs

// ── Compaction ───────────────────────────────────────────────────────────────────

/**
 * Compact older messages into a summary, keeping recent turns intact.
 *
 * @param messages - Full message history
 * @param recentTurnCount - Number of recent turns to preserve (default: 6)
 * @returns Summary of compacted messages + the preserved recent messages
 */
export async function compactMessages(
  messages: ChatMessage[],
  recentTurnCount: number = DEFAULT_RECENT_TURNS
): Promise<{ summary: string; keptMessages: ChatMessage[] }> {
  // Split messages into old (to compact) and recent (to keep)
  const turnBoundary = findTurnBoundary(messages, recentTurnCount);
  const oldMessages = messages.slice(0, turnBoundary);
  const keptMessages = messages.slice(turnBoundary);

  if (oldMessages.length === 0) {
    return { summary: '', keptMessages: messages };
  }

  // Format old messages for summarization
  const transcript = formatTranscript(oldMessages);

  // Use 'quick' model for compaction (fast, cheap)
  const provider = createProvider('quick');

  const response = await provider.chat([
    {
      role: 'system',
      content: `You are a conversation compactor. Summarize the following conversation transcript into a dense, information-rich summary. Preserve:
- Key decisions made
- Important facts and data points mentioned
- User preferences and constraints
- Action items and outcomes
- Any unresolved questions or topics

Be concise but thorough. Use bullet points. Do not omit important details.`,
    },
    {
      role: 'user',
      content: `Summarize this conversation:\n\n${transcript}`,
    },
  ]);

  return {
    summary: response.content,
    keptMessages,
  };
}

/**
 * Find the index where we should split old/recent messages.
 * Counts backwards from the end to find `turnCount` user messages.
 */
function findTurnBoundary(messages: ChatMessage[], turnCount: number): number {
  let userCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      userCount++;
      if (userCount >= turnCount) {
        return i;
      }
    }
  }
  // If we don't have enough turns, compact nothing
  return 0;
}

/**
 * Format messages into a readable transcript for the LLM.
 */
function formatTranscript(messages: ChatMessage[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    const role = msg.role.toUpperCase();

    if (msg.role === 'tool') {
      const toolId = msg.toolCallId ? ` [${msg.toolCallId}]` : '';
      lines.push(`TOOL${toolId}: ${truncate(msg.content, 500)}`);
    } else if (msg.toolCalls && msg.toolCalls.length > 0) {
      lines.push(`${role}: ${msg.content}`);
      for (const tc of msg.toolCalls) {
        lines.push(`  -> Called ${tc.name}(${JSON.stringify(tc.arguments).slice(0, 200)})`);
      }
    } else {
      lines.push(`${role}: ${truncate(msg.content, 1000)}`);
    }
  }

  return lines.join('\n');
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '... [truncated]';
}

// ── Graph Entity Extraction ──────────────────────────────────────────────────────

/**
 * Extract structured entities from a compaction summary for the knowledge graph.
 *
 * Categories:
 *  - entity:     Companies, products, tools, platforms
 *  - person:     People with names, roles, relationships
 *  - decision:   What was decided, why, when
 *  - fact:       Specific data points, metrics, numbers
 *  - preference: User/org preferences
 */
export async function extractGraphEntities(
  summary: string,
  orgId: string
): Promise<GraphNode[]> {
  const provider = createProvider('quick');

  const response = await provider.chat([
    {
      role: 'system',
      content: `You extract structured entities from conversation summaries. Return a JSON array of objects, each with:
- type: one of "entity", "person", "decision", "fact", "preference", "tool", "product", "company"
- label: short name/title
- aliases: array of alternative names (can be empty)
- properties: object with key-value pairs of relevant details

Only extract clearly stated information. Do not infer or hallucinate.
Return ONLY a JSON array, no other text.`,
    },
    {
      role: 'user',
      content: `Extract entities from this conversation summary:\n\n${summary}`,
    },
  ]);

  const text = response.content.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    console.warn('[Compaction] No JSON array found in extraction response');
    return [];
  }

  try {
    const raw = JSON.parse(jsonMatch[0]) as Array<{
      type?: string;
      label?: string;
      aliases?: string[];
      properties?: Record<string, string>;
    }>;

    const now = new Date().toISOString();

    return raw
      .filter((item) => item.label && item.type)
      .map((item) => ({
        id: generateNodeId(item.label!, item.type!),
        type: validateNodeType(item.type!),
        label: item.label!,
        aliases: item.aliases ?? [],
        properties: item.properties ?? {},
        orgId,
        source: 'compaction',
        createdAt: now,
        updatedAt: now,
      }));
  } catch (err) {
    console.error('[Compaction] Failed to parse extraction JSON:', err);
    return [];
  }
}

/**
 * Generate a deterministic node ID from label and type.
 */
function generateNodeId(label: string, type: string): string {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${type}_${normalized}`;
}

/**
 * Validate and normalize node type.
 */
function validateNodeType(type: string): GraphNodeType {
  const valid: GraphNodeType[] = [
    'entity',
    'person',
    'decision',
    'fact',
    'preference',
    'tool',
    'product',
    'company',
  ];

  const lower = type.toLowerCase() as GraphNodeType;
  if (valid.includes(lower)) return lower;
  return 'entity';
}
