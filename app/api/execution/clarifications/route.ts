/**
 * POST /api/execution/clarifications
 *
 * Submit a user's response to a clarification question.
 * Called when user clicks an option button in the ExecutionDashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { respondToClarification } from '@/lib/execution/clarifier';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { clarificationId, response } = body;

  if (!clarificationId || !response) {
    return NextResponse.json(
      { error: 'clarificationId and response are required' },
      { status: 400 },
    );
  }

  try {
    await respondToClarification(clarificationId, response);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Clarifications API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to save response' },
      { status: 500 },
    );
  }
}
