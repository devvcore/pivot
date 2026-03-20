/**
 * Wide Execution — Manus AI-inspired parallel execution across multiple items.
 *
 * Detects when a user task targets a list of items (competitors, clients, leads)
 * and splits it into parallel per-item tasks.
 *
 * Example: "Research these competitors: Acme, BigCo, Startup" →
 *   3 parallel tasks, one per competitor, same agent & prompt template.
 */

import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '@/lib/supabase/admin';

const FLASH_MODEL = 'gemini-2.5-flash';

// ── Max items per wide execution request ──
export const MAX_WIDE_ITEMS = 20;

// ── Patterns that signal a wide task ──
const WIDE_PATTERNS = [
  // Explicit list with colon: "research these competitors: A, B, C"
  /(?:for|about|on|research|analyze|compare|review|contact|email|brief)\s+(?:these|the following|each of|all of|every)\s+\w+[\s:]+(.+)/i,
  // "for each X in: A, B, C"
  /for\s+each\s+\w+\s+(?:in|:)\s*(.+)/i,
  // "A, B, and C" or "A, B, C" at the end after an action verb
  /(?:research|analyze|compare|review|brief|email|contact|audit|evaluate|assess|benchmark)\s+(.+?,\s*.+)/i,
  // "all my clients/customers/leads"
  /\b(?:all|each|every)\s+(?:my|our)\s+(?:clients?|customers?|leads?|contacts?|accounts?|prospects?|subscribers?)\b/i,
  // "each of these: ..."
  /each\s+of\s+(?:these|the following)\s*[:\-]\s*(.+)/i,
];

// ── Patterns for integration-backed item lists ──
const INTEGRATION_LIST_PATTERNS: { pattern: RegExp; provider: string; recordType: string }[] = [
  { pattern: /\b(?:all|each|every)\s+(?:my|our)\s+(?:stripe\s+)?customers?\b/i, provider: 'stripe', recordType: 'customers' },
  { pattern: /\b(?:all|each|every)\s+(?:my|our)\s+(?:stripe\s+)?(?:clients?|accounts?)\b/i, provider: 'stripe', recordType: 'customers' },
  { pattern: /\b(?:all|each|every)\s+(?:my|our)\s+(?:salesforce\s+)?(?:accounts?|opportunities?)\b/i, provider: 'salesforce', recordType: 'accounts' },
  { pattern: /\b(?:all|each|every)\s+(?:my|our)\s+(?:hubspot\s+)?contacts?\b/i, provider: 'hubspot', recordType: 'contacts' },
  { pattern: /\b(?:all|each|every)\s+(?:my|our)\s+(?:hubspot\s+)?(?:leads?|deals?)\b/i, provider: 'hubspot', recordType: 'deals' },
];

/**
 * Check if a message is a wide task (targets multiple items in parallel).
 */
export function isWideTask(message: string): boolean {
  // Check for explicit item lists
  for (const pattern of WIDE_PATTERNS) {
    if (pattern.test(message)) return true;
  }
  return false;
}

/**
 * Extract individual items from a message.
 * Returns the base task template and the list of items.
 */
export async function splitIntoItems(
  message: string,
  orgId?: string
): Promise<{ taskTemplate: string; items: string[]; source: 'parsed' | 'integration' | 'gemini' }> {
  // 1. Check if this references integration data (e.g., "all my Stripe customers")
  if (orgId) {
    for (const { pattern, provider, recordType } of INTEGRATION_LIST_PATTERNS) {
      if (pattern.test(message)) {
        const items = await pullItemsFromIntegration(orgId, provider, recordType);
        if (items.length > 0) {
          // Build task template by removing the "all my customers" part
          const taskTemplate = message.replace(pattern, '[ITEM]');
          return { taskTemplate, items: items.slice(0, MAX_WIDE_ITEMS), source: 'integration' };
        }
      }
    }
  }

  // 2. Try to parse items directly from the message
  const parsed = parseItemsFromMessage(message);
  if (parsed) {
    return { ...parsed, source: 'parsed' };
  }

  // 3. Fall back to Gemini for complex extraction
  try {
    const result = await extractWithGemini(message);
    if (result && result.items.length >= 2) {
      return { ...result, source: 'gemini' };
    }
  } catch (err) {
    console.error('[wide-executor] Gemini extraction failed:', err);
  }

  // No items found — not a wide task
  return { taskTemplate: message, items: [], source: 'parsed' };
}

/**
 * Parse items directly from the message using heuristics.
 */
