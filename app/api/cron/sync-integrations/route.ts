// ═══════════════════════════════════════════════════════════════
// GET /api/cron/sync-integrations
// Cron endpoint for scheduled background syncs.
// Called by Vercel cron (hourly) or an external scheduler.
// Verifies CRON_SECRET header for security.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { runScheduledSync } from '@/lib/integrations/sync-engine';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for cron jobs

export async function GET(req: Request) {
  try {
    // ─── Verify cron secret ─────────────────────────────────────────────────
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      const providedSecret =
        authHeader?.replace('Bearer ', '') ??
        new URL(req.url).searchParams.get('secret');

      if (providedSecret !== cronSecret) {
        console.warn('[cron/sync-integrations] Unauthorized request');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // ─── Run scheduled sync ─────────────────────────────────────────────────
    console.log('[cron/sync-integrations] Starting scheduled sync...');
    const startTime = Date.now();

    const result = await runScheduledSync();

    const durationMs = Date.now() - startTime;
    console.log(
      `[cron/sync-integrations] Completed in ${durationMs}ms: ${result.synced} synced, ${result.errors} errors`
    );

    return NextResponse.json({
      success: true,
      ...result,
      durationMs,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron/sync-integrations] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Cron sync failed',
      },
      { status: 500 }
    );
  }
}
