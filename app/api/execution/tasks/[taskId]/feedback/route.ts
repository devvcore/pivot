import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { processFeedback, getAgentPerformance } from '@/lib/execution/feedback';

type RouteContext = { params: Promise<{ taskId: string }> };

/**
 * POST /api/execution/tasks/[taskId]/feedback
 * Submit user feedback on a completed task.
 *
 * Body: {
 *   orgId: string,
 *   rating?: number (1-5),
 *   thumbs?: 'up' | 'down',
 *   feedbackText?: string,
 *   corrections?: string,
 * }
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  try {
    const { taskId } = await context.params;
    const body = await req.json();
    const { orgId, rating, thumbs, feedbackText, corrections } = body;

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
    }

    if (thumbs !== undefined && thumbs !== 'up' && thumbs !== 'down') {
      return NextResponse.json({ error: 'thumbs must be "up" or "down"' }, { status: 400 });
    }

    // Get task to find agent
    const supabase = createAdminClient();
    const { data: task } = await supabase
      .from('execution_tasks')
      .select('agent_id, title, result')
      .eq('id', taskId)
      .single();

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const result = await processFeedback(
      { taskId, orgId, userId: auth.user.id, rating, thumbs, feedbackText, corrections },
      task.agent_id,
      task.title,
      task.result ?? '',
    );

    return NextResponse.json({ success: true, lessonsExtracted: result.lessonsExtracted });
  } catch (err) {
    console.error('[POST /api/execution/tasks/[taskId]/feedback]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process feedback' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/execution/tasks/[taskId]/feedback?orgId=...
 * Get existing feedback for a task.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  try {
    const { taskId } = await context.params;
    const { searchParams } = req.nextUrl;
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: feedback, error } = await supabase
      .from('task_feedback')
      .select('*')
      .eq('task_id', taskId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feedback: feedback ?? [] });
  } catch (err) {
    console.error('[GET /api/execution/tasks/[taskId]/feedback]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch feedback' },
      { status: 500 },
    );
  }
}