function parseItemsFromMessage(message: string): { taskTemplate: string; items: string[] } | null {
  // Pattern: "... : A, B, C" or "... : A, B, and C"
  const colonListMatch = message.match(/^(.+?)\s*[:]\s*(.+)$/);
  if (colonListMatch) {
    const items = splitCommaSeparated(colonListMatch[2]);
    if (items.length >= 2) {
      return { taskTemplate: colonListMatch[1].trim(), items };
    }
  }

  // Pattern: "research A, B, C" (comma-separated list after a verb)
  const verbListMatch = message.match(
    /^(.*?(?:research|analyze|compare|review|brief|email|contact|audit|evaluate|assess|benchmark)\s+)(.+?,\s*.+)$/i
  );
  if (verbListMatch) {
    const items = splitCommaSeparated(verbListMatch[2]);
    if (items.length >= 2) {
      return { taskTemplate: verbListMatch[1].trim(), items };
    }
  }

  // Pattern: numbered list "1. A\n2. B\n3. C"
  const numberedItems = message.match(/\d+\.\s+(.+)/g);
  if (numberedItems && numberedItems.length >= 2) {
    const items = numberedItems.map(item => item.replace(/^\d+\.\s+/, '').trim());
    // Task template is everything before the first numbered item
    const firstIdx = message.indexOf(numberedItems[0]);
    const taskTemplate = message.slice(0, firstIdx).trim();
    return { taskTemplate: taskTemplate || 'Process this item', items };
  }

  // Pattern: bullet list "- A\n- B"
  const bulletItems = message.match(/^[-*]\s+(.+)/gm);
  if (bulletItems && bulletItems.length >= 2) {
    const items = bulletItems.map(item => item.replace(/^[-*]\s+/, '').trim());
    const firstIdx = message.indexOf(bulletItems[0]);
    const taskTemplate = message.slice(0, firstIdx).trim();
    return { taskTemplate: taskTemplate || 'Process this item', items };
  }

  return null;
}

/**
 * Split "A, B, and C" or "A, B, C" into ["A", "B", "C"].
 */
function splitCommaSeparated(text: string): string[] {
  return text
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 200);
}

/**
 * Use Gemini to extract items from a complex message.
 */
async function extractWithGemini(
  message: string
): Promise<{ taskTemplate: string; items: string[] } | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const prompt = `You are an AI task splitter. The user wants to perform the SAME task across MULTIPLE items.

Extract:
1. "taskTemplate" — the task to perform for each item (use [ITEM] as placeholder)
2. "items" — the list of specific items

User message:
"""
${message}
"""

Return ONLY valid JSON: {"taskTemplate": "...", "items": ["...", "..."]}
If this is NOT a multi-item task, return: {"taskTemplate": "", "items": []}`;

  const result = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 0.0, maxOutputTokens: 500 },
  });

  const text = result.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.taskTemplate && Array.isArray(parsed.items)) {
      return {
        taskTemplate: parsed.taskTemplate,
        items: parsed.items.filter((i: unknown) => typeof i === 'string' && i.length > 0),
      };
    }
  } catch { /* parse failed */ }

  return null;
}

/**
 * Pull items from integration_data (e.g., Stripe customers, Salesforce accounts).
 */
async function pullItemsFromIntegration(
  orgId: string,
  provider: string,
  recordType: string
): Promise<string[]> {
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from('integration_data')
    .select('data')
    .eq('org_id', orgId)
    .eq('provider', provider)
    .eq('record_type', recordType)
    .order('synced_at', { ascending: false })
    .limit(1);

  if (!rows || rows.length === 0) return [];

  const rawData = rows[0].data;
  const records = Array.isArray(rawData) ? rawData : (rawData as Record<string, unknown>)?.data;
  if (!Array.isArray(records)) return [];

  // Extract names from common patterns
  const items: string[] = [];
  for (const record of records) {
    if (typeof record !== 'object' || record === null) continue;
    const r = record as Record<string, unknown>;
    const name =
      r.name ?? r.Name ?? r.company ?? r.Company ??
      r.email ?? r.Email ??
      (r.firstname ? `${r.firstname} ${r.lastname ?? ''}`.trim() : null) ??
      (r.first_name ? `${r.first_name} ${r.last_name ?? ''}`.trim() : null) ??
      r.description ?? r.title ?? r.id;
    if (typeof name === 'string' && name.length > 0) {
      items.push(name);
    }
  }

  return items.slice(0, MAX_WIDE_ITEMS);
}
