import { task, logger } from "@trigger.dev/sdk";

/**
 * Example task to verify Trigger.dev setup works.
 * This can be removed once real tasks are implemented.
 */
export const helloWorldTask = task({
  id: "hello-world",
  // Per-task retry override (optional, uses global defaults if omitted)
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: { name: string }) => {
    logger.info("Hello world task started", { payload });

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const message = `Hello, ${payload.name}! Trigger.dev is working.`;
    logger.info("Task completed", { message });

    return { message };
  },
});
