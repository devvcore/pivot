/**
 * CRM Tools — Agent-managed customer relationship management
 *
 * Agents can search contacts, manage pipeline stages, add notes,
 * and get follow-up suggestions. Auto-populated from Stripe/Gmail/Slack.
 */

import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';

// ── Search CRM ──────────────────────────────────────────────────────────────

const searchCRM: Tool = {
  name: 'search_crm',
  description: 'Search CRM contacts by name, email, or company. Returns contact details with recent activities. Use this to find information about clients before writing emails, proposals, or follow-ups.',
  parameters: {
    query: { type: 'string', description: 'Search query (name, email, or company)' },
    stage: { type: 'string', description: 'Filter by pipeline stage: lead, prospect, qualified, proposal, negotiation, won, lost, active' },
  },
  required: ['query'],
  category: 'operations',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const query = String(args.query ?? '');
    const stage = args.stage ? String(args.stage) : undefined;
    if (!query) return { success: false, output: 'Search query required.' };

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      let q = supabase
        .from('crm_contacts')
        .select('*')
        .eq('org_id', context.orgId)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
        .order('score', { ascending: false })
        .limit(10);

      if (stage) q = q.eq('stage', stage);

      const { data, error } = await q;
      if (error) return { success: false, output: `CRM search failed: ${error.message}` };
      if (!data || data.length === 0) {
        return { success: true, output: `No contacts found matching "${query}". The CRM may need syncing — try asking me to sync CRM data from integrations.` };
      }

      const lines = [`## CRM Results: "${query}" (${data.length} contacts)\n`];
      for (const c of data) {
        lines.push(`**${c.name}** ${c.company ? `(${c.company})` : ''}`);
        lines.push(`  Email: ${c.email ?? 'N/A'} | Stage: ${c.stage} | Score: ${c.score}/100`);
        if (c.deal_value) lines.push(`  Deal Value: $${Number(c.deal_value).toLocaleString()}`);
        if (c.last_activity) lines.push(`  Last Activity: ${c.last_activity}`);
        if (c.next_followup_at) lines.push(`  Next Follow-up: ${new Date(c.next_followup_at).toLocaleDateString()}`);
        if (c.ai_summary) lines.push(`  AI Summary: ${c.ai_summary}`);
        lines.push('');
      }

      return { success: true, output: lines.join('\n'), cost: 0 };
    } catch (err) {
      return { success: false, output: `CRM error: ${err instanceof Error ? err.message : 'unknown'}` };
    }
  },
};

// ── Get Contact Details ─────────────────────────────────────────────────────

const getContactDetails: Tool = {
  name: 'get_contact_details',
  description: 'Get full details for a CRM contact including their activity timeline, deal history, and AI summary. Use when you need deep context about a specific client.',
  parameters: {
    email: { type: 'string', description: 'Contact email address' },
    name: { type: 'string', description: 'Contact name (if email not available)' },
  },
  required: [],
  category: 'operations',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const email = args.email ? String(args.email) : undefined;
    const name = args.name ? String(args.name) : undefined;
    if (!email && !name) return { success: false, output: 'Provide email or name to look up a contact.' };

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      let q = supabase.from('crm_contacts').select('*').eq('org_id', context.orgId);
      if (email) q = q.eq('email', email);
      else if (name) q = q.ilike('name', `%${name}%`);

      const { data: contacts } = await q.limit(1);
      if (!contacts || contacts.length === 0) {
        return { success: true, output: `No contact found. Check the CRM or sync from integrations.` };
      }

      const contact = contacts[0];

      // Get activities
      const { data: activities } = await supabase
        .from('crm_activities')
        .select('*')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const lines = [
        `## ${contact.name}`,
        contact.company ? `**Company:** ${contact.company}` : '',
        contact.title ? `**Title:** ${contact.title}` : '',
        `**Email:** ${contact.email ?? 'N/A'}`,
        `**Phone:** ${contact.phone ?? 'N/A'}`,
        `**Stage:** ${contact.stage} | **Score:** ${contact.score}/100`,
        contact.deal_value ? `**Deal Value:** $${Number(contact.deal_value).toLocaleString()}` : '',
        contact.website ? `**Website:** ${contact.website}` : '',
        contact.linkedin_url ? `**LinkedIn:** ${contact.linkedin_url}` : '',
        contact.tags?.length > 0 ? `**Tags:** ${contact.tags.join(', ')}` : '',
        contact.ai_summary ? `\n**AI Summary:** ${contact.ai_summary}` : '',
        contact.notes ? `\n**Notes:** ${contact.notes}` : '',
      ].filter(Boolean);

      if (activities && activities.length > 0) {
        lines.push('\n### Recent Activity');
        for (const a of activities.slice(0, 10)) {
          const date = new Date(a.created_at).toLocaleDateString();
          const badge = a.automated ? ' [Agent]' : '';
          lines.push(`- ${date}: ${a.title}${badge}${a.sentiment ? ` (${a.sentiment})` : ''}`);
        }
      }

      if (contact.next_followup_at) {
        lines.push(`\n**Next Follow-up:** ${new Date(contact.next_followup_at).toLocaleDateString()}`);
        if (contact.followup_note) lines.push(`  Note: ${contact.followup_note}`);
      }

      return { success: true, output: lines.join('\n'), cost: 0 };
    } catch (err) {
      return { success: false, output: `Contact lookup failed: ${err instanceof Error ? err.message : 'unknown'}` };
    }
  },
};

