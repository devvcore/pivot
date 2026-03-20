/**
 * PM Board API — Kanban board data grouped by status
 *
 * GET /api/pm/board?orgId=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { getTicketBoard } from '@/lib/pm/ticket-engine';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const orgId = request.nextUrl.searchParams.get('orgId');
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    const columns = await getTicketBoard(orgId);
    const total = columns.reduce((sum, col) => sum + col.count, 0);

    return NextResponse.json({ columns, total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
