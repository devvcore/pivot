import { NextResponse } from 'next/server';
import { listCampaignTemplates } from '@/lib/execution/campaign-templates';

/**
 * GET /api/execution/campaigns/templates
 * List all available campaign templates. No auth required.
 */
export async function GET() {
  const templates = listCampaignTemplates();
  return NextResponse.json({ templates });
}
