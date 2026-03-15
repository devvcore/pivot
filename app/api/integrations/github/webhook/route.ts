// ═══════════════════════════════════════════════════════════════
// Pivot — GitHub Webhook Receiver
// Accepts push, pull_request, pull_request_review events
// and stores them for the scoring engine to consume.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

// Verify GitHub webhook signature
function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if no secret configured
  if (!signature) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

// Map GitHub org/user to our org_id
async function resolveOrgId(installationOwner: string): Promise<string | null> {
  const supabase = createAdminClient();

  // Look up by GitHub org/user stored in integration metadata
  const { data } = await supabase
    .from('integrations')
    .select('org_id')
    .eq('provider', 'github')
    .eq('status', 'connected')
    .limit(10);

  if (!data || data.length === 0) return null;

  // Check metadata for matching GitHub org
  for (const row of data) {
    // For now, return the first connected GitHub integration
    // In production, match by metadata.github_org === installationOwner
    return row.org_id;
  }

  return data[0]?.org_id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const eventType = req.headers.get('x-github-event');

    // Verify webhook signature
    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);

    // Only process events we care about
    const supportedEvents = ['push', 'pull_request', 'pull_request_review', 'check_run'];
    if (!eventType || !supportedEvents.includes(eventType)) {
      return NextResponse.json({ status: 'ignored', event: eventType });
    }

    // Resolve which org this belongs to
    const repoOwner = payload.repository?.owner?.login ?? payload.organization?.login ?? '';
    const orgId = await resolveOrgId(repoOwner);

    if (!orgId) {
      return NextResponse.json({ status: 'no_matching_org' });
    }

    // Store the webhook event
    const supabase = createAdminClient();
    await supabase.from('integration_webhook_events').insert({
      org_id: orgId,
      provider: 'github',
      event_type: eventType,
      external_id: payload.delivery ?? `${eventType}_${Date.now()}`,
      payload: {
        // Slim down the payload to relevant data
        action: payload.action,
        repository: {
          full_name: payload.repository?.full_name,
          name: payload.repository?.name,
        },
        ...(eventType === 'push' ? {
          ref: payload.ref,
          commits: (payload.commits ?? []).map((c: any) => ({
            id: c.id,
            message: c.message?.slice(0, 200),
            author: { username: c.author?.username, name: c.author?.name },
            timestamp: c.timestamp,
            added: c.added?.length ?? 0,
            modified: c.modified?.length ?? 0,
            removed: c.removed?.length ?? 0,
          })),
          pusher: payload.pusher?.name,
        } : {}),
        ...(eventType === 'pull_request' ? {
          pull_request: {
            number: payload.pull_request?.number,
            title: payload.pull_request?.title,
            state: payload.pull_request?.state,
            merged: payload.pull_request?.merged,
            user: { login: payload.pull_request?.user?.login },
            created_at: payload.pull_request?.created_at,
            merged_at: payload.pull_request?.merged_at,
            additions: payload.pull_request?.additions,
            deletions: payload.pull_request?.deletions,
          },
        } : {}),
        ...(eventType === 'pull_request_review' ? {
          review: {
            state: payload.review?.state,
            user: { login: payload.review?.user?.login },
            submitted_at: payload.review?.submitted_at,
          },
          pull_request: {
            number: payload.pull_request?.number,
            user: { login: payload.pull_request?.user?.login },
            created_at: payload.pull_request?.created_at,
          },
        } : {}),
        ...(eventType === 'check_run' ? {
          check_run: {
            name: payload.check_run?.name,
            conclusion: payload.check_run?.conclusion,
            head_sha: payload.check_run?.head_sha,
          },
        } : {}),
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ status: 'stored', event: eventType });
  } catch (err) {
    console.error('[github-webhook] Error:', err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 },
    );
  }
}
