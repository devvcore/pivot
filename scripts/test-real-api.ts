#!/usr/bin/env npx tsx
/**
 * Real E2E API integration tests — actual HTTP calls to localhost:3000
 */

const BASE = "http://localhost:3000";
const ORG_ID = "bad7cf7d-f09f-410c-8ca1-607652d00bb8";
const TOKEN = process.env.TEST_TOKEN!;

const results: { name: string; pass: boolean; detail: string }[] = [];

async function chatCall(message: string, messages: any[] = []): Promise<any> {
  const res = await fetch(`${BASE}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId: ORG_ID, message, messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function createTask(title: string, agentId: string): Promise<any> {
  const res = await fetch(`${BASE}/api/execution/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ orgId: ORG_ID, title, agentId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CreateTask ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function pollTask(taskId: string, maxWaitMs = 120_000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(
      `${BASE}/api/execution/tasks/${taskId}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (!res.ok) {
      console.log(`  poll ${res.status}`);
      continue;
    }
    const data = await res.json();
    const status = data.task?.status ?? data.status;
    console.log(`  poll → status=${status} (${Math.round((Date.now() - start) / 1000)}s)`);
    if (status === "completed" || status === "failed" || status === "error") {
      return data;
    }
  }
  throw new Error(`Task ${taskId} did not complete within ${maxWaitMs / 1000}s`);
}

function getTaskOutput(data: any): string {
  // Try multiple places where the output might be
  if (data.task?.output) return typeof data.task.output === "string" ? data.task.output : JSON.stringify(data.task.output);
  if (data.output) return typeof data.output === "string" ? data.output : JSON.stringify(data.output);
  // Check events for content
  const events = data.events ?? data.task?.events ?? [];
  for (const e of events.reverse()) {
    if (e.type === "complete" || e.type === "content") {
      return e.content ?? e.data?.content ?? JSON.stringify(e);
    }
  }
  return JSON.stringify(data).slice(0, 1000);
}

function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`\n[${ tag }] ${name}`);
  console.log(`  ${detail.slice(0, 500)}`);
}

// ═══════════════════════════════════════════
// TEST 1: Pivvy greeting
// ═══════════════════════════════════════════
async function test1_pivvyGreeting() {
  console.log("\n─── Test 1: Pivvy greeting ───");
  try {
    const data = await chatCall("hi");
    const reply = data.reply ?? data.message ?? data.content ?? JSON.stringify(data);
    const lower = reply.toLowerCase();
    // Should be warm, not canned, not an error
    const isWarm = lower.includes("hey") || lower.includes("hi") || lower.includes("hello") || lower.includes("welcome") || lower.includes("what") || lower.includes("help");
    const isCanned = lower.includes("i'm sorry, i can only") || lower.includes("as an ai");
    const pass = isWarm && !isCanned && reply.length > 10;
    record("Pivvy greeting", pass, reply);
  } catch (e: any) {
    record("Pivvy greeting", false, e.message);
  }
}

// ═══════════════════════════════════════════
// TEST 2: Pivvy health score
// ═══════════════════════════════════════════
async function test2_healthScore() {
  console.log("\n─── Test 2: Pivvy health score ───");
  try {
    const data = await chatCall("what's my health score?");
    const reply = data.reply ?? data.message ?? data.content ?? JSON.stringify(data);
    // Should contain a number or score-like content
    const hasData = /\d/.test(reply) || reply.toLowerCase().includes("score") || reply.toLowerCase().includes("health");
    const pass = hasData && reply.length > 30;
    record("Pivvy health score", pass, reply);
  } catch (e: any) {
    record("Pivvy health score", false, e.message);
  }
}

// ═══════════════════════════════════════════
// TEST 3: Pivvy CRM / clients
// ═══════════════════════════════════════════
async function test3_clients() {
  console.log("\n─── Test 3: Pivvy client search ───");
  try {
    const data = await chatCall("who are my clients?");
    const reply = data.reply ?? data.message ?? data.content ?? JSON.stringify(data);
    // Should mention some client data or explain what it found
    const hasContent = reply.length > 50;
    const pass = hasContent;
    record("Pivvy client search", pass, reply);
  } catch (e: any) {
    record("Pivvy client search", false, e.message);
  }
}

// ═══════════════════════════════════════════
// TEST 4: Pivvy capabilities
// ═══════════════════════════════════════════
async function test4_capabilities() {
  console.log("\n─── Test 4: Pivvy capabilities ───");
  try {
    const data = await chatCall("what can you do for me?");
    const reply = data.reply ?? data.message ?? data.content ?? JSON.stringify(data);
    // Should be brief, NOT a brochure (< 2000 chars), mention some capabilities
    const isBrief = reply.length < 2000;
    const pass = isBrief && reply.length > 30;
    record("Pivvy capabilities", pass, `(${reply.length} chars) ${reply}`);
  } catch (e: any) {
    record("Pivvy capabilities", false, e.message);
  }
}

// ═══════════════════════════════════════════
// TEST 5: Agent email quality (marketer)
// ═══════════════════════════════════════════
async function test5_emailTask() {
  console.log("\n─── Test 5: Marketer upsell email ───");
  try {
    const created = await createTask(
      "Draft a personalized upsell email to Kate Phillips about website maintenance packages",
      "marketer"
    );
    const taskId = created.task?.id ?? created.id;
    console.log(`  taskId=${taskId}`);
    const result = await pollTask(taskId);
    const output = getTaskOutput(result);
    const lower = output.toLowerCase();
    // Check for placeholder vs real data
    const hasPlaceholder = output.includes("[Client Name]") || output.includes("[Your Name]") || output.includes("{name}");
    const hasRealContent = lower.includes("kate") || lower.includes("maintenance") || lower.includes("website");
    const resultText = result.task?.result ?? output;
    const pass = !hasPlaceholder && hasRealContent && output.length > 100;
    record("Marketer upsell email", pass, `placeholders=${hasPlaceholder}, realContent=${hasRealContent}\n${resultText}`);
  } catch (e: any) {
    record("Marketer upsell email", false, e.message);
  }
}

// ═══════════════════════════════════════════
// TEST 6: Agent LinkedIn post (marketer)
// ═══════════════════════════════════════════
async function test6_linkedinPost() {
  console.log("\n─── Test 6: Marketer LinkedIn post ───");
  try {
    const created = await createTask(
      "Write a LinkedIn post about our AI-powered business intelligence platform Pivot",
      "marketer"
    );
    const taskId = created.task?.id ?? created.id;
    console.log(`  taskId=${taskId}`);
    const result = await pollTask(taskId);
    const output = getTaskOutput(result);
    const lower = output.toLowerCase();
    const hasHashtags = output.includes("#");
    const hasPivot = lower.includes("pivot");
    const isPersonalized = lower.includes("ai") || lower.includes("intelligence") || lower.includes("business");
    const resultText = result.task?.result ?? output;
    const pass = hasPivot && isPersonalized && output.length > 100;
    record("Marketer LinkedIn post", pass, `hashtags=${hasHashtags}, pivot=${hasPivot}\n${resultText}`);
  } catch (e: any) {
    record("Marketer LinkedIn post", false, e.message);
  }
}

// ═══════════════════════════════════════════
// TEST 7: Stripe data access (analyst)
// ═══════════════════════════════════════════
async function test7_stripeData() {
  console.log("\n─── Test 7: Analyst Stripe revenue ───");
  try {
    const created = await createTask(
      "Pull our Stripe revenue data and tell me about each customer",
      "analyst"
    );
    const taskId = created.task?.id ?? created.id;
    console.log(`  taskId=${taskId}`);
    const result = await pollTask(taskId);
    const output = getTaskOutput(result);
    const lower = output.toLowerCase();
    // Should have real dollar amounts or customer names
    const hasMoney = /\$[\d,]+/.test(output) || lower.includes("revenue") || lower.includes("mrr");
    const hasNames = lower.includes("customer") || lower.includes("client") || /[A-Z][a-z]+ [A-Z][a-z]+/.test(output);
    const noFabricatedDisclaimer = !lower.includes("i don't have") || lower.includes("stripe");
    const resultText = result.task?.result ?? output;
    const pass = (hasMoney || hasNames) && output.length > 100;
    record("Analyst Stripe revenue", pass, `money=${hasMoney}, names=${hasNames}\n${resultText}`);
  } catch (e: any) {
    record("Analyst Stripe revenue", false, e.message);
  }
}

// ═══════════════════════════════════════════
// TEST 8: CRM search via Pivvy
// ═══════════════════════════════════════════
async function test8_crmSearch() {
  console.log("\n─── Test 8: Pivvy CRM search ───");
  try {
    const data = await chatCall("look up contacts in my CRM");
    const reply = data.reply ?? data.message ?? data.content ?? JSON.stringify(data);
    const tools = data.toolsUsed ?? [];
    const lower = reply.toLowerCase();
    // Should attempt CRM access or explain what it found
    const hasContent = reply.length > 30;
    const mentionsCRM = lower.includes("crm") || lower.includes("contact") || lower.includes("salesforce") || lower.includes("hubspot") || lower.includes("pipeline");
    const usedTool = tools.length > 0;
    const pass = hasContent && mentionsCRM;
    record("Pivvy CRM search", pass, `tools=${JSON.stringify(tools)}\n${reply}`);
  } catch (e: any) {
    record("Pivvy CRM search", false, e.message);
  }
}

// ═══════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  PIVOT REAL API E2E TESTS");
  console.log("═══════════════════════════════════════════");
  console.log(`  Base: ${BASE}`);
  console.log(`  Org:  ${ORG_ID}`);
  console.log(`  Auth: ${TOKEN ? "Bearer token" : "NONE (chat-only)"}`);

  // Run Pivvy tests (no auth needed, can run in parallel-ish)
  await test1_pivvyGreeting();
  await test2_healthScore();
  await test3_clients();
  await test4_capabilities();

  // Run agent tasks (need auth, sequential because they're expensive)
  if (TOKEN) {
    await test5_emailTask();
    await test6_linkedinPost();
    await test7_stripeData();
  } else {
    record("Marketer upsell email", false, "SKIPPED: no auth token");
    record("Marketer LinkedIn post", false, "SKIPPED: no auth token");
    record("Analyst Stripe revenue", false, "SKIPPED: no auth token");
  }

  // CRM search via Pivvy (no auth needed)
  await test8_crmSearch();

  // Summary
  console.log("\n═══════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════");
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  for (const r of results) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.name}`);
  }
  console.log(`\n  ${passed}/${total} passed`);
  console.log("═══════════════════════════════════════════");
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(2);
});
