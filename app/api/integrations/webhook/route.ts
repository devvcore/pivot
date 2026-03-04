// ═══════════════════════════════════════════════════════════════
// POST /api/integrations/webhook
// Universal webhook handler for provider events.
// Verifies signatures, processes events incrementally.
// Supports: Slack, Stripe, Jira webhooks.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

// ─── Slack Signature Verification ───────────────────────────────────────────

function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex');
  const expectedSignature = `v0=${hmac}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// ─── Stripe Signature Verification ──────────────────────────────────────────

function verifyStripeSignature(
  body: string,
  signatureHeader: string
): boolean {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  // Parse Stripe signature header
  const parts = signatureHeader.split(',');
  const timestamp = parts
    .find((p) => p.startsWith('t='))
    ?.substring(2);
  const sig = parts
    .find((p) => p.startsWith('v1='))
    ?.substring(3);

  if (!timestamp || !sig) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const payload = `${timestamp}.${body}`;
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(sig),
    Buffer.from(expectedSig)
  );
}

// ─── Jira Signature Verification ────────────────────────────────────────────

function verifyJiraSignature(
  body: string,
  signatureHeader: string
): boolean {
  const webhookSecret = process.env.JIRA_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

// ─── Detect Provider from Headers / Body ────────────────────────────────────

type WebhookProvider = 'slack' | 'stripe' | 'jira' | 'unknown';

function detectProvider(headers: Headers): WebhookProvider {
  if (headers.get('x-slack-signature')) return 'slack';
  if (headers.get('stripe-signature')) return 'stripe';
  if (headers.get('x-atlassian-webhook-identifier')) return 'jira';
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers = req.headers;
  const provider = detectProvider(headers);

  if (provider === 'unknown') {
    return NextResponse.json(
      { error: 'Unknown webhook provider. Expected Slack, Stripe, or Jira headers.' },
      { status: 400 }
    );
  }

  try {
    switch (provider) {
      case 'slack':
        return await handleSlackWebhook(rawBody, headers);
      case 'stripe':
        return await handleStripeWebhook(rawBody, headers);
      case 'jira':
        return await handleJiraWebhook(rawBody, headers);
      default:
        return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }
  } catch (err) {
    console.error(`[webhook/${provider}] Error:`, err);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ─── Slack Webhook Handler ──────────────────────────────────────────────────

async function handleSlackWebhook(
  rawBody: string,
  headers: Headers
): Promise<NextResponse> {
  const timestamp = headers.get('x-slack-request-timestamp') ?? '';
  const signature = headers.get('x-slack-signature') ?? '';

  // Verify signature
  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    console.warn('[webhook/slack] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // Handle Slack URL verification challenge
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Handle event callbacks
  if (payload.type === 'event_callback') {
    const event = payload.event;
    const teamId = payload.team_id;

    console.log(
      `[webhook/slack] Event: ${event?.type} from team ${teamId}`
    );

    // Find the integration for this Slack team
    const supabase = createAdminClient();
    const { data: integration } = await supabase
      .from('integrations')
      .select()
      .eq('provider', 'slack')
      .contains('metadata', { teamId })
      .single();

    if (!integration) {
      console.warn(`[webhook/slack] No integration found for team ${teamId}`);
      return NextResponse.json({ ok: true }); // Acknowledge to avoid retries
    }

    // Process events incrementally
    switch (event?.type) {
      case 'message': {
        // Save message event for later analysis
        await supabase.from('integration_webhook_events').insert({
          integration_id: integration.id,
          org_id: integration.org_id,
          provider: 'slack',
          event_type: 'message',
          payload: event,
          processed: false,
        });
        break;
      }
      case 'channel_created':
      case 'channel_deleted':
      case 'member_joined_channel':
      case 'member_left_channel': {
        await supabase.from('integration_webhook_events').insert({
          integration_id: integration.id,
          org_id: integration.org_id,
          provider: 'slack',
          event_type: event.type,
          payload: event,
          processed: false,
        });
        break;
      }
      default:
        console.log(`[webhook/slack] Ignoring event type: ${event?.type}`);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

// ─── Stripe Webhook Handler ─────────────────────────────────────────────────

async function handleStripeWebhook(
  rawBody: string,
  headers: Headers
): Promise<NextResponse> {
  const signatureHeader = headers.get('stripe-signature') ?? '';

  // Verify signature
  if (!verifyStripeSignature(rawBody, signatureHeader)) {
    console.warn('[webhook/stripe] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  console.log(`[webhook/stripe] Event: ${event.type} (${event.id})`);

  // Find the Stripe integration by matching the account
  const supabase = createAdminClient();
  const accountId = event.account ?? event.data?.object?.account;

  let integrationQuery = supabase
    .from('integrations')
    .select()
    .eq('provider', 'stripe');

  if (accountId) {
    integrationQuery = integrationQuery.contains('metadata', {
      stripeAccountId: accountId,
    });
  }

  const { data: integration } = await integrationQuery.limit(1).single();

  // Process key Stripe events
  const relevantEvents = [
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'invoice.paid',
    'invoice.payment_failed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'charge.refunded',
    'charge.dispute.created',
  ];

  if (relevantEvents.includes(event.type)) {
    await supabase.from('integration_webhook_events').insert({
      integration_id: integration?.id ?? null,
      org_id: integration?.org_id ?? null,
      provider: 'stripe',
      event_type: event.type,
      payload: event.data?.object ?? event,
      processed: false,
    });
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}

// ─── Jira Webhook Handler ───────────────────────────────────────────────────

async function handleJiraWebhook(
  rawBody: string,
  headers: Headers
): Promise<NextResponse> {
  const signatureHeader = headers.get('x-hub-signature') ?? '';

  // Verify signature if secret is configured
  if (process.env.JIRA_WEBHOOK_SECRET) {
    if (!verifyJiraSignature(rawBody, signatureHeader)) {
      console.warn('[webhook/jira] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const payload = JSON.parse(rawBody);
  const webhookEvent = payload.webhookEvent ?? payload.eventType;

  console.log(`[webhook/jira] Event: ${webhookEvent}`);

  // Find the Jira integration
  const supabase = createAdminClient();
  const cloudId = payload.cloudId ?? payload.issue?.self?.match(/\/ex\/jira\/([^/]+)/)?.[1];

  let integrationQuery = supabase
    .from('integrations')
    .select()
    .eq('provider', 'jira');

  if (cloudId) {
    integrationQuery = integrationQuery.contains('metadata', { cloudId });
  }

  const { data: integration } = await integrationQuery.limit(1).single();

  // Process relevant Jira events
  const relevantEvents = [
    'jira:issue_created',
    'jira:issue_updated',
    'jira:issue_deleted',
    'sprint_created',
    'sprint_started',
    'sprint_closed',
    'board_created',
    'project_created',
  ];

  if (relevantEvents.includes(webhookEvent)) {
    await supabase.from('integration_webhook_events').insert({
      integration_id: integration?.id ?? null,
      org_id: integration?.org_id ?? null,
      provider: 'jira',
      event_type: webhookEvent,
      payload,
      processed: false,
    });
  }

  return NextResponse.json({ ok: true });
}
