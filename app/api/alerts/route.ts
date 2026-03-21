// ═══════════════════════════════════════════════════════════════
// /api/alerts — List and manage proactive alerts
// GET:   list alerts for org (unread first)
// PATCH: mark alert(s) as read
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** Resolve orgId from query param or organization ownership */
async function resolveOrgId(
  request: NextRequest,
  userId: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  // 1. Accept orgId from query param
  const qsOrgId = request.nextUrl.searchParams.get('orgId');
  if (qsOrgId) return qsOrgId;

  // 2. Look up organization owned by this user
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', userId)
    .limit(1)
    .single();

  return org?.id ?? null;
}

// ── GET: list alerts ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  const orgId = await resolveOrgId(request, auth.user.id, supabase);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 });
  }

  // Parse query params
  const url = new URL(request.url);
  const severity = url.searchParams.get('severity'); // filter by severity
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  let query = supabase
    .from('alerts')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('read', { ascending: true })      // unread first
    .order('created_at', { ascending: false }) // newest first within each group
    .range(offset, offset + limit - 1);

  if (severity) {
    query = query.eq('severity', severity);
  }
  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data: alerts, count, error } = await query;

  if (error) {
    console.error('[api/alerts] GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also return unread count for badge
  const { count: unreadCount } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('read', false);

  return NextResponse.json({
    alerts: alerts ?? [],
    total: count ?? 0,
    unreadCount: unreadCount ?? 0,
  });
}

// ── PATCH: mark alerts as read ───────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  const orgId = await resolveOrgId(request, auth.user.id, supabase);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 });
  }

  let body: { alertIds?: string[]; markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.markAllRead) {
    // Mark all unread alerts as read
    const { error, count } = await supabase
      .from('alerts')
      .update({ read: true, read_at: now })
      .eq('org_id', orgId)
      .eq('read', false);

    if (error) {
      console.error('[api/alerts] PATCH markAllRead error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: count ?? 0 });
  }

  if (body.alertIds && Array.isArray(body.alertIds) && body.alertIds.length > 0) {
    // Mark specific alerts as read (scoped to org)
    const { error, count } = await supabase
      .from('alerts')
      .update({ read: true, read_at: now })
      .eq('org_id', orgId)
      .in('id', body.alertIds);

    if (error) {
      console.error('[api/alerts] PATCH alertIds error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: count ?? 0 });
  }

  return NextResponse.json({ error: 'Provide alertIds or markAllRead' }, { status: 400 });
}
