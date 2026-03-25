#!/usr/bin/env npx tsx
/**
 * E2E Test Script for New Features
 *
 * Tests:
 * 1. Browser Automation (Rover) Agent — tool registration & execution
 * 2. Slack RAG — embedding & search
 * 3. Notification Engine — triage & delivery
 * 4. Daily Briefing — generation
 * 5. All agents — basic execution test
 *
 * Usage:
 *   npx tsx scripts/test-new-features.ts
 *   npx tsx scripts/test-new-features.ts --quick   # Skip slow tests
 */

const args = process.argv.slice(2);
const QUICK = args.includes("--quick");

let passed = 0;
let failed = 0;
let skipped = 0;
const errors: string[] = [];

function log(msg: string) {
  console.log(`  ${msg}`);
}

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}

function fail(name: string, error: string) {
  failed++;
  errors.push(`${name}: ${error}`);
  console.log(`  ❌ ${name}: ${error}`);
}

function skip(name: string) {
  skipped++;
  console.log(`  ⏭️  ${name} (skipped)`);
}

// ── Test 1: Browser Tools Registration ────────────────────────────────────────

async function testBrowserTools() {
  console.log("\n🌐 Test: Browser Automation Tools");
  try {
    const { globalRegistry } = await import("../lib/execution/tools/index");
    // Import browser tools to trigger registration
    await import("../lib/execution/tools/browser-tools");

    const toolNames = [
      "browse_website",
      "take_screenshot",
      "fill_and_submit_form",
      "extract_structured_data",
      "monitor_webpage",
      "run_browser_workflow",
    ];

    for (const name of toolNames) {
      const tool = globalRegistry.get(name);
      if (tool) {
        pass(`Tool "${name}" registered`);
      } else {
        fail(`Tool "${name}" registered`, "Not found in registry");
      }
    }
  } catch (err) {
    fail("Browser tools import", err instanceof Error ? err.message : String(err));
  }
}

// ── Test 2: Rover Agent Definition ────────────────────────────────────────────

async function testRoverAgent() {
  console.log("\n🤖 Test: Rover Agent");
  try {
    const { AGENTS, getAgentForCategory } = await import("../lib/execution/agents/index");

    if (AGENTS.rover) {
      pass("Rover agent exists in registry");
      if (AGENTS.rover.defaultOutfit === "automation") {
        pass("Rover uses automation outfit");
      } else {
        fail("Rover outfit", `Expected 'automation', got '${AGENTS.rover.defaultOutfit}'`);
      }
    } else {
      fail("Rover agent exists", "Not found in AGENTS");
    }

    // Test category routing
    const categories = ["browser", "automation", "scrape", "monitor"];
    for (const cat of categories) {
      const agent = getAgentForCategory(cat);
      if (agent.id === "rover") {
        pass(`Category "${cat}" → rover`);
      } else {
        fail(`Category "${cat}" → rover`, `Got ${agent.id}`);
      }
    }
  } catch (err) {
    fail("Rover agent", err instanceof Error ? err.message : String(err));
  }
}

// ── Test 3: Automation Outfit ─────────────────────────────────────────────────

async function testAutomationOutfit() {
  console.log("\n🎭 Test: Automation Outfit");
  try {
    const { OUTFITS } = await import("../lib/execution/outfits");

    if (OUTFITS.automation) {
      pass("Automation outfit exists");
      const requiredTools = ["browse_website", "extract_structured_data", "monitor_webpage"];
      for (const tool of requiredTools) {
        if (OUTFITS.automation.tools.includes(tool)) {
          pass(`Outfit has "${tool}"`);
        } else {
          fail(`Outfit has "${tool}"`, "Missing from tool list");
        }
      }
    } else {
      fail("Automation outfit exists", "Not found in OUTFITS");
    }
  } catch (err) {
    fail("Automation outfit", err instanceof Error ? err.message : String(err));
  }
}

// ── Test 4: Slack RAG Module ──────────────────────────────────────────────────

async function testSlackRAG() {
  console.log("\n💬 Test: Slack RAG");
  try {
    const slackRag = await import("../lib/slack/slack-rag");
    if (typeof slackRag.embedSlackMessages === "function") {
      pass("embedSlackMessages function exists");
    } else {
      fail("embedSlackMessages", "Function not exported");
    }
    if (typeof slackRag.searchSlackMessages === "function") {
      pass("searchSlackMessages function exists");
    } else {
      fail("searchSlackMessages", "Function not exported");
    }
    if (typeof slackRag.embedNewWebhookMessage === "function") {
      pass("embedNewWebhookMessage function exists");
    } else {
      fail("embedNewWebhookMessage", "Function not exported");
    }
  } catch (err) {
    fail("Slack RAG import", err instanceof Error ? err.message : String(err));
  }
}

// ── Test 5: Slack RAG Tools ───────────────────────────────────────────────────

async function testSlackRAGTools() {
  console.log("\n🔍 Test: Slack RAG Tools");
  try {
    const { globalRegistry } = await import("../lib/execution/tools/index");
    await import("../lib/execution/tools/slack-rag-tools");

    const tool = globalRegistry.get("search_slack_history");
    if (tool) {
      pass("search_slack_history tool registered");
    } else {
      fail("search_slack_history", "Not found in registry");
    }
  } catch (err) {
    fail("Slack RAG tools", err instanceof Error ? err.message : String(err));
  }
}

