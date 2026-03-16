/**
 * Collect integration data from the database for injection into the analysis pipeline.
 * Reads from integration_data table and formats for synthesis prompts.
 *
 * pullFreshIntegrationData() calls Composio APIs for EVERY connected provider
 * and upserts the results into integration_data so synthesis has fresh data.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { IntegrationContext, IntegrationDataRecord } from '@/lib/types';
import {
  getStripePayments, getStripeCustomers,
  getQuickBooksInvoices, getQuickBooksAccounts,
  getEmails, getGmailProfile,
  getSlackChannels, getSlackChannelHistory, getSlackUsers,
  getSalesforceAccounts, getSalesforceOpportunities,
  getHubSpotContacts, getHubSpotDeals,
  getGitHubRepos, getGitHubIssues, getGitHubPRs,
  searchJiraIssues,
  getCalendarEvents,
  searchNotion,
  getLinearIssues,
  getLinkedInProfile,
  getTwitterUser,
  getTeamsChannels,
  getAirtableBases,
  getInstagramProfile, getInstagramMedia,
  getFacebookPages, getFacebookPagePosts,
  getYouTubeChannel, getYouTubeVideos,
} from './composio-tools';

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

// ═══════════════════════════════════════════════════════════════
// Fresh Integration Data Pull
// Calls Composio APIs for EVERY connected provider in parallel
// and upserts results into integration_data before synthesis.
// ═══════════════════════════════════════════════════════════════

/**
 * Pulls fresh data from all connected integrations in parallel.
 * Called before synthesis so that collectIntegrationContext() reads fresh data.
 */
export async function pullFreshIntegrationData(orgId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: integrations } = await supabase
    .from('integrations')
    .select('provider')
    .eq('org_id', orgId)
    .eq('status', 'connected');

  if (!integrations?.length) {
    console.log('[Pivot] No connected integrations — skipping data pull');
    return;
  }

  const connected = new Set(integrations.map((i: { provider: string }) => i.provider));
  console.log(`[Pivot] Pulling fresh data from ${connected.size} integrations: ${[...connected].join(', ')}`);

  const tasks: Promise<void>[] = [];

  if (connected.has('stripe'))           tasks.push(pullStripe(orgId));
  if (connected.has('quickbooks'))       tasks.push(pullQuickBooks(orgId));
  if (connected.has('gmail'))            tasks.push(pullGmail(orgId));
  if (connected.has('slack'))            tasks.push(pullSlack(orgId));
  if (connected.has('salesforce'))       tasks.push(pullSalesforce(orgId));
  if (connected.has('hubspot'))          tasks.push(pullHubSpot(orgId));
  if (connected.has('github'))           tasks.push(pullGitHub(orgId));
  if (connected.has('jira'))             tasks.push(pullJira(orgId));
  if (connected.has('google_calendar'))  tasks.push(pullCalendar(orgId));
  if (connected.has('notion'))           tasks.push(pullNotion(orgId));
  if (connected.has('linear'))           tasks.push(pullLinear(orgId));
  if (connected.has('microsoft_teams'))  tasks.push(pullTeams(orgId));
  if (connected.has('airtable'))         tasks.push(pullAirtable(orgId));
  if (connected.has('linkedin'))         tasks.push(pullLinkedIn(orgId));
  if (connected.has('twitter'))          tasks.push(pullTwitter(orgId));
  if (connected.has('instagram'))        tasks.push(pullInstagram(orgId));
  if (connected.has('facebook'))         tasks.push(pullFacebook(orgId));
  if (connected.has('youtube'))          tasks.push(pullYouTube(orgId));

  const results = await Promise.allSettled(tasks);
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`[Pivot] Integration pull complete: ${succeeded} succeeded, ${failed} failed`);
}

// ── Upsert helper ───────────────────────────────────────────────────────────

async function upsertIntegrationData(
  orgId: string,
  provider: string,
  records: { recordType: string; data: unknown }[],
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const upserts = records
    .filter(r => r.data != null)
    .map(r => ({
      org_id: orgId,
      provider,
      record_type: r.recordType,
      data: r.data,
      synced_at: now,
    }));
  if (upserts.length === 0) return;
  const { error } = await supabase
    .from('integration_data')
    .upsert(upserts, { onConflict: 'org_id,provider,record_type' });
  if (error) console.warn(`[Pivot] Upsert failed for ${provider}:`, error.message);
}

