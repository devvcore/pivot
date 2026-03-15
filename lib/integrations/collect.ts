/**
 * Collect integration data from the database for injection into the analysis pipeline.
 * Reads from integration_data table and formats for synthesis prompts.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { IntegrationContext, IntegrationDataRecord } from '@/lib/types';

/**
 * Fetches all integration data records for an organization.
 * Called during pipeline execution (run.ts) before synthesis starts.
 */
export async function collectIntegrationContext(orgId: string): Promise<IntegrationContext> {
  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from('integration_data')
    .select('provider, record_type, data, synced_at')
    .eq('org_id', orgId)
    .order('synced_at', { ascending: false });

  if (error || !rows || rows.length === 0) {
    return { records: [], providers: [], lastSyncedAt: null };
  }

  const records: IntegrationDataRecord[] = rows.map((r) => ({
    provider: r.provider,
    recordType: r.record_type,
    data: typeof r.data === 'string' ? safeParseJson(r.data) : r.data,
    syncedAt: r.synced_at,
  }));

  const providers = [...new Set(records.map((r) => r.provider))];
  const lastSyncedAt = records[0]?.syncedAt ?? null;

  return { records, providers, lastSyncedAt };
}

/**
 * Formats integration context into a text block for injection into synthesis prompts.
 * Appended to formatPacketAsContext output so every synthesis function sees it.
 */
export function formatIntegrationContextAsText(ctx: IntegrationContext | undefined): string {
  if (!ctx || ctx.records.length === 0) return '';

  const lines: string[] = [
    '',
    '══ CONNECTED TOOL DATA (from live integrations) ══',
    `Providers: ${ctx.providers.join(', ')} | Last synced: ${ctx.lastSyncedAt ?? 'Unknown'}`,
    'IMPORTANT: When this data is available, use these REAL metrics instead of estimating.',
    'Cite the data source (e.g. "[from Slack]", "[from QuickBooks]").',
    '',
  ];

  // Group records by provider
  const byProvider = new Map<string, IntegrationDataRecord[]>();
  for (const rec of ctx.records) {
    const existing = byProvider.get(rec.provider) ?? [];
    existing.push(rec);
    byProvider.set(rec.provider, existing);
  }

  for (const [provider, records] of byProvider) {
    const ago = records[0] ? timeAgo(records[0].syncedAt) : 'unknown';
    lines.push(`[${providerLabel(provider)}] (synced ${ago})`);

    for (const rec of records) {
      const summary = summarizeData(rec.data);
      lines.push(`  - ${rec.recordType}: ${summary}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function safeParseJson(str: string): any {
  try { return JSON.parse(str); } catch { return str; }
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    slack: 'Slack', gmail: 'Gmail', quickbooks: 'QuickBooks',
    stripe: 'Stripe', salesforce: 'Salesforce', hubspot: 'HubSpot',
    github: 'GitHub', jira: 'Jira', google_analytics: 'Google Analytics',
    google_sheets: 'Google Sheets', notion: 'Notion', linear: 'Linear',
    asana: 'Asana', google_calendar: 'Google Calendar',
    microsoft_teams: 'Microsoft Teams', airtable: 'Airtable',
    adp: 'ADP', workday: 'Workday',
  };
  return labels[provider] ?? provider;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function summarizeData(data: any): string {
  if (typeof data === 'string') return data.slice(0, 200);
  if (typeof data !== 'object' || data === null) return String(data);

  // If it's an array, summarize length + first item
  if (Array.isArray(data)) {
    if (data.length === 0) return 'No records';
    const first = typeof data[0] === 'object'
      ? Object.entries(data[0]).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')
      : String(data[0]);
    return `${data.length} records (e.g. ${first})`;
  }

  // If it has a 'note' field (placeholder data), show that
  if (data.note) return data.note;

  // Otherwise summarize top-level keys
  const entries = Object.entries(data).slice(0, 5);
  return entries.map(([k, v]) => {
    if (typeof v === 'number') return `${k}: ${v.toLocaleString()}`;
    if (typeof v === 'string') return `${k}: ${v.slice(0, 80)}`;
    if (Array.isArray(v)) return `${k}: ${v.length} items`;
    return `${k}: [object]`;
  }).join(' | ');
}
