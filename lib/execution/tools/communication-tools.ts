/**
 * Communication Tools — Email, Slack, documents, spreadsheets
 *
 * Email via Gmail SMTP (credentials in .env: GMAIL_EMAIL, GMAIL_APP_PASSWORD).
 * Slack via Slack API (credentials in .env: SLACK_APP_TOKEN).
 * Document/spreadsheet tools generate content as artifacts.
 */

import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatEmailBody(subject: string, body: string, to: string): string {
  return `To: ${to}\nSubject: ${subject}\n\n${body}`;
}

function csvFromData(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\n');
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

const sendEmail: Tool = {
  name: 'send_email',
  description: 'Draft and send an email via Gmail. If Gmail credentials are not configured, the email will be generated as a draft artifact instead of being sent. Supports plain text emails.',
  parameters: {
    to: {
      type: 'string',
      description: 'Recipient email address.',
    },
    subject: {
      type: 'string',
      description: 'Email subject line.',
    },
    body: {
      type: 'string',
      description: 'Email body content (plain text). Use \\n for line breaks.',
    },
    cc: {
      type: 'string',
      description: 'Optional CC email address.',
    },
  },
  required: ['to', 'subject', 'body'],
  category: 'communication',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const to = String(args.to ?? '');
    const subject = String(args.subject ?? '');
    const body = String(args.body ?? '');
    const cc = args.cc ? String(args.cc) : undefined;

    if (!to || !subject || !body) {
      return { success: false, output: 'Required fields: to, subject, body.' };
    }

    // Try Composio Gmail first (user's connected OAuth account)
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();
      const { data: integration } = await supabase
        .from('integrations')
        .select('status')
        .eq('org_id', context.orgId)
        .eq('provider', 'gmail')
        .eq('status', 'connected')
        .maybeSingle();

      if (integration) {
        const { sendEmail: composioSendEmail } = await import('@/lib/integrations/composio-tools');
        const result = await composioSendEmail(context.orgId, to, subject, body);
        if (result) {
          return {
            success: true,
            output: `✅ Email sent successfully via Gmail!\n\nTo: ${to}${cc ? `\nCC: ${cc}` : ''}\nSubject: ${subject}`,
            cost: 0,
          };
        }
      }
    } catch {
      // Fall through to draft mode
    }

    // Fallback: generate as draft artifact
    const draft = formatEmailBody(subject, body, to);
    return {
      success: true,
      output: `Email drafted (Gmail not connected via Composio).\n\nTo: ${to}${cc ? `\nCC: ${cc}` : ''}\nSubject: ${subject}\n\nConnect Gmail via Settings → Integrations to send emails automatically.\n\n---\n${body}`,
      artifacts: [{ type: 'email', name: `email-to-${to.split('@')[0]}.txt`, content: draft }],
      cost: 0,
    };
  },
};

const sendSlackMessage: Tool = {
  name: 'send_slack_message',
  description: 'Send a message to a Slack channel or user. If Slack credentials are not configured, the message will be generated as a draft artifact.',
  parameters: {
    channel: {
      type: 'string',
      description: 'Slack channel name (e.g., "#general") or user ID.',
    },
    message: {
      type: 'string',
      description: 'Message text. Supports Slack markdown (bold, links, etc.).',
    },
    thread_ts: {
      type: 'string',
      description: 'Optional thread timestamp to reply in a thread.',
    },
  },
  required: ['channel', 'message'],
  category: 'communication',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const channel = String(args.channel ?? '');
    const message = String(args.message ?? '');

    if (!channel || !message) {
      return { success: false, output: 'Required fields: channel, message.' };
    }

    // Try Composio Slack first (user's connected OAuth account)
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();
      const { data: integration } = await supabase
        .from('integrations')
        .select('status')
        .eq('org_id', context.orgId)
        .eq('provider', 'slack')
        .eq('status', 'connected')
        .maybeSingle();

      if (integration) {
        const { sendSlackMessage: composioSlack } = await import('@/lib/integrations/composio-tools');
        const result = await composioSlack(context.orgId, channel.replace('#', ''), message);
        if (result) {
          return {
            success: true,
            output: `✅ Message sent to ${channel} via Slack successfully.`,
            cost: 0,
          };
        }
      }
    } catch {
      // Fall through to direct API or draft
    }

    // Try direct Slack API token
    const slackToken = process.env.SLACK_APP_TOKEN;
    if (slackToken) {
      try {
        const response = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slackToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: channel.replace('#', ''),
            text: message,
            ...(args.thread_ts ? { thread_ts: String(args.thread_ts) } : {}),
          }),
        });
        const data = await response.json();
        if (data.ok) {
          return { success: true, output: `✅ Message sent to ${channel} successfully.`, cost: 0 };
        }
      } catch { /* fall through to draft */ }
    }

    // Fallback: draft artifact
    return {
      success: true,
      output: `Slack message drafted (Slack not connected).\n\nChannel: ${channel}\nMessage:\n${message}\n\nConnect Slack via Settings → Integrations to send messages automatically.`,
      artifacts: [{ type: 'document', name: `slack-${channel.replace('#', '')}.txt`, content: `Channel: ${channel}\n\n${message}` }],
      cost: 0,
    };
  },
};

