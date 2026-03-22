import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { CampaignEngine } from '@/lib/execution/campaign-engine';

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * GET /api/execution/campaigns/[campaignId]
 * Get campaign details including all steps.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  try {
    const { campaignId } = await context.params;

    const engine = new CampaignEngine();
    const campaign = await engine.getCampaign(campaignId);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const steps = await engine.getCampaignSteps(campaignId);

    return NextResponse.json({ campaign, steps });
  } catch (err) {
    console.error('[GET /api/execution/campaigns/[campaignId]]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch campaign' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/execution/campaigns/[campaignId]
 * Cancel a campaign (soft cancel — marks it cancelled, stops new steps from launching).
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  try {
    const { campaignId } = await context.params;

    const engine = new CampaignEngine();

    // Verify campaign exists before cancelling
    const campaign = await engine.getCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    await engine.cancelCampaign(campaignId);

    return NextResponse.json({ success: true, campaignId });
  } catch (err) {
    console.error('[DELETE /api/execution/campaigns/[campaignId]]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to cancel campaign' },
      { status: 500 }
    );
  }
}
