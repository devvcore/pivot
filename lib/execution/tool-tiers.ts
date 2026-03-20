/**
 * Tool Tier & Approval Gate System
 *
 * Inspired by BetterBot's tiers.js — assigns permission levels to tools
 * so agents can operate autonomously with appropriate guardrails.
 *
 * 4 tiers:
 *   READ          — Always auto-approved. Read-only queries, searches, lookups.
 *   WRITE_SELF    — Always auto-approved. Creates artifacts in Pivot (docs, charts).
 *   ACT           — Auto-approved in interactive mode; needs approval in background/scheduled.
 *   DESTRUCTIVE   — Always needs confirmation. Reserved for future delete operations.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToolTier = 'READ' | 'WRITE_SELF' | 'ACT' | 'DESTRUCTIVE';

export interface ApprovalRequest {
  id?: string;
  taskId: string;
  orgId: string;
  agentId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  tier: ToolTier;
  actionDescription: string;
  reasoning?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  preview?: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
}

// ── Tool → Tier Map ───────────────────────────────────────────────────────────

export const TOOL_TIER_MAP: Record<string, ToolTier> = {
  // ── READ tier: always auto-approved ──
  query_analysis: 'READ',
  query_integration_data: 'READ',
  web_search: 'READ',
  scrape_website: 'READ',
  get_social_analytics: 'READ',
  check_connection: 'READ',
  check_domain_availability: 'READ',
  read_from_google_sheets: 'READ',
  list_calendar_events: 'READ',
  search_notion: 'READ',
  read_emails: 'READ',
  search_emails: 'READ',
  github_list_repos: 'READ',
  github_list_issues: 'READ',
  github_list_prs: 'READ',
  analyze_competitors: 'READ',
  seo_audit: 'READ',
  salary_benchmark: 'READ',
  trend_analysis: 'READ',
  benchmark_comparison: 'READ',
  expense_analysis: 'READ',
  pricing_optimizer: 'READ',
  risk_assessment: 'READ',
  vendor_comparison: 'READ',
  research_brand: 'READ',

  // ── WRITE_SELF tier: creates artifacts within Pivot, auto-approved ──
  create_document: 'WRITE_SELF',
  create_spreadsheet: 'WRITE_SELF',
  create_chart_data: 'WRITE_SELF',
  create_report: 'WRITE_SELF',
  create_social_post: 'WRITE_SELF',
  create_ad_copy: 'WRITE_SELF',
  create_landing_page: 'WRITE_SELF',
  create_email_campaign: 'WRITE_SELF',
  create_job_posting: 'WRITE_SELF',
  create_interview_questions: 'WRITE_SELF',
  create_onboarding_plan: 'WRITE_SELF',
  performance_review_template: 'WRITE_SELF',
  create_process_document: 'WRITE_SELF',
  create_sop: 'WRITE_SELF',
  create_project_plan: 'WRITE_SELF',
  create_invoice: 'WRITE_SELF',
  create_budget: 'WRITE_SELF',
  financial_projection: 'WRITE_SELF',
  create_slide_deck: 'WRITE_SELF',
  generate_media: 'WRITE_SELF',

  // ── ACT tier: external side effects — auto in interactive, approval in background ──
  send_email: 'ACT',
  reply_to_email: 'ACT',
  send_slack_message: 'ACT',
  post_to_linkedin: 'ACT',
  post_to_twitter: 'ACT',
  post_to_instagram: 'ACT',
  post_to_facebook: 'ACT',
  create_jira_ticket: 'ACT',
  create_hubspot_contact: 'ACT',
  create_calendar_event: 'ACT',
  write_to_google_sheets: 'ACT',
  github_create_issue: 'ACT',
  github_create_pr: 'ACT',
  github_create_comment: 'ACT',

  // ── DESTRUCTIVE tier: always needs confirmation (reserved for future) ──
  // No current tools — placeholder for delete_*, revoke_*, etc.
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the tier for a tool. Defaults to ACT (safe side) for unknown tools.
 */
export function getToolTier(toolName: string): ToolTier {
  return TOOL_TIER_MAP[toolName] ?? 'ACT';
}

/**
 * Determine whether a tool call needs approval before execution.
 *
 * - READ / WRITE_SELF: never need approval
 * - ACT: needs approval ONLY in background/scheduled mode
 * - DESTRUCTIVE: always needs approval
 */
export function needsApproval(toolName: string, isBackground: boolean): boolean {
  const tier = getToolTier(toolName);

  switch (tier) {
    case 'READ':
    case 'WRITE_SELF':
      return false;
    case 'ACT':
      return isBackground;
    case 'DESTRUCTIVE':
      return true;
    default:
      return isBackground; // safe default
  }
}

/**
 * Generate a human-readable description of what a tool call will do.
 * Used in approval request UI.
 */
export function describeToolAction(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'send_email':
      return `Send email to ${args.to || 'recipient'}${args.subject ? `: "${args.subject}"` : ''}`;
    case 'reply_to_email':
      return `Reply to email${args.subject ? `: "${args.subject}"` : ''}`;
    case 'send_slack_message':
      return `Send Slack message to ${args.channel || 'channel'}`;
    case 'post_to_linkedin':
      return `Post to LinkedIn: "${String(args.content || args.text || '').slice(0, 80)}..."`;
    case 'post_to_twitter':
      return `Post to Twitter/X: "${String(args.content || args.text || '').slice(0, 80)}..."`;
    case 'post_to_instagram':
      return `Post to Instagram${args.caption ? `: "${String(args.caption).slice(0, 80)}..."` : ''}`;
    case 'post_to_facebook':
      return `Post to Facebook: "${String(args.content || args.message || '').slice(0, 80)}..."`;
    case 'create_jira_ticket':
      return `Create Jira ticket: "${args.title || args.summary || 'untitled'}"`;
    case 'create_hubspot_contact':
      return `Create HubSpot contact: ${args.email || args.name || 'unknown'}`;
    case 'create_calendar_event':
      return `Create calendar event: "${args.title || args.summary || 'untitled'}"`;
    case 'write_to_google_sheets':
      return `Write to Google Sheets: "${args.spreadsheet_name || args.title || 'untitled'}"`;
    case 'github_create_issue':
      return `Create GitHub issue: "${args.title || 'untitled'}"`;
    case 'github_create_pr':
      return `Create GitHub PR: "${args.title || 'untitled'}"`;
    case 'github_create_comment':
      return `Comment on GitHub issue/PR #${args.issue_number || args.pr_number || '?'}`;
    default:
      return `Execute ${toolName}`;
  }
}

/**
 * Determine risk level for an ACT-tier tool call.
 */
export function assessRiskLevel(toolName: string, args: Record<string, unknown>): 'low' | 'medium' | 'high' | 'critical' {
  // Social media posts are medium risk — visible to the public
  if (['post_to_linkedin', 'post_to_twitter', 'post_to_instagram', 'post_to_facebook'].includes(toolName)) {
    return 'medium';
  }

  // Emails are medium-high risk depending on recipient count
  if (toolName === 'send_email' || toolName === 'reply_to_email') {
    const to = String(args.to || '');
    const recipientCount = to.split(',').length;
    return recipientCount > 5 ? 'high' : 'medium';
  }

  // GitHub PRs are medium risk
  if (toolName === 'github_create_pr') {
    return 'medium';
  }

  // Everything else is low
  return 'low';
}
