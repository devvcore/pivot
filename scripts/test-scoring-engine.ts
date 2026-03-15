#!/usr/bin/env npx tsx
/**
 * Comprehensive Scoring Engine Test
 *
 * Tests the pure scoring functions (no Supabase needed) with 25+ synthetic
 * employees across different roles, salary ranges, industries, and data
 * availability tiers.
 *
 * Run: npx tsx scripts/test-scoring-engine.ts
 */

// ─── Import pure functions (no Supabase dependency) ─────────────────────────

import {
  classifyRole,
  calculateIntangibleScore,
  calculateNetValue,
  calculateIntangibleMultiplier,
  determineConfidence,
  applyTimeWeighting,
  scoreEmployee,
  countMeasuredDimensions,
  getWeakestDimensions,
  projectedImpact,
  estimateHardValue,
  performanceAdjustment,
  type RoleType,
  type DimensionScores,
  type DimensionData,
  type EmployeeScoringInput,
  type CompanyContext,
  type ScoringEvent,
} from "../lib/scoring/engine";

import {
  getIndustryBenchmark,
  getFTEBenchmark,
  classifyCompanySize,
  getDefaultIntangibleScore,
  getDefaultRevenueMultiplier,
} from "../lib/scoring/benchmarks";

// ─── Test Harness ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    const msg = details ? `${name}: ${details}` : name;
    failures.push(msg);
    console.log(`  ✗ ${name}${details ? ` — ${details}` : ""}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, name: string) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, name, diff > tolerance ? `expected ~${expected}, got ${actual} (diff: ${diff})` : undefined);
}

function section(title: string) {
  console.log(`\n━━━ ${title} ━━━`);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Role Classification
// ═══════════════════════════════════════════════════════════════════════════

section("1. Role Classification");

// Direct revenue roles
assert(classifyRole("Sales Manager") === "direct_revenue", "Sales Manager → direct_revenue");
assert(classifyRole("Account Executive") === "direct_revenue", "Account Executive → direct_revenue");
assert(classifyRole("Business Development Rep") === "direct_revenue", "BDR → direct_revenue");
assert(classifyRole("SDR - Outbound") === "direct_revenue", "SDR → direct_revenue");
assert(classifyRole("Client Success Manager") === "direct_revenue", "Client Success → direct_revenue");
assert(classifyRole("Solutions Architect") === "direct_revenue", "Solutions Architect → direct_revenue");
assert(classifyRole("Freelance Developer") === "direct_revenue", "Freelance Developer → direct_revenue");

// Enabler roles
assert(classifyRole("Engineering Manager") === "enabler", "Engineering Manager → enabler");
assert(classifyRole("Product Manager") === "enabler", "Product Manager → enabler");
assert(classifyRole("VP of Engineering") === "enabler", "VP of Engineering → enabler");
assert(classifyRole("Scrum Master") === "enabler", "Scrum Master → enabler");
assert(classifyRole("CTO") === "enabler", "CTO → enabler");
assert(classifyRole("Director of Operations") === "enabler", "Director of Ops → enabler");
assert(classifyRole("Tech Lead") === "enabler", "Tech Lead → enabler");

// Support roles
assert(classifyRole("HR Manager") === "support", "HR Manager → support");
assert(classifyRole("Office Manager") === "support", "Office Manager → support");
assert(classifyRole("Accountant") === "support", "Accountant → support");
assert(classifyRole("QA Engineer") === "support", "QA Engineer → support");
assert(classifyRole("Recruiter") === "support", "Recruiter → support");
assert(classifyRole("Legal Counsel") === "support", "Legal Counsel → support");

// Developer fallback (not explicitly in support keywords, should go to direct_revenue)
assert(classifyRole("Software Developer") === "direct_revenue", "Software Developer → direct_revenue");
assert(classifyRole("Senior Engineer") === "direct_revenue", "Senior Engineer → direct_revenue (engineer fallback)");
assert(classifyRole("Full-Stack Developer") === "direct_revenue", "Full-Stack Developer → direct_revenue");

// Null / unknown
assert(classifyRole(null) === "support", "null title → support");
assert(classifyRole("") === "support", "empty title → support");
assert(classifyRole("Chief Happiness Officer") === "enabler", "Chief Happiness Officer → enabler (has 'chief' keyword)");
assert(classifyRole("Barista") === "support", "Unknown title (Barista) → support");

// Activity pattern overrides
assert(
  classifyRole("Software Developer", { reviewRatio: 0.7 }) === "enabler",
  "Developer with >60% review ratio → enabler override"
);
assert(
  classifyRole("Junior Developer", { primaryActivity: "management" }) === "enabler",
  "Junior Dev with management activity → enabler override"
);
assert(
  classifyRole("Sales Rep", { reviewRatio: 0.3 }) === "direct_revenue",
  "Sales Rep with low review ratio → stays direct_revenue"
);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Intangible Score Calculation
// ═══════════════════════════════════════════════════════════════════════════

section("2. Intangible Score Calculation");

// All dimensions present
const fullDimensions: DimensionScores = {
  responsiveness: 80,
  outputVolume: 90,
  qualitySignal: 70,
  collaboration: 85,
  reliability: 95,
  managerAssessment: 75,
};

const scoreDR = calculateIntangibleScore(fullDimensions, "direct_revenue");
// Weights: resp 0.10, output 0.30, quality 0.25, collab 0.05, reliability 0.15, manager 0.15
// = 80*0.10 + 90*0.30 + 70*0.25 + 85*0.05 + 95*0.15 + 75*0.15
// = 8 + 27 + 17.5 + 4.25 + 14.25 + 11.25 = 82.25
assertClose(scoreDR, 82.25, 0.01, "Direct revenue full dimensions = 82.25");

const scoreEnabler = calculateIntangibleScore(fullDimensions, "enabler");
// Weights: resp 0.20, output 0.15, quality 0.20, collab 0.25, reliability 0.10, manager 0.10
// = 80*0.20 + 90*0.15 + 70*0.20 + 85*0.25 + 95*0.10 + 75*0.10
// = 16 + 13.5 + 14 + 21.25 + 9.5 + 7.5 = 81.75
assertClose(scoreEnabler, 81.75, 0.01, "Enabler full dimensions = 81.75");

const scoreSupport = calculateIntangibleScore(fullDimensions, "support");
// Weights: resp 0.25, output 0.15, quality 0.15, collab 0.20, reliability 0.15, manager 0.10
// = 80*0.25 + 90*0.15 + 70*0.15 + 85*0.20 + 95*0.15 + 75*0.10
// = 20 + 13.5 + 10.5 + 17 + 14.25 + 7.5 = 82.75
assertClose(scoreSupport, 82.75, 0.01, "Support full dimensions = 82.75");

// Missing dimensions — weight redistribution
const partialDimensions: DimensionScores = {
  responsiveness: 80,
  outputVolume: 90,
  qualitySignal: null,
  collaboration: null,
  reliability: null,
  managerAssessment: null,
};

const scorePartial = calculateIntangibleScore(partialDimensions, "direct_revenue");
// Only responsiveness (0.10) and outputVolume (0.30) have data. Total weight = 0.40
// Weighted sum = 80*0.10 + 90*0.30 = 8 + 27 = 35
// Redistributed: 35 / 0.40 = 87.5
assertClose(scorePartial, 87.5, 0.01, "Partial dimensions with redistribution = 87.5");

// All null dimensions
const emptyDimensions: DimensionScores = {
  responsiveness: null,
  outputVolume: null,
  qualitySignal: null,
  collaboration: null,
  reliability: null,
  managerAssessment: null,
};

const scoreEmpty = calculateIntangibleScore(emptyDimensions, "direct_revenue");
assert(scoreEmpty === 0, "All null dimensions → score 0");

// Single dimension
const singleDim: DimensionScores = {
  responsiveness: 72,
  outputVolume: null,
  qualitySignal: null,
  collaboration: null,
  reliability: null,
  managerAssessment: null,
};

const scoreSingle = calculateIntangibleScore(singleDim, "direct_revenue");
// Only responsiveness (0.10) has data. Redistributed: 72*0.10/0.10 = 72
assertClose(scoreSingle, 72, 0.01, "Single dimension redistributes to its own value");

// Clamping test
const clampedDim: DimensionScores = {
  responsiveness: 150, // over 100
  outputVolume: -10,   // below 0
  qualitySignal: 50,
  collaboration: null,
  reliability: null,
  managerAssessment: null,
};

const scoreClamped = calculateIntangibleScore(clampedDim, "direct_revenue");
// Clamped: resp=100, output=0, quality=50
// resp=100*0.10 + output=0*0.30 + quality=50*0.25 = 10 + 0 + 12.5 = 22.5
// Total weight = 0.10 + 0.30 + 0.25 = 0.65
// Redistributed: 22.5 / 0.65 = 34.615...
assertClose(scoreClamped, 34.62, 0.02, "Clamped dimensions (150→100, -10→0)");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Net Value Calculation
// ═══════════════════════════════════════════════════════════════════════════

section("3. Net Value Calculation");

// Basic calculation
const nv1 = calculateNetValue(5000, 80, 100, 3000);
// = 5000 + (80 * 100) - 3000 = 5000 + 8000 - 3000 = 10000
assertClose(nv1, 10000, 0.01, "Basic: 5000 + 80*100 - 3000 = 10000");

// Zero hard value (typical when no revenue collectors)
const nv2 = calculateNetValue(0, 75, 50, 5000);
// = 0 + (75 * 50) - 5000 = 3750 - 5000 = -1250
assertClose(nv2, -1250, 0.01, "Zero hard value: 0 + 75*50 - 5000 = -1250");

// Negative net value (costs exceed value)
const nv3 = calculateNetValue(0, 30, 50, 8000);
// = 0 + (30 * 50) - 8000 = 1500 - 8000 = -6500
assertClose(nv3, -6500, 0.01, "Negative net value: 0 + 30*50 - 8000 = -6500");

// Zero cost (e.g., volunteer or intern)
const nv4 = calculateNetValue(2000, 60, 50, 0);
// = 2000 + (60 * 50) - 0 = 2000 + 3000 = 5000
assertClose(nv4, 5000, 0.01, "Zero cost: 2000 + 60*50 = 5000");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Intangible Multiplier
// ═══════════════════════════════════════════════════════════════════════════

section("4. Intangible Multiplier");

// Known revenue and employee count
const mult1 = calculateIntangibleMultiplier(1_000_000, 10);
// revenue per employee = 100,000 / 100 = 1000
assertClose(mult1, 1000, 0.01, "$1M rev / 10 employees → multiplier 1000");

const mult2 = calculateIntangibleMultiplier(500_000, 100);
// revenue per employee = 5000 / 100 = 50
assertClose(mult2, 50, 0.01, "$500K rev / 100 employees → multiplier 50");

// Null revenue fallback
const mult3 = calculateIntangibleMultiplier(null, 10);
assert(mult3 === 50, "Null revenue → fallback 50");

// Zero revenue fallback
const mult4 = calculateIntangibleMultiplier(0, 10);
assert(mult4 === 50, "Zero revenue → fallback 50");

// Zero employees fallback
const mult5 = calculateIntangibleMultiplier(1_000_000, 0);
assert(mult5 === 50, "Zero employees → fallback 50");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: Confidence Tier
// ═══════════════════════════════════════════════════════════════════════════

section("5. Confidence Tier");

assert(
  determineConfidence(["slack", "github", "jira"]) === "measured",
  "3 sources → measured"
);
assert(
  determineConfidence(["slack", "github", "jira", "gmail"]) === "measured",
  "4 sources → measured"
);
assert(
  determineConfidence(["slack", "github"]) === "partial",
  "2 sources → partial"
);
assert(
  determineConfidence(["slack"]) === "partial",
  "1 source → partial"
);
assert(
  determineConfidence([]) === "estimated",
  "0 sources → estimated"
);

// New hire override
const recentStart = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(); // 15 days ago
assert(
  determineConfidence(["slack", "github", "jira"], recentStart) === "evaluating",
  "New hire (15 days) with 3 sources → evaluating (overrides measured)"
);

const oldStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days ago
assert(
  determineConfidence(["slack", "github", "jira"], oldStart) === "measured",
  "Tenured employee (90 days) with 3 sources → measured"
);

// Deduplicated sources
assert(
  determineConfidence(["slack", "slack", "slack"]) === "partial",
  "3 duplicate sources → partial (unique count = 1)"
);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: Time Weighting
// ═══════════════════════════════════════════════════════════════════════════

section("6. Time Weighting (30-day rolling average)");

const now = new Date();

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

const events: ScoringEvent[] = [
  { id: "1", employeeId: "e1", source: "slack", eventType: "responsiveness", data: { value: 90 }, createdAt: daysAgo(2) },
  { id: "2", employeeId: "e1", source: "slack", eventType: "responsiveness", data: { value: 80 }, createdAt: daysAgo(10) },
  { id: "3", employeeId: "e1", source: "slack", eventType: "responsiveness", data: { value: 70 }, createdAt: daysAgo(20) },
  { id: "4", employeeId: "e1", source: "slack", eventType: "responsiveness", data: { value: 50 }, createdAt: daysAgo(35) }, // dropped (>30 days)
  { id: "5", employeeId: "e1", source: "github", eventType: "output", data: { value: 85 }, createdAt: daysAgo(5) },
];

const weighted = applyTimeWeighting(events);

// responsiveness: (90*3 + 80*2 + 70*1) / (3+2+1) = (270+160+70)/6 = 500/6 = 83.33
const respWeighted = weighted.get("responsiveness");
assert(respWeighted !== undefined, "Responsiveness events weighted");
if (respWeighted !== undefined) {
  assertClose(respWeighted, 83.33, 0.02, "Responsiveness weighted avg = 83.33");
}

// output: 85*3 / 3 = 85
const outputWeighted = weighted.get("output");
assert(outputWeighted !== undefined, "Output events weighted");
if (outputWeighted !== undefined) {
  assertClose(outputWeighted, 85, 0.01, "Output weighted avg = 85");
}

// Dropped event (>30 days) should not appear
assert(!weighted.has("dropped"), "Events >30 days dropped");

// Non-numeric values should be skipped
const nonNumericEvents: ScoringEvent[] = [
  { id: "6", employeeId: "e1", source: "test", eventType: "text", data: { value: "not a number" }, createdAt: daysAgo(1) },
];
const nonNumResult = applyTimeWeighting(nonNumericEvents);
assert(nonNumResult.size === 0, "Non-numeric event data skipped");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 6B: Performance Adjustment & Hard Value Estimation
// ═══════════════════════════════════════════════════════════════════════════

section("6B. Performance Adjustment Factor");

// No measured data → 1.0 (trust benchmark)
assertClose(performanceAdjustment(0, false), 1.0, 0.001, "No data: factor=1.0 regardless of score");
assertClose(performanceAdjustment(100, false), 1.0, 0.001, "No data: factor=1.0 even with high score");

// Measured data — linear scaling
assertClose(performanceAdjustment(0, true), 0.5, 0.001, "Score 0: factor=0.5 (half benchmark)");
assertClose(performanceAdjustment(25, true), 0.75, 0.001, "Score 25: factor=0.75");
assertClose(performanceAdjustment(50, true), 1.0, 0.001, "Score 50: factor=1.0 (average=benchmark)");
assertClose(performanceAdjustment(75, true), 1.1, 0.001, "Score 75: factor=1.1");
assertClose(performanceAdjustment(100, true), 1.2, 0.001, "Score 100: factor=1.2 (exceptional)");

// Hard value estimation
const hv1 = estimateHardValue(120000, "Sales Rep", "direct_revenue", "saas", 50, true);
// SaaS sales = 4.0x, perf=1.0 → (120K/12)*4.0*1.0 = $40,000
assertClose(hv1, 40000, 1, "SaaS Sales Rep $120K, avg perf → $40K/mo");

const hv2 = estimateHardValue(120000, "Sales Rep", "direct_revenue", "saas", 100, true);
// perf=1.2 → $40,000*1.2 = $48,000
assertClose(hv2, 48000, 1, "SaaS Sales Rep $120K, perfect perf → $48K/mo");

const hv3 = estimateHardValue(120000, "Sales Rep", "direct_revenue", "saas", 0, true);
// perf=0.5 → $40,000*0.5 = $20,000
assertClose(hv3, 20000, 1, "SaaS Sales Rep $120K, zero perf → $20K/mo");

const hv4 = estimateHardValue(0, "Sales Rep", "direct_revenue", "saas");
assert(hv4 === 0, "Zero salary → zero hard value");

const hv5 = estimateHardValue(null, "Sales Rep", "direct_revenue", "saas");
assert(hv5 === 0, "Null salary → zero hard value");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: Full Employee Scoring (25 Synthetic Employees)
// ═══════════════════════════════════════════════════════════════════════════

section("7. Full Employee Scoring — 25 Synthetic Employees");

// Company context: SaaS company, $2M annual revenue, 20 employees
const companyContext: CompanyContext = {
  orgId: "org_test",
  totalRevenue: 2_000_000 / 12, // monthly
  employeeCount: 20,
  industry: "saas",
};
// Intangible multiplier: (2M/12)/20 / 100 = 8333.33/100 = 83.33

type TestEmployee = {
  employee: EmployeeScoringInput;
  dimensions: DimensionData;
  label: string;
};

function makeDimData(
  resp: number | null,
  output: number | null,
  quality: number | null,
  collab: number | null,
  reliability: number | null,
  manager: number | null,
  source: string = "test"
): DimensionData {
  return {
    responsiveness: resp !== null ? { score: resp, sources: [source] } : null,
    outputVolume: output !== null ? { score: output, sources: [source] } : null,
    qualitySignal: quality !== null ? { score: quality, sources: [source] } : null,
    collaboration: collab !== null ? { score: collab, sources: [source] } : null,
    reliability: reliability !== null ? { score: reliability, sources: [source] } : null,
    managerAssessment: manager !== null ? { score: manager, sources: [source] } : null,
  };
}

function makeDimDataMultiSource(
  resp: number | null,
  output: number | null,
  quality: number | null,
  collab: number | null,
  reliability: number | null,
  manager: number | null,
  sources: string[]
): DimensionData {
  const src = sources;
  return {
    responsiveness: resp !== null ? { score: resp, sources: [...src] } : null,
    outputVolume: output !== null ? { score: output, sources: [...src] } : null,
    qualitySignal: quality !== null ? { score: quality, sources: [...src] } : null,
    collaboration: collab !== null ? { score: collab, sources: [...src] } : null,
    reliability: reliability !== null ? { score: reliability, sources: [...src] } : null,
    managerAssessment: manager !== null ? { score: manager, sources: [...src] } : null,
  };
}

const testEmployees: TestEmployee[] = [
  // ─── Tier 1: Full Data (3+ sources, all dimensions) ───────────────
  {
    label: "Star Sales Rep — all dimensions high",
    employee: { id: "e01", orgId: "org_test", name: "Alice Johnson", roleTitle: "Senior Account Executive", salary: 120000, startDate: "2024-01-15", roleType: null },
    dimensions: makeDimDataMultiSource(92, 95, 88, 78, 90, 85, ["slack", "github", "salesforce"]),
  },
  {
    label: "Top Engineer — excellent output & quality",
    employee: { id: "e02", orgId: "org_test", name: "Bob Chen", roleTitle: "Senior Software Engineer", salary: 160000, startDate: "2023-06-01", roleType: null },
    dimensions: makeDimDataMultiSource(75, 98, 95, 82, 92, 80, ["slack", "github", "jira"]),
  },
  {
    label: "CTO — high collaboration, moderate output",
    employee: { id: "e03", orgId: "org_test", name: "Carol Williams", roleTitle: "CTO", salary: 200000, startDate: "2022-01-01", roleType: null },
    dimensions: makeDimDataMultiSource(88, 60, 75, 95, 90, 92, ["slack", "github", "jira"]),
  },
  {
    label: "Mediocre Developer — average everything",
    employee: { id: "e04", orgId: "org_test", name: "Dan Miller", roleTitle: "Software Developer", salary: 95000, startDate: "2024-03-01", roleType: null },
    dimensions: makeDimDataMultiSource(50, 55, 52, 48, 60, 45, ["slack", "github", "jira"]),
  },
  {
    label: "Office Admin — high reliability & responsiveness",
    employee: { id: "e05", orgId: "org_test", name: "Eva Martinez", roleTitle: "Office Manager", salary: 55000, startDate: "2023-09-01", roleType: null },
    dimensions: makeDimDataMultiSource(95, 70, 80, 88, 98, 90, ["slack", "gmail", "jira"]),
  },

  // ─── Tier 2: Partial Data (1-2 sources, some dimensions) ──────────
  {
    label: "SDR — only Slack + Gmail data",
    employee: { id: "e06", orgId: "org_test", name: "Frank Lee", roleTitle: "SDR - Outbound", salary: 65000, startDate: "2024-06-01", roleType: null },
    dimensions: makeDimDataMultiSource(88, 72, null, 65, null, null, ["slack", "gmail"]),
  },
  {
    label: "Designer — only Jira data",
    employee: { id: "e07", orgId: "org_test", name: "Grace Kim", roleTitle: "UI/UX Designer", salary: 90000, startDate: "2024-01-15", roleType: null },
    dimensions: makeDimData(null, 85, 78, null, 70, null, "jira"),
  },
  {
    label: "PM — only Slack data",
    employee: { id: "e08", orgId: "org_test", name: "Henry Patel", roleTitle: "Product Manager", salary: 130000, startDate: "2023-11-01", roleType: null },
    dimensions: makeDimData(82, null, null, 90, null, null, "slack"),
  },
  {
    label: "Marketing Manager — Slack + Gmail",
    employee: { id: "e09", orgId: "org_test", name: "Iris Wang", roleTitle: "Marketing Manager", salary: 85000, startDate: "2024-02-01", roleType: null },
    dimensions: makeDimDataMultiSource(78, 65, null, 72, 80, null, ["slack", "gmail"]),
  },
  {
    label: "QA Engineer — only GitHub data",
    employee: { id: "e10", orgId: "org_test", name: "Jake Thompson", roleTitle: "QA Engineer", salary: 80000, startDate: "2024-04-01", roleType: null },
    dimensions: makeDimData(null, 70, 92, null, 88, null, "github"),
  },

  // ─── Tier 3: No Integration Data (benchmark only) ──────────────────
  {
    label: "New Sales Rep — no data yet",
    employee: { id: "e11", orgId: "org_test", name: "Kate Brown", roleTitle: "Account Executive", salary: 90000, startDate: "2025-01-01", roleType: null },
    dimensions: makeDimData(null, null, null, null, null, null),
  },
  {
    label: "Finance Manager — no integrations",
    employee: { id: "e12", orgId: "org_test", name: "Leo Garcia", roleTitle: "Finance Manager", salary: 95000, startDate: "2023-08-01", roleType: null },
    dimensions: makeDimData(null, null, null, null, null, null),
  },
  {
    label: "HR Specialist — no data",
    employee: { id: "e13", orgId: "org_test", name: "Mia Robinson", roleTitle: "HR Specialist", salary: 60000, startDate: "2024-05-01", roleType: null },
    dimensions: makeDimData(null, null, null, null, null, null),
  },

  // ─── Edge Cases ────────────────────────────────────────────────────
  {
    label: "New Hire (2 weeks ago) — evaluating tier",
    employee: { id: "e14", orgId: "org_test", name: "Noah Davis", roleTitle: "Junior Developer", salary: 70000, startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), roleType: null },
    dimensions: makeDimDataMultiSource(60, 50, 55, 45, 40, null, ["slack", "github", "jira"]),
  },
  {
    label: "Overpaid underperformer — should rank low",
    employee: { id: "e15", orgId: "org_test", name: "Olivia Wilson", roleTitle: "Consultant", salary: 180000, startDate: "2023-01-01", roleType: null },
    dimensions: makeDimDataMultiSource(30, 25, 35, 20, 40, 25, ["slack", "github", "jira"]),
  },
  {
    label: "Underpaid star — should rank high",
    employee: { id: "e16", orgId: "org_test", name: "Peter Clark", roleTitle: "Software Developer", salary: 55000, startDate: "2023-03-01", roleType: null },
    dimensions: makeDimDataMultiSource(92, 95, 90, 88, 96, 90, ["slack", "github", "jira"]),
  },
  {
    label: "Zero salary (intern/volunteer)",
    employee: { id: "e17", orgId: "org_test", name: "Quinn Adams", roleTitle: "Intern", salary: 0, startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), roleType: null },
    dimensions: makeDimData(50, 40, 45, 60, 55, null, "slack"),
  },
  {
    label: "Manager with only manager assessment",
    employee: { id: "e18", orgId: "org_test", name: "Rachel Green", roleTitle: "Director of Sales", salary: 150000, startDate: "2022-06-01", roleType: null },
    dimensions: makeDimData(null, null, null, null, null, 88, "manager_input"),
  },
  {
    label: "High output but terrible quality",
    employee: { id: "e19", orgId: "org_test", name: "Sam Foster", roleTitle: "Junior Developer", salary: 65000, startDate: "2024-07-01", roleType: null },
    dimensions: makeDimDataMultiSource(60, 95, 15, 40, 30, 35, ["slack", "github", "jira"]),
  },
  {
    label: "Perfect reliability but slow",
    employee: { id: "e20", orgId: "org_test", name: "Tina Brooks", roleTitle: "Senior QA Engineer", salary: 85000, startDate: "2023-04-01", roleType: null },
    dimensions: makeDimDataMultiSource(25, 45, 95, 70, 100, 80, ["slack", "github", "jira"]),
  },

  // ─── Different role type overrides ─────────────────────────────────
  {
    label: "Explicit direct_revenue override",
    employee: { id: "e21", orgId: "org_test", name: "Uma Singh", roleTitle: "Solutions Consultant", salary: 110000, startDate: "2023-10-01", roleType: "direct_revenue" },
    dimensions: makeDimDataMultiSource(80, 75, 82, 70, 85, 78, ["slack", "github", "jira"]),
  },
  {
    label: "Explicit enabler override",
    employee: { id: "e22", orgId: "org_test", name: "Victor Nguyen", roleTitle: "Senior Developer", salary: 140000, startDate: "2023-02-01", roleType: "enabler" },
    dimensions: makeDimDataMultiSource(85, 80, 78, 92, 88, 82, ["slack", "github", "jira"]),
  },
  {
    label: "Explicit support override",
    employee: { id: "e23", orgId: "org_test", name: "Wendy Taylor", roleTitle: "Data Analyst", salary: 75000, startDate: "2024-01-01", roleType: "support" },
    dimensions: makeDimDataMultiSource(90, 70, 85, 80, 92, 75, ["slack", "github", "jira"]),
  },

  // ─── Extreme outliers ──────────────────────────────────────────────
  {
    label: "All perfect 100s",
    employee: { id: "e24", orgId: "org_test", name: "Xavier Moore", roleTitle: "Sales Manager", salary: 100000, startDate: "2023-01-01", roleType: null },
    dimensions: makeDimDataMultiSource(100, 100, 100, 100, 100, 100, ["slack", "github", "jira"]),
  },
  {
    label: "All zeros",
    employee: { id: "e25", orgId: "org_test", name: "Yara Lewis", roleTitle: "Support Agent", salary: 45000, startDate: "2024-01-01", roleType: null },
    dimensions: makeDimDataMultiSource(0, 0, 0, 0, 0, 0, ["slack", "github", "jira"]),
  },
];

// Run scoring
console.log("\n  Scoring all employees...\n");

type ScoredEmployee = ReturnType<typeof scoreEmployee> & { label: string; name: string; salary: number };
const scoredEmployees: ScoredEmployee[] = [];

for (const { employee, dimensions, label } of testEmployees) {
  const result = scoreEmployee(employee, dimensions, companyContext);
  scoredEmployees.push({
    ...result,
    label,
    name: employee.name,
    salary: employee.salary ?? 0,
  });
}

// Sort by netValue descending (same as ranking)
scoredEmployees.sort((a, b) => b.netValue - a.netValue);

// ─── Print the leaderboard ──────────────────────────────────────────────────

console.log("  ┌────┬────────────────────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┬────────────┬───────────────┐");
console.log("  │ #  │ Employee                               │ Role Type    │ Intangible   │ Total Cost   │ Net Value    │ Confidence │ Measured Dims │");
console.log("  ├────┼────────────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────┼───────────────┤");

for (let i = 0; i < scoredEmployees.length; i++) {
  const e = scoredEmployees[i];
  const rank = String(i + 1).padStart(2);
  const name = `${e.name}`.padEnd(38);
  const role = e.roleType.padEnd(12);
  const intangible = e.intangibleScore.toFixed(1).padStart(10);
  const cost = `$${e.totalCost.toFixed(0)}`.padStart(10);
  const netVal = `$${e.netValue.toFixed(0)}`.padStart(10);
  const conf = e.confidence.padEnd(10);
  const dims = `${countMeasuredDimensions(e.dimensions)}/6`.padStart(11);

  console.log(`  │ ${rank} │ ${name} │ ${role} │ ${intangible}   │ ${cost}   │ ${netVal}   │ ${conf} │ ${dims}   │`);
}

console.log("  └────┴────────────────────────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┴────────────┴───────────────┘");

// ─── Validate ranking sanity ─────────────────────────────────────────────────

section("8. Ranking Sanity Checks");

// Find specific employees by ID
const byId = (id: string) => scoredEmployees.find((e) => e.employeeId === id)!;
const rankOf = (id: string) => scoredEmployees.findIndex((e) => e.employeeId === id) + 1;

// Underpaid star should rank above overpaid underperformer
assert(
  rankOf("e16") < rankOf("e15"),
  "Underpaid star (Peter) ranks above overpaid underperformer (Olivia)"
);

// Star sales rep should rank reasonably high
assert(
  rankOf("e01") <= 10,
  `Star sales rep (Alice) ranks in top 10 (actual: ${rankOf("e01")})`
);

// All-100s employee should be in top 5 (salary differences can affect absolute ranking)
assert(
  rankOf("e24") <= 5,
  `All-100s employee (Xavier) is in top 5 (actual: ${rankOf("e24")})`
);

// All-zeros should be near the bottom
assert(
  rankOf("e25") >= 20,
  `All-zeros employee (Yara) is near bottom (actual: ${rankOf("e25")})`
);

// No-data employees (e11, e12, e13) should rank below data-rich high performers.
// With benchmark-estimated hard value, they can have positive net value, but should
// rank lower than employees with measured data and high scores.
assert(
  rankOf("e11") > rankOf("e01"),
  `No-data sales rep (Kate) ranks below measured star sales rep (Alice): Kate=${rankOf("e11")}, Alice=${rankOf("e01")}`
);

// Intern (zero salary) should have zero total cost
assert(
  byId("e17").totalCost === 0,
  `Intern (Quinn) has zero cost (actual: $${byId("e17").totalCost})`
);

// High output/bad quality dev should score lower than balanced dev
assert(
  byId("e04").intangibleScore > byId("e19").intangibleScore || rankOf("e04") < rankOf("e19"),
  "Balanced mediocre dev scores vs high-output-low-quality"
);

// CTO as enabler should value collaboration and responsiveness more
assert(
  byId("e03").roleType === "enabler",
  `CTO classified as enabler (actual: ${byId("e03").roleType})`
);

// New hire should be "evaluating"
assert(
  byId("e14").confidence === "evaluating",
  `New hire (Noah) confidence = evaluating (actual: ${byId("e14").confidence})`
);

// No-data employees should be "estimated"
assert(
  byId("e11").confidence === "estimated",
  `No-data employee (Kate) confidence = estimated (actual: ${byId("e11").confidence})`
);

// Multi-source employees should be "measured"
assert(
  byId("e01").confidence === "measured",
  `Full-data employee (Alice) confidence = measured (actual: ${byId("e01").confidence})`
);

// Explicit role type override works
assert(
  byId("e21").roleType === "direct_revenue",
  `Explicit override (Uma) → direct_revenue (actual: ${byId("e21").roleType})`
);
assert(
  byId("e22").roleType === "enabler",
  `Explicit override (Victor) → enabler (actual: ${byId("e22").roleType})`
);
assert(
  byId("e23").roleType === "support",
  `Explicit override (Wendy) → support (actual: ${byId("e23").roleType})`
);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 9: Weakest Dimensions
// ═══════════════════════════════════════════════════════════════════════════

section("9. Weakest Dimensions & Goal Targeting");

const weakest = getWeakestDimensions(fullDimensions, "direct_revenue", 3);
assert(weakest.length === 3, "Returns 3 weakest dimensions");
// Full dims: resp=80, output=90, quality=70, collab=85, reliability=95, manager=75
// Sorted ascending: quality=70, manager=75, resp=80
assert(
  weakest[0].dimension === "qualitySignal",
  `Weakest dim is qualitySignal (actual: ${weakest[0].dimension}, score: ${weakest[0].score})`
);
assert(
  weakest[1].dimension === "managerAssessment",
  `2nd weakest is managerAssessment (actual: ${weakest[1].dimension}, score: ${weakest[1].score})`
);

// Partial dimensions — should only return dims with data
const weakestPartial = getWeakestDimensions(partialDimensions, "direct_revenue", 3);
assert(
  weakestPartial.length === 2,
  `Partial data: only 2 dims available (actual: ${weakestPartial.length})`
);

// Empty dimensions
const weakestEmpty = getWeakestDimensions(emptyDimensions, "direct_revenue", 3);
assert(
  weakestEmpty.length === 0,
  `No data: 0 weakest dims (actual: ${weakestEmpty.length})`
);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 10: Projected Impact
// ═══════════════════════════════════════════════════════════════════════════

section("10. Projected Impact");

const impact = projectedImpact(fullDimensions, "direct_revenue", "qualitySignal", 20);
// Current quality = 70, improved to 90
// Current intangible: 82.25 (calculated above)
// New: resp=80*0.10 + output=90*0.30 + quality=90*0.25 + collab=85*0.05 + rel=95*0.15 + mgr=75*0.15
// = 8 + 27 + 22.5 + 4.25 + 14.25 + 11.25 = 87.25
// Impact = 87.25 - 82.25 = 5.0
assertClose(impact, 5, 0.01, "Improving quality from 70→90: impact = 5.0 points");

const impactSmall = projectedImpact(fullDimensions, "direct_revenue", "collaboration", 10);
// collab weight for direct_revenue is 0.05, so +10 improvement gives +0.5 impact
assertClose(impactSmall, 0.5, 0.01, "Low-weight dimension (+10 collab for DR): impact = 0.5");

const impactLargeWeight = projectedImpact(fullDimensions, "direct_revenue", "outputVolume", 10);
// output weight for direct_revenue is 0.30, currently 90→100 (capped)
// But improvement would be 90+10=100
// Impact = 100*0.30 - 90*0.30 = 30-27 = 3.0
assertClose(impactLargeWeight, 3, 0.01, "High-weight dimension (+10 output for DR): impact = 3.0");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 11: Benchmark Lookups
// ═══════════════════════════════════════════════════════════════════════════

section("11. Industry Benchmarks");

// SaaS sales rep at medium company
const b1 = getIndustryBenchmark("saas", "medium", "Sales Rep");
assert(b1.revenueMultiplier === 4.0, `SaaS Sales Rep medium: multiplier=${b1.revenueMultiplier} (expected 4.0)`);
assert(b1._source === "industry_estimate", "Source is industry_estimate");

// Same role at tiny company — should be higher (1.4x)
const b2 = getIndustryBenchmark("saas", "tiny", "Sales Rep");
assertClose(b2.revenueMultiplier, 5.6, 0.01, `SaaS Sales Rep tiny: multiplier=${b2.revenueMultiplier} (expected 5.6)`);

// Agency designer
const b3 = getIndustryBenchmark("agency", 15, "Designer");
assertClose(b3.revenueMultiplier, 3.6, 0.01, `Agency Designer small(15): multiplier=${b3.revenueMultiplier} (expected 3.0*1.2=3.6)`);

// Unknown industry falls back to general
const b4 = getIndustryBenchmark("fintech", "medium", "Developer");
assert(b4.revenueMultiplier === 2.0, `Unknown industry (fintech) → general Developer: multiplier=${b4.revenueMultiplier}`);

// Company size classification
assert(classifyCompanySize(3) === "tiny", "3 employees → tiny");
assert(classifyCompanySize(5) === "tiny", "5 employees → tiny");
assert(classifyCompanySize(6) === "small", "6 employees → small");
assert(classifyCompanySize(20) === "small", "20 employees → small");
assert(classifyCompanySize(21) === "medium", "21 employees → medium");
assert(classifyCompanySize(100) === "medium", "100 employees → medium");
assert(classifyCompanySize(101) === "large", "101 employees → large");
assert(classifyCompanySize(500) === "large", "500 employees → large");

// FTE benchmarks
const fte1 = getFTEBenchmark("saas", 20, 2_000_000);
assert(fte1.total > 0, `SaaS FTE benchmark total: ${fte1.total}`);
assert(fte1.engineering >= 2, `SaaS FTE engineering: ${fte1.engineering} (should be >= 2)`);
assert(fte1._source === "industry_estimate", "FTE source is industry_estimate");

// Defaults
assert(getDefaultIntangibleScore("direct_revenue") === 65, "Default intangible for direct_revenue = 65");
assert(getDefaultIntangibleScore("enabler") === 60, "Default intangible for enabler = 60");
assert(getDefaultIntangibleScore("support") === 55, "Default intangible for support = 55");

assert(getDefaultRevenueMultiplier("direct_revenue") === 2.5, "Default rev multiplier for direct_revenue = 2.5");
assert(getDefaultRevenueMultiplier("enabler") === 1.5, "Default rev multiplier for enabler = 1.5");
assert(getDefaultRevenueMultiplier("support") === 0.7, "Default rev multiplier for support = 0.7");


// ═══════════════════════════════════════════════════════════════════════════
// TEST 12: Score Distributions & Fairness
// ═══════════════════════════════════════════════════════════════════════════

section("12. Score Distribution Analysis");

const intangibleScores = scoredEmployees.map(e => e.intangibleScore);
const nonZeroScores = intangibleScores.filter(s => s > 0);
const netValues = scoredEmployees.map(e => e.netValue);

const avgIntangible = nonZeroScores.reduce((a, b) => a + b, 0) / (nonZeroScores.length || 1);
const minIntangible = Math.min(...nonZeroScores);
const maxIntangible = Math.max(...nonZeroScores);
const spread = maxIntangible - minIntangible;

console.log(`\n  Intangible Scores (non-zero): min=${minIntangible.toFixed(1)}, avg=${avgIntangible.toFixed(1)}, max=${maxIntangible.toFixed(1)}, spread=${spread.toFixed(1)}`);
console.log(`  Net Values: min=$${Math.min(...netValues).toFixed(0)}, avg=$${(netValues.reduce((a,b) => a+b, 0) / netValues.length).toFixed(0)}, max=$${Math.max(...netValues).toFixed(0)}`);

// Sanity: spread should be meaningful (at least 30 points between worst and best)
assert(spread >= 30, `Score spread is meaningful: ${spread.toFixed(1)} (should be >= 30)`);

// Net values should have both positive and negative
const hasPositive = netValues.some(v => v > 0);
const hasNegative = netValues.some(v => v < 0);
assert(hasPositive, "At least one employee has positive net value");
assert(hasNegative, "At least one employee has negative net value (costs > value)");

// Role types should distribute correctly
const roleTypes = scoredEmployees.map(e => e.roleType);
const drCount = roleTypes.filter(r => r === "direct_revenue").length;
const enCount = roleTypes.filter(r => r === "enabler").length;
const suCount = roleTypes.filter(r => r === "support").length;
console.log(`  Role distribution: direct_revenue=${drCount}, enabler=${enCount}, support=${suCount}`);
assert(drCount >= 3, `At least 3 direct_revenue (actual: ${drCount})`);
assert(enCount >= 3, `At least 3 enabler (actual: ${enCount})`);
assert(suCount >= 5, `At least 5 support (actual: ${suCount})`);

// Confidence tiers
const confTiers = scoredEmployees.map(e => e.confidence);
const measuredCount = confTiers.filter(c => c === "measured").length;
const partialCount = confTiers.filter(c => c === "partial").length;
const estimatedCount = confTiers.filter(c => c === "estimated").length;
const evaluatingCount = confTiers.filter(c => c === "evaluating").length;
console.log(`  Confidence tiers: measured=${measuredCount}, partial=${partialCount}, estimated=${estimatedCount}, evaluating=${evaluatingCount}`);
assert(measuredCount >= 5, `At least 5 measured (actual: ${measuredCount})`);
assert(partialCount >= 3, `At least 3 partial (actual: ${partialCount})`);
assert(estimatedCount >= 2, `At least 2 estimated (actual: ${estimatedCount})`);
assert(evaluatingCount >= 1, `At least 1 evaluating (actual: ${evaluatingCount})`);


// ═══════════════════════════════════════════════════════════════════════════
// TEST 13: Edge Cases & Invariants
// ═══════════════════════════════════════════════════════════════════════════

section("13. Edge Cases & Invariants");

// All intangible scores should be in [0, 100]
for (const e of scoredEmployees) {
  assert(
    e.intangibleScore >= 0 && e.intangibleScore <= 100,
    `${e.name} intangible in [0,100]: ${e.intangibleScore}`
  );
}

// Each dimension score should be in [0, 100] or null
for (const e of scoredEmployees) {
  for (const dim of ["responsiveness", "outputVolume", "qualitySignal", "collaboration", "reliability", "managerAssessment"] as const) {
    const val = e.dimensions[dim];
    if (val !== null) {
      assert(
        val >= 0 && val <= 100,
        `${e.name}.${dim} in [0,100]: ${val}`
      );
    }
  }
}

// Total cost should never be negative
for (const e of scoredEmployees) {
  assert(e.totalCost >= 0, `${e.name} total cost >= 0: $${e.totalCost}`);
}

// CountMeasuredDimensions should match actual data
assert(countMeasuredDimensions(fullDimensions) === 6, "Full dimensions: 6 measured");
assert(countMeasuredDimensions(partialDimensions) === 2, "Partial dimensions: 2 measured");
assert(countMeasuredDimensions(emptyDimensions) === 0, "Empty dimensions: 0 measured");


// ═══════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════

section("RESULTS");

console.log(`\n  Total: ${passed + failed} tests`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failures.length > 0) {
  console.log("\n  Failures:");
  for (const f of failures) {
    console.log(`    ✗ ${f}`);
  }
}

console.log("");
process.exit(failed > 0 ? 1 : 0);
