/**
 * CRM Engine — AI-managed contact relationship management
 *
 * Auto-populates from Stripe, Gmail, Slack, and other integrations.
 * Provides lead scoring, contact enrichment, and follow-up suggestions.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CRMContact {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  source: string;
  source_id: string | null;
  stage: string;
  deal_value: number | null;
  currency: string;
  tags: string[];
  last_contacted_at: string | null;
  last_activity: string | null;
  next_followup_at: string | null;
  followup_note: string | null;
  website: string | null;
  linkedin_url: string | null;
  notes: string | null;
  ai_summary: string | null;
  assigned_to: string | null;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface CRMActivity {
  id: string;
  org_id: string;
  contact_id: string;
  type: string;
  title: string;
  description: string | null;
  channel: string | null;
  sentiment: string | null;
  automated: boolean;
  agent_id: string | null;
  task_id: string | null;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJson(val: unknown): unknown {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

/** Extract email address from a "Name <email>" string */
function extractEmail(raw: string): string | null {
  const match = raw.match(/<([^>]+@[^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  if (raw.includes('@')) return raw.toLowerCase().trim();
  return null;
}

/** Extract display name from a "Name <email>" string */
function extractName(raw: string): string {
  const match = raw.match(/^(.+?)\s*<[^>]+>/);
  if (match) return match[1].replace(/["']/g, '').trim();
  // If it's just an email, use the part before @
  if (raw.includes('@')) return raw.split('@')[0].replace(/[._-]/g, ' ').trim();
  return raw.trim();
}

function nowISO(): string {
  return new Date().toISOString();
}

// ── Sync from Stripe ─────────────────────────────────────────────────────────

export async function syncContactsFromStripe(orgId: string): Promise<number> {
  const supabase = createAdminClient();

  // Read customers from integration_data
  const { data: rows } = await supabase
    .from('integration_data')
    .select('data')
    .eq('org_id', orgId)
    .eq('provider', 'stripe')
    .eq('record_type', 'customers')
    .limit(1)
    .single();

  if (!rows?.data) return 0;

  const raw = safeParseJson(rows.data) as Record<string, unknown>;
  const customers: Array<Record<string, unknown>> =
    (raw?.data as Record<string, unknown>)?.data as Array<Record<string, unknown>>
    ?? raw?.data as Array<Record<string, unknown>>
    ?? [];

  if (!Array.isArray(customers) || customers.length === 0) return 0;

  // Also load payments for deal value calculation
  const { data: paymentRows } = await supabase
    .from('integration_data')
    .select('data')
    .eq('org_id', orgId)
    .eq('provider', 'stripe')
    .eq('record_type', 'payments')
    .limit(1)
    .single();

  const paymentRaw = safeParseJson(paymentRows?.data) as Record<string, unknown>;
  const payments: Array<Record<string, unknown>> =
    (paymentRaw?.data as Record<string, unknown>)?.data as Array<Record<string, unknown>>
    ?? paymentRaw?.data as Array<Record<string, unknown>>
    ?? [];

  // Build payment totals per customer
  const paymentsByCustomer = new Map<string, { total: number; count: number; lastDate: string }>();
  if (Array.isArray(payments)) {
    for (const p of payments) {
      if (p.status !== 'succeeded') continue;
      const custId = String(p.customer ?? '');
      if (!custId) continue;
      const existing = paymentsByCustomer.get(custId) ?? { total: 0, count: 0, lastDate: '' };
      existing.total += Number(p.amount ?? 0) / 100;
      existing.count++;
      const date = p.created ? new Date(Number(p.created) * 1000).toISOString() : '';
      if (date > existing.lastDate) existing.lastDate = date;
      paymentsByCustomer.set(custId, existing);
    }
  }

  let synced = 0;
  for (const cust of customers) {
    const email = String(cust.email ?? '').toLowerCase().trim();
    const name = String(cust.name ?? cust.description ?? email.split('@')[0] ?? 'Unknown');
    const stripeId = String(cust.id ?? '');

    if (!email && !name) continue;

    const paymentInfo = paymentsByCustomer.get(stripeId);
    const dealValue = paymentInfo?.total ?? null;

    // Determine stage based on payment history
    let stage = 'lead';
    if (paymentInfo && paymentInfo.count > 0) {
      stage = paymentInfo.count >= 3 ? 'active' : 'won';
    }

    // Upsert by org_id + email (or source_id if no email)
    const existing = email
      ? await supabase.from('crm_contacts').select('id').eq('org_id', orgId).eq('email', email).limit(1).single()
      : await supabase.from('crm_contacts').select('id').eq('org_id', orgId).eq('source_id', stripeId).limit(1).single();

    if (existing.data?.id) {
      // Update existing contact
      await supabase.from('crm_contacts').update({
        deal_value: dealValue,
        stage,
        source_id: stripeId,
        last_contacted_at: paymentInfo?.lastDate ?? undefined,
        last_activity: paymentInfo ? `Payment: $${paymentInfo.total.toFixed(2)} (${paymentInfo.count} payments)` : undefined,
        updated_at: nowISO(),
      }).eq('id', existing.data.id);
    } else {
      // Create new contact
      await supabase.from('crm_contacts').insert({
        org_id: orgId,
        name,
        email: email || null,
        source: 'stripe',
        source_id: stripeId,
        stage,
        deal_value: dealValue,
        last_contacted_at: paymentInfo?.lastDate ?? null,
        last_activity: paymentInfo ? `Payment: $${paymentInfo.total.toFixed(2)} (${paymentInfo.count} payments)` : null,
      });
    }
    synced++;
  }

  console.log(`[CRM] Synced ${synced} contacts from Stripe`);
  return synced;
}

// ── Sync from Gmail ──────────────────────────────────────────────────────────

export async function syncContactsFromGmail(orgId: string): Promise<number> {
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from('integration_data')
    .select('data')
    .eq('org_id', orgId)
    .eq('provider', 'gmail')
    .eq('record_type', 'emails')
    .limit(1)
    .single();

  if (!rows?.data) return 0;

  const raw = safeParseJson(rows.data) as Record<string, unknown>;
  const rawData = raw?.data as Record<string, unknown> | undefined;
  const messages: Array<Record<string, unknown>> =
    rawData?.messages as Array<Record<string, unknown>>
    ?? raw?.messages as Array<Record<string, unknown>>
    ?? rawData as unknown as Array<Record<string, unknown>>
    ?? [];

  if (!Array.isArray(messages) || messages.length === 0) return 0;

  // Aggregate by sender
  const contactMap = new Map<string, {
    name: string;
    email: string;
    count: number;
    lastDate: string;
    subjects: string[];
    sentByUs: number;
    receivedByUs: number;
  }>();

  for (const msg of messages) {
    const fromRaw = String(msg.sender ?? msg.from ?? msg.From ?? '');
    const toRaw = String(msg.to ?? msg.To ?? '');
    const subject = String(msg.subject ?? msg.Subject ?? msg.snippet ?? '').slice(0, 200);
    const date = String(msg.date ?? msg.Date ?? msg.internalDate ?? '');

    // Skip notifications and no-reply
    if (fromRaw.includes('noreply') || fromRaw.includes('no-reply') || fromRaw.includes('notification') || fromRaw.includes('mailer-daemon')) continue;

    const email = extractEmail(fromRaw);
    if (!email) continue;

    const existing = contactMap.get(email) ?? {
      name: extractName(fromRaw),
      email,
      count: 0,
      lastDate: '',
      subjects: [],
      sentByUs: 0,
      receivedByUs: 0,
    };

    existing.count++;
    existing.receivedByUs++;
    if (subject && existing.subjects.length < 5) existing.subjects.push(subject);
    if (date > existing.lastDate) existing.lastDate = date;

    contactMap.set(email, existing);

    // Also track outbound emails
    const toEmail = extractEmail(toRaw);
    if (toEmail && toEmail !== email) {
      const toExisting = contactMap.get(toEmail) ?? {
        name: extractName(toRaw),
        email: toEmail,
        count: 0,
        lastDate: '',
        subjects: [],
        sentByUs: 0,
        receivedByUs: 0,
      };
      toExisting.sentByUs++;
      if (date > toExisting.lastDate) toExisting.lastDate = date;
      contactMap.set(toEmail, toExisting);
    }
  }

  let synced = 0;
  for (const [email, info] of contactMap) {
    if (info.count < 1) continue; // Skip very low-frequency contacts

    const existing = await supabase
      .from('crm_contacts')
      .select('id, source')
      .eq('org_id', orgId)
      .eq('email', email)
      .limit(1)
      .single();

    if (existing.data?.id) {
      // Update last_contacted_at if newer
      await supabase.from('crm_contacts').update({
        last_contacted_at: info.lastDate || undefined,
        last_activity: `Email: ${info.subjects[0] ?? 'conversation'}`,
        updated_at: nowISO(),
      }).eq('id', existing.data.id);

      // Create activity
      await supabase.from('crm_activities').insert({
        org_id: orgId,
        contact_id: existing.data.id,
        type: 'email_received',
        title: `${info.count} emails synced from Gmail`,
        description: info.subjects.slice(0, 3).join(', '),
        channel: 'gmail',
        automated: true,
        agent_id: 'crm_sync',
      });
    } else {
      // Create new contact
      const { data: inserted } = await supabase.from('crm_contacts').insert({
        org_id: orgId,
        name: info.name,
        email,
        source: 'gmail',
        stage: 'lead',
        last_contacted_at: info.lastDate || null,
        last_activity: `Email: ${info.subjects[0] ?? 'conversation'}`,
      }).select('id').single();

      if (inserted?.id) {
        await supabase.from('crm_activities').insert({
          org_id: orgId,
          contact_id: inserted.id,
          type: 'email_received',
          title: `${info.count} emails synced from Gmail`,
          description: info.subjects.slice(0, 3).join(', '),
          channel: 'gmail',
          automated: true,
          agent_id: 'crm_sync',
        });
      }
    }
    synced++;
  }

  console.log(`[CRM] Synced ${synced} contacts from Gmail`);
  return synced;
}

// ── Sync from Slack ──────────────────────────────────────────────────────────

export async function syncContactsFromSlack(orgId: string): Promise<number> {
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from('integration_data')
    .select('data')
    .eq('org_id', orgId)
    .eq('provider', 'slack')
    .eq('record_type', 'messages')
    .limit(1)
    .single();

  if (!rows?.data) return 0;

  const raw = safeParseJson(rows.data);
  if (!Array.isArray(raw)) return 0;

  // Also try to load Slack users for name/email resolution
  const { data: userRows } = await supabase
    .from('integration_data')
    .select('data')
    .eq('org_id', orgId)
    .eq('provider', 'slack')
    .eq('record_type', 'users')
    .limit(1)
    .single();

  const slackUsers = new Map<string, { name: string; email: string }>();
  if (userRows?.data) {
    const users = safeParseJson(userRows.data);
    if (Array.isArray(users)) {
      for (const u of users as Array<Record<string, unknown>>) {
        const id = String(u.id ?? '');
        const profile = u.profile as Record<string, unknown> | undefined;
        const name = String(u.real_name ?? profile?.real_name ?? u.name ?? '');
        const email = String(profile?.email ?? '').toLowerCase().trim();
        if (id && (name || email)) {
          slackUsers.set(id, { name, email });
        }
      }
    }
  }

  // Count messages per user across channels
  const userActivity = new Map<string, { count: number; channels: Set<string>; lastTs: string }>();

  for (const channel of raw as Array<Record<string, unknown>>) {
    const channelName = String(channel.channel ?? 'unknown');
    const msgs = channel.messages as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(msgs)) continue;

    for (const msg of msgs) {
      const userId = String(msg.user ?? '');
      if (!userId || userId === 'undefined') continue;

      const existing = userActivity.get(userId) ?? { count: 0, channels: new Set(), lastTs: '' };
      existing.count++;
      existing.channels.add(channelName);
      const ts = String(msg.ts ?? '');
      if (ts > existing.lastTs) existing.lastTs = ts;
      userActivity.set(userId, existing);
    }
  }

  let synced = 0;
  for (const [userId, activity] of userActivity) {
    const userInfo = slackUsers.get(userId);
    if (!userInfo) continue; // Skip users we can't resolve

    const email = userInfo.email;
    const name = userInfo.name || email?.split('@')[0] || userId;

    if (!email) continue; // Need email for dedup

    const existing = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', email)
      .limit(1)
      .single();

    const lastContactedAt = activity.lastTs
      ? new Date(parseFloat(activity.lastTs) * 1000).toISOString()
      : null;

    if (existing.data?.id) {
      await supabase.from('crm_contacts').update({
        last_contacted_at: lastContactedAt ?? undefined,
        last_activity: `Slack: ${[...activity.channels].slice(0, 3).map(c => `#${c}`).join(', ')}`,
        updated_at: nowISO(),
      }).eq('id', existing.data.id);
    } else {
      await supabase.from('crm_contacts').insert({
        org_id: orgId,
        name,
        email,
        source: 'slack',
        stage: 'lead',
        last_contacted_at: lastContactedAt,
        last_activity: `Slack: ${[...activity.channels].slice(0, 3).map(c => `#${c}`).join(', ')}`,
      });
    }
    synced++;
  }

  console.log(`[CRM] Synced ${synced} contacts from Slack`);
  return synced;
}

// ── Enrich Contact ───────────────────────────────────────────────────────────

export async function enrichContact(contactId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: contact } = await supabase
    .from('crm_contacts')
    .select('*')
    .eq('id', contactId)
    .single();

  if (!contact) return false;

  const searchQuery = [contact.name, contact.company, contact.email]
    .filter(Boolean)
    .join(' ');

  if (!searchQuery.trim()) return false;

  // Use OpenRouter/Perplexity sonar for enrichment
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[CRM] OPENROUTER_API_KEY not set — skipping enrichment');
    return false;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pivotcommandcenter.com',
        'X-Title': 'Pivot CRM Enrichment',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a contact enrichment assistant. Given a person\'s information, find their professional details. Return ONLY valid JSON with these fields: company, title, linkedin_url, website, summary. Use null for unknown fields. The summary should be 1-2 sentences about their professional background.',
          },
          {
            role: 'user',
            content: `Find professional details for: ${searchQuery}`,
          },
        ],
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) return false;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return false;

    const enrichment = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const updates: Record<string, unknown> = { updated_at: nowISO() };
    if (enrichment.company && !contact.company) updates.company = String(enrichment.company);
    if (enrichment.title && !contact.title) updates.title = String(enrichment.title);
    if (enrichment.linkedin_url && !contact.linkedin_url) updates.linkedin_url = String(enrichment.linkedin_url);
    if (enrichment.website && !contact.website) updates.website = String(enrichment.website);
    if (enrichment.summary) updates.ai_summary = String(enrichment.summary);

    await supabase.from('crm_contacts').update(updates).eq('id', contactId);

    // Log enrichment activity
    await supabase.from('crm_activities').insert({
      org_id: contact.org_id,
      contact_id: contactId,
      type: 'note',
      title: 'Contact enriched via AI web search',
      description: updates.ai_summary ? String(updates.ai_summary) : 'Enrichment data updated',
      automated: true,
      agent_id: 'crm_enrichment',
    });

    console.log(`[CRM] Enriched contact ${contact.name}`);
    return true;
  } catch (err) {
    console.warn(`[CRM] Enrichment failed for ${contact.name}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

// ── Lead Scoring ─────────────────────────────────────────────────────────────

export async function scoreContacts(orgId: string): Promise<number> {
  const supabase = createAdminClient();

  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id, name, email, stage, deal_value, last_contacted_at, last_activity, tags, source, company, title')
    .eq('org_id', orgId);

  if (!contacts || contacts.length === 0) return 0;

  // Load activity counts per contact
  const { data: activities } = await supabase
    .from('crm_activities')
    .select('contact_id, type, created_at')
    .eq('org_id', orgId);

  const activityCounts = new Map<string, { total: number; recent: number }>();
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  if (activities) {
    for (const act of activities) {
      const existing = activityCounts.get(act.contact_id) ?? { total: 0, recent: 0 };
      existing.total++;
      if (new Date(act.created_at).getTime() > thirtyDaysAgo) existing.recent++;
      activityCounts.set(act.contact_id, existing);
    }
  }

  let scored = 0;
  for (const contact of contacts) {
    let score = 0;
    const actInfo = activityCounts.get(contact.id) ?? { total: 0, recent: 0 };

    // Engagement frequency (0-30 points)
    score += Math.min(actInfo.total * 3, 15);
    score += Math.min(actInfo.recent * 5, 15);

    // Deal value (0-25 points)
    if (contact.deal_value) {
      if (contact.deal_value >= 10000) score += 25;
      else if (contact.deal_value >= 5000) score += 20;
      else if (contact.deal_value >= 1000) score += 15;
      else if (contact.deal_value >= 100) score += 10;
      else score += 5;
    }

    // Recency (0-20 points)
    if (contact.last_contacted_at) {
      const daysSince = (now - new Date(contact.last_contacted_at).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSince <= 3) score += 20;
      else if (daysSince <= 7) score += 15;
      else if (daysSince <= 14) score += 10;
      else if (daysSince <= 30) score += 5;
    }

    // Stage advancement (0-15 points)
    const stageScores: Record<string, number> = {
      lead: 0, prospect: 3, qualified: 6, proposal: 9, negotiation: 12, won: 15, active: 15, lost: 0, churned: 0,
    };
    score += stageScores[contact.stage] ?? 0;

    // Completeness bonus (0-10 points)
    if (contact.email) score += 2;
    if (contact.company) score += 2;
    if (contact.title) score += 2;
    if (contact.tags && contact.tags.length > 0) score += 2;
    if (contact.source !== 'manual') score += 2;

    score = Math.min(score, 100);

    await supabase.from('crm_contacts').update({ score, updated_at: nowISO() }).eq('id', contact.id);
    scored++;
  }

  console.log(`[CRM] Scored ${scored} contacts`);
  return scored;
}

// ── Contact Timeline ─────────────────────────────────────────────────────────

export async function getContactTimeline(contactId: string): Promise<CRMActivity[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('crm_activities')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[CRM] Failed to get timeline:', error.message);
    return [];
  }

  return (data ?? []) as CRMActivity[];
}

// ── Move Contact Stage ───────────────────────────────────────────────────────

export async function moveContactStage(
  contactId: string,
  newStage: string,
  reason?: string,
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: contact } = await supabase
    .from('crm_contacts')
    .select('org_id, name, stage')
    .eq('id', contactId)
    .single();

  if (!contact) return false;

  const oldStage = contact.stage;

  await supabase.from('crm_contacts').update({
    stage: newStage,
    updated_at: nowISO(),
  }).eq('id', contactId);

  // Log stage change activity
  await supabase.from('crm_activities').insert({
    org_id: contact.org_id,
    contact_id: contactId,
    type: 'stage_change',
    title: `Stage: ${oldStage} → ${newStage}`,
    description: reason ?? null,
    automated: false,
  });

  console.log(`[CRM] Moved ${contact.name} from ${oldStage} to ${newStage}`);
  return true;
}

// ── Suggest Follow-ups ───────────────────────────────────────────────────────

export interface FollowupSuggestion {
  contact_id: string;
  contact_name: string;
  email: string | null;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggested_action: string;
  days_since_contact: number;
}

export async function suggestFollowups(orgId: string): Promise<FollowupSuggestion[]> {
  const supabase = createAdminClient();

  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id, name, email, stage, deal_value, score, last_contacted_at, last_activity, next_followup_at, followup_note')
    .eq('org_id', orgId)
    .not('stage', 'in', '(lost,churned)')
    .order('score', { ascending: false });

  if (!contacts || contacts.length === 0) return [];

  const now = Date.now();
  const suggestions: FollowupSuggestion[] = [];

  for (const contact of contacts) {
    const daysSince = contact.last_contacted_at
      ? Math.floor((now - new Date(contact.last_contacted_at).getTime()) / (24 * 60 * 60 * 1000))
      : 999;

    // Explicit follow-up scheduled
    if (contact.next_followup_at) {
      const followupDate = new Date(contact.next_followup_at).getTime();
      if (followupDate <= now) {
        suggestions.push({
          contact_id: contact.id,
          contact_name: contact.name,
          email: contact.email,
          reason: contact.followup_note ?? 'Scheduled follow-up is due',
          priority: 'high',
          suggested_action: 'Send follow-up email or schedule a call',
          days_since_contact: daysSince,
        });
        continue;
      }
    }

    // High-value deal going cold
    if (contact.deal_value && contact.deal_value > 1000 && daysSince > 7 && ['proposal', 'negotiation', 'qualified'].includes(contact.stage)) {
      suggestions.push({
        contact_id: contact.id,
        contact_name: contact.name,
        email: contact.email,
        reason: `$${contact.deal_value.toLocaleString()} deal in ${contact.stage} stage — ${daysSince} days since last contact`,
        priority: 'high',
        suggested_action: 'Check in on proposal status or schedule a meeting',
        days_since_contact: daysSince,
      });
      continue;
    }

    // Active customers going quiet
    if (['won', 'active'].includes(contact.stage) && daysSince > 30) {
      suggestions.push({
        contact_id: contact.id,
        contact_name: contact.name,
        email: contact.email,
        reason: `Active customer — ${daysSince} days since last contact (risk of churn)`,
        priority: 'medium',
        suggested_action: 'Send a check-in email or offer new value',
        days_since_contact: daysSince,
      });
      continue;
    }

    // Hot leads going cold
    if (contact.score >= 50 && daysSince > 14 && ['lead', 'prospect'].includes(contact.stage)) {
      suggestions.push({
        contact_id: contact.id,
        contact_name: contact.name,
        email: contact.email,
        reason: `High-scoring lead (${contact.score}/100) — ${daysSince} days since last contact`,
        priority: 'medium',
        suggested_action: 'Re-engage with relevant content or offer',
        days_since_contact: daysSince,
      });
      continue;
    }

    // Any contact silent for 60+ days
    if (daysSince > 60 && contact.stage !== 'lead') {
      suggestions.push({
        contact_id: contact.id,
        contact_name: contact.name,
        email: contact.email,
        reason: `No contact in ${daysSince} days`,
        priority: 'low',
        suggested_action: 'Send a re-engagement email',
        days_since_contact: daysSince,
      });
    }
  }

  // Sort by priority then days since contact
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.days_since_contact - a.days_since_contact;
  });

  return suggestions.slice(0, 20);
}

// ── Lookup & Search ──────────────────────────────────────────────────────────

export async function getContactByEmail(orgId: string, email: string): Promise<CRMContact | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('crm_contacts')
    .select('*')
    .eq('org_id', orgId)
    .eq('email', email.toLowerCase().trim())
    .limit(1)
    .single();

  return (data as CRMContact) ?? null;
}

export async function searchContacts(
  orgId: string,
  query: string,
): Promise<CRMContact[]> {
  const supabase = createAdminClient();
  const q = query.toLowerCase().trim();

  if (!q) return [];

  // Supabase doesn't support OR across ilike on multiple columns natively,
  // so we use three parallel queries and merge.
  const [byName, byEmail, byCompany] = await Promise.all([
    supabase.from('crm_contacts').select('*').eq('org_id', orgId).ilike('name', `%${q}%`).limit(20),
    supabase.from('crm_contacts').select('*').eq('org_id', orgId).ilike('email', `%${q}%`).limit(20),
    supabase.from('crm_contacts').select('*').eq('org_id', orgId).ilike('company', `%${q}%`).limit(20),
  ]);

  // Deduplicate by id
  const seen = new Set<string>();
  const results: CRMContact[] = [];
  for (const row of [...(byName.data ?? []), ...(byEmail.data ?? []), ...(byCompany.data ?? [])]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      results.push(row as CRMContact);
    }
  }

  return results.slice(0, 30);
}
