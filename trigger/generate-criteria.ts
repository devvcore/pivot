import { task, logger } from "@trigger.dev/sdk";

/**
 * Generate acceptance criteria for a task using a fast model.
 * Produces 3-7 testable criteria that the review-task can evaluate against.
 */
export const generateCriteriaJob = task({
  id: "generate-criteria",
  maxDuration: 30,
  retry: { maxAttempts: 2 },
  run: async (payload: {
    taskId: string;
    title: string;
    description: string;
  }) => {
    const { taskId, title, description } = payload;

    logger.info("generate-criteria started", { taskId, title });

    // ── Build prompt ────────────────────────────────────────────
    const _prompt = `You are a quality assurance expert. Generate testable acceptance criteria for the following task.

TASK TITLE: ${title}
TASK DESCRIPTION: ${description}

Generate 3-7 specific, testable acceptance criteria. Each criterion should be:
- Objectively verifiable (can be checked by reviewing the output)
- Specific (not vague or generic)
- Focused on the deliverable quality

Respond with a JSON array of strings, each being one acceptance criterion.
Example: ["The report includes at least 3 data-backed recommendations", "All financial figures include source citations", ...]`;

    // TODO: Call 'quick' model (e.g., gemini-2.5-flash) with prompt
    // TODO: Parse the JSON array response

    // Skeleton: generate reasonable default criteria based on task title
    const criteria = generateDefaultCriteria(title, description);

    logger.info("generate-criteria complete", {
      taskId,
      criteriaCount: criteria.length,
    });

    return {
      taskId,
      criteria,
    };
  },
});

/**
 * Generate sensible default criteria when the model is not yet integrated.
 * These serve as fallback and demonstrate the expected format.
 */
function generateDefaultCriteria(title: string, description: string): string[] {
  const criteria: string[] = [
    "The output directly addresses the task objective",
    "The output is complete and does not contain placeholder content",
    "The output is factually consistent with any provided data",
  ];

  // Add context-aware criteria based on keywords
  const combined = `${title} ${description}`.toLowerCase();

  if (combined.includes("report") || combined.includes("analysis")) {
    criteria.push("The analysis includes specific data points or metrics");
    criteria.push("Recommendations are actionable and prioritized");
  }

  if (combined.includes("plan") || combined.includes("strategy")) {
    criteria.push("The plan includes clear timeline or milestones");
    criteria.push("Resource requirements or dependencies are identified");
  }

  if (combined.includes("email") || combined.includes("message") || combined.includes("draft")) {
    criteria.push("The tone is professional and appropriate for the audience");
    criteria.push("The message has a clear call-to-action");
  }

  if (combined.includes("code") || combined.includes("implement")) {
    criteria.push("The implementation handles edge cases");
    criteria.push("The code follows established patterns in the codebase");
  }

  // Cap at 7 criteria
  return criteria.slice(0, 7);
}