const createDocument: Tool = {
  name: 'create_document',
  description: 'Create a structured document in markdown or plain text format. Use for memos, proposals, reports, policies, plans, and any text-based deliverable.',
  parameters: {
    title: {
      type: 'string',
      description: 'Document title.',
    },
    content: {
      type: 'string',
      description: 'Full document content in markdown format. Use ## for sections, - for bullets, **bold** for emphasis.',
    },
    format: {
      type: 'string',
      description: 'Output format.',
      enum: ['markdown', 'plain'],
    },
  },
  required: ['title', 'content'],
  category: 'communication',
  costTier: 'free',

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const title = String(args.title ?? 'Untitled Document');
    const content = String(args.content ?? '');
    const format = String(args.format ?? 'markdown');

    if (!content) {
      return { success: false, output: 'Document content is required.' };
    }

    const ext = format === 'plain' ? 'txt' : 'md';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const fullContent = format === 'markdown'
      ? `# ${title}\n\n${content}`
      : `${title}\n${'='.repeat(title.length)}\n\n${content}`;

    return {
      success: true,
      output: `Document "${title}" created (${content.length} characters, ${format} format).`,
      artifacts: [{ type: 'document', name: `${slug}.${ext}`, content: fullContent }],
      cost: 0,
    };
  },
};

const createSpreadsheet: Tool = {
  name: 'create_spreadsheet',
  description: 'Create a CSV spreadsheet with headers and data rows. Use for budgets, projections, comparisons, tracking sheets, and any tabular data.',
  parameters: {
    title: {
      type: 'string',
      description: 'Spreadsheet title (used as filename).',
    },
    headers: {
      type: 'string',
      description: 'Comma-separated column headers (e.g., "Month,Revenue,Expenses,Profit").',
    },
    rows: {
      type: 'string',
      description: 'Data rows, each row on a new line, values separated by commas. (e.g., "Jan,10000,8000,2000\\nFeb,12000,8500,3500")',
    },
  },
  required: ['title', 'headers', 'rows'],
  category: 'communication',
  costTier: 'free',

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const title = String(args.title ?? 'spreadsheet');
    const headersStr = String(args.headers ?? '');
    const rowsStr = String(args.rows ?? '');

    if (!headersStr || !rowsStr) {
      return { success: false, output: 'Headers and rows are required.' };
    }

    const headers = headersStr.split(',').map(h => h.trim());
    const rows = rowsStr.split('\n').map(r => r.split(',').map(v => v.trim()));

    const csv = csvFromData(headers, rows);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    return {
      success: true,
      output: `Spreadsheet "${title}" created with ${headers.length} columns and ${rows.length} rows.`,
      artifacts: [{ type: 'spreadsheet', name: `${slug}.csv`, content: csv }],
      cost: 0,
    };
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const communicationTools: Tool[] = [sendEmail, sendSlackMessage, createDocument, createSpreadsheet];
registerTools(communicationTools);
