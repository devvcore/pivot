import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { syncAllCRMData } from '@/lib/crm/auto-sync';

/**
 * POST /api/crm/sync — trigger manual CRM sync from integrations
 * Body: { orgId }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    const results = await syncAllCRMData(orgId);

    return NextResponse.json({
      success: true,
      synced: {
        stripe: results.stripe,
        gmail: results.gmail,
        slack: results.slack,
        total: results.stripe + results.gmail + results.slack,
      },
      scored: results.scored,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
