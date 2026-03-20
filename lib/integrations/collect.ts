/**
 * Collect integration data from the database for injection into the analysis pipeline.
 * Reads from integration_data table and formats for synthesis prompts.
 *
 * pullFreshIntegrationData() calls Composio APIs for EVERY connected provider
 * and upserts the results into integration_data so synthesis has fresh data.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { IntegrationContext, IntegrationDataRecord, OrgIntelligence } from '@/lib/types';
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
  getInstagramProfile, getInstagramMedia, getInstagramInsights,
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
      // For financial data, show detailed numbers instead of just summaries
      if (provider === 'stripe' && rec.recordType === 'charges_overview') {
        const raw = typeof rec.data === 'string' ? safeParseJson(rec.data) : rec.data;
        lines.push(`  - charges_overview: ${raw.successfulCharges || 0} successful charges, total $${((raw.totalAmountCents || 0) / 100).toLocaleString()}`);
      } else if (provider === 'stripe' && rec.recordType === 'customers_overview') {
        const raw = typeof rec.data === 'string' ? safeParseJson(rec.data) : rec.data;
        lines.push(`  - customers_overview: ${raw.totalCustomers || 0} total customers`);
        if (raw.recentCustomers && Array.isArray(raw.recentCustomers)) {
          for (const c of raw.recentCustomers) {
            lines.push(`    * ${c.name || 'Unknown'} (${c.email || 'no email'})`);
          }
        }
      } else if (provider === 'stripe' && rec.recordType === 'payments') {
        const raw = typeof rec.data === 'string' ? safeParseJson(rec.data) : rec.data;
        const items = raw?.data?.data || raw?.data || [];
        if (Array.isArray(items)) {
          let total = 0;
          const succeeded = items.filter((p: any) => p.status === 'succeeded');
          succeeded.forEach((p: any) => { total += (p.amount || 0); });
          lines.push(`  - payments: ${succeeded.length} successful payments totaling $${(total / 100).toLocaleString()}`);
          // Show each payment
          for (const p of succeeded.slice(0, 30)) {
            const date = p.created ? new Date(p.created * 1000).toISOString().split('T')[0] : 'unknown';
            const custId = p.customer || 'unknown';
            lines.push(`    * ${date}: $${(p.amount / 100).toFixed(2)} from ${custId} (${p.id})`);
          }
        }
      } else if (provider === 'stripe' && rec.recordType === 'customers') {
        const raw = typeof rec.data === 'string' ? safeParseJson(rec.data) : rec.data;
        const custs = raw?.data?.data || raw?.data || [];
        if (Array.isArray(custs)) {
          lines.push(`  - customers: ${custs.length} customers`);
          for (const c of custs) {
            lines.push(`    * ${c.name || 'Unknown'} — ${c.email || 'no email'} (${c.id})`);
          }
        }
      } else if (provider === 'gmail' && rec.recordType === 'emails') {
        const raw = (typeof rec.data === 'string' ? safeParseJson(rec.data as string) : rec.data) as Record<string, unknown>;
        const rawData = raw?.data as Record<string, unknown> | undefined;
        const msgs = rawData?.messages ?? raw?.messages ?? rawData ?? raw;
        if (Array.isArray(msgs)) {
          lines.push(`  - emails: ${msgs.length} recent emails`);
          // Group by sender for client intelligence
          const bySender = new Map<string, { count: number; subjects: string[]; latest: string }>();
          for (const msg of msgs.slice(0, 50)) {
            const m = msg as Record<string, unknown>;
            const from = String(m.sender ?? m.from ?? m.From ?? '').replace(/<[^>]+>/g, '').trim();
            const subject = String(m.subject ?? m.Subject ?? m.snippet ?? '').slice(0, 80);
            const date = String(m.date ?? m.Date ?? m.internalDate ?? '');
            if (from && !from.includes('noreply') && !from.includes('notification')) {
              const existing = bySender.get(from) ?? { count: 0, subjects: [], latest: '' };
              existing.count++;
              if (existing.subjects.length < 3) existing.subjects.push(subject);
              if (!existing.latest || date > existing.latest) existing.latest = date;
              bySender.set(from, existing);
            }
          }
          // Show top contacts (most emails)
          const topContacts = [...bySender.entries()]
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 10);
          if (topContacts.length > 0) {
            lines.push(`  - top email contacts:`);
            for (const [name, info] of topContacts) {
              lines.push(`    * ${name} (${info.count} emails) — recent: "${info.subjects[0] ?? ''}"`);
            }
          }
        }
      } else if (provider === 'slack' && rec.recordType === 'messages') {
        const raw = typeof rec.data === 'string' ? safeParseJson(rec.data as string) : rec.data;
        if (Array.isArray(raw)) {
          let totalMsgs = 0;
          for (const ch of raw as Array<Record<string, unknown>>) {
            const msgs = ch.messages as unknown[];
            totalMsgs += Array.isArray(msgs) ? msgs.length : 0;
          }
          lines.push(`  - slack messages: ${totalMsgs} messages across ${(raw as unknown[]).length} channels`);
          // Show channel summaries
          for (const ch of (raw as Array<Record<string, unknown>>).slice(0, 5)) {
            const msgs = ch.messages as Array<Record<string, unknown>> | undefined;
            const channelName = ch.channel ?? 'unknown';
            const msgCount = Array.isArray(msgs) ? msgs.length : 0;
            lines.push(`    * #${channelName}: ${msgCount} messages`);
          }
        }
      } else {
        const summary = summarizeData(rec.data);
        lines.push(`  - ${rec.recordType}: ${summary}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Moved up so extractFinancialFacts can use it
function safeParseJson(str: string): unknown {
  try { return JSON.parse(str); } catch { return str; }
}

/**
 * Extract verified financial facts from integration data (Stripe, QuickBooks, etc.)
 * so the synthesis pipeline treats them as ground truth instead of supplementary text.
 */