// ── Update Contact Stage ────────────────────────────────────────────────────

const updateContactStage: Tool = {
  name: 'update_contact_stage',
  description: 'Move a CRM contact to a new pipeline stage. Logs the transition as an activity. Use when a deal progresses (e.g., lead → qualified, proposal → won).',
  parameters: {
    email: { type: 'string', description: 'Contact email' },
    stage: { type: 'string', description: 'New stage: lead, prospect, qualified, proposal, negotiation, won, lost, active' },
    reason: { type: 'string', description: 'Why this contact is moving stages' },
  },
  required: ['email', 'stage'],
  category: 'operations',
  costTier: 'cheap',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const email = String(args.email ?? '');
    const stage = String(args.stage ?? '');
    const reason = String(args.reason ?? '');

    if (!email || !stage) return { success: false, output: 'Email and stage required.' };

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('id, name, stage')
        .eq('org_id', context.orgId)
        .eq('email', email)
        .single();

      if (!contact) return { success: false, output: `No contact found with email: ${email}` };

      const oldStage = contact.stage;

      // Update stage
      await supabase.from('crm_contacts').update({
        stage,
        updated_at: new Date().toISOString(),
      }).eq('id', contact.id);

      // Log activity
      await supabase.from('crm_activities').insert({
        org_id: context.orgId,
        contact_id: contact.id,
        type: 'stage_change',
        title: `Moved from ${oldStage} → ${stage}`,
        description: reason || undefined,
        automated: true,
        agent_id: context.agentId,
      });

      return {
        success: true,
        output: `Moved **${contact.name}** from ${oldStage} → **${stage}**${reason ? `. Reason: ${reason}` : ''}`,
        cost: 0,
      };
    } catch (err) {
      return { success: false, output: `Stage update failed: ${err instanceof Error ? err.message : 'unknown'}` };
    }
  },
};

// ── Add Contact Note ────────────────────────────────────────────────────────

const addContactNote: Tool = {
  name: 'add_contact_note',
  description: 'Add a note or activity to a CRM contact. Use after interactions, meetings, emails, or when you learn something new about a client.',
  parameters: {
    email: { type: 'string', description: 'Contact email' },
    note: { type: 'string', description: 'The note or activity description' },
    type: { type: 'string', description: 'Activity type: note, email_sent, call, meeting, task_completed' },
  },
  required: ['email', 'note'],
  category: 'operations',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const email = String(args.email ?? '');
    const note = String(args.note ?? '');
    const type = String(args.type ?? 'note');

    if (!email || !note) return { success: false, output: 'Email and note required.' };

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('id, name')
        .eq('org_id', context.orgId)
        .eq('email', email)
        .single();

      if (!contact) return { success: false, output: `No contact found: ${email}` };

      await supabase.from('crm_activities').insert({
        org_id: context.orgId,
        contact_id: contact.id,
        type: type as string,
        title: note.slice(0, 100),
        description: note,
        automated: true,
        agent_id: context.agentId,
      });

      // Update last activity
      await supabase.from('crm_contacts').update({
        last_activity: `${type}: ${note.slice(0, 60)}`,
        last_contacted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', contact.id);

      return { success: true, output: `Note added to **${contact.name}**: ${note.slice(0, 100)}`, cost: 0 };
    } catch (err) {
      return { success: false, output: `Failed to add note: ${err instanceof Error ? err.message : 'unknown'}` };
    }
  },
};

// ── Get Pipeline Summary ────────────────────────────────────────────────────