// ── Provider Pull Functions ─────────────────────────────────────────────────

async function pullStripe(orgId: string): Promise<void> {
  const [payments, customers] = await Promise.all([
    getStripePayments(orgId, 100),
    getStripeCustomers(orgId, 100),
  ]);
  await upsertIntegrationData(orgId, 'stripe', [
    { recordType: 'payments', data: payments },
    { recordType: 'customers', data: customers },
  ]);
  console.log('[Pivot] Stripe pull done');
}

async function pullQuickBooks(orgId: string): Promise<void> {
  const [invoices, accounts] = await Promise.all([
    getQuickBooksInvoices(orgId),
    getQuickBooksAccounts(orgId),
  ]);
  await upsertIntegrationData(orgId, 'quickbooks', [
    { recordType: 'invoices', data: invoices },
    { recordType: 'accounts', data: accounts },
  ]);
  console.log('[Pivot] QuickBooks pull done');
}

async function pullGmail(orgId: string): Promise<void> {
  // Pull emails in smaller batches to avoid Composio 413 payload limit
  // 50 emails max per request — fetch recent first, then older if successful
  const [batch1, profile] = await Promise.all([
    getEmails(orgId, undefined, 50),
    getGmailProfile(orgId),
  ]);

  const records: { recordType: string; data: unknown }[] = [
    { recordType: 'profile', data: profile },
  ];

  if (batch1) {
    records.push({ recordType: 'emails', data: batch1 });
  }

  await upsertIntegrationData(orgId, 'gmail', records);
  console.log('[Pivot] Gmail pull done');
}

async function pullSlack(orgId: string): Promise<void> {
  // First get channels list, then pull history from top 5 most active
  const [channels, users] = await Promise.all([
    getSlackChannels(orgId),
    getSlackUsers(orgId),
  ]);

  let messages: unknown = null;
  if (channels && Array.isArray(channels)) {
    // Get history from first 5 channels (most likely active)
    const topChannels = channels.slice(0, 5);
    const histories = await Promise.all(
      topChannels.map((ch: any) =>
        getSlackChannelHistory(orgId, ch.id || ch.channel_id, 50)
          .then(h => ({ channel: ch.name || ch.id, messages: h }))
          .catch(() => null)
      ),
    );
    messages = histories.filter(Boolean);
  }

  await upsertIntegrationData(orgId, 'slack', [
    { recordType: 'channels', data: channels },
    { recordType: 'users', data: users },
    { recordType: 'messages', data: messages },
  ]);
  console.log('[Pivot] Slack pull done');
}

async function pullSalesforce(orgId: string): Promise<void> {
  const [accounts, opportunities] = await Promise.all([
    getSalesforceAccounts(orgId),
    getSalesforceOpportunities(orgId),
  ]);
  await upsertIntegrationData(orgId, 'salesforce', [
    { recordType: 'accounts', data: accounts },
    { recordType: 'opportunities', data: opportunities },
  ]);
  console.log('[Pivot] Salesforce pull done');
}

async function pullHubSpot(orgId: string): Promise<void> {
  const [contacts, deals] = await Promise.all([
    getHubSpotContacts(orgId, undefined, 200),
    getHubSpotDeals(orgId),
  ]);
  await upsertIntegrationData(orgId, 'hubspot', [
    { recordType: 'contacts', data: contacts },
    { recordType: 'deals', data: deals },
  ]);
  console.log('[Pivot] HubSpot pull done');
}

async function pullGitHub(orgId: string): Promise<void> {
  // List repos first, then pull issues/PRs from top 3 repos
  const repos = await getGitHubRepos(orgId);
  let issues: unknown = null;
  let pullRequests: unknown = null;

  if (repos && Array.isArray(repos)) {
    const topRepos = repos.slice(0, 3);
    const [issueResults, prResults] = await Promise.all([
      Promise.all(
        topRepos.map((r: any) => {
          const owner = r.owner?.login || r.full_name?.split('/')[0];
          const name = r.name;
          if (!owner || !name) return null;
          return getGitHubIssues(orgId, owner, name).catch(() => null);
        }),
      ),
      Promise.all(
        topRepos.map((r: any) => {
          const owner = r.owner?.login || r.full_name?.split('/')[0];
          const name = r.name;
          if (!owner || !name) return null;
          return getGitHubPRs(orgId, owner, name).catch(() => null);
        }),
      ),
    ]);
    issues = issueResults.filter(Boolean).flat();
    pullRequests = prResults.filter(Boolean).flat();
  }

  await upsertIntegrationData(orgId, 'github', [
    { recordType: 'repos', data: repos },
    { recordType: 'issues', data: issues },
    { recordType: 'pull_requests', data: pullRequests },
  ]);
  console.log('[Pivot] GitHub pull done');
}

