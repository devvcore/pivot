/**
 * POST /api/execution/wide
 *
 * Wide Execution — run the same task across multiple items in parallel.
 * Inspired by Manus AI's "Wide Research" pattern.
 *
 * Body: { orgId, task, items: string[], agentId?, costCeiling?, conversationId? }
 *
 * If `items` is not provided but the task message contains a list,
 * we auto-detect and split using wide-executor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { createOrchestrator } from '@/lib/execution/orchestrator';
import { collectIntegrationContext, formatIntegrationContextAsText } from '@/lib/integrations/collect';
import { splitIntoItems, MAX_WIDE_ITEMS } from '@/lib/execution/wide-executor';
import { v4 as uuidv4 } from 'uuid';

const VALID_AGENTS = [
  'strategist', 'marketer', 'analyst', 'recruiter',
  'operator', 'researcher', 'codebot',
];

/* ── Keyword fallback router (same as batch/route.ts) ── */
function autoRouteAgent(message: string): string {
  const lower = message.toLowerCase();
  const keywords: [string[], string][] = [
    [['linkedin', 'instagram', 'social', 'post', 'content', 'ad ', 'campaign', 'seo', 'landing page', 'email campaign', 'marketing', 'brand'], 'marketer'],
    [['budget', 'invoice', 'financial', 'forecast', 'pricing', 'expense', 'revenue', 'cash', 'profit', 'burn rate', 'unit economics'], 'analyst'],
    [['hire', 'job posting', 'interview', 'salary', 'onboard', 'recruit', 'talent', 'performance review', 'hr '], 'recruiter'],
    [['process', 'sop', 'risk', 'vendor', 'project plan', 'operations', 'workflow', 'compliance'], 'operator'],
    [['research', 'competitor', 'market', 'benchmark', 'trend', 'industry', 'analyze'], 'researcher'],
    [['code', 'github', 'repo', 'pull request', 'ci/cd', 'engineer', 'deploy', 'bug'], 'codebot'],
    [['strategy', 'plan', 'goal', 'okr', 'prioritize', 'roadmap', 'coordinate'], 'strategist'],
  ];
  for (const [words, agent] of keywords) {
    if (words.some((w) => lower.includes(w))) return agent;
  }
  return 'strategist';
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const {
      orgId,
      task,
      items: providedItems,
      agentId: requestedAgent,
      costCeiling,
      conversationId,
    } = body as {
      orgId?: string;
      task?: string;
      items?: string[];
      agentId?: string;
      costCeiling?: number;
      conversationId?: string;
    };

    if (!orgId || !task) {
      return NextResponse.json({ error: 'orgId and task are required' }, { status: 400 });
    }

    // ── 1. Resolve items ──
    let items: string[];
    let taskTemplate: string;

    if (providedItems && Array.isArray(providedItems) && providedItems.length > 0) {
      items = providedItems.slice(0, MAX_WIDE_ITEMS);
      taskTemplate = task;
    } else {
      // Auto-detect items from the task message
      const split = await splitIntoItems(task, orgId);
      items = split.items;
      taskTemplate = split.taskTemplate;

      if (items.length === 0) {
        return NextResponse.json(
          { error: 'Could not detect items for wide execution. Provide an explicit items array or include a list in your task.' },
          { status: 400 }
        );
      }

      console.log(`[POST /api/execution/wide] Auto-detected ${items.length} items (source: ${split.source})`);
    }

    if (items.length > MAX_WIDE_ITEMS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_WIDE_ITEMS} items per wide execution request` },
        { status: 400 }
      );
    }

    console.log(`[POST /api/execution/wide] "${task.slice(0, 60)}..." → ${items.length} items`);

    // ── 2. Load deliverables and integration context ──
    const supabase = createAdminClient();
    let deliverables: Record<string, unknown> | undefined;

    const { data: latestJob } = await supabase
      .from('jobs')
      .select('results_json')
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestJob?.results_json) {
      deliverables = latestJob.results_json as Record<string, unknown>;
    }

    const integrationCtx = await collectIntegrationContext(orgId);
    const integrationText = formatIntegrationContextAsText(integrationCtx);
    if (integrationCtx.providers.length > 0) {
      if (!deliverables) deliverables = {};
      deliverables.__integrationData = integrationText;
      deliverables.__integrationProviders = integrationCtx.providers;
    }

    // ── 3. Resolve agent ──
    const agentId = (requestedAgent && VALID_AGENTS.includes(requestedAgent))
      ? requestedAgent
      : autoRouteAgent(task);

    // ── 4. Create tasks for each item and fire pipelines ──
    const wideId = uuidv4();
    const taskCeiling = costCeiling ?? 0.50;

    const createdTasks: { id: string; title: string; agentId: string; status: string; item: string }[] = [];

    // Build per-item task title
    const buildItemTitle = (item: string): string => {
      // If template has [ITEM] placeholder, replace it
      if (taskTemplate.includes('[ITEM]')) {
        return taskTemplate.replace(/\[ITEM\]/g, item);
      }
      // Otherwise append the item
      return `${taskTemplate} — ${item}`;
    };

    // Create all tasks first (sequential DB inserts to avoid conflicts)
    for (const item of items) {
      const title = buildItemTitle(item);

      const { data: taskRow, error: insertError } = await supabase
        .from('execution_tasks')
        .insert({
          org_id: orgId,
          title,
          agent_id: agentId,
          priority: 'medium',
          cost_ceiling: taskCeiling,
          status: 'queued',
        })
        .select('id, title, agent_id, status')
        .single();

      if (insertError || !taskRow) {
        console.error('[POST /api/execution/wide] Insert error:', insertError?.message);
        continue;
      }

      // Log session_start with wide context
      await supabase.from('execution_events').insert({
        task_id: taskRow.id,
        agent_id: agentId,
        org_id: orgId,
        event_type: 'session_start',
        data: {
          userMessage: task,
          source: 'wide',
          wideId,
          item,
          itemIndex: items.indexOf(item),
          totalItems: items.length,
          conversationId: conversationId || undefined,
        },
      });

      await supabase.from('execution_events').insert({
        task_id: taskRow.id,
        agent_id: agentId,
        org_id: orgId,
        event_type: 'status_change',
        data: { from: null, to: 'queued', title, wideId },
      });

      createdTasks.push({
        id: taskRow.id,
        title: taskRow.title,
        agentId: taskRow.agent_id,
        status: taskRow.status,
        item,
      });
    }

    // Fire all pipelines in parallel (non-blocking)
    const pipelinePromises = createdTasks.map((ct) => {
      const orchestrator = createOrchestrator(deliverables);
      return orchestrator.runPipeline(ct.id).catch(async (err: Error) => {
        console.error(`[POST /api/execution/wide] Pipeline failed for ${ct.id} (${ct.item}):`, err.message);
        try {
          await supabase
            .from('execution_tasks')
            .update({ status: 'failed', review_feedback: err.message })
            .eq('id', ct.id);
          await supabase.from('execution_events').insert({
            task_id: ct.id,
            agent_id: agentId,
            org_id: orgId,
            event_type: 'error',
            data: { error: err.message, phase: 'pipeline', wideId },
          });
        } catch { /* best-effort status update */ }
      });
    });

    // Don't await — let them run in background
    Promise.allSettled(pipelinePromises).then((results) => {
      const failed = results.filter(r => r.status === 'rejected').length;
      console.log(`[POST /api/execution/wide] All ${items.length} pipelines settled (${failed} failed)`);
    });

    return NextResponse.json(
      {
        tasks: createdTasks,
        wideId,
        itemCount: createdTasks.length,
        agentId,
        taskTemplate,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/execution/wide]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process wide execution' },
      { status: 500 }
    );
  }
}
