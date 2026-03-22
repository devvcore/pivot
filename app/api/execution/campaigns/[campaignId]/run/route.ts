import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { CampaignEngine } from '@/lib/execution/campaign-engine';

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * POST /api/execution/campaigns/[campaignId]/run
 * Start executing a campaign. Fire and forget — returns immediately while the
 * campaign runs asynchronously in the background.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  try {
    const { campaignId } = await context.params;

    const engine = new CampaignEngine();

    // Verify campaign exists and is in a runnable state
    const campaign = await engine.getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status === 'running') {
      return NextResponse.json({ error: 'Campaign is already running' }, { status: 409 });
    }

    if (['completed', 'failed', 'cancelled'].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Campaign is already ${campaign.status} and cannot be started` },
        { status: 409 }
      );
    }

    // Fire and forget — run campaign asynchronously
    engine.runCampaign(campaignId).catch((err: Error) => {
      console.error(`[POST /api/execution/campaigns/${campaignId}/run] Campaign failed:`, err.message);
    });

    return NextResponse.json({ success: true, campaignId, message: 'Campaign started' });
  } catch (err) {
    console.error('[POST /api/execution/campaigns/[campaignId]/run]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start campaign' },
      { status: 500 }
    );
  }
}
