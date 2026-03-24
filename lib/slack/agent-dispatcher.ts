/**
 * Agent Dispatcher — Routes Slack agent task requests and campaign commands
 * to the Pivot execution engine.
 */

import { Orchestrator } from '@/lib/execution/orchestrator';
import { CampaignEngine } from '@/lib/execution/campaign-engine';
import { getCampaignTemplate, listCampaignTemplates } from '@/lib/execution/campaign-templates';
import { section, fieldsSection, divider, context, header, type SlackBlock } from './block-kit';

// ── Agent Task Dispatcher ─────────────────────────────────────────────────────

/**
 * Dispatch an agent task through the orchestrator and return Slack blocks
 * summarizing the outcome.
 */
export async function dispatchAgentTask(
  orgId: string,
  agentId: string,
  taskTitle: string,
  taskDescription: string,
): Promise<SlackBlock[]> {
  const orchestrator = new Orchestrator();

  const taskId = await orchestrator.submitTask({
    orgId,
    title: taskTitle,
    description: taskDescription,
    agentId,
    priority: 'medium',
    acceptanceCriteria: [],
    maxAttempts: 3,
    costCeiling: 2.0,
  });

  const task = await orchestrator.runPipeline(taskId);

  const agentLabel = agentId.charAt(0).toUpperCase() + agentId.slice(1);

  if (task.status === 'completed') {
    const result = task.result ?? 'Task completed successfully.';
    const truncated = result.length > 2800 ? result.slice(0, 2800) + '…' : result;
    const costStr = task.costSpent != null ? `$${task.costSpent.toFixed(4)}` : 'n/a';

    return [
      header(`✅ ${agentLabel} — ${taskTitle}`),
      section(truncated),
      divider(),
      context([`Cost: ${costStr}`, `Task ID: ${task.id}`]),
    ];
  } else {
    const feedback = task.reviewFeedback ?? task.result ?? 'Task did not complete.';

    return [
      header(`❌ ${agentLabel} — ${taskTitle}`),
      section(feedback),
      divider(),
      context([`Task ID: ${task.id}`]),
    ];
  }
}

// ── Campaign Command Handler ──────────────────────────────────────────────────

const engine = new CampaignEngine();

/**
 * Handle a campaign command from Slack and return Block Kit blocks.
 *
 * Supported actions: launch, list, status, pause, cancel
 */
export async function handleCampaignCommand(
  orgId: string,
  action: 'launch' | 'list' | 'status' | 'pause' | 'cancel',
  templateId?: string,
  campaignId?: string,
): Promise<SlackBlock[]> {
  switch (action) {
    case 'launch':
      return handleLaunch(orgId, templateId);

    case 'list':
      return handleList(orgId);

    case 'status':
      return handleStatus(orgId, campaignId);

    case 'pause':
      return handlePause(orgId, campaignId);

    case 'cancel':
      return handleCancel(orgId, campaignId);

    default:
      return [section(`Unknown campaign action: ${action}`)];
  }
}

// ── Action Handlers ───────────────────────────────────────────────────────────

async function handleLaunch(orgId: string, templateId?: string): Promise<SlackBlock[]> {
  if (!templateId) {
    // Show available templates
    const templates = listCampaignTemplates();
    const lines = templates.map(
      (t) => `• *${t.name}* (\`${t.id}\`) — ${t.description.slice(0, 80)}…  _${t.estimatedDuration}_`,
    );
    return [
      header('Available Campaign Templates'),
      section(lines.join('\n')),
      divider(),
      section('To launch a campaign, use:\n`/pivot campaign launch <template-id>`'),
    ];
  }

  const template = getCampaignTemplate(templateId);
  if (!template) {
    return [section(`Template \`${templateId}\` not found. Run \`/pivot campaign launch\` to see available templates.`)];
  }

  // Create the campaign
  const campaign = await engine.createCampaign(
    orgId,
    template.name,
    template.steps.map((s, idx) => ({
      stepOrder: idx + 1,
      title: s.title,
      description: s.description,
      agentId: s.agentId,
      dependsOn: s.dependsOn,
      delayMinutes: s.delayMinutes,
    })),
    {
      templateId: template.id,
      description: template.description,
    },
  );

  // Fire campaign execution in background — do not await
  engine.runCampaign(campaign.id).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[agent-dispatcher] Background campaign ${campaign.id} failed: ${msg}`);
  });

  const stepLines = template.steps.map((s, idx) => `${idx + 1}. *${s.title}* (${s.agentId})`);

  return [
    header(`Campaign launched: ${template.name}`),
    section(template.description),
    divider(),
    section('*Steps:*\n' + stepLines.join('\n')),
    divider(),
    context([
      `Campaign ID: ${campaign.id}`,
      `Estimated duration: ${template.estimatedDuration}`,
      `Use \`/pivot campaign status ${campaign.id}\` to check progress`,
    ]),
  ];
}

