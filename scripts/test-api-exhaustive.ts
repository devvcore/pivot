#!/usr/bin/env npx tsx
/**
 * Exhaustive API test suite for Pivot
 * Tests all major endpoints with real data
 */

const BASE = "http://localhost:3000";
const ORG_ID = "bad7cf7d-f09f-410c-8ca1-607652d00bb8";
const USER_ID = "f2e75fb7-d525-436b-b3aa-0bc4e6b63788";

const SUPABASE_URL = "https://rdghujwngnbnwxotxbbl.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkZ2h1anduZ25ibnd4b3R4YmJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU4NDgwNiwiZXhwIjoyMDg4MTYwODA2fQ.rbRjighX42jcJcQEyQ5S_MTUUatvZEGM9sub4MEIN00";

let TOKEN = "";
let passed = 0;
let failed = 0;
const results: { name: string; pass: boolean; detail: string; time: number }[] = [];

async function getToken(): Promise<string> {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  // Generate a session for the user
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: "manueldavid500@gmail.com",
  });
  if (error) throw new Error(`Failed to generate link: ${error.message}`);

  // Use the token hash to verify and get a session
  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) throw new Error("No hashed_token in magic link response");

  const { data: verifyData, error: verifyErr } = await sb.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (verifyErr) throw new Error(`Failed to verify OTP: ${verifyErr.message}`);

  return verifyData.session!.access_token;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function test(
  name: string,
  fn: () => Promise<{ pass: boolean; detail: string }>
) {
  const start = Date.now();
  try {
    const result = await fn();
    const time = Date.now() - start;
    results.push({ name, ...result, time });
    if (result.pass) {
      passed++;
      console.log(`  ✅ ${name} (${time}ms)`);
    } else {
      failed++;
      console.log(`  ❌ ${name} (${time}ms) — ${result.detail}`);
    }
  } catch (err: any) {
    const time = Date.now() - start;
    failed++;
    const detail = err.message?.substring(0, 200) || "Unknown error";
    results.push({ name, pass: false, detail, time });
    console.log(`  ❌ ${name} (${time}ms) — EXCEPTION: ${detail}`);
  }
}

