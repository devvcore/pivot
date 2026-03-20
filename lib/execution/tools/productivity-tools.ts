/**
 * Productivity & Business Tools — Slide decks, calendar, Notion, Sheets via Composio
 *
 * Real actions that agents can take on behalf of the user:
 * - Create and update Google Sheets
 * - Create Notion pages/databases
 * - Manage Google Calendar events
 * - Generate slide deck presentations
 * - Send messages via Microsoft Teams
 */

import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';

// ── Connection Check ─────────────────────────────────────────────────────────

async function checkConnection(orgId: string, provider: string): Promise<boolean> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('integrations')
      .select('status')
      .eq('org_id', orgId)
      .eq('provider', provider)
      .eq('status', 'connected')
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

// ── Slide Deck Generation ────────────────────────────────────────────────────

const createSlideDeck: Tool = {
  name: 'create_slide_deck',
  description: 'Generate a professional slide deck/presentation in HTML format. Creates a multi-slide presentation with speaker notes, optimized for business use (pitch decks, strategy decks, board presentations, team updates).',
  parameters: {
    title: {
      type: 'string',
      description: 'Presentation title.',
    },
    purpose: {
      type: 'string',
      description: 'Purpose of the deck.',
      enum: ['pitch_deck', 'strategy_deck', 'board_update', 'team_update', 'sales_deck', 'product_roadmap', 'investor_update', 'general'],
    },
    slides: {
      type: 'string',
      description: 'Comma-separated list of slide topics/sections to include (e.g., "Problem,Solution,Market Size,Business Model,Team,Ask").',
    },
    key_data: {
      type: 'string',
      description: 'Key data points, metrics, or information to include in the deck.',
    },
    brand_color: {
      type: 'string',
      description: 'Primary brand color hex code (e.g., "#2563EB"). Defaults to professional blue.',
    },
  },
  required: ['title', 'purpose'],
  category: 'communication',
  costTier: 'moderate',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const title = String(args.title ?? '');
    const purpose = String(args.purpose ?? 'general');
    const slidesStr = String(args.slides ?? '');
    const keyData = String(args.key_data ?? '');
    const brandColor = String(args.brand_color ?? '#2563EB');

    if (!title) {
      return { success: false, output: 'Presentation title is required.' };
    }

    // Default slides per purpose
    const defaultSlides: Record<string, string[]> = {
      pitch_deck: ['Title', 'Problem', 'Solution', 'Market Size', 'Business Model', 'Traction', 'Competition', 'Team', 'Financials', 'The Ask'],
      strategy_deck: ['Title', 'Executive Summary', 'Current State', 'Goals & KPIs', 'Strategy Pillars', 'Initiatives', 'Timeline', 'Budget', 'Risks', 'Next Steps'],
      board_update: ['Title', 'Key Metrics', 'Revenue Update', 'Growth', 'Product Updates', 'Team', 'Challenges', 'Financial Summary', 'Next Quarter'],
      team_update: ['Title', 'Highlights', 'Metrics', 'Wins', 'Challenges', 'Upcoming', 'Action Items'],
      sales_deck: ['Title', 'The Challenge', 'Our Solution', 'How It Works', 'Features', 'Case Studies', 'Pricing', 'ROI', 'Next Steps'],
      product_roadmap: ['Title', 'Vision', 'Current State', 'Q1 Priorities', 'Q2 Priorities', 'H2 Outlook', 'Dependencies', 'Resources'],
      investor_update: ['Title', 'Highlights', 'KPIs', 'Revenue', 'Burn Rate', 'Product', 'Growth', 'Hiring', 'Runway', 'Ask'],
      general: ['Title', 'Overview', 'Key Points', 'Details', 'Summary', 'Next Steps'],
    };

    const slides = slidesStr
      ? slidesStr.split(',').map(s => s.trim())
      : defaultSlides[purpose] ?? defaultSlides.general;

    // Generate slide HTML
    const slideHtml = slides.map((slide, i) => `
      <section class="slide" id="slide-${i + 1}">
        <div class="slide-number">${i + 1} / ${slides.length}</div>
        <h2>${slide}</h2>
        <div class="slide-content">
          ${i === 0 ? `<h1 style="font-size:2.5em;margin-bottom:0.5em;">${title}</h1><p style="font-size:1.2em;opacity:0.8;">${purpose.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>` : `<p>[${slide} content — populate with your specific data]</p>`}
        </div>
        <div class="speaker-notes">Speaker notes for: ${slide}</div>
      </section>`).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, sans-serif; background: #0f172a; color: #f8fafc; }
.slide { width: 100vw; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4rem; position: relative; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 1px solid #334155; }
.slide h2 { font-size: 2.2em; font-weight: 700; margin-bottom: 2rem; color: ${brandColor}; text-transform: uppercase; letter-spacing: 0.05em; }
.slide h1 { color: #f8fafc; }
.slide-content { max-width: 900px; text-align: center; font-size: 1.3em; line-height: 1.8; }
.slide-number { position: absolute; bottom: 2rem; right: 2rem; font-size: 0.9em; opacity: 0.5; }
.speaker-notes { display: none; }
@media print { .slide { page-break-after: always; } }
</style>
</head>
<body>
${slideHtml}
<script>
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
function showSlide(n) { slides.forEach((s,i) => { s.style.display = i === n ? 'flex' : 'none'; }); currentSlide = n; }
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); showSlide(Math.min(currentSlide + 1, slides.length - 1)); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); showSlide(Math.max(currentSlide - 1, 0)); }
});
showSlide(0);
</script>
</body>
</html>`;

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    return {
      success: true,
      output: `Slide deck "${title}" generated with ${slides.length} slides.\n\nSlides: ${slides.join(' → ')}\n\nThe presentation is available as an HTML artifact. Open in a browser and use arrow keys to navigate.${keyData ? '\n\nKey data provided — populate slides with your specific metrics.' : ''}`,
      artifacts: [{ type: 'html', name: `${slug}-deck.html`, content: html }],
      cost: 0.01,
    };
  },
};

// ── Google Sheets Actions ────────────────────────────────────────────────────

const writeToGoogleSheets: Tool = {
  name: 'write_to_google_sheets',
  description: 'Write data to a Google Sheets spreadsheet. Requires Google Sheets to be connected via Composio. Use this to update spreadsheets, add rows, or create data in existing sheets.',
  parameters: {
    spreadsheet_id: {
      type: 'string',
      description: 'Google Sheets spreadsheet ID (from the URL).',
    },
    range: {
      type: 'string',
      description: 'Cell range to write to (e.g., "Sheet1!A1:D10", "Sheet1!A1").',
    },
    values: {
      type: 'string',
      description: 'Data to write as JSON 2D array (e.g., [["Name","Score"],["Alice",95],["Bob",87]]).',
    },
  },
  required: ['spreadsheet_id', 'range', 'values'],
  category: 'data',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const spreadsheetId = String(args.spreadsheet_id ?? '');
    const range = String(args.range ?? '');
    const valuesStr = String(args.values ?? '');

    if (!spreadsheetId || !range || !valuesStr) {
      return { success: false, output: 'spreadsheet_id, range, and values are required.' };
    }

    const connected = await checkConnection(context.orgId, 'google_sheets');
    if (!connected) {
      return { success: false, output: '[connect:google_sheets]' };
    }

    try {
      let values: unknown[][];
      try {
        values = JSON.parse(valuesStr);
      } catch {
        return { success: false, output: 'Invalid values format. Must be a JSON 2D array.' };
      }

      const { writeSpreadsheet } = await import('@/lib/integrations/composio-tools');
      const result = await writeSpreadsheet(context.orgId, spreadsheetId, range, values);

      if (result) {
        return {
          success: true,
          output: `✅ Data written to Google Sheets!\n\nSpreadsheet: ${spreadsheetId}\nRange: ${range}\nRows written: ${values.length}`,
          cost: 0,
        };
      }
      return { success: false, output: 'Failed to write to Google Sheets.' };
    } catch (err) {
      return { success: false, output: `Google Sheets write failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