export function extractFinancialFactsFromIntegrations(ctx: IntegrationContext): import('@/lib/types').FinancialFact[] {
  const facts: import('@/lib/types').FinancialFact[] = [];

  for (const rec of ctx.records) {
    const data = rec.data;
    if (!data || typeof data !== 'object') continue;

    // ── Stripe charges_overview ──
    if (rec.provider === 'stripe' && rec.recordType === 'charges_overview') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      if (raw.totalAmountCents && typeof raw.totalAmountCents === 'number') {
        facts.push({
          label: 'Total Revenue (all-time)',
          value: raw.totalAmountCents / 100,
          sourceFile: 'Stripe Integration (Live)',
          confidence: 100,
        });
      }
      if (raw.successfulCharges && typeof raw.successfulCharges === 'number') {
        facts.push({
          label: 'Total Successful Charges',
          value: raw.successfulCharges,
          sourceFile: 'Stripe Integration (Live)',
          confidence: 100,
        });
      }
    }

    // ── Stripe customers_overview ──
    if (rec.provider === 'stripe' && rec.recordType === 'customers_overview') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      if (raw.totalCustomers && typeof raw.totalCustomers === 'number') {
        facts.push({
          label: 'Total Customers',
          value: raw.totalCustomers,
          sourceFile: 'Stripe Integration (Live)',
          confidence: 100,
        });
      }
    }

    // ── Stripe payments — derive MRR and cash position from actual transactions ──
    if (rec.provider === 'stripe' && rec.recordType === 'payments') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const items = raw?.data?.data || raw?.data || [];
      if (Array.isArray(items) && items.length > 0) {
        // Calculate monthly revenue from last 30 days
        const now = Date.now() / 1000;
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        let last30Revenue = 0;
        let totalRevenue = 0;
        for (const item of items) {
          if (item.status === 'succeeded' && typeof item.amount === 'number') {
            totalRevenue += item.amount;
            if (item.created && item.created >= thirtyDaysAgo) {
              last30Revenue += item.amount;
            }
          }
        }
        if (last30Revenue > 0) {
          facts.push({
            label: 'Monthly Revenue (last 30 days)',
            value: last30Revenue / 100,
            sourceFile: 'Stripe Integration (Live)',
            confidence: 95,
          });
        }
        // Use total revenue as cash position proxy (revenue collected via Stripe)
        if (totalRevenue > 0) {
          facts.push({
            label: 'Cash Collected via Stripe',
            value: totalRevenue / 100,
            sourceFile: 'Stripe Integration (Live)',
            confidence: 95,
          });
        }
      }
    }

    // ── Stripe customers — extract names for customer context ──
    if (rec.provider === 'stripe' && rec.recordType === 'customers') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const customers = raw?.data?.data || raw?.data || [];
      if (Array.isArray(customers)) {
        // Calculate total customer value from balance data if available
        let activeCustomers = 0;
        for (const cust of customers) {
          if (cust.email) activeCustomers++;
        }
        if (activeCustomers > 0) {
          facts.push({
            label: 'Active Customers with Email',
            value: activeCustomers,
            sourceFile: 'Stripe Integration (Live)',
            confidence: 100,
          });
        }
      }
    }

    // ── QuickBooks accounts (if available) ──
    if (rec.provider === 'quickbooks' && rec.recordType === 'accounts') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const accounts = Array.isArray(raw) ? raw : raw?.data || [];
      for (const acct of accounts) {
        if (acct.AccountType === 'Bank' && typeof acct.CurrentBalance === 'number') {
          facts.push({
            label: `Cash Position (${acct.Name || 'Bank Account'})`,
            value: acct.CurrentBalance,
            sourceFile: 'QuickBooks Integration (Live)',
            confidence: 100,
          });
        }
      }
    }

    // ── PayPal balance ──
    if (rec.provider === 'paypal' && rec.recordType === 'balance') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const balances = raw?.balances || raw?.data?.balances || [];
      for (const b of (Array.isArray(balances) ? balances : [])) {
        if (b.value && typeof b.value.value === 'string') {
          facts.push({
            label: `PayPal Balance (${b.currency || 'USD'})`,
            value: parseFloat(b.value.value),
            sourceFile: 'PayPal Integration (Live)',
            confidence: 100,
          });
        }
      }
    }

    // ── PayPal transactions ──
    if (rec.provider === 'paypal' && rec.recordType === 'transactions') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const items = raw?.transaction_details || raw?.data?.transaction_details || [];
      if (Array.isArray(items) && items.length > 0) {
        let total = 0;
        for (const t of items) {
          const amt = t?.transaction_info?.transaction_amount?.value;
          if (amt && parseFloat(amt) > 0) total += parseFloat(amt);
        }
        if (total > 0) {
          facts.push({ label: 'PayPal Revenue (recent)', value: total, sourceFile: 'PayPal Integration (Live)', confidence: 90 });
        }
      }
    }

    // ── Square payments ──
    if (rec.provider === 'square' && rec.recordType === 'payments') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const payments = raw?.payments || raw?.data?.payments || [];
      if (Array.isArray(payments) && payments.length > 0) {
        let total = 0;
        for (const p of payments) {
          if (p.status === 'COMPLETED' && p.amount_money?.amount) {
            total += p.amount_money.amount;
          }
        }
        if (total > 0) {
          facts.push({ label: 'Square Revenue', value: total / 100, sourceFile: 'Square Integration (Live)', confidence: 95 });
        }
        facts.push({ label: 'Square Transaction Count', value: payments.length, sourceFile: 'Square Integration (Live)', confidence: 100 });
      }
    }

    // ── Xero accounts (bank balances) ──
    if (rec.provider === 'xero' && rec.recordType === 'accounts') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const accounts = raw?.Accounts || raw?.data?.Accounts || [];
      for (const acct of (Array.isArray(accounts) ? accounts : [])) {
        if (acct.Type === 'BANK' && typeof acct.Balance === 'number') {
          facts.push({
            label: `Cash Position (${acct.Name || 'Xero Bank'})`,
            value: acct.Balance,
            sourceFile: 'Xero Integration (Live)',
            confidence: 100,
          });
        }
      }
    }

    // ── Xero invoices ──
    if (rec.provider === 'xero' && rec.recordType === 'invoices') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const invoices = raw?.Invoices || raw?.data?.Invoices || [];
      if (Array.isArray(invoices) && invoices.length > 0) {
        let totalPaid = 0, totalOutstanding = 0;
        for (const inv of invoices) {
          if (inv.Status === 'PAID') totalPaid += inv.Total || 0;
          if (inv.Status === 'AUTHORISED') totalOutstanding += inv.AmountDue || 0;
        }
        if (totalPaid > 0) facts.push({ label: 'Revenue from Invoices (Xero)', value: totalPaid, sourceFile: 'Xero Integration (Live)', confidence: 95 });
        if (totalOutstanding > 0) facts.push({ label: 'Outstanding Receivables (Xero)', value: totalOutstanding, sourceFile: 'Xero Integration (Live)', confidence: 100 });
      }
    }

    // ── FreshBooks invoices ──
    if (rec.provider === 'freshbooks' && rec.recordType === 'invoices') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const invoices = raw?.invoices || raw?.data?.invoices || [];
      if (Array.isArray(invoices) && invoices.length > 0) {
        let totalPaid = 0, totalOutstanding = 0;
        for (const inv of invoices) {
          if (inv.payment_status === 'paid') totalPaid += parseFloat(inv.amount?.amount || '0');
          if (inv.payment_status === 'unpaid' || inv.payment_status === 'partial') totalOutstanding += parseFloat(inv.outstanding?.amount || '0');
        }
        if (totalPaid > 0) facts.push({ label: 'Revenue from Invoices (FreshBooks)', value: totalPaid, sourceFile: 'FreshBooks Integration (Live)', confidence: 95 });
        if (totalOutstanding > 0) facts.push({ label: 'Outstanding Receivables (FreshBooks)', value: totalOutstanding, sourceFile: 'FreshBooks Integration (Live)', confidence: 100 });
      }
    }

    // ── Plaid account balances ──
    if (rec.provider === 'plaid' && rec.recordType === 'accounts') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const accounts = raw?.accounts || raw?.data?.accounts || [];
      for (const acct of (Array.isArray(accounts) ? accounts : [])) {
        if (acct.balances?.current != null) {
          facts.push({
            label: `Cash Position (${acct.name || acct.official_name || 'Bank Account'})`,
            value: acct.balances.current,
            sourceFile: 'Plaid Integration (Live)',
            confidence: 100,
          });
        }
      }
    }

    // ── Mercury account balances ──
    if (rec.provider === 'mercury' && rec.recordType === 'accounts') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const accounts = raw?.accounts || raw?.data || [];
      for (const acct of (Array.isArray(accounts) ? accounts : [])) {
        if (acct.currentBalance != null) {
          facts.push({
            label: `Cash Position (${acct.name || 'Mercury'})`,
            value: acct.currentBalance,
            sourceFile: 'Mercury Integration (Live)',
            confidence: 100,
          });
        }
      }
    }

    // ── Brex transactions ──
    if (rec.provider === 'brex' && rec.recordType === 'transactions') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const items = raw?.items || raw?.data?.items || [];
      if (Array.isArray(items) && items.length > 0) {
        let totalSpend = 0;
        for (const t of items) {
          if (t.amount?.amount) totalSpend += Math.abs(t.amount.amount);
        }
        if (totalSpend > 0) {
          facts.push({ label: 'Corporate Card Spend (Brex)', value: totalSpend / 100, sourceFile: 'Brex Integration (Live)', confidence: 95 });
        }
      }
    }

    // ── Gusto payrolls ──
    if (rec.provider === 'gusto' && rec.recordType === 'payrolls') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const payrolls = Array.isArray(raw) ? raw : raw?.data || [];
      if (Array.isArray(payrolls) && payrolls.length > 0) {
        let totalPayroll = 0;
        for (const p of payrolls) {
          if (p.totals?.net_pay) totalPayroll += parseFloat(p.totals.net_pay);
        }
        if (totalPayroll > 0) {
          facts.push({ label: 'Total Payroll (Gusto)', value: totalPayroll, sourceFile: 'Gusto Integration (Live)', confidence: 95 });
        }
        // Estimate monthly payroll from most recent
        const recent = payrolls[0];
        if (recent?.totals?.net_pay) {
          facts.push({ label: 'Monthly Payroll Expense (est)', value: parseFloat(recent.totals.net_pay) * 2, sourceFile: 'Gusto Integration (Live)', confidence: 80 });
        }
      }
    }

    // ── Wave accounts ──
    if (rec.provider === 'wave' && rec.recordType === 'accounts') {
      const raw = typeof data === 'string' ? safeParseJson(data as string) : data;
      const accounts = raw?.accounts || raw?.data?.accounts || [];
      for (const acct of (Array.isArray(accounts) ? accounts : [])) {
        if (acct.type === 'asset' && acct.subtype === 'cash_and_bank' && typeof acct.balance === 'number') {
          facts.push({
            label: `Cash Position (${acct.name || 'Wave'})`,
            value: acct.balance,
            sourceFile: 'Wave Integration (Live)',
            confidence: 100,
          });
        }
      }
    }
  }

  return facts;
}

