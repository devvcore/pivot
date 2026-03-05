import { task, logger } from "@trigger.dev/sdk";

/**
 * Quality review task. Evaluates agent output against acceptance criteria
 * using a fast/cheap model to decide: accept, revise, or fail.
 *
 * This implements BetterBot's review loop pattern:
 *   Agent produces output -> Review checks quality -> Accept or send back
 */
export const reviewTaskJob = task({
  id: "review-task",
  maxDuration: 60,
  retry: { maxAttempts: 2 },
  run: async (payload: {
    taskId: string;
    output: string;
    acceptanceCriteria: string[];
  }) => {
    const { taskId, output, acceptanceCriteria } = payload;

    logger.info("review-task started", {
      taskId,
      outputLength: output.length,
      criteriaCount: acceptanceCriteria.length,
    });

    // If no criteria provided, auto-accept
    if (!acceptanceCriteria.length) {
      logger.info("No acceptance criteria, auto-accepting", { taskId });
      return {
        taskId,
        decision: "accept" as const,
        feedback: null,
        criteriaResults: [],
      };
    }

    // ── Build review prompt ─────────────────────────────────────
    const criteriaList = acceptanceCriteria
      .map((c, i) => `${i + 1}. ${c}`)
      .join("\n");

    const _reviewPrompt = `You are a quality reviewer. Evaluate the following output against the acceptance criteria.

ACCEPTANCE CRITERIA:
${criteriaList}

OUTPUT TO REVIEW:
${output}

For each criterion, determine if it is MET or NOT MET with a brief explanation.
Then provide an overall decision:
- "accept" if ALL criteria are met
- "revise" if some criteria are not met but the output is salvageable (include specific feedback)
- "fail" if the output is fundamentally wrong or unusable

Respond in JSON format:
{
  "criteriaResults": [
    { "criterion": "...", "met": true/false, "explanation": "..." }
  ],
  "decision": "accept" | "revise" | "fail",
  "feedback": "specific feedback if revise/fail, null if accept"
}`;

    // TODO: Call 'quick' model (e.g., gemini-2.5-flash) with reviewPrompt
    // TODO: Parse the JSON response

    // Skeleton: auto-accept for now
    const criteriaResults = acceptanceCriteria.map((criterion) => ({
      criterion,
      met: true,
      explanation: "Placeholder - actual review pending model integration",
    }));

    const decision: "accept" | "revise" | "fail" = "accept";
    const feedback: string | null = null;

    logger.info("review-task complete", { taskId, decision });

    return {
      taskId,
      decision,
      feedback,
      criteriaResults,
    };
  },
});
