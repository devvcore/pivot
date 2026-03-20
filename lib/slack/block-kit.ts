/**
 * Slack Block Kit formatting utilities.
 *
 * Converts Pivvy responses and structured data into rich Slack Block Kit
 * payloads with sections, dividers, context blocks, and action buttons.
 */

// ── Block Kit Types ──────────────────────────────────────────────────────────

export interface SlackBlock {
  type: string;
  text?: SlackText;
  fields?: SlackText[];
  elements?: SlackElement[];
  accessory?: SlackElement;
  block_id?: string;
}

export interface SlackText {
  type: 'mrkdwn' | 'plain_text';
  text: string;
  emoji?: boolean;
}

export interface SlackElement {
  type: string;
  text?: SlackText;
  url?: string;
  action_id?: string;
  value?: string;
  style?: string;
  image_url?: string;
  alt_text?: string;
}

// ── Primitive Builders ───────────────────────────────────────────────────────

export function mrkdwn(text: string): SlackText {
  return { type: 'mrkdwn', text };
}

export function plainText(text: string): SlackText {
  return { type: 'plain_text', text, emoji: true };
}

export function section(text: string): SlackBlock {
  return { type: 'section', text: mrkdwn(text) };
}

export function fieldsSection(pairs: [string, string][]): SlackBlock {
  return {
    type: 'section',
    fields: pairs.map(([label, value]) => mrkdwn(`*${label}*\n${value}`)),
  };
}

export function divider(): SlackBlock {
  return { type: 'divider' };
}

export function context(texts: string[]): SlackBlock {
  return {
    type: 'context',
    elements: texts.map(t => mrkdwn(t)) as any,
  };
}

export function header(text: string): SlackBlock {
  return { type: 'header', text: plainText(text) };
}

export function button(label: string, actionId: string, url?: string, style?: 'primary' | 'danger'): SlackElement {
  const btn: SlackElement = {
    type: 'button',
    text: plainText(label),
    action_id: actionId,
  };
  if (url) btn.url = url;
  if (style) btn.style = style;
  return btn;
}

export function actions(buttons: SlackElement[]): SlackBlock {
  return { type: 'actions', elements: buttons };
}

// ── High-Level Formatters ────────────────────────────────────────────────────

/** Format a plain text response as rich Slack blocks */
export function formatPivvyResponse(text: string, pivotBaseUrl?: string): SlackBlock[] {
  const blocks: SlackBlock[] = [];
  const baseUrl = pivotBaseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.pivotcommandcenter.com';

  // Split response into paragraphs
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim());

  for (const para of paragraphs) {
    // Detect bullet lists
    if (para.match(/^[\s]*[-*]\s/m)) {
      const lines = para.split('\n').map(l => {
        // Convert markdown-style bullets to Slack mrkdwn
        return l.replace(/^\s*[-*]\s+/, '\u2022 ').replace(/\*\*(.+?)\*\*/g, '*$1*');
      });
      blocks.push(section(lines.join('\n')));
    } else {
      // Convert markdown bold to Slack bold
      const slackText = para.replace(/\*\*(.+?)\*\*/g, '*$1*');
      blocks.push(section(slackText));
    }
  }

  // Add "View in Pivot" button
  blocks.push(divider());
  blocks.push(actions([
    button('Open Pivot Dashboard', 'open_pivot', baseUrl, 'primary'),
  ]));

  return blocks;
}

/** Format a business health summary for Slack */
export function formatHealthSummary(data: {
  orgName: string;
  healthScore: number;
  healthGrade: string;
  cashRunway: number;
  revenueAtRisk: number;
  totalLeaks: number;
  issuesCount?: number;
}): SlackBlock[] {
  const scoreEmoji = data.healthScore >= 80 ? ':large_green_circle:'
    : data.healthScore >= 60 ? ':large_yellow_circle:'
    : ':red_circle:';

  return [
    header(`${data.orgName} - Business Health`),
    fieldsSection([
      ['Health Score', `${scoreEmoji} *${data.healthScore}/100* (Grade ${data.healthGrade})`],
      ['Cash Runway', `*${data.cashRunway}* weeks`],
      ['Revenue at Risk', `*$${data.revenueAtRisk.toLocaleString()}*`],
      ['Revenue Leaks', `*$${data.totalLeaks.toLocaleString()}*`],
    ]),
    ...(data.issuesCount !== undefined ? [
      context([`${data.issuesCount} open issues identified`]),
    ] : []),
    divider(),
    actions([
      button('View Full Report', 'view_report', undefined, 'primary'),
      button('See Issues', 'view_issues'),
    ]),
  ];
}

/** Format a CRM pipeline summary for Slack */
export function formatPipelineSummary(stages: {
  name: string;
  count: number;
  value: number;
}[], totalValue: number, winRate: number): SlackBlock[] {
  const blocks: SlackBlock[] = [
    header('CRM Pipeline Overview'),
  ];

  // Build fields in pairs
  const pairs: [string, string][] = [];
  for (const stage of stages) {
    if (stage.count === 0) continue;
    const valueStr = stage.value > 0 ? ` | $${stage.value.toLocaleString()}` : '';
    pairs.push([stage.name, `${stage.count} contacts${valueStr}`]);
  }

  // Slack fields max 10 per section
  for (let i = 0; i < pairs.length; i += 10) {
    blocks.push(fieldsSection(pairs.slice(i, i + 10)));
  }

  blocks.push(divider());
  blocks.push(
    context([
      `Total pipeline value: *$${totalValue.toLocaleString()}*`,
      `Win rate: *${winRate}%*`,
    ]),
  );
  blocks.push(actions([
    button('View Pipeline', 'view_pipeline', undefined, 'primary'),
  ]));

  return blocks;
}

/** Format open tasks summary for Slack */
export function formatTasksSummary(tasks: {
  status: string;
  count: number;
}[], totalOpen: number): SlackBlock[] {
  const blocks: SlackBlock[] = [
    header('Open Tasks & Tickets'),
  ];

  const lines = tasks
    .filter(t => t.count > 0)
    .map(t => {
      const emoji = t.status === 'in_progress' ? ':arrows_counterclockwise:'
        : t.status === 'todo' ? ':white_circle:'
        : t.status === 'review' ? ':eyes:'
        : t.status === 'backlog' ? ':inbox_tray:'
        : ':ballot_box_with_check:';
      return `${emoji} *${capitalize(t.status.replace('_', ' '))}:* ${t.count}`;
    });

  blocks.push(section(lines.join('\n')));
  blocks.push(divider());
  blocks.push(
    context([`*${totalOpen}* total open tickets`]),
  );
  blocks.push(actions([
    button('View All Tasks', 'view_tasks', undefined, 'primary'),
  ]));

  return blocks;
}

/** Convert Slack blocks to a flat text fallback (for clients that don't support blocks) */
export function blocksToFallbackText(blocks: SlackBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === 'header' && block.text) {
      parts.push(block.text.text);
    } else if (block.type === 'section' && block.text) {
      parts.push(block.text.text);
    } else if (block.type === 'section' && block.fields) {
      parts.push(block.fields.map(f => f.text).join(' | '));
    } else if (block.type === 'context' && block.elements) {
      parts.push((block.elements as any).map(e => e.text).join(' | '));
    }
  }
  return parts.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
