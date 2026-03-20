/**
 * CRM Auto-Sync — runs during pipeline ingestion
 *
 * Called from the integration data pump (collect.ts) after pulling fresh data.
 * Syncs contacts from all integration sources and scores them.
 */

import {
  syncContactsFromStripe,
  syncContactsFromGmail,
  syncContactsFromSlack,
  scoreContacts,
} from './engine';

/**
 * Sync all CRM data from connected integrations.
 * Runs all sync functions in parallel, then scores all contacts.
 * Deduplication is handled inside each sync function (by email).
 */
export async function syncAllCRMData(orgId: string): Promise<{
  stripe: number;
  gmail: number;
  slack: number;
  scored: number;
}> {
  console.log(`[CRM] Starting full sync for org ${orgId}`);

  // Run all syncs in parallel — each function deduplicates by email
  const [stripe, gmail, slack] = await Promise.allSettled([
    syncContactsFromStripe(orgId),
    syncContactsFromGmail(orgId),
    syncContactsFromSlack(orgId),
  ]);

  const stripeCount = stripe.status === 'fulfilled' ? stripe.value : 0;
  const gmailCount = gmail.status === 'fulfilled' ? gmail.value : 0;
  const slackCount = slack.status === 'fulfilled' ? slack.value : 0;

  if (stripe.status === 'rejected') console.warn('[CRM] Stripe sync failed:', stripe.reason);
  if (gmail.status === 'rejected') console.warn('[CRM] Gmail sync failed:', gmail.reason);
  if (slack.status === 'rejected') console.warn('[CRM] Slack sync failed:', slack.reason);

  // Score all contacts after syncing
  let scored = 0;
  try {
    scored = await scoreContacts(orgId);
  } catch (err) {
    console.warn('[CRM] Contact scoring failed:', err instanceof Error ? err.message : err);
  }

  const total = stripeCount + gmailCount + slackCount;
  console.log(`[CRM] Full sync complete: ${total} contacts synced (Stripe: ${stripeCount}, Gmail: ${gmailCount}, Slack: ${slackCount}), ${scored} scored`);

  return { stripe: stripeCount, gmail: gmailCount, slack: slackCount, scored };
}