const readFromGoogleSheets: Tool = {
  name: 'read_from_google_sheets',
  description: 'Read data from a Google Sheets spreadsheet. Requires Google Sheets to be connected via Composio.',
  parameters: {
    spreadsheet_id: {
      type: 'string',
      description: 'Google Sheets spreadsheet ID (from the URL).',
    },
    range: {
      type: 'string',
      description: 'Cell range to read (e.g., "Sheet1!A1:D10").',
    },
  },
  required: ['spreadsheet_id', 'range'],
  category: 'data',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const spreadsheetId = String(args.spreadsheet_id ?? '');
    const range = String(args.range ?? '');

    if (!spreadsheetId || !range) {
      return { success: false, output: 'spreadsheet_id and range are required.' };
    }

    const connected = await checkConnection(context.orgId, 'google_sheets');
    if (!connected) {
      return { success: false, output: '[connect:google_sheets]' };
    }

    try {
      const { readSpreadsheet } = await import('@/lib/integrations/composio-tools');
      const result = await readSpreadsheet(context.orgId, spreadsheetId, range);

      if (result) {
        return {
          success: true,
          output: `Data from Google Sheets (${range}):\n\n${JSON.stringify(result, null, 2).slice(0, 4000)}`,
          cost: 0,
        };
      }
      return { success: true, output: 'No data found in the specified range.', cost: 0 };
    } catch (err) {
      return { success: false, output: `Google Sheets read failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── Google Calendar Actions ──────────────────────────────────────────────────

const listCalendarEvents: Tool = {
  name: 'list_calendar_events',
  description: 'List upcoming Google Calendar events. Requires Google Calendar to be connected via Composio.',
  parameters: {
    time_min: {
      type: 'string',
      description: 'Start time filter in ISO format (e.g., "2024-01-15T00:00:00Z"). Defaults to now.',
    },
    time_max: {
      type: 'string',
      description: 'End time filter in ISO format. Defaults to 7 days from now.',
    },
  },
  required: [],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const connected = await checkConnection(context.orgId, 'google_calendar');
    if (!connected) {
      return { success: false, output: '[connect:google_calendar]' };
    }

    try {
      const { getCalendarEvents } = await import('@/lib/integrations/composio-tools');
      const timeMin = args.time_min ? String(args.time_min) : new Date().toISOString();
      const timeMax = args.time_max ? String(args.time_max) : new Date(Date.now() + 7 * 86400000).toISOString();

      const result = await getCalendarEvents(context.orgId, 'primary', timeMin, timeMax);

      if (result) {
        const events = Array.isArray(result) ? result : (result?.items ?? result?.data ?? []);
        const eventList = (events as Array<Record<string, unknown>>).slice(0, 20).map((e: Record<string, unknown>) => {
          const start = e.start as Record<string, unknown> | undefined;
          const startTime = start?.dateTime ?? start?.date ?? 'TBD';
          return `- ${e.summary ?? 'Untitled'} (${startTime})`;
        }).join('\n');

        return {
          success: true,
          output: `Upcoming calendar events:\n\n${eventList || 'No events found in the specified range.'}`,
          cost: 0,
        };
      }
      return { success: true, output: 'No calendar events found.', cost: 0 };
    } catch (err) {
      return { success: false, output: `Calendar fetch failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── Notion Actions ───────────────────────────────────────────────────────────

const searchNotionPages: Tool = {
  name: 'search_notion',
  description: 'Search across a Notion workspace for pages and databases. Requires Notion to be connected via Composio.',
  parameters: {
    query: {
      type: 'string',
      description: 'Search query to find pages, databases, or content in Notion.',
    },
  },
  required: ['query'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const query = String(args.query ?? '');
    if (!query) {
      return { success: false, output: 'Search query is required.' };
    }

    const connected = await checkConnection(context.orgId, 'notion');
    if (!connected) {
      return { success: false, output: '[connect:notion]' };
    }

    try {
      const { searchNotion } = await import('@/lib/integrations/composio-tools');
      const result = await searchNotion(context.orgId, query);

      if (result) {
        return {
          success: true,
          output: `Notion search results for "${query}":\n\n${JSON.stringify(result, null, 2).slice(0, 4000)}`,
          cost: 0,
        };
      }
      return { success: true, output: 'No results found in Notion.', cost: 0 };
    } catch (err) {
      return { success: false, output: `Notion search failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── Jira Actions ─────────────────────────────────────────────────────────────

const createJiraTicket: Tool = {
  name: 'create_jira_ticket',
  description: 'Create a new Jira issue/ticket. Requires Jira to be connected via Composio.',
  parameters: {
    project_key: {
      type: 'string',
      description: 'Jira project key (e.g., "ENG", "PROD").',
    },
    summary: {
      type: 'string',
      description: 'Issue title/summary.',
    },
    description: {
      type: 'string',
      description: 'Issue description.',
    },
    issue_type: {
      type: 'string',
      description: 'Issue type.',
      enum: ['Task', 'Bug', 'Story', 'Epic'],
    },
  },
  required: ['project_key', 'summary', 'description'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const projectKey = String(args.project_key ?? '');
    const summary = String(args.summary ?? '');
    const description = String(args.description ?? '');
    const issueType = String(args.issue_type ?? 'Task');

    if (!projectKey || !summary) {
      return { success: false, output: 'project_key and summary are required.' };
    }

    const connected = await checkConnection(context.orgId, 'jira');
    if (!connected) {
      return { success: false, output: '[connect:jira]' };
    }

    try {
      const { createJiraIssue } = await import('@/lib/integrations/composio-tools');
      const result = await createJiraIssue(context.orgId, projectKey, summary, description, issueType);

      if (result) {
        return {
          success: true,
          output: `✅ Jira ticket created!\n\nProject: ${projectKey}\nType: ${issueType}\nSummary: ${summary}`,
          cost: 0,
        };
      }
      return { success: false, output: 'Failed to create Jira ticket.' };
    } catch (err) {
      return { success: false, output: `Jira ticket creation failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── HubSpot CRM Actions ─────────────────────────────────────────────────────

const createHubSpotContact: Tool = {
  name: 'create_hubspot_contact',
  description: 'Create a new contact in HubSpot CRM. Requires HubSpot to be connected via Composio.',
  parameters: {
    email: {
      type: 'string',
      description: 'Contact email address.',
    },
    firstname: {
      type: 'string',
      description: 'First name.',
    },
    lastname: {
      type: 'string',
      description: 'Last name.',
    },
    company: {
      type: 'string',
      description: 'Company name.',
    },
  },
  required: ['email', 'firstname', 'lastname'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const email = String(args.email ?? '');
    const firstname = String(args.firstname ?? '');
    const lastname = String(args.lastname ?? '');
    const company = args.company ? String(args.company) : undefined;

    if (!email || !firstname || !lastname) {
      return { success: false, output: 'email, firstname, and lastname are required.' };
    }

    const connected = await checkConnection(context.orgId, 'hubspot');
    if (!connected) {
      return { success: false, output: '[connect:hubspot]' };
    }

    try {
      const { createHubSpotContact: composioCreate } = await import('@/lib/integrations/composio-tools');
      const result = await composioCreate(context.orgId, email, firstname, lastname, company);

      if (result) {
        return {
          success: true,
          output: `✅ HubSpot contact created!\n\nName: ${firstname} ${lastname}\nEmail: ${email}${company ? `\nCompany: ${company}` : ''}`,
          cost: 0,
        };
      }
      return { success: false, output: 'Failed to create HubSpot contact.' };
    } catch (err) {
      return { success: false, output: `HubSpot contact creation failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

const createCalendarEvent: Tool = {
  name: 'create_calendar_event',
  description: 'Create a new Google Calendar event. Use to schedule meetings, reminders, deadlines, follow-ups, or any time-based action item. Requires Google Calendar connected via Composio.',
  parameters: {
    title: {
      type: 'string',
      description: 'Event title/summary.',
    },
    start_time: {
      type: 'string',
      description: 'Event start time in ISO 8601 format (e.g., "2026-03-20T10:00:00-05:00").',
    },
    end_time: {
      type: 'string',
      description: 'Event end time in ISO 8601 format (e.g., "2026-03-20T11:00:00-05:00").',
    },
    description: {
      type: 'string',
      description: 'Optional event description with agenda, notes, or links.',
    },
    attendees: {
      type: 'string',
      description: 'Optional comma-separated email addresses of attendees.',
    },
  },
  required: ['title', 'start_time', 'end_time'],
  category: 'system',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const title = String(args.title ?? '');
    const startTime = String(args.start_time ?? '');
    const endTime = String(args.end_time ?? '');
    const description = args.description ? String(args.description) : undefined;
    const attendeesStr = args.attendees ? String(args.attendees) : undefined;

    if (!title || !startTime || !endTime) {
      return { success: false, output: 'Required fields: title, start_time, end_time.' };
    }

    const connected = await checkConnection(context.orgId, 'google_calendar');
    if (!connected) {
      return {
        success: false,
        output: '[connect:google_calendar]',
        cost: 0,
      };
    }

    try {
      const { createCalendarEvent: composioCreate } = await import('@/lib/integrations/composio-tools');
      const attendees = attendeesStr ? attendeesStr.split(',').map(e => e.trim()).filter(Boolean) : undefined;
      const result = await composioCreate(context.orgId, title, startTime, endTime, description, attendees);

      if (result) {
        return {
          success: true,
          output: `✅ Calendar event created!\n\nTitle: ${title}\nStart: ${startTime}\nEnd: ${endTime}${attendeesStr ? `\nAttendees: ${attendeesStr}` : ''}`,
          cost: 0,
        };
      }
      return { success: false, output: 'Failed to create calendar event.' };
    } catch (err) {
      return { success: false, output: `Calendar event creation failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const productivityTools: Tool[] = [
  createSlideDeck,
  writeToGoogleSheets,
  readFromGoogleSheets,
  listCalendarEvents,
  createCalendarEvent,
  searchNotionPages,
  createJiraTicket,
  createHubSpotContact,
];
registerTools(productivityTools);
