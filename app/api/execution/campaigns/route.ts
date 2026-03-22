import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { CampaignEngine } from '@/lib/execution/campaign-engine';
import { getCampaignTemplate } from '@/lib/execution/campaign-templates';

/**
 * GET /api/execution/campaigns?orgId=...&status=...
 * List campaigns for an org with optional status filter.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  try {
    const orgId = req.nextUrl.searchParams.get('orgId');
    if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

    const engine = new CampaignEngine();
    const status = req.nextUrl.searchParams.get('status') as Parameters<typeof engine.listCampaigns>[1] | null;
    const campaigns = await engine.listCampaigns(orgId, status ?? undefined);
    return NextResponse.json({ campaigns });
  } catch (err) {
    console.error('[GET /api/execution/campaigns]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/execution/campaigns
 * Create a new campaign, optionally from a template.
 *
 * Body: {
 *   orgId: string,
 *   title?: string,
 *   description?: string,
 *   templateId?: string,
 *   steps?: StepInput[],
 *   triggerType?: 'manual' | 'scheduled' | 'event' | 'webhook',
 *   cronExpression?: string,
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { orgId, title, description, templateId, steps, triggerType, cronExpression } = body;

    if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

    const engine = new CampaignEngine();

    let campaignSteps = steps;
    if (templateId && !steps) {
      const template = getCampaignTemplate(templateId);
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      campaignSteps = template.steps;
    }

    if (!campaignSteps || campaignSteps.length === 0) {
      return NextResponse.json({ error: 'No steps provided' }, { status: 400 });
    }

    const campaign = await engine.createCampaign(
      orgId,
      title ?? `Campaign ${new Date().toLocaleDateString()}`,
      campaignSteps,
      {
        description,
        templateId,
        triggerType,
        cronExpression,
        createdBy: auth.user.id,
      }
    );

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/execution/campaigns]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create campaign' },
      { status: 500 }
    );
  }
}