// ── Pivvy Conversations ──
async function testPivvy(name: string, message: string, checks: (body: any) => { pass: boolean; detail: string }) {
  await test(name, async () => {
    const res = await fetch(`${BASE}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: ORG_ID, message, messages: [] }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { pass: false, detail: `HTTP ${res.status}: ${text.substring(0, 150)}` };
    }
    const body = await res.json();
    return checks(body);
  });
}

// ── Agent Tasks ──
async function testAgent(
  name: string,
  agentId: string,
  message: string,
  checks: (events: any[]) => { pass: boolean; detail: string }
) {
  await test(name, async () => {
    // Create task
    const createRes = await fetch(`${BASE}/api/execution/tasks`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ orgId: ORG_ID, agentId, title: message, priority: "high" }),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      return { pass: false, detail: `Create failed HTTP ${createRes.status}: ${text.substring(0, 150)}` };
    }
    const { task } = await createRes.json();
    const taskId = task.id;

    // Poll for completion (max 120s)
    let events: any[] = [];
    let status = "pending";
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`${BASE}/api/execution/tasks/${taskId}`, {
        headers: authHeaders(),
      });
      if (!pollRes.ok) continue;
      const pollBody = await pollRes.json();
      status = pollBody.task?.status || status;
      events = pollBody.events || [];
      if (status === "completed" || status === "failed") break;
    }

    if (status !== "completed") {
      return { pass: false, detail: `Task did not complete: status=${status}, events=${events.length}` };
    }

    return checks(events);
  });
}

// ── API Endpoints ──
async function testGet(name: string, path: string, checks: (body: any, status: number) => { pass: boolean; detail: string }) {
  await test(name, async () => {
    const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
    const status = res.status;
    let body: any;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return checks(body, status);
  });
}

// ═══════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log("\n🔑 Getting auth token...");
  TOKEN = await getToken();
  console.log(`   Token acquired (${TOKEN.substring(0, 20)}...)\n`);

  // ── PHASE 1: API Endpoints (fast) ──
  console.log("═══ PHASE 1: API ENDPOINTS ═══");

  await testGet("16. GET /api/crm/contacts", `/api/crm/contacts?orgId=${ORG_ID}`, (body, status) => {
    if (status === 200 && (Array.isArray(body) || Array.isArray(body?.contacts))) {
      const arr = Array.isArray(body) ? body : body.contacts;
      return { pass: true, detail: `${arr.length} contacts returned` };
    }
    return { pass: false, detail: `status=${status}, body=${JSON.stringify(body).substring(0, 150)}` };
  });

  await testGet("17. GET /api/pm/tickets", `/api/pm/tickets?orgId=${ORG_ID}`, (body, status) => {
    if (status === 200 && (Array.isArray(body) || Array.isArray(body?.tickets) || body !== null)) {
      return { pass: true, detail: `status=200, type=${typeof body}` };
    }
    return { pass: false, detail: `status=${status}, body=${JSON.stringify(body).substring(0, 150)}` };
  });

  await testGet("18. GET /api/alerts", `/api/alerts?orgId=${ORG_ID}`, (body, status) => {
    if (status === 200) {
      return { pass: true, detail: `status=200, keys=${Object.keys(body || {}).join(",")}` };
    }
    return { pass: false, detail: `status=${status}` };
  });

  await testGet("19. GET /api/pulse", `/api/pulse?orgId=${ORG_ID}`, (body, status) => {
    if (status === 200 && body) {
      return { pass: true, detail: `keys=${Object.keys(body).slice(0, 5).join(",")}` };
    }
    return { pass: false, detail: `status=${status}, body=${JSON.stringify(body).substring(0, 150)}` };
  });

  await testGet("20. GET /api/eval", `/api/eval`, (body, status) => {
    if (status === 200) {
      return { pass: true, detail: `status=200` };
    }
    return { pass: false, detail: `status=${status}, body=${JSON.stringify(body).substring(0, 150)}` };
  });

  // ── PHASE 2: Pivvy Conversations ──
  console.log("\n═══ PHASE 2: PIVVY CONVERSATIONS ═══");

  await testPivvy("1. Pivvy: greeting", "hi", (body) => {
    const reply = body.reply || body.response || body.message || "";
    if (reply.length > 10 && /hi|hey|hello|welcome|how|what/i.test(reply)) {
      return { pass: true, detail: `reply: "${reply.substring(0, 80)}..."` };
    }
    return { pass: false, detail: `reply too short or not greeting: "${reply.substring(0, 100)}"` };
  });

  await testPivvy("2. Pivvy: runway", "what's my runway?", (body) => {
    const reply = body.message || body.reply || body.response || "";
    if (reply.length > 50) {
      const hasNumbers = /\d/.test(reply);
      return { pass: true, detail: `len=${reply.length}, hasNumbers=${hasNumbers}, snippet="${reply.substring(0, 80)}..."` };
    }
    return { pass: false, detail: `reply too short: "${reply.substring(0, 100)}"` };
  });

  await testPivvy("3. Pivvy: cash flow projection", "show me a cash flow projection", (body) => {
    const reply = body.message || body.reply || body.response || "";
    const hasProjection = body.projection || body.chart || /projection|forecast|month|cash/i.test(reply);
    if (reply.length > 30 && hasProjection) {
      return { pass: true, detail: `len=${reply.length}, hasProjection=true` };
    }
    return { pass: false, detail: `reply="${reply.substring(0, 100)}", projection=${!!body.projection}` };
  });

  await testPivvy("4. Pivvy: top clients by revenue", "who are my top clients by revenue?", (body) => {
    const reply = body.message || body.reply || body.response || "";
    if (reply.length > 50) {
      return { pass: true, detail: `len=${reply.length}, snippet="${reply.substring(0, 80)}..."` };
    }
    return { pass: false, detail: `reply too short: "${reply.substring(0, 100)}"` };
  });

  await testPivvy("5. Pivvy: draft email", "draft an email to Kate Phillips about our maintenance packages", (body) => {
    const reply = body.message || body.reply || body.response || "";
    const noPlaceholders = !reply.includes("[Your Name]") && !reply.includes("[Insert");
    if (reply.length > 100 && noPlaceholders) {
      return { pass: true, detail: `len=${reply.length}, noPlaceholders=${noPlaceholders}` };
    }
    return { pass: false, detail: `len=${reply.length}, noPlaceholders=${noPlaceholders}, snippet="${reply.substring(0, 100)}"` };
  });

  await testPivvy("6. Pivvy: biggest risks", "what are my biggest risks?", (body) => {
    const reply = body.message || body.reply || body.response || "";
    if (reply.length > 50 && /risk|concern|challenge|threat|issue/i.test(reply)) {
      return { pass: true, detail: `len=${reply.length}` };
    }
    return { pass: false, detail: `reply="${reply.substring(0, 100)}"` };
  });

  await testPivvy("7. Pivvy: web search", "search the web for AI business intelligence competitors", (body) => {
    const reply = body.message || body.reply || body.response || "";
    if (reply.length > 100) {
      return { pass: true, detail: `len=${reply.length}` };
    }
    return { pass: false, detail: `reply too short: len=${reply.length}` };
  });

  await testPivvy("8. Pivvy: LinkedIn post", "create a LinkedIn post about our latest project", (body) => {
    const reply = body.message || body.reply || body.response || "";
    if (reply.length > 80) {
      return { pass: true, detail: `len=${reply.length}` };
    }
    return { pass: false, detail: `reply too short: len=${reply.length}` };
  });

  await testPivvy("9. Pivvy: pipeline", "what does my pipeline look like?", (body) => {
    const reply = body.message || body.reply || body.response || "";
    if (reply.length > 50) {
      return { pass: true, detail: `len=${reply.length}` };
    }
    return { pass: false, detail: `reply too short: len=${reply.length}` };
  });

  await testPivvy("10. Pivvy: email check", "check my email for anything important", (body) => {
    const reply = body.message || body.reply || body.response || "";
    if (reply.length > 50) {
      return { pass: true, detail: `len=${reply.length}` };
    }
    return { pass: false, detail: `reply too short: len=${reply.length}` };
  });

  // ── PHASE 3: Agent Tasks ──
  console.log("\n═══ PHASE 3: AGENT TASKS ═══");

  await testAgent(
    "11. Marketer: Instagram captions",
    "marketer",
    "Write 3 Instagram captions for a web development agency",
    (events) => {
      const content = events
        .filter((e: any) => e.event_type === "content" || e.event_type === "agent_output")
        .map((e: any) => e.data?.content || e.data?.output || "")
        .join("\n");
      if (content.length > 100) {
        const hasMultiple = (content.match(/\n\n/g) || []).length >= 1 || content.includes("1") || content.includes("Caption");
        return { pass: true, detail: `len=${content.length}, hasMultiple=${hasMultiple}` };
      }
      return { pass: false, detail: `content too short: ${content.length} chars, events=${events.length}` };
    }
  );

  await testAgent(
    "12. Analyst: financial summary",
    "analyst",
    "Create a monthly financial summary from Stripe data",
    (events) => {
      const content = events
        .filter((e: any) => e.event_type === "content" || e.event_type === "agent_output")
        .map((e: any) => e.data?.content || e.data?.output || "")
        .join("\n");
      if (content.length > 100) {
        return { pass: true, detail: `len=${content.length}` };
      }
      return { pass: false, detail: `content too short: ${content.length} chars` };
    }
  );

  await testAgent(
    "13. Researcher: Webflow vs custom dev",
    "researcher",
    "Research Webflow and compare it to custom development for small businesses",
    (events) => {
      const content = events
        .filter((e: any) => e.event_type === "content" || e.event_type === "agent_output")
        .map((e: any) => e.data?.content || e.data?.output || "")
        .join("\n");
      const toolCalls = events.filter((e: any) => e.event_type === "tool_call");
      const usedWebSearch = toolCalls.some((e: any) => (e.data?.tool || e.data?.name || "").includes("search"));
      if (content.length > 100) {
        return { pass: true, detail: `len=${content.length}, webSearch=${usedWebSearch}, tools=${toolCalls.length}` };
      }
      return { pass: false, detail: `content too short: ${content.length} chars` };
    }
  );

  await testAgent(
    "14. Operator: project plan",
    "operator",
    "Create a project plan for migrating a client from WordPress to Next.js",
    (events) => {
      const content = events
        .filter((e: any) => e.event_type === "content" || e.event_type === "agent_output")
        .map((e: any) => e.data?.content || e.data?.output || "")
        .join("\n");
      if (content.length > 100) {
        const hasStructure = /phase|step|week|day|milestone|task/i.test(content);
        return { pass: true, detail: `len=${content.length}, hasStructure=${hasStructure}` };
      }
      return { pass: false, detail: `content too short: ${content.length} chars` };
    }
  );

  await testAgent(
    "15. Recruiter: job posting",
    "recruiter",
    "Write a job posting for a junior React developer, remote, $60K-$80K",
    (events) => {
      const content = events
        .filter((e: any) => e.event_type === "content" || e.event_type === "agent_output")
        .map((e: any) => e.data?.content || e.data?.output || "")
        .join("\n");
      if (content.length > 100) {
        const hasKey = /react|remote|salary|\$60|junior/i.test(content);
        return { pass: true, detail: `len=${content.length}, hasKeyTerms=${hasKey}` };
      }
      return { pass: false, detail: `content too short: ${content.length} chars` };
    }
  );

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${passed + failed} passed (${failed} failed)`);
  console.log("═══════════════════════════════════════════\n");

  if (failed > 0) {
    console.log("FAILURES:");
    results
      .filter((r) => !r.pass)
      .forEach((r) => console.log(`  ❌ ${r.name}: ${r.detail}`));
    console.log("");
  }

  // Timing summary
  const totalTime = results.reduce((a, r) => a + r.time, 0);
  console.log(`Total test time: ${(totalTime / 1000).toFixed(1)}s\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
