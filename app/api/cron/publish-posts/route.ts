import { NextRequest, NextResponse } from 'next/server';
import { publishDuePosts } from '@/lib/execution/post-scheduler';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await publishDuePosts();
  return NextResponse.json({ ...result, timestamp: new Date().toISOString() });
}
