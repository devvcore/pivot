import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/supabase/auth-api';

/**
 * GET /api/crm/contacts?orgId=...&stage=...&search=...&tags=...&sort=...&limit=...&offset=...
 * List contacts with filters.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const orgId = searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const stage = searchParams.get('stage');
  const search = searchParams.get('search');
  const tags = searchParams.get('tags'); // comma-separated
  const sort = searchParams.get('sort') ?? 'score'; // score, name, deal_value, last_contacted_at, created_at
  const order = searchParams.get('order') ?? 'desc';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    const supabase = createAdminClient();

    let query = supabase
      .from('crm_contacts')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId);

    if (stage) {
      query = query.eq('stage', stage);
    }

    if (search) {
      // Use OR filter across name, email, company
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
    }

    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        query = query.overlaps('tags', tagList);
      }
    }

    const validSorts = ['score', 'name', 'deal_value', 'last_contacted_at', 'created_at', 'updated_at'];
    const sortField = validSorts.includes(sort) ? sort : 'score';
    query = query.order(sortField, { ascending: order === 'asc' });

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contacts: data ?? [], total: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/crm/contacts — create a contact manually
 * Body: { orgId, name, email?, phone?, company?, title?, stage?, deal_value?, tags?, notes? }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { orgId, name, email, phone, company, title, stage, deal_value, tags, notes } = body;

    if (!orgId || !name) {
      return NextResponse.json({ error: 'orgId and name are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check for duplicate email
    if (email) {
      const { data: existing } = await supabase
        .from('crm_contacts')
        .select('id')
        .eq('org_id', orgId)
        .eq('email', email.toLowerCase().trim())
        .limit(1)
        .single();

      if (existing?.id) {
        return NextResponse.json({ error: 'Contact with this email already exists', existingId: existing.id }, { status: 409 });
      }
    }

    const { data, error } = await supabase
      .from('crm_contacts')
      .insert({
        org_id: orgId,
        name,
        email: email?.toLowerCase().trim() ?? null,
        phone: phone ?? null,
        company: company ?? null,
        title: title ?? null,
        source: 'manual',
        stage: stage ?? 'lead',
        deal_value: deal_value ?? null,
        tags: tags ?? [],
        notes: notes ?? null,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log creation activity
    await supabase.from('crm_activities').insert({
      org_id: orgId,
      contact_id: data.id,
      type: 'note',
      title: 'Contact created manually',
      description: notes ?? null,
      automated: false,
    });

    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/crm/contacts — update a contact
 * Body: { contactId, stage?, notes?, tags?, deal_value?, next_followup_at?, followup_note?, assigned_to? }
 */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { contactId, ...updates } = body;

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify contact exists
    const { data: existing } = await supabase
      .from('crm_contacts')
      .select('id, org_id, stage')
      .eq('id', contactId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Build update object with only allowed fields
    const allowedFields = ['name', 'email', 'phone', 'company', 'title', 'stage', 'deal_value', 'currency', 'tags', 'notes', 'next_followup_at', 'followup_note', 'assigned_to', 'website', 'linkedin_url'];
    const updateObj: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateObj[field] = updates[field];
      }
    }

    const { data, error } = await supabase
      .from('crm_contacts')
      .update(updateObj)
      .eq('id', contactId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log stage change if applicable
    if (updates.stage && updates.stage !== existing.stage) {
      await supabase.from('crm_activities').insert({
        org_id: existing.org_id,
        contact_id: contactId,
        type: 'stage_change',
        title: `Stage: ${existing.stage} → ${updates.stage}`,
        description: updates.stageReason ?? null,
        automated: false,
      });
    }

    // Log deal update if applicable
    if (updates.deal_value !== undefined) {
      await supabase.from('crm_activities').insert({
        org_id: existing.org_id,
        contact_id: contactId,
        type: 'deal_update',
        title: `Deal value updated to $${Number(updates.deal_value).toLocaleString()}`,
        automated: false,
      });
    }

    return NextResponse.json({ contact: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