async function handleList(orgId: string): Promise<SlackBlock[]> {
  const campaigns = await engine.listCampaigns(orgId);

  if (campaigns.length === 0) {
    return [section('No campaigns found. Start one with `/pivot campaign launch`.')];
  }

  const shown = campaigns.slice(0, 5);
  const pairs: [string, string][] = shown.map((c) => {
    const progress = `${c.completedSteps}/${c.totalSteps} steps`;
    return [c.title, `${c.status} | ${progress}`];
  });

  const blocks: SlackBlock[] = [
    header('Campaigns'),
    fieldsSection(pairs),
  ];

  if (campaigns.length > 5) {
    blocks.push(context([`Showing 5 of ${campaigns.length} campaigns`]));
  }

  return blocks;
}

async function handleStatus(orgId: string, campaignId?: string): Promise<SlackBlock[]> {
  let resolvedId = campaignId;

  if (!resolvedId) {
    const running = await engine.listCampaigns(orgId, 'running');
    if (running.length === 0) {
      return [section('No running campaigns found.')];
    }
    resolvedId = running[0].id;
  }

  const campaign = await engine.getCampaign(resolvedId);
  if (!campaign) {
    return [section(`Campaign \`${resolvedId}\` not found.`)];
  }

  const steps = await engine.getCampaignSteps(resolvedId);

  const stepLines = steps.map((s) => {
    const emoji = s.status === 'completed'
      ? ':white_check_mark:'
      : s.status === 'running'
        ? ':hourglass_flowing_sand:'
        : s.status === 'failed'
          ? ':x:'
          : ':black_small_square:';
    return `${emoji} ${s.title}`;
  });

  return [
    header(`Campaign: ${campaign.title}`),
    fieldsSection([
      ['Status', campaign.status],
      ['Progress', `${campaign.completedSteps}/${campaign.totalSteps} steps`],
    ]),
    divider(),
    section('*Step Progress:*\n' + stepLines.join('\n')),
    divider(),
    context([`Campaign ID: ${campaign.id}`]),
  ];
}

async function handlePause(orgId: string, campaignId?: string): Promise<SlackBlock[]> {
  let resolvedId = campaignId;

  if (!resolvedId) {
    const running = await engine.listCampaigns(orgId, 'running');
    if (running.length === 0) {
      return [section('No running campaigns to pause.')];
    }
    resolvedId = running[0].id;
  }

  await engine.pauseCampaign(resolvedId);
  return [
    section(`:double_vertical_bar: Campaign paused.`),
    context([`Campaign ID: ${resolvedId}`]),
  ];
}

async function handleCancel(orgId: string, campaignId?: string): Promise<SlackBlock[]> {
  let resolvedId = campaignId;

  if (!resolvedId) {
    const running = await engine.listCampaigns(orgId, 'running');
    if (running.length === 0) {
      return [section('No running campaigns to cancel.')];
    }
    resolvedId = running[0].id;
  }

  await engine.cancelCampaign(resolvedId);
  return [
    section(`:x: Campaign cancelled.`),
    context([`Campaign ID: ${resolvedId}`]),
  ];
}