const getPipelineSummary: Tool = {
  name: 'get_pipeline_summary',
  description: 'Get CRM pipeline overview — contacts grouped by stage with counts and total deal values. Use to understand the sales funnel at a glance.',
  parameters: {},
  required: [],
  category: 'operations',
  costTier: 'free',

  async execute(_args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('stage, deal_value, name')
        .eq('org_id', context.orgId);

      if (!contacts || contacts.length === 0) {
        return { success: true, output: 'CRM is empty. Sync from integrations to populate contacts, or create contacts manually.' };
      }

      const stages: Record<string, { count: number; value: number; names: string[] }> = {};
      for (const c of contacts) {
        const s = c.stage ?? 'lead';
        if (!stages[s]) stages[s] = { count: 0, value: 0, names: [] };
        stages[s].count++;
        stages[s].value += Number(c.deal_value ?? 0);
        if (stages[s].names.length < 3) stages[s].names.push(c.name);
      }

      const order = ['lead', 'prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'active'];
      const lines = ['## Pipeline Summary\n'];
      let totalValue = 0;

      for (const stage of order) {
        const s = stages[stage];
        if (!s) continue;
        totalValue += s.value;
        const valueStr = s.value > 0 ? ` | $${s.value.toLocaleString()}` : '';
        lines.push(`**${stage.charAt(0).toUpperCase() + stage.slice(1)}:** ${s.count} contacts${valueStr}`);
        lines.push(`  ${s.names.join(', ')}${s.count > 3 ? `, +${s.count - 3} more` : ''}`);
      }

      lines.push(`\n**Total Pipeline Value:** $${totalValue.toLocaleString()}`);
      lines.push(`**Total Contacts:** ${contacts.length}`);

      return { success: true, output: lines.join('\n'), cost: 0 };
    } catch (err) {
      return { success: false, output: `Pipeline error: ${err instanceof Error ? err.message : 'unknown'}` };
    }
  },
};

// ── Create Contact ─────────────────────────────────────────────────────────

