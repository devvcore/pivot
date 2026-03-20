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
  description: 'Send an email via Gmail. This tool ACTUALLY SENDS the email — it is not a draft. When the user asks you to send, email, or message someone, you MUST call this tool with the to, subject, and body. Do NOT write the email inline in your response — call this tool instead.',
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

    // Check if Gmail is connected (exclude stale 'error' records)
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data: integration } = await supabase
      .from('integrations')
      .select('status')
      .eq('org_id', context.orgId)
      .eq('provider', 'gmail')
      .in('status', ['connected'])
      .maybeSingle();

    if (!integration) {
      // Gmail not connected — return connect marker + draft
      const draft = formatEmailBody(subject, body, to);
      return {
        success: false,
        output: `[connect:gmail]`,
        artifacts: [{ type: 'email', name: `email-to-${to.split('@')[0]}.txt`, content: draft }],
        cost: 0,
      };
    }

    // Gmail IS connected — send via Composio
    try {
      const { sendEmail: composioSendEmail } = await import('@/lib/integrations/composio-tools');
      const result = await composioSendEmail(context.orgId, to, subject, body);
      if (result) {
        return {
          success: true,
          output: `✅ Email sent successfully via Gmail!\n\nTo: ${to}${cc ? `\nCC: ${cc}` : ''}\nSubject: ${subject}`,
          cost: 0,
        };
      }
      return {
        success: false,
        output: `Email send failed — Gmail returned no result. Try again or check the Gmail connection.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Email send failed: ${message}` };
    }
  },
};

