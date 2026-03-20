/**
 * Directives & Governance System
 *
 * Combines BetterBot's directives with Vallum-style natural language policies.
 * Directives are org-level rules that constrain agent behavior:
 *   - 'never'  — Forbidden actions (hard block, tool calls checked)
 *   - 'always' — Mandatory actions (injected as requirements)
 *   - 'prefer' — Soft preferences (guidance, not enforced)
 *   - 'ignore' — Topics to skip (agent told to deprioritize)
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DirectiveType = 'never' | 'always' | 'prefer' | 'ignore';
export type DirectiveSource = 'user' | 'agent' | 'system';

export interface Directive {
  id: string;
  org_id: string;
  type: DirectiveType;
  content: string;
  source: DirectiveSource;
  active: boolean;
  created_at: string;
}

export interface DirectiveViolation {
  violated: boolean;
  directive: string;
}

// ── Save / Load ───────────────────────────────────────────────────────────────

/**
 * Save a new directive for an organization.
 */
export async function saveDirective(
  orgId: string,
  type: DirectiveType,
  content: string,
  source: DirectiveSource = 'user'
): Promise<Directive | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('directives')
    .insert({ org_id: orgId, type, content, source, active: true })
    .select()
    .single();

  if (error) {
    console.error('[Directives] Failed to save:', error.message);
    return null;
  }
  return data as Directive;
}

/**
 * Load all active directives for an organization.
 */
export async function loadDirectives(orgId: string): Promise<Directive[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('directives')
    .select('*')
    .eq('org_id', orgId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Directives] Failed to load:', error.message);
    return [];
  }
  return (data ?? []) as Directive[];
}

/**
 * Deactivate a directive (soft delete).
 */
export async function deactivateDirective(directiveId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('directives')
    .update({ active: false })
    .eq('id', directiveId);

  if (error) {
    console.error('[Directives] Failed to deactivate:', error.message);
    return false;
  }
  return true;
}

// ── Format for Agent Prompt ───────────────────────────────────────────────────

const TYPE_LABELS: Record<DirectiveType, string> = {
  never: 'NEVER',
  always: 'ALWAYS',
  prefer: 'PREFER',
  ignore: 'IGNORE',
};

/**
 * Format directives as a block to inject into agent system prompts.
 * Returns empty string if no directives.
 */
export function formatDirectivesAsContext(directives: Directive[]): string {
  if (!directives.length) return '';

  const lines = directives.map(
    (d) => `${TYPE_LABELS[d.type]}: ${d.content}`
  );

  return `--- Organization Directives ---
These are binding rules set by the organization. You MUST follow them.
NEVER directives are HARD BLOCKS — do not perform the forbidden action under any circumstances.
ALWAYS directives are MANDATORY — ensure every response complies.
PREFER directives are SOFT GUIDANCE — follow when possible.
IGNORE directives mean SKIP that topic — do not address it unless explicitly asked.

${lines.join('\n')}`;
}

// ── Directive Violation Check ─────────────────────────────────────────────────

/**
 * Check if a tool call violates any 'never' directive.
 *
 * Uses keyword matching against the directive content and tool name + args.
 * Only 'never' directives can block tool calls.
 */
export function checkDirectiveViolation(
  toolName: string,
  args: Record<string, unknown>,
  directives: Directive[]
): DirectiveViolation {
  const neverDirectives = directives.filter((d) => d.type === 'never');
  if (neverDirectives.length === 0) {
    return { violated: false, directive: '' };
  }

  // Build a searchable string from the tool call
  const callSignature = `${toolName} ${JSON.stringify(args)}`.toLowerCase();

  for (const d of neverDirectives) {
    const contentLower = d.content.toLowerCase();

    // Extract meaningful keywords from the directive (3+ chars, skip stop words)
    const stopWords = new Set([
      'the', 'and', 'for', 'not', 'with', 'that', 'this', 'from', 'but',
      'are', 'was', 'were', 'been', 'have', 'has', 'had', 'will', 'can',
      'may', 'should', 'would', 'could', 'without', 'any', 'all', 'our',
      'their', 'your', 'its', 'don', 'does', 'never', 'always',
    ]);
    const keywords = contentLower
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    // Check for tool-name-level matches
    // e.g., "never email clients" should match send_email
    const toolMappings: Record<string, string[]> = {
      send_email: ['email', 'mail', 'gmail', 'message'],
      post_to_linkedin: ['linkedin', 'post', 'social'],
      post_to_twitter: ['twitter', 'tweet', 'post', 'social'],
      post_to_instagram: ['instagram', 'post', 'social'],
      post_to_facebook: ['facebook', 'post', 'social'],
      create_jira_ticket: ['jira', 'ticket', 'issue'],
      github_create_issue: ['github', 'issue'],
      github_create_pr: ['github', 'pull', 'request'],
      send_slack_message: ['slack', 'message'],
      write_to_google_sheets: ['sheets', 'spreadsheet', 'google'],
    };

    const toolKeywords = toolMappings[toolName] ?? [toolName.replace(/_/g, ' ')];

    // A directive is violated if:
    // 1. The directive keywords overlap with the tool keywords/call signature
    // 2. At least 2 keywords match (to avoid false positives on single common words)
    let matchCount = 0;
    for (const kw of keywords) {
      if (callSignature.includes(kw)) {
        matchCount++;
      }
      for (const tk of toolKeywords) {
        if (tk.includes(kw) || kw.includes(tk)) {
          matchCount++;
        }
      }
    }

    // Require at least 2 keyword matches to consider it a violation
    if (matchCount >= 2) {
      return {
        violated: true,
        directive: `BLOCKED by org directive: "${d.content}" — This action is forbidden by your organization's governance rules.`,
      };
    }
  }

  return { violated: false, directive: '' };
}