const createContact: Tool = {
  name: 'create_contact',
  description: 'Create a new CRM contact. Use when a new lead, prospect, or business relationship needs to be tracked in the pipeline.',
  parameters: {
    name: { type: 'string', description: 'Full name of the contact.' },
    email: { type: 'string', description: 'Email address.' },
    company: { type: 'string', description: 'Company or organization.' },
    title: { type: 'string', description: 'Job title.' },
    phone: { type: 'string', description: 'Phone number.' },
    stage: { type: 'string', description: 'Initial pipeline stage (default: lead). Options: lead, prospect, qualified, proposal, negotiation, won, lost, churned, active' },
    deal_value: { type: 'number', description: 'Estimated deal value in USD.' },
    source: { type: 'string', description: 'How this contact was acquired: manual, stripe, gmail, slack, linkedin, form, referral' },
    notes: { type: 'string', description: 'Initial notes about the contact.' },
    tags: { type: 'string', description: 'Comma-separated tags (e.g., "enterprise,high-priority,inbound").' },
  },
  required: ['name'],
  category: 'operations',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const name = String(args.name ?? '').trim();
    if (!name) return { success: false, output: 'Contact name is required.' };

    const tags = args.tags
      ? String(args.tags).split(',').map(t => t.trim()).filter(Boolean)
      : [];

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      // Check for duplicate by email
      if (args.email) {
        const { data: existing } = await supabase
          .from('crm_contacts')
          .select('id, name')
          .eq('org_id', context.orgId)
          .eq('email', String(args.email))
          .maybeSingle();

        if (existing) {
          return {
            success: false,
            output: `A contact with email ${args.email} already exists: ${existing.name} (ID: ${existing.id}). Use search_crm to view them.`,
          };
        }
      }

      const { data: contact, error } = await supabase
        .from('crm_contacts')
        .insert({
          org_id: context.orgId,
          name,
          email: args.email ? String(args.email) : null,
          company: args.company ? String(args.company) : null,
          title: args.title ? String(args.title) : null,
          phone: args.phone ? String(args.phone) : null,
          stage: args.stage ? String(args.stage) : 'lead',
          deal_value: args.deal_value !== undefined ? Number(args.deal_value) : null,
          source: args.source ? String(args.source) : 'manual',
          notes: args.notes ? String(args.notes) : null,
          tags,
        })
        .select('id, name, email, stage, deal_value')
        .single();

      if (error) return { success: false, output: `Failed to create contact: ${error.message}` };

      // Log creation as first activity
      if (contact) {
        await supabase.from('crm_activities').insert({
          org_id: context.orgId,
          contact_id: contact.id,
          type: 'note',
          title: 'Contact created',
          description: args.notes ? String(args.notes) : `New ${args.stage ?? 'lead'} created by agent`,
          automated: true,
          agent_id: context.agentId,
        });
      }

      return {
        success: true,
        output: `Created **${name}**${args.email ? ` (${args.email})` : ''}${args.company ? ` at ${args.company}` : ''}\nStage: ${args.stage ?? 'lead'}${args.deal_value ? ` | Deal: $${Number(args.deal_value).toLocaleString()}` : ''}\nID: ${contact?.id}`,
        cost: 0,
      };
    } catch (err) {
      return { success: false, output: `Create contact error: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── Suggest Follow-ups ──────────────────────────────────────────────────────

const suggestFollowups: Tool = {
  name: 'suggest_followups',
  description: 'Get AI-powered follow-up suggestions — contacts with overdue follow-ups, stale leads, and high-value deals needing attention. Use for daily pipeline hygiene.',
  parameters: {
    days_stale: { type: 'number', description: 'Consider contacts stale if not contacted in this many days (default: 7).' },
    stage: { type: 'string', description: 'Only suggest follow-ups for a specific stage: lead, prospect, qualified, proposal, negotiation, won, lost, active' },
    limit: { type: 'number', description: 'Max suggestions to return (default 10, max 25).' },
  },
  required: [],
  category: 'operations',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const daysStale = Math.max(Number(args.days_stale ?? 7), 1);
    const maxResults = Math.min(Math.max(Number(args.limit ?? 10), 1), 25);
    const stage = args.stage ? String(args.stage) : undefined;

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - daysStale);

      // 1. Overdue follow-ups
      let overdueQ = supabase
        .from('crm_contacts')
        .select('id, name, email, company, stage, deal_value, next_followup_at, followup_note, last_contacted_at')
        .eq('org_id', context.orgId)
        .lt('next_followup_at', new Date().toISOString())
        .not('stage', 'in', '("won","lost","churned")')
        .order('next_followup_at', { ascending: true })
        .limit(maxResults);

      if (stage) overdueQ = overdueQ.eq('stage', stage);
      const { data: overdue } = await overdueQ;

      // 2. Stale contacts
      let staleQ = supabase
        .from('crm_contacts')
        .select('id, name, email, company, stage, deal_value, last_contacted_at, score')
        .eq('org_id', context.orgId)
        .not('stage', 'in', '("won","lost","churned")')
        .or(`last_contacted_at.lt.${staleDate.toISOString()},last_contacted_at.is.null`)
        .order('deal_value', { ascending: false, nullsFirst: false })
        .limit(maxResults);

      if (stage) staleQ = staleQ.eq('stage', stage);
      const { data: stale } = await staleQ;

      // 3. High-value pipeline deals
      let hvQ = supabase
        .from('crm_contacts')
        .select('id, name, email, company, stage, deal_value, last_contacted_at')
        .eq('org_id', context.orgId)
        .in('stage', ['proposal', 'negotiation'])
        .order('deal_value', { ascending: false, nullsFirst: false })
        .limit(5);

      if (stage) hvQ = hvQ.eq('stage', stage);
      const { data: highValue } = await hvQ;

      const parts: string[] = ['## Follow-Up Suggestions\n'];

      if (overdue && overdue.length > 0) {
        parts.push(`### Overdue Follow-Ups (${overdue.length})\n`);
        for (const c of overdue) {
          const daysOver = Math.floor((Date.now() - new Date(c.next_followup_at as string).getTime()) / 86400000);
          parts.push(`- **${c.name}**${c.company ? ` (${c.company})` : ''} — ${c.stage}, ${daysOver}d overdue${c.followup_note ? `: "${c.followup_note}"` : ''}${c.deal_value ? ` | $${Number(c.deal_value).toLocaleString()}` : ''}`);
        }
        parts.push('');
      }

      if (stale && stale.length > 0) {
        const overdueIds = new Set((overdue ?? []).map(c => c.id));
        const uniqueStale = stale.filter(c => !overdueIds.has(c.id));
        if (uniqueStale.length > 0) {
          parts.push(`### Stale Contacts (no contact in ${daysStale}+ days)\n`);
          for (const c of uniqueStale.slice(0, maxResults)) {
            const daysSince = c.last_contacted_at
              ? Math.floor((Date.now() - new Date(c.last_contacted_at as string).getTime()) / 86400000)
              : null;
            parts.push(`- **${c.name}**${c.company ? ` (${c.company})` : ''} — ${c.stage}${daysSince !== null ? `, ${daysSince}d since last contact` : ', never contacted'}${c.deal_value ? ` | $${Number(c.deal_value).toLocaleString()}` : ''}`);
          }
          parts.push('');
        }
      }

      if (highValue && highValue.length > 0) {
        parts.push(`### High-Value Deals in Pipeline\n`);
        for (const c of highValue) {
          parts.push(`- **${c.name}**${c.company ? ` (${c.company})` : ''} — ${c.stage}${c.deal_value ? ` | $${Number(c.deal_value).toLocaleString()}` : ''}`);
        }
        parts.push('');
      }

      if ((overdue?.length ?? 0) + (stale?.length ?? 0) + (highValue?.length ?? 0) === 0) {
        parts.push('No follow-ups needed right now. Pipeline is up to date.');
      }

      return { success: true, output: parts.join('\n'), cost: 0 };
    } catch (err) {
      return { success: false, output: `Follow-up suggestions error: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// ── Register ────────────────────────────────────────────────────────────────

export const crmTools: Tool[] = [searchCRM, getContactDetails, updateContactStage, addContactNote, createContact, suggestFollowups, getPipelineSummary];
registerTools(crmTools);