async function pullJira(orgId: string): Promise<void> {
  // Generic JQL to get recent issues
  const issues = await searchJiraIssues(orgId, 'order by updated DESC');
  await upsertIntegrationData(orgId, 'jira', [
    { recordType: 'issues', data: issues },
  ]);
  console.log('[Pivot] Jira pull done');
}

async function pullCalendar(orgId: string): Promise<void> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const events = await getCalendarEvents(
    orgId,
    'primary',
    thirtyDaysAgo.toISOString(),
    thirtyDaysAhead.toISOString(),
  );
  await upsertIntegrationData(orgId, 'google_calendar', [
    { recordType: 'events', data: events },
  ]);
  console.log('[Pivot] Google Calendar pull done');
}

async function pullNotion(orgId: string): Promise<void> {
  const pages = await searchNotion(orgId, '');
  await upsertIntegrationData(orgId, 'notion', [
    { recordType: 'pages', data: pages },
  ]);
  console.log('[Pivot] Notion pull done');
}

async function pullLinear(orgId: string): Promise<void> {
  const issues = await getLinearIssues(orgId);
  await upsertIntegrationData(orgId, 'linear', [
    { recordType: 'issues', data: issues },
  ]);
  console.log('[Pivot] Linear pull done');
}

async function pullTeams(orgId: string): Promise<void> {
  // Teams API requires a teamId — try listing with empty to see what's available
  const channels = await getTeamsChannels(orgId, '');
  await upsertIntegrationData(orgId, 'microsoft_teams', [
    { recordType: 'channels', data: channels },
  ]);
  console.log('[Pivot] Microsoft Teams pull done');
}

async function pullAirtable(orgId: string): Promise<void> {
  const bases = await getAirtableBases(orgId);
  await upsertIntegrationData(orgId, 'airtable', [
    { recordType: 'bases', data: bases },
  ]);
  console.log('[Pivot] Airtable pull done');
}

async function pullLinkedIn(orgId: string): Promise<void> {
  const profile = await getLinkedInProfile(orgId);
  await upsertIntegrationData(orgId, 'linkedin', [
    { recordType: 'profile', data: profile },
  ]);
  console.log('[Pivot] LinkedIn pull done');
}

async function pullTwitter(orgId: string): Promise<void> {
  const user = await getTwitterUser(orgId);
  await upsertIntegrationData(orgId, 'twitter', [
    { recordType: 'profile', data: user },
  ]);
  console.log('[Pivot] Twitter pull done');
}

async function pullInstagram(orgId: string): Promise<void> {
  const [profile, media] = await Promise.all([
    getInstagramProfile(orgId),
    getInstagramMedia(orgId, 25),
  ]);
  await upsertIntegrationData(orgId, 'instagram', [
    { recordType: 'profile', data: profile },
    { recordType: 'media', data: media },
  ]);
  console.log('[Pivot] Instagram pull done');
}

async function pullFacebook(orgId: string): Promise<void> {
  const pages = await getFacebookPages(orgId);
  let posts: unknown = null;

  if (pages && Array.isArray(pages) && pages.length > 0) {
    // Pull posts from the first page
    posts = await getFacebookPagePosts(orgId, pages[0].id, 25).catch(() => null);
  }

  await upsertIntegrationData(orgId, 'facebook', [
    { recordType: 'pages', data: pages },
    { recordType: 'posts', data: posts },
  ]);
  console.log('[Pivot] Facebook pull done');
}

async function pullYouTube(orgId: string): Promise<void> {
  const [channel, videos] = await Promise.all([
    getYouTubeChannel(orgId),
    getYouTubeVideos(orgId, 25),
  ]);
  await upsertIntegrationData(orgId, 'youtube', [
    { recordType: 'channel', data: channel },
    { recordType: 'videos', data: videos },
  ]);
  console.log('[Pivot] YouTube pull done');
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
    linkedin: 'LinkedIn', twitter: 'X (Twitter)',
    instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube',
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