// ═══════════════════════════════════════════════════════════════
// Org Intelligence Extraction
// AI-powered analysis of integration data to extract people,
// roles, org structure, and business intelligence
// ═══════════════════════════════════════════════════════════════

/**
 * Analyzes ALL integration data to extract org intelligence:
 * - People (employees, clients, contractors) from Slack, Gmail, GitHub
 * - Org structure from communication patterns
 * - Client relationships from payment + communication data
 * - Business insights from cross-referencing all sources
 */
export function extractOrgIntelligence(ctx: IntegrationContext): OrgIntelligence {
  const people: OrgIntelligence['people'] = [];
  const seenEmails = new Set<string>();
  const insights: string[] = [];
  const departments = new Set<string>();
  const channels: string[] = [];

  for (const rec of ctx.records) {
    const raw = typeof rec.data === 'string' ? safeParseJson(rec.data) : rec.data;

    // ── Slack users → employees ──
    if (rec.provider === 'slack' && rec.recordType === 'users') {
      const users = raw?.members || raw?.data?.members || raw?.data || [];
      if (Array.isArray(users)) {
        for (const u of users) {
          if (u.is_bot || u.deleted || u.id === 'USLACKBOT') continue;
          const email = u.profile?.email;
          if (email && seenEmails.has(email)) continue;
          if (email) seenEmails.add(email);
          people.push({
            name: u.real_name || u.profile?.real_name || u.name || 'Unknown',
            email: email || undefined,
            role: u.profile?.title || undefined,
            department: undefined,
            isEmployee: !u.is_restricted && !u.is_ultra_restricted,
            isClient: false,
            isContractor: u.is_restricted || u.is_ultra_restricted || false,
            communicationFrequency: undefined,
            sources: ['slack'],
          });
        }
        if (users.filter((u: any) => !u.is_bot && !u.deleted).length > 0) {
          insights.push(`${users.filter((u: any) => !u.is_bot && !u.deleted).length} team members found in Slack workspace`);
        }
      }
    }

    // ── Slack channels → departments/teams ──
    if (rec.provider === 'slack' && rec.recordType === 'channels') {
      const chs = raw?.channels || raw?.data?.channels || raw?.data || [];
      if (Array.isArray(chs)) {
        for (const ch of chs) {
          const name = ch.name || ch.name_normalized || '';
          channels.push(name);
          // Infer departments from channel names
          if (name.match(/eng|dev|tech|code|backend|frontend/i)) departments.add('Engineering');
          if (name.match(/market|growth|seo|ads|content/i)) departments.add('Marketing');
          if (name.match(/sales|deal|pipeline|prospect/i)) departments.add('Sales');
          if (name.match(/design|ui|ux|brand/i)) departments.add('Design');
          if (name.match(/ops|operations|infra|devops/i)) departments.add('Operations');
          if (name.match(/hr|people|hiring|recruit/i)) departments.add('HR');
          if (name.match(/finance|accounting|invoice|billing/i)) departments.add('Finance');
          if (name.match(/support|help|customer|success/i)) departments.add('Customer Success');
          if (name.match(/product|roadmap|feature/i)) departments.add('Product');
        }
        insights.push(`${chs.length} Slack channels — active communication across ${departments.size || 'multiple'} areas`);
      }
    }

    // ── Slack messages → communication patterns + activity levels ──
    if (rec.provider === 'slack' && rec.recordType === 'messages') {
      const channelHistories = Array.isArray(raw) ? raw : raw?.data || [];
      if (Array.isArray(channelHistories)) {
        const messageCounts: Record<string, number> = {};
        for (const ch of channelHistories) {
          const msgs = ch?.messages?.messages || ch?.messages?.data?.messages || ch?.messages || [];
          if (Array.isArray(msgs)) {
            for (const m of msgs) {
              if (m.user && !m.bot_id) {
                messageCounts[m.user] = (messageCounts[m.user] || 0) + 1;
              }
            }
          }
        }
        // Tag people with communication frequency
        for (const p of people) {
          if (p.sources.includes('slack')) {
            // Match by name (Slack user IDs don't directly match)
            const totalMsgs = Object.values(messageCounts).reduce((a, b) => a + b, 0);
            if (totalMsgs > 0) {
              p.communicationFrequency = 'medium'; // Default; could be refined with user ID matching
            }
          }
        }
        const totalMessages = Object.values(messageCounts).reduce((a, b) => a + b, 0);
        if (totalMessages > 0) {
          insights.push(`${totalMessages} recent Slack messages across ${Object.keys(messageCounts).length} active participants`);
        }
      }
    }

    // ── Gmail → contacts, clients, communication patterns ──
    if (rec.provider === 'gmail' && rec.recordType === 'emails') {
      const emails = raw?.data?.messages || raw?.messages || raw?.data || [];
      if (Array.isArray(emails)) {
        const contactCounts: Record<string, { name: string; count: number }> = {};
        for (const email of emails) {
          const from = email.from || email.sender || '';
          const match = from.match(/^"?([^"<]+)"?\s*<?([^>]+@[^>]+)>?/);
          if (match) {
            const [, name, addr] = match;
            const cleanAddr = addr.toLowerCase().trim();
            if (!contactCounts[cleanAddr]) {
              contactCounts[cleanAddr] = { name: name.trim(), count: 0 };
            }
            contactCounts[cleanAddr].count++;
          }
        }
        // Add frequent email contacts as potential clients/partners
        for (const [email, info] of Object.entries(contactCounts)) {
          if (seenEmails.has(email)) {
            // Already known from Slack — update sources
            const existing = people.find(p => p.email === email);
            if (existing && !existing.sources.includes('gmail')) existing.sources.push('gmail');
            continue;
          }
          seenEmails.add(email);
          people.push({
            name: info.name || email,
            email,
            role: undefined,
            department: undefined,
            isEmployee: false,
            isClient: info.count >= 3, // frequent correspondence = likely client/partner
            isContractor: false,
            communicationFrequency: info.count >= 5 ? 'high' : info.count >= 2 ? 'medium' : 'low',
            sources: ['gmail'],
          });
        }
        insights.push(`${emails.length} emails analyzed — ${Object.keys(contactCounts).length} unique contacts identified`);
      }
    }

    // ── GitHub → developers, contributors ──
    if (rec.provider === 'github' && (rec.recordType === 'issues' || rec.recordType === 'prs')) {
      const items = raw?.data || raw || [];
      if (Array.isArray(items)) {
        for (const item of items) {
          const user = item.user || item.author || item.creator;
          if (user && typeof user === 'object') {
            const login = user.login || user.username || '';
            const name = user.name || login;
            if (login && !seenEmails.has(login + '@github')) {
              seenEmails.add(login + '@github');
              // Check if this person already exists by name
              const existing = people.find(p => p.name.toLowerCase() === name.toLowerCase());
              if (existing) {
                if (!existing.sources.includes('github')) existing.sources.push('github');
                if (!existing.role) existing.role = 'Developer';
                departments.add('Engineering');
              } else {
                people.push({
                  name,
                  email: user.email || undefined,
                  role: 'Developer',
                  department: 'Engineering',
                  isEmployee: true,
                  isClient: false,
                  isContractor: false,
                  sources: ['github'],
                });
                departments.add('Engineering');
              }
            }
          }
        }
      }
    }

    // ── Jira/Linear → project people ──
    if ((rec.provider === 'jira' || rec.provider === 'linear') && rec.recordType === 'issues') {
      const items = raw?.issues || raw?.data?.issues || raw?.data || [];
      if (Array.isArray(items)) {
        for (const issue of items) {
          const assignee = issue.assignee || issue.fields?.assignee;
          if (assignee && typeof assignee === 'object') {
            const name = assignee.displayName || assignee.name || '';
            const email = assignee.emailAddress || assignee.email || '';
            if (name && !people.find(p => p.name.toLowerCase() === name.toLowerCase())) {
              if (email) seenEmails.add(email);
              people.push({
                name,
                email: email || undefined,
                role: 'Team Member',
                department: undefined,
                isEmployee: true,
                isClient: false,
                isContractor: false,
                sources: [rec.provider],
              });
            } else if (name) {
              const existing = people.find(p => p.name.toLowerCase() === name.toLowerCase());
              if (existing && !existing.sources.includes(rec.provider)) existing.sources.push(rec.provider);
            }
          }
        }
      }
    }

    // ── Stripe customers → client relationships ──
    if (rec.provider === 'stripe' && rec.recordType === 'customers') {
      const custs = raw?.data?.data || raw?.data || [];
      if (Array.isArray(custs)) {
        for (const c of custs) {
          const email = c.email?.toLowerCase();
          if (email && seenEmails.has(email)) {
            const existing = people.find(p => p.email === email);
            if (existing) {
              existing.isClient = true;
              if (!existing.sources.includes('stripe')) existing.sources.push('stripe');
            }
          } else if (email || c.name) {
            if (email) seenEmails.add(email);
            people.push({
              name: c.name || email || 'Unknown',
              email: email || undefined,
              role: 'Customer',
              department: undefined,
              isEmployee: false,
              isClient: true,
              isContractor: false,
              sources: ['stripe'],
            });
          }
        }
      }
    }

    // ── HubSpot/Salesforce contacts → clients/leads ──
    if ((rec.provider === 'hubspot' || rec.provider === 'salesforce') &&
        (rec.recordType === 'contacts' || rec.recordType === 'accounts')) {
      const contacts = raw?.results || raw?.data?.results || raw?.data || [];
      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          const email = (c.properties?.email || c.Email || c.email || '').toLowerCase();
          const name = c.properties?.firstname
            ? `${c.properties.firstname} ${c.properties.lastname || ''}`.trim()
            : c.Name || c.name || email;
          if (!name && !email) continue;
          if (email && seenEmails.has(email)) {
            const existing = people.find(p => p.email === email);
            if (existing) {
              existing.isClient = true;
              if (!existing.sources.includes(rec.provider)) existing.sources.push(rec.provider);
            }
            continue;
          }
          if (email) seenEmails.add(email);
          people.push({
            name: name || email,
            email: email || undefined,
            role: 'Contact',
            department: undefined,
            isEmployee: false,
            isClient: true,
            isContractor: false,
            sources: [rec.provider],
          });
        }
      }
    }

    // ── Google Calendar → meeting patterns ──
    if (rec.provider === 'google_calendar' && rec.recordType === 'events') {
      const events = raw?.items || raw?.data?.items || raw?.data || [];
      if (Array.isArray(events) && events.length > 0) {
        const attendeeSet = new Set<string>();
        for (const evt of events) {
          for (const a of (evt.attendees || [])) {
            if (a.email) attendeeSet.add(a.email.toLowerCase());
          }
        }
        insights.push(`${events.length} calendar events with ${attendeeSet.size} unique attendees — active meeting culture`);
      }
    }
  }

  // Build org structure summary
  const employees = people.filter(p => p.isEmployee);
  const clients = people.filter(p => p.isClient);
  const contractors = people.filter(p => p.isContractor && !p.isEmployee);

  if (employees.length > 0) insights.push(`${employees.length} employees identified across ${departments.size} departments`);
  if (clients.length > 0) insights.push(`${clients.length} clients/contacts identified from payment and communication data`);
  if (contractors.length > 0) insights.push(`${contractors.length} contractors/external collaborators detected`);

  // Build client relationships from Stripe + communication cross-reference
  const clientRelationships: OrgIntelligence['clientRelationships'] = [];
  for (const p of clients) {
    clientRelationships.push({
      name: p.name,
      contactPerson: p.email || undefined,
      communicationFrequency: p.communicationFrequency || undefined,
      recentActivity: p.sources.length > 1
        ? `Active across ${p.sources.join(', ')}`
        : `Found in ${p.sources[0]}`,
    });
  }

  return {
    people,
    orgStructure: {
      departments: [...departments],
      teamSize: employees.length,
      keyRoles: [...new Set(employees.map(p => p.role).filter(Boolean) as string[])],
      hierarchy: employees.length <= 5 ? 'flat' : employees.length <= 20 ? 'small team' : 'growing organization',
    },
    communicationPatterns: {
      primaryChannels: channels.slice(0, 10),
      collaborationStyle: channels.length > 10 ? 'highly collaborative, many channels' : channels.length > 3 ? 'organized, structured channels' : 'lean communication',
    },
    clientRelationships: clientRelationships.slice(0, 20),
    insights,
  };
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
  // Financial / Cash Flow providers
  if (connected.has('paypal'))           tasks.push(pullPayPal(orgId));
  if (connected.has('square'))           tasks.push(pullSquare(orgId));
  if (connected.has('xero'))             tasks.push(pullXero(orgId));
  if (connected.has('freshbooks'))       tasks.push(pullFreshBooks(orgId));
  if (connected.has('plaid'))            tasks.push(pullPlaid(orgId));
  if (connected.has('mercury'))          tasks.push(pullMercury(orgId));
  if (connected.has('wave'))             tasks.push(pullWave(orgId));
  if (connected.has('brex'))             tasks.push(pullBrex(orgId));
  if (connected.has('gusto'))            tasks.push(pullGusto(orgId));

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
  // Extract key metrics from profile for social media deep dive
  const profileData = profile && typeof profile === 'object' ? profile as Record<string, unknown> : {};
  const socialSummary = {
    platform: 'linkedin',
    name: profileData.firstName ? `${profileData.firstName} ${profileData.lastName ?? ''}` : profileData.localizedFirstName ?? 'Unknown',
    headline: profileData.headline ?? profileData.localizedHeadline ?? '',
    connections: profileData.numConnections ?? profileData.connections ?? 'N/A',
    followers: profileData.followersCount ?? profileData.followers ?? 'N/A',
    profileViews: profileData.profileViews ?? 'N/A',
    industry: profileData.industry ?? '',
    location: profileData.location ?? profileData.locationName ?? '',
  };
  await upsertIntegrationData(orgId, 'linkedin', [
    { recordType: 'profile', data: profile },
    { recordType: 'social_summary', data: socialSummary },
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

  // Enrich media with engagement insights (likes, comments, impressions, reach)
  let mediaWithInsights = media;
  if (media && Array.isArray(media)) {
    const items = (media as Array<Record<string, unknown>>).slice(0, 15); // Top 15 to avoid rate limits
    const enriched = await Promise.allSettled(
      items.map(async (item) => {
        const mediaId = item.id as string;
        if (!mediaId) return item;
        try {
          const insights = await getInstagramInsights(orgId, mediaId);
          return { ...item, insights };
        } catch {
          return item; // Keep media even if insights fail
        }
      })
    );
    mediaWithInsights = enriched.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
  }

  // Compute engagement summary from enriched media
  const engagementSummary = computeInstagramEngagement(mediaWithInsights as Array<Record<string, unknown>>);

  await upsertIntegrationData(orgId, 'instagram', [
    { recordType: 'profile', data: profile },
    { recordType: 'media', data: mediaWithInsights },
    { recordType: 'engagement_summary', data: engagementSummary },
  ]);
  console.log('[Pivot] Instagram pull done (with engagement insights)');
}

/** Compute engagement analytics from Instagram media with insights */
function computeInstagramEngagement(media: Array<Record<string, unknown>>): Record<string, unknown> {
  if (!media || media.length === 0) return { totalPosts: 0 };

  let totalLikes = 0, totalComments = 0, totalImpressions = 0, totalReach = 0;
  const topPosts: Array<Record<string, unknown>> = [];

  for (const item of media) {
    const insights = item.insights as Record<string, unknown> | undefined;
    const likes = Number(item.like_count ?? insights?.likes ?? insights?.like_count ?? 0);
    const comments = Number(item.comments_count ?? insights?.comments ?? insights?.comments_count ?? 0);
    const impressions = Number(insights?.impressions ?? 0);
    const reach = Number(insights?.reach ?? 0);

    totalLikes += likes;
    totalComments += comments;
    totalImpressions += impressions;
    totalReach += reach;

    topPosts.push({
      id: item.id,
      caption: String(item.caption ?? '').slice(0, 100),
      mediaType: item.media_type,
      timestamp: item.timestamp,
      likes,
      comments,
      impressions,
      reach,
      engagement: likes + comments,
    });
  }

  // Sort by engagement (likes + comments)
  topPosts.sort((a, b) => (b.engagement as number) - (a.engagement as number));

  const avgEngagement = media.length > 0 ? Math.round((totalLikes + totalComments) / media.length) : 0;

  return {
    totalPosts: media.length,
    totalLikes,
    totalComments,
    totalImpressions,
    totalReach,
    avgEngagementPerPost: avgEngagement,
    engagementRate: totalImpressions > 0 ? Math.round((totalLikes + totalComments) / totalImpressions * 10000) / 100 : 0,
    topPerformingPosts: topPosts.slice(0, 5),
    worstPerformingPosts: topPosts.slice(-3).reverse(),
    bestPostingTimes: extractBestTimes(topPosts.slice(0, 10)),
    contentThemes: extractThemes(topPosts.slice(0, 10)),
  };
}

function extractBestTimes(posts: Array<Record<string, unknown>>): string[] {
  const hours: Record<number, number> = {};
  for (const post of posts) {
    const ts = post.timestamp as string;
    if (!ts) continue;
    try {
      const h = new Date(ts).getHours();
      hours[h] = (hours[h] ?? 0) + 1;
    } catch { /* skip */ }
  }
  return Object.entries(hours)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([h]) => {
      const hour = parseInt(h);
      return hour < 12 ? `${hour || 12}AM` : `${hour === 12 ? 12 : hour - 12}PM`;
    });
}

