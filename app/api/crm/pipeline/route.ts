import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { getContactTimeline } from '@/lib/crm/engine';

/**
 * GET /api/crm/pipeline?orgId=...
 * Returns pipeline overview: contacts grouped by stage with counts and total deal values.
 *
 * GET /api/crm/pipeline?contactId=...
 * Returns the timeline (activities) for a specific contact.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const contactId = searchParams.get('contactId');

  // ── Timeline for a specific contact ──
  if (contactId) {
    try {
      const timeline = await getContactTimeline(contactId);
      return NextResponse.json({ timeline });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Pipeline overview ──
  const orgId = searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    // Load all contacts for the org
    const { data: contacts, error } = await supabase
      .from('crm_contacts')
      .select('id, name, email, company, stage, deal_value, score, last_contacted_at, last_activity')
      .eq('org_id', orgId)
      .order('score', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by stage
    const stages = ['lead', 'prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'churned', 'active'];
    const pipeline: Record<string, {
      stage: string;
      count: number;
      total_deal_value: number;
      contacts: Array<{
        id: string;
        name: string;
        email: string | null;
        company: string | null;
        deal_value: number | null;
        score: number;
        last_contacted_at: string | null;
        last_activity: string | null;
      }>;
    }> = {};

    for (const stage of stages) {
      pipeline[stage] = { stage, count: 0, total_deal_value: 0, contacts: [] };
    }

    for (const contact of contacts ?? []) {
      const stage = contact.stage ?? 'lead';
      if (!pipeline[stage]) {
        pipeline[stage] = { stage, count: 0, total_deal_value: 0, contacts: [] };
      }
      pipeline[stage].count++;
      pipeline[stage].total_deal_value += contact.deal_value ?? 0;
      pipeline[stage].contacts.push({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        company: contact.company,
        deal_value: contact.deal_value,
        score: contact.score,
        last_contacted_at: contact.last_contacted_at,
        last_activity: contact.last_activity,
      });
    }

    // Load custom pipeline config if exists
    const { data: pipelineConfig } = await supabase
      .from('crm_pipelines')
      .select('*')
      .eq('org_id', orgId)
      .limit(1)
      .single();

    // Summary stats
    const totalContacts = contacts?.length ?? 0;
    const totalDealValue = (contacts ?? []).reduce((sum, c) => sum + (c.deal_value ?? 0), 0);
    const avgScore = totalContacts > 0
      ? Math.round((contacts ?? []).reduce((sum, c) => sum + (c.score ?? 0), 0) / totalContacts)
      : 0;

    return NextResponse.json({
      pipeline: Object.values(pipeline).filter(s => s.count > 0 || ['lead', 'prospect', 'qualified', 'proposal', 'negotiation', 'won'].includes(s.stage)),
      summary: {
        total_contacts: totalContacts,
        total_deal_value: totalDealValue,
        avg_score: avgScore,
      },
      config: pipelineConfig ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
