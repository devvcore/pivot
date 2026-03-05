import { task, logger } from "@trigger.dev/sdk";

/**
 * Autonomous agent heartbeat task. Implements BetterBot's 3-tier heartbeat:
 *
 *   Tier 1 (Cheap triage):   Check for pending tasks, events, triggers
 *   Tier 2 (Lightweight):    Handle simple actions (status updates, notifications)
 *   Tier 3 (Full wake):      Complex work requiring full agent session
 *
 * This is scheduled periodically (e.g., every 5 minutes) per active agent.
 */
export const agentHeartbeat = task({
  id: "agent-heartbeat",
  maxDuration: 120, // 2 minutes max
  retry: { maxAttempts: 1 }, // Don't retry heartbeats
  run: async (payload: {
    orgId: string;
    agentId: string;
  }) => {
    const { orgId, agentId } = payload;

    logger.info("agent-heartbeat started", { orgId, agentId });

    // ════════════════════════════════════════════════════════════
    // TIER 1: Cheap triage (no model call)
    // Check for pending work without spending tokens
    // ════════════════════════════════════════════════════════════

    logger.info("Tier 1: Checking for pending work", { orgId, agentId });

    // TODO: Query execution_tasks for queued/in_progress tasks assigned to this agent
    // TODO: Query execution_events for unprocessed events
    // TODO: Check for approval responses that need action
    // TODO: Check integration webhooks / triggers

    const pendingTasks: string[] = []; // TODO: actual query
    const pendingEvents: string[] = []; // TODO: actual query
    const pendingApprovals: string[] = []; // TODO: actual query

    const hasWork =
      pendingTasks.length > 0 ||
      pendingEvents.length > 0 ||
      pendingApprovals.length > 0;

    if (!hasWork) {
      logger.info("Tier 1: No pending work, agent stays idle", { orgId, agentId });
      return {
        orgId,
        agentId,
        tier: 1,
        action: "idle",
        pendingTasks: 0,
        pendingEvents: 0,
        pendingApprovals: 0,
      };
    }

    // ════════════════════════════════════════════════════════════
    // TIER 2: Lightweight action (minimal model call if needed)
    // Handle simple tasks without full agent wake
    // ════════════════════════════════════════════════════════════

    logger.info("Tier 2: Processing lightweight actions", {
      orgId,
      agentId,
      pendingTasks: pendingTasks.length,
      pendingEvents: pendingEvents.length,
      pendingApprovals: pendingApprovals.length,
    });

    // Handle approval responses (no model needed)
    for (const approvalId of pendingApprovals) {
      logger.info("Processing approval response", { approvalId });
      // TODO: Read approval decision, update task accordingly
    }

    // Handle simple event responses
    for (const eventId of pendingEvents) {
      logger.info("Processing event", { eventId });
      // TODO: Triage event, handle if simple (e.g., status update)
    }

    // Check if remaining work needs full agent wake
    const complexTasks = pendingTasks; // TODO: filter for complex tasks
    if (complexTasks.length === 0) {
      logger.info("Tier 2: All work handled at lightweight level", { orgId, agentId });
      return {
        orgId,
        agentId,
        tier: 2,
        action: "lightweight",
        processedApprovals: pendingApprovals.length,
        processedEvents: pendingEvents.length,
        remainingTasks: 0,
      };
    }

    // ════════════════════════════════════════════════════════════
    // TIER 3: Full agent wake (triggers execute-task)
    // Complex work requiring full agent session with tools
    // ════════════════════════════════════════════════════════════

    logger.info("Tier 3: Triggering full agent wake for complex tasks", {
      orgId,
      agentId,
      complexTaskCount: complexTasks.length,
    });

    // TODO: For each complex task, trigger executeTaskJob
    // const { executeTaskJob } = await import("./execute-task");
    // for (const taskId of complexTasks) {
    //   await executeTaskJob.trigger({ taskId, orgId, agentId, ... });
    // }

    return {
      orgId,
      agentId,
      tier: 3,
      action: "full-wake",
      triggeredTasks: complexTasks.length,
    };
  },
});