function extractThemes(posts: Array<Record<string, unknown>>): string[] {
  const themes = new Map<string, number>();
  for (const post of posts) {
    const caption = String(post.caption ?? '').toLowerCase();
    // Extract hashtags
    const hashtags = caption.match(/#\w+/g) ?? [];
    for (const tag of hashtags) {
      themes.set(tag, (themes.get(tag) ?? 0) + 1);
    }
  }
  return [...themes.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([tag]) => tag);
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

// ── Financial Provider Pull Functions (Composio-based) ─────────────────────

async function pullPayPal(orgId: string): Promise<void> {
  const { executeComposioAction } = await import('./composio');
  const [transactions, balance] = await Promise.allSettled([
    executeComposioAction(orgId, 'paypal', 'PAYPAL_LIST_TRANSACTIONS', {}),
    executeComposioAction(orgId, 'paypal', 'PAYPAL_GET_BALANCE', {}),
  ]);
  await upsertIntegrationData(orgId, 'paypal', [
    { recordType: 'transactions', data: transactions.status === 'fulfilled' ? transactions.value : null },
    { recordType: 'balance', data: balance.status === 'fulfilled' ? balance.value : null },
  ]);
  console.log('[Pivot] PayPal pull done');
}

async function pullSquare(orgId: string): Promise<void> {
  const { executeComposioAction } = await import('./composio');
  const [payments, customers] = await Promise.allSettled([
    executeComposioAction(orgId, 'square', 'SQUARE_LIST_PAYMENTS', {}),
    executeComposioAction(orgId, 'square', 'SQUARE_LIST_CUSTOMERS', {}),
  ]);
  await upsertIntegrationData(orgId, 'square', [
    { recordType: 'payments', data: payments.status === 'fulfilled' ? payments.value : null },
    { recordType: 'customers', data: customers.status === 'fulfilled' ? customers.value : null },
  ]);
  console.log('[Pivot] Square pull done');
}

async function pullXero(orgId: string): Promise<void> {
  const { executeComposioAction } = await import('./composio');
  const [invoices, accounts, contacts] = await Promise.allSettled([
    executeComposioAction(orgId, 'xero', 'XERO_LIST_INVOICES', {}),
    executeComposioAction(orgId, 'xero', 'XERO_LIST_ACCOUNTS', {}),
    executeComposioAction(orgId, 'xero', 'XERO_LIST_CONTACTS', {}),
  ]);
  await upsertIntegrationData(orgId, 'xero', [
    { recordType: 'invoices', data: invoices.status === 'fulfilled' ? invoices.value : null },
    { recordType: 'accounts', data: accounts.status === 'fulfilled' ? accounts.value : null },
    { recordType: 'contacts', data: contacts.status === 'fulfilled' ? contacts.value : null },
  ]);
  console.log('[Pivot] Xero pull done');
}

async function pullFreshBooks(orgId: string): Promise<void> {
  const { executeComposioAction } = await import('./composio');
  const [invoices, expenses, clients] = await Promise.allSettled([
    executeComposioAction(orgId, 'freshbooks', 'FRESHBOOKS_LIST_INVOICES', {}),
    executeComposioAction(orgId, 'freshbooks', 'FRESHBOOKS_LIST_EXPENSES', {}),
    executeComposioAction(orgId, 'freshbooks', 'FRESHBOOKS_LIST_CLIENTS', {}),
  ]);
  await upsertIntegrationData(orgId, 'freshbooks', [
    { recordType: 'invoices', data: invoices.status === 'fulfilled' ? invoices.value : null },
    { recordType: 'expenses', data: expenses.status === 'fulfilled' ? expenses.value : null },
    { recordType: 'clients', data: clients.status === 'fulfilled' ? clients.value : null },
  ]);
  console.log('[Pivot] FreshBooks pull done');
}

async function pullPlaid(orgId: string): Promise<void> {
  const { executeComposioAction } = await import('./composio');
  const [accounts, transactions] = await Promise.allSettled([
    executeComposioAction(orgId, 'plaid', 'PLAID_GET_ACCOUNTS', {}),
    executeComposioAction(orgId, 'plaid', 'PLAID_GET_TRANSACTIONS', { start_date: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0] }),
  ]);
  await upsertIntegrationData(orgId, 'plaid', [
    { recordType: 'accounts', data: accounts.status === 'fulfilled' ? accounts.value : null },
    { recordType: 'transactions', data: transactions.status === 'fulfilled' ? transactions.value : null },
  ]);
  console.log('[Pivot] Plaid pull done');
}

async function pullMercury(orgId: string): Promise<void> {
  const { executeComposioAction } = await import('./composio');
  const [accounts, transactions] = await Promise.allSettled([
    executeComposioAction(orgId, 'mercury', 'MERCURY_LIST_ACCOUNTS', {}),
    executeComposioAction(orgId, 'mercury', 'MERCURY_LIST_TRANSACTIONS', {}),
  ]);
  await upsertIntegrationData(orgId, 'mercury', [
    { recordType: 'accounts', data: accounts.status === 'fulfilled' ? accounts.value : null },
    { recordType: 'transactions', data: transactions.status === 'fulfilled' ? transactions.value : null },
  ]);
  console.log('[Pivot] Mercury pull done');
}

async function pullWave(orgId: string): Promise<void> {
  const { executeComposioAction } = await import('./composio');
  const [invoices, accounts] = await Promise.allSettled([
    executeComposioAction(orgId, 'wave', 'WAVE_LIST_INVOICES', {}),
    executeComposioAction(orgId, 'wave', 'WAVE_LIST_ACCOUNTS', {}),
  ]);
  await upsertIntegrationData(orgId, 'wave', [
    { recordType: 'invoices', data: invoices.status === 'fulfilled' ? invoices.value : null },
    { recordType: 'accounts', data: accounts.status === 'fulfilled' ? accounts.value : null },
  ]);
  console.log('[Pivot] Wave pull done');
}

async function pullBrex(orgId: string): Promise<void> {
  const { executeComposioAction } = await import('./composio');
  const [transactions, accounts] = await Promise.allSettled([
    executeComposioAction(orgId, 'brex', 'BREX_LIST_TRANSACTIONS', {}),
    executeComposioAction(orgId, 'brex', 'BREX_LIST_ACCOUNTS', {}),
  ]);
  await upsertIntegrationData(orgId, 'brex', [
    { recordType: 'transactions', data: transactions.status === 'fulfilled' ? transactions.value : null },
    { recordType: 'accounts', data: accounts.status === 'fulfilled' ? accounts.value : null },
  ]);
  console.log('[Pivot] Brex pull done');
}

async function pullGusto(orgId: string): Promise<void> {
  const { executeComposioAction } = await import('./composio');
  const [payrolls, employees] = await Promise.allSettled([
    executeComposioAction(orgId, 'gusto', 'GUSTO_LIST_PAYROLLS', {}),
    executeComposioAction(orgId, 'gusto', 'GUSTO_LIST_EMPLOYEES', {}),
  ]);
  await upsertIntegrationData(orgId, 'gusto', [
    { recordType: 'payrolls', data: payrolls.status === 'fulfilled' ? payrolls.value : null },
    { recordType: 'employees', data: employees.status === 'fulfilled' ? employees.value : null },
  ]);
  console.log('[Pivot] Gusto pull done');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
    paypal: 'PayPal', square: 'Square', xero: 'Xero',
    freshbooks: 'FreshBooks', plaid: 'Plaid (Bank)', mercury: 'Mercury',
    wave: 'Wave', brex: 'Brex', gusto: 'Gusto',
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
