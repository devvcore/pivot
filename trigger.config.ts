import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Replace with your actual Trigger.dev project ref from the dashboard
  project: "proj_pivot",
  runtime: "node",
  // The trigger/ directory is auto-detected, but we make it explicit
  dirs: ["trigger"],
  // Max duration per task run in seconds (300s = 5 minutes)
  maxDuration: 300,
  // Retry defaults for all tasks
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
});