const sendSlackMessage: Tool = {
  name: 'send_slack_message',
  description: 'Send a message to a Slack channel or user. This tool ACTUALLY SENDS the message. When the user asks you to message someone on Slack, you MUST call this tool — do NOT write the message inline in your response.',
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

    // Slack not connected — return connect marker + draft
    return {
      success: false,
      output: `[connect:slack]`,
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

const readEmails: Tool = {
  name: 'read_emails',
  description: 'Read recent emails from the user\'s Gmail inbox. Use to check for unread messages, find specific emails, or gather context before replying. Returns sender, subject, snippet, and date for each email.',
  parameters: {
    query: {
      type: 'string',
      description: 'Optional Gmail search query (e.g., "is:unread", "from:john", "subject:Q4 report"). Defaults to recent emails.',
    },
    max_results: {
      type: 'number',
      description: 'Maximum number of emails to return (default 5, max 20).',
    },
  },
  required: [],
  category: 'communication',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const query = args.query ? String(args.query) : undefined;
    const maxResults = Math.min(Number(args.max_results) || 5, 20);

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

      if (!integration) {
        return {
          success: false,
          output: '[connect:gmail]',
        };
      }

      const { getEmails } = await import('@/lib/integrations/composio-tools');
      const result = await getEmails(context.orgId, query, maxResults);

      if (!result) {
        return { success: true, output: query ? `No emails found matching "${query}".` : 'Inbox is empty or no recent emails found.', cost: 0 };
      }

      // Composio wraps response: { data: { messages: [...] } } or direct array
      const emails = Array.isArray(result)
        ? result
        : (result?.data?.messages ?? result?.messages ?? result?.data ?? [result]);

      if (!Array.isArray(emails) || emails.length === 0) {
        return { success: true, output: query ? `No emails found matching "${query}".` : 'Inbox is empty or no recent emails found.', cost: 0 };
      }

      const formatted = emails.slice(0, maxResults).map((e: any, i: number) => {
        const from = e.sender || e.from || e.headers?.from || 'Unknown';
        const subject = e.subject || e.headers?.subject || '(no subject)';
        const snippet = e.snippet || e.preview || e.body?.slice(0, 120) || '';
        const date = e.date || e.internalDate || e.receivedAt || '';
        return `${i + 1}. From: ${from}\n   Subject: ${subject}\n   Preview: ${snippet}\n   Date: ${date}`;
      }).join('\n\n');

      return {
        success: true,
        output: `Found ${emails.length} email(s)${query ? ` matching "${query}"` : ''}:\n\n${formatted}`,
        cost: 0,
      };
    } catch (err) {
      return { success: false, output: `Failed to read emails: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
  },
};

const replyToEmail: Tool = {
  name: 'reply_to_email',
  description: 'Reply to an email. Composes and sends a reply via Gmail. Use after reading emails to respond to a specific message.',
  parameters: {
    to: {
      type: 'string',
      description: 'Recipient email address (the person you\'re replying to).',
    },
    subject: {
      type: 'string',
      description: 'Email subject (should start with "Re: " followed by the original subject).',
    },
    body: {
      type: 'string',
      description: 'Reply body content (plain text).',
    },
    original_subject: {
      type: 'string',
      description: 'The original email subject for context tracking.',
    },
  },
  required: ['to', 'subject', 'body'],
  category: 'communication',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const to = String(args.to ?? '');
    const subject = String(args.subject ?? '');
    const body = String(args.body ?? '');

    if (!to || !subject || !body) {
      return { success: false, output: 'Required fields: to, subject, body.' };
    }

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

      if (!integration) {
        return {
          success: false,
          output: '[connect:gmail]',
          artifacts: [{ type: 'email', name: `reply-to-${to.split('@')[0]}.txt`, content: formatEmailBody(subject, body, to) }],
          cost: 0,
        };
      }

      const { sendEmail: composioSendEmail } = await import('@/lib/integrations/composio-tools');
      const result = await composioSendEmail(context.orgId, to, subject, body);
      if (result) {
        return { success: true, output: `✅ Reply sent to ${to}!\nSubject: ${subject}`, cost: 0 };
      }
      return { success: false, output: 'Failed to send reply via Gmail.' };
    } catch (err) {
      return { success: false, output: `Failed to send reply: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
  },
};

const searchEmails: Tool = {
  name: 'search_emails',
  description: 'Search emails using Gmail search syntax. More targeted than read_emails — use when you need to find specific messages by sender, subject, date, labels, etc.',
  parameters: {
    query: {
      type: 'string',
      description: 'Gmail search query (e.g., "from:jane subject:Q4 docs", "is:unread after:2026/03/01", "has:attachment from:accounting"). Required.',
    },
    max_results: {
      type: 'number',
      description: 'Maximum number of results (default 10, max 20).',
    },
  },
  required: ['query'],
  category: 'communication',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const query = String(args.query ?? '');
    const maxResults = Math.min(Number(args.max_results) || 10, 20);

    if (!query) {
      return { success: false, output: 'Search query is required. Use Gmail search syntax (e.g., "from:john subject:budget").' };
    }

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

      if (!integration) {
        return {
          success: false,
          output: '[connect:gmail]',
        };
      }

      const { getEmails } = await import('@/lib/integrations/composio-tools');
      const result = await getEmails(context.orgId, query, maxResults);

      if (!result) {
        return { success: true, output: `No emails found matching "${query}".`, cost: 0 };
      }

      // Composio wraps response: { data: { messages: [...] } } or direct array
      const emails = Array.isArray(result)
        ? result
        : (result?.data?.messages ?? result?.messages ?? result?.data ?? [result]);

      if (!Array.isArray(emails) || emails.length === 0) {
        return { success: true, output: `No emails found matching "${query}".`, cost: 0 };
      }

      const formatted = emails.slice(0, maxResults).map((e: any, i: number) => {
        const from = e.sender || e.from || e.headers?.from || 'Unknown';
        const subject = e.subject || e.headers?.subject || '(no subject)';
        const snippet = e.snippet || e.preview || e.body?.slice(0, 120) || '';
        const date = e.date || e.internalDate || e.receivedAt || '';
        return `${i + 1}. From: ${from}\n   Subject: ${subject}\n   Preview: ${snippet}\n   Date: ${date}`;
      }).join('\n\n');

      return {
        success: true,
        output: `Found ${emails.length} email(s) matching "${query}":\n\n${formatted}`,
        cost: 0,
      };
    } catch (err) {
      return { success: false, output: `Failed to search emails: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const communicationTools: Tool[] = [sendEmail, sendSlackMessage, createDocument, createSpreadsheet, readEmails, replyToEmail, searchEmails];
registerTools(communicationTools);