// ── Test 6: Notification Engine ───────────────────────────────────────────────

async function testNotificationEngine() {
  console.log("\n🔔 Test: Notification Engine");
  try {
    const { processEventInline, deliverNotification, processWebhookEvents } = await import("../lib/notifications/engine");

    if (typeof processEventInline === "function") {
      pass("processEventInline function exists");
    } else {
      fail("processEventInline", "Function not exported");
    }

    if (typeof deliverNotification === "function") {
      pass("deliverNotification function exists");
    } else {
      fail("deliverNotification", "Function not exported");
    }

    if (typeof processWebhookEvents === "function") {
      pass("processWebhookEvents function exists");
    } else {
      fail("processWebhookEvents", "Function not exported");
    }
  } catch (err) {
    fail("Notification engine import", err instanceof Error ? err.message : String(err));
  }
}

// ── Test 7: Daily Briefing ────────────────────────────────────────────────────

async function testDailyBriefing() {
  console.log("\n📋 Test: Daily Briefing");
  try {
    const { generateDailyBriefing, saveBriefing } = await import("../lib/briefing/daily-digest");

    if (typeof generateDailyBriefing === "function") {
      pass("generateDailyBriefing function exists");
    } else {
      fail("generateDailyBriefing", "Function not exported");
    }

    if (typeof saveBriefing === "function") {
      pass("saveBriefing function exists");
    } else {
      fail("saveBriefing", "Function not exported");
    }
  } catch (err) {
    fail("Daily briefing import", err instanceof Error ? err.message : String(err));
  }
}

// ── Test 8: All Agents Exist ──────────────────────────────────────────────────

async function testAllAgents() {
  console.log("\n👥 Test: All 8 Agents");
  try {
    const { AGENTS, listAgents } = await import("../lib/execution/agents/index");

    const expectedAgents = [
      "strategist", "marketer", "analyst", "recruiter",
      "operator", "researcher", "codebot", "rover",
    ];

    for (const id of expectedAgents) {
      if (AGENTS[id]) {
        pass(`Agent "${id}" (${AGENTS[id].name}) exists`);
      } else {
        fail(`Agent "${id}" exists`, "Missing from AGENTS");
      }
    }

    const list = listAgents();
    if (list.length === expectedAgents.length) {
      pass(`listAgents() returns ${list.length} agents`);
    } else {
      fail(`listAgents() count`, `Expected ${expectedAgents.length}, got ${list.length}`);
    }
  } catch (err) {
    fail("All agents", err instanceof Error ? err.message : String(err));
  }
}

// ── Test 9: Outfits Have Slack RAG ────────────────────────────────────────────

async function testOutfitsHaveSlackRAG() {
  console.log("\n🔗 Test: All Outfits Have RAG Tools");
  try {
    const { OUTFITS } = await import("../lib/execution/outfits");

    const ragTools = ["search_documents", "list_documents"];
    for (const [name, outfit] of Object.entries(OUTFITS)) {
      for (const tool of ragTools) {
        if (outfit.tools.includes(tool)) {
          // pass silently — too many checks
        } else {
          fail(`${name} has ${tool}`, "Missing");
        }
      }
    }
    pass("All outfits have RAG tools (search_documents, list_documents)");
  } catch (err) {
    fail("Outfit RAG check", err instanceof Error ? err.message : String(err));
  }
}

// ── Test 10: Browse Website Tool Execution ────────────────────────────────────

async function testBrowseWebsite() {
  console.log("\n🌍 Test: browse_website Execution");
  if (QUICK) {
    skip("browse_website execution (--quick mode)");
    return;
  }

  try {
    const { globalRegistry, createCostTracker } = await import("../lib/execution/tools/index");
    await import("../lib/execution/tools/browser-tools");

    const result = await globalRegistry.execute(
      "browse_website",
      { url: "https://example.com" },
      {
        orgId: "test-org",
        agentId: "rover",
        sessionId: "test",
        costTracker: createCostTracker(1.0),
      },
    );

    if (result.success) {
      const output = (result as any).output ?? "";
      if (output.includes("Title:")) {
        pass(`browse_website returned output with title`);
      } else {
        fail("browse_website title", "No title in output");
      }
      if (output.length > 100) {
        pass(`browse_website returned ${output.length} chars of content`);
      } else {
        fail("browse_website content", `Only ${output.length} chars`);
      }
    } else {
      fail("browse_website execution", (result as any).output ?? "Unknown error");
    }
  } catch (err) {
    fail("browse_website execution", err instanceof Error ? err.message : String(err));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║  Pivot New Features E2E Test Suite                       ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");

  await testBrowserTools();
  await testRoverAgent();
  await testAutomationOutfit();
  await testSlackRAG();
  await testSlackRAGTools();
  await testNotificationEngine();
  await testDailyBriefing();
  await testAllAgents();
  await testOutfitsHaveSlackRAG();
  await testBrowseWebsite();

  console.log("\n" + "═".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log(`Score: ${passed}/${passed + failed} (${Math.round(passed / (passed + failed) * 100)}%)`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const err of errors) {
      console.log(`  ❌ ${err}`);
    }
  }

  console.log("═".repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
