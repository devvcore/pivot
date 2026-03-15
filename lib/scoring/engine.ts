// ═══════════════════════════════════════════════════════════════
// Pivot — Employee Value Scoring Engine
//
// Core scoring calculations for the Employee Value Engine.
// Net Value = Hard Value + (Intangible Score x Intangible Multiplier) - Total Cost
//
// All scores are traceable to data sources. No guesses, no fills.
// If a dimension has no data, it is excluded and weights redistribute.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from "@/lib/supabase/admin";
import { getIndustryBenchmark } from "./benchmarks";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RoleType = "direct_revenue" | "enabler" | "support";
export type ConfidenceTier = "measured" | "partial" | "estimated" | "evaluating";

export type DimensionKey =
  | "responsiveness"
  | "outputVolume"
  | "qualitySignal"
  | "collaboration"
  | "reliability"
  | "managerAssessment";

export interface DimensionScores {
  responsiveness: number | null;
  outputVolume: number | null;
  qualitySignal: number | null;
  collaboration: number | null;
  reliability: number | null;
  managerAssessment: number | null;
}

export interface EmployeeScoreResult {
  employeeId: string;
  hardValue: number;
  totalCost: number;
  netValue: number;
  intangibleScore: number;
  dimensions: DimensionScores;
  roleType: RoleType;
  confidence: ConfidenceTier;
  dataSources: string[];
  rank: number;
  rankChange: number;
}

/** A timestamped event used for 30-day rolling weighted average */
export interface ScoringEvent {
  id: string;
  employeeId: string;
  source: string;
  eventType: string;
  data: Record<string, any>;
  createdAt: string; // ISO timestamp
}

/** Input data for scoring a single employee */
export interface EmployeeScoringInput {
  id: string;
  orgId: string;
  name: string;
  roleTitle: string | null;
  salary: number | null;
  startDate: string | null;
  roleType: RoleType | null;
}

/** Dimension data gathered from collectors */
export interface DimensionData {
  responsiveness: { score: number; sources: string[] } | null;
  outputVolume: { score: number; sources: string[] } | null;
  qualitySignal: { score: number; sources: string[] } | null;
  collaboration: { score: number; sources: string[] } | null;
  reliability: { score: number; sources: string[] } | null;
  managerAssessment: { score: number; sources: string[] } | null;
}

/** Company context needed for scoring calculations */
export interface CompanyContext {
  orgId: string;
  totalRevenue: number | null;
  employeeCount: number;
  industry: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Role-type weight splits between hard value and intangible value.
 * From design doc Section 2.
 */
const ROLE_VALUE_WEIGHTS: Record<RoleType, { hard: number; intangible: number }> = {
  direct_revenue: { hard: 0.7, intangible: 0.3 },
  enabler: { hard: 0.4, intangible: 0.6 },
  support: { hard: 0.1, intangible: 0.9 },
};

/**
 * Dimension weights by role type. Each row sums to 1.0.
 * From design doc Section 3.
 */
const DIMENSION_WEIGHTS: Record<RoleType, Record<DimensionKey, number>> = {
  direct_revenue: {
    responsiveness: 0.10,
    outputVolume: 0.30,
    qualitySignal: 0.25,
    collaboration: 0.05,
    reliability: 0.15,
    managerAssessment: 0.15,
  },
  enabler: {
    responsiveness: 0.20,
    outputVolume: 0.15,
    qualitySignal: 0.20,
    collaboration: 0.25,
    reliability: 0.10,
    managerAssessment: 0.10,
  },
  support: {
    responsiveness: 0.25,
    outputVolume: 0.15,
    qualitySignal: 0.15,
    collaboration: 0.20,
    reliability: 0.15,
    managerAssessment: 0.10,
  },
};

/**
 * Time-decay weights for the 30-day rolling window.
 * Events in days 1-7 get 3x, 8-14 get 2x, 15-30 get 1x.
 */
const TIME_WEIGHTS = {
  recent: { maxDays: 7, weight: 3 },
  mid: { maxDays: 14, weight: 2 },
  older: { maxDays: 30, weight: 1 },
} as const;

/** All dimension keys for iteration */
const ALL_DIMENSIONS: DimensionKey[] = [
  "responsiveness",
  "outputVolume",
  "qualitySignal",
  "collaboration",
  "reliability",
  "managerAssessment",
];

/**
 * Keywords used for rule-based role classification.
 * The AI classifier runs on top of this as a fallback hierarchy:
 * 1. Explicit role_type set on employee record
 * 2. Job title keyword matching
 * 3. Default to "support"
 */
const ROLE_TITLE_KEYWORDS: Record<RoleType, string[]> = {
  direct_revenue: [
    "sales", "account executive", "account manager", "ae ", "bdr", "sdr",
    "business development", "consultant", "consulting", "revenue",
    "client success", "customer success", "client-facing",
    "solutions engineer", "solutions architect",
    "freelance", "contractor",
  ],
  enabler: [
    "project manager", "product manager", "pm ", "program manager",
    "team lead", "tech lead", "engineering manager", "architect",
    "director", "vp ", "vice president", "head of",
    "scrum master", "agile coach", "delivery manager",
    "cto", "cpo", "chief",
  ],
  support: [
    "hr ", "human resources", "admin", "administrative",
    "finance", "accounting", "accountant", "bookkeeper",
    "office manager", "operations", "ops ",
    "legal", "compliance", "recruiting", "recruiter",
    "marketing", "content", "designer", "design",
    "qa ", "quality assurance", "test ", "tester",
    "support", "helpdesk", "help desk",
    "data entry", "clerk",
  ],
};

// ─── Core Scoring Functions ──────────────────────────────────────────────────

/**
 * Classify an employee's role type from their job title.
 * Uses keyword matching against title. If no match found, defaults to "support".
 *
 * Activity pattern analysis (e.g., someone titled "Developer" who mostly does
 * code reviews gets classified as "enabler") is handled by the AI classifier
 * upstream — this function is the deterministic fallback.
 */
export function classifyRole(
  jobTitle: string | null,
  activityPatterns?: { primaryActivity?: string; reviewRatio?: number }
): RoleType {
  if (!jobTitle) return "support";

  const normalized = jobTitle.toLowerCase().trim();

  // If activity patterns suggest enabler behavior (e.g., >60% of activity is
  // reviews/unblocking rather than direct output), override to enabler.
  if (activityPatterns) {
    if (activityPatterns.reviewRatio !== undefined && activityPatterns.reviewRatio > 0.6) {
      return "enabler";
    }
    if (activityPatterns.primaryActivity === "management") {
      return "enabler";
    }
  }

  // Check each role type's keywords against the normalized title
  for (const roleType of ["direct_revenue", "enabler", "support"] as RoleType[]) {
    for (const keyword of ROLE_TITLE_KEYWORDS[roleType]) {
      if (normalized.includes(keyword)) {
        return roleType;
      }
    }
  }

  // Developer/engineer without explicit classification: default to direct_revenue
  // since they produce direct output. If their activity patterns later show they
  // are mostly reviewing/mentoring, the AI classifier will re-classify.
  if (
    normalized.includes("developer") ||
    normalized.includes("engineer") ||
    normalized.includes("programmer") ||
    normalized.includes("dev ")
  ) {
    return "direct_revenue";
  }

  return "support";
}

/**
 * Calculate the weighted intangible score from individual dimension scores.
 *
 * Missing data handling: If a dimension is null (no data), it is excluded from
 * the calculation and its weight is redistributed proportionally among the
 * remaining dimensions. This ensures we never fill with guesses.
 *
 * Returns a score from 0 to 100.
 */
export function calculateIntangibleScore(
  dimensions: DimensionScores,
  roleType: RoleType
): number {
  const weights = DIMENSION_WEIGHTS[roleType];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of ALL_DIMENSIONS) {
    const score = dimensions[dim];
    if (score === null || score === undefined) continue;

    // Clamp to 0-100 range
    const clamped = Math.max(0, Math.min(100, score));
    const weight = weights[dim];

    weightedSum += clamped * weight;
    totalWeight += weight;
  }

  // If no dimensions have data, return 0
  if (totalWeight === 0) return 0;

  // Redistribute: divide by the sum of weights that actually had data.
  // This proportionally scales up the available dimensions.
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * Calculate net value using the core formula.
 *
 * Net Value = Hard Value + (Intangible Score x Intangible Multiplier) - Total Cost
 *
 * intangibleMultiplier converts the 0-100 intangible score to a dollar value.
 * Example: avg revenue per employee = $8,000/mo
 *          intangible multiplier = $8,000 / 100 = $80 per point
 *          intangible score of 80 = 80 * $80 = $6,400
 */
export function calculateNetValue(
  hardValue: number,
  intangibleScore: number,
  intangibleMultiplier: number,
  totalCost: number
): number {
  const intangibleDollars = intangibleScore * intangibleMultiplier;
  return Math.round((hardValue + intangibleDollars - totalCost) * 100) / 100;
}

/**
 * Determine the intangible multiplier from company context.
 *
 * If totalRevenue and employeeCount are known:
 *   multiplier = (totalRevenue / employeeCount) / 100
 *
 * This converts a 0-100 intangible score into a dollar amount proportional
 * to the company's average revenue per employee.
 *
 * Falls back to a conservative default if data is missing.
 */
export function calculateIntangibleMultiplier(
  totalRevenue: number | null,
  employeeCount: number
): number {
  if (totalRevenue === null || totalRevenue <= 0 || employeeCount <= 0) {
    // Conservative fallback: $50 per intangible point
    // (equivalent to $5,000/mo revenue per employee)
    return 50;
  }

  const revenuePerEmployee = totalRevenue / employeeCount;
  return Math.round((revenuePerEmployee / 100) * 100) / 100;
}

/**
 * Determine confidence tier based on data sources available.
 *
 * - measured: 3+ distinct data sources
 * - partial: 1-2 data sources
 * - estimated: 0 data sources (benchmark only)
 * - evaluating: new hire with < 30 days tenure
 */
export function determineConfidence(
  dataSources: string[],
  startDate?: string | null
): ConfidenceTier {
  // Check for new hire first
  if (startDate) {
    const start = new Date(startDate);
    const now = new Date();
    const daysSinceStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceStart < 30) {
      return "evaluating";
    }
  }

  const uniqueSources = new Set(dataSources);
  if (uniqueSources.size >= 3) return "measured";
  if (uniqueSources.size >= 1) return "partial";
  return "estimated";
}

/**
 * Apply 30-day rolling weighted average to scoring events.
 *
 * Events from the last 7 days get 3x weight.
 * Events from 8-14 days get 2x weight.
 * Events from 15-30 days get 1x weight.
 * Events older than 30 days are dropped entirely.
 *
 * Returns the weighted average of numeric values in event data,
 * grouped by event type. Each group returns its weighted average.
 */
export function applyTimeWeighting(
  events: ScoringEvent[]
): Map<string, number> {
  const now = new Date();
  const results = new Map<string, { weightedSum: number; totalWeight: number }>();

  for (const event of events) {
    const eventDate = new Date(event.createdAt);
    const daysAgo = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);

    // Drop events older than 30 days
    if (daysAgo > 30) continue;

    // Determine time weight
    let timeWeight: number;
    if (daysAgo <= TIME_WEIGHTS.recent.maxDays) {
      timeWeight = TIME_WEIGHTS.recent.weight;
    } else if (daysAgo <= TIME_WEIGHTS.mid.maxDays) {
      timeWeight = TIME_WEIGHTS.mid.weight;
    } else {
      timeWeight = TIME_WEIGHTS.older.weight;
    }

    // Extract numeric value from event data
    const value = typeof event.data.value === "number" ? event.data.value : null;
    if (value === null) continue;

    const key = event.eventType;
    const existing = results.get(key) || { weightedSum: 0, totalWeight: 0 };
    existing.weightedSum += value * timeWeight;
    existing.totalWeight += timeWeight;
    results.set(key, existing);
  }

  // Convert to weighted averages
  const averages = new Map<string, number>();
  for (const [key, { weightedSum, totalWeight }] of results) {
    if (totalWeight > 0) {
      averages.set(key, Math.round((weightedSum / totalWeight) * 100) / 100);
    }
  }

  return averages;
}

/**
 * Extract dimension scores from raw dimension data, collecting all sources.
 */
function extractDimensions(dimensionData: DimensionData): {
  dimensions: DimensionScores;
  sources: string[];
} {
  const sources: string[] = [];
  const dimensions: DimensionScores = {
    responsiveness: null,
    outputVolume: null,
    qualitySignal: null,
    collaboration: null,
    reliability: null,
    managerAssessment: null,
  };

  // Map from DimensionData keys to DimensionScores keys
  const mapping: [keyof DimensionData, DimensionKey][] = [
    ["responsiveness", "responsiveness"],
    ["outputVolume", "outputVolume"],
    ["qualitySignal", "qualitySignal"],
    ["collaboration", "collaboration"],
    ["reliability", "reliability"],
    ["managerAssessment", "managerAssessment"],
  ];

  for (const [dataKey, dimKey] of mapping) {
    const entry = dimensionData[dataKey];
    if (entry !== null && entry !== undefined) {
      dimensions[dimKey] = Math.max(0, Math.min(100, entry.score));
      sources.push(...entry.sources);
    }
  }

  return { dimensions, sources };
}

/**
 * Calculate the total monthly cost for an employee.
 * Salary is the base. A standard 1.3x multiplier covers benefits,
 * payroll taxes, and overhead allocation.
 *
 * This is deliberately simple. Companies with detailed cost data from
 * HR integrations (ADP, Workday) will override this upstream.
 */
function estimateMonthlyTotalCost(annualSalary: number | null): number {
  if (annualSalary === null || annualSalary <= 0) return 0;

  const monthlySalary = annualSalary / 12;
  const overheadMultiplier = 1.3; // benefits + taxes + overhead
  return Math.round(monthlySalary * overheadMultiplier * 100) / 100;
}

/**
 * Calculate a performance adjustment factor for estimated hard value.
 *
 * Benchmark multipliers tell us what someone in this role SHOULD produce.
 * But if their measured intangible performance is terrible, they're probably
 * NOT producing at benchmark level. This factor scales the estimate:
 *
 *   Score 0  → 0.50x (terrible performer, probably half of benchmark)
 *   Score 50 → 1.00x (average = benchmark expectation)
 *   Score 100 → 1.20x (exceptional, likely exceeding benchmark by 20%)
 *
 * If no dimensions are measured (all null), we trust the benchmark as-is (1.0).
 */
export function performanceAdjustment(
  intangibleScore: number,
  hasMeasuredDimensions: boolean
): number {
  if (!hasMeasuredDimensions) return 1.0;

  if (intangibleScore >= 50) {
    // 50→1.0, 100→1.2 (linear)
    return 1.0 + (intangibleScore - 50) * 0.004;
  } else {
    // 0→0.5, 50→1.0 (linear)
    return 0.5 + intangibleScore * 0.01;
  }
}

/**
 * Estimate monthly hard value when no revenue collector data is available.
 *
 * Uses industry benchmark multipliers to estimate how much revenue an
 * employee generates based on their salary, role, and industry.
 * E.g., a SaaS sales rep at $120K has a 4.0x multiplier → $40K/mo estimated.
 *
 * The estimate is adjusted by a performance factor derived from the
 * intangible score — poor performers get a reduced estimate, strong
 * performers get a bonus. This prevents high-salary poor performers
 * from dominating the rankings purely based on salary.
 *
 * When real hard value data comes from collectors (Salesforce, Stripe,
 * QuickBooks), this estimate is replaced by actual tracked revenue.
 */
export function estimateHardValue(
  annualSalary: number | null,
  roleTitle: string | null,
  roleType: RoleType,
  industry: string | null,
  intangibleScore?: number,
  hasMeasuredDimensions?: boolean
): number {
  if (!annualSalary || annualSalary <= 0) return 0;

  const benchmark = getIndustryBenchmark(
    industry || "general",
    "medium",
    roleTitle || "",
    roleType
  );

  const baseValue = (annualSalary / 12) * benchmark.revenueMultiplier;
  const perfFactor = performanceAdjustment(
    intangibleScore ?? 50,
    hasMeasuredDimensions ?? false
  );

  return Math.round(baseValue * perfFactor * 100) / 100;
}

// ─── Full Employee Scoring ───────────────────────────────────────────────────

/**
 * Score a single employee. This is the main entry point for individual scoring.
 *
 * Combines hard value, intangible dimensions, role classification, confidence
 * assessment, and cost calculation into a single EmployeeScoreResult.
 *
 * Does NOT save to database — that is handled by scoreAllEmployees.
 */
export function scoreEmployee(
  employee: EmployeeScoringInput,
  dimensionData: DimensionData,
  companyContext: CompanyContext
): Omit<EmployeeScoreResult, "rank" | "rankChange"> {
  // 1. Determine role type (use stored value or classify from title)
  const roleType = employee.roleType ?? classifyRole(employee.roleTitle);

  // 2. Extract dimension scores and data sources
  const { dimensions, sources } = extractDimensions(dimensionData);

  // 3. Calculate intangible composite score
  const intangibleScore = calculateIntangibleScore(dimensions, roleType);

  // 4. Calculate intangible multiplier from company context
  const intangibleMultiplier = calculateIntangibleMultiplier(
    companyContext.totalRevenue,
    companyContext.employeeCount
  );

  // 5. Estimate total cost
  const totalCost = estimateMonthlyTotalCost(employee.salary);

  // 6. Hard value: Estimate from industry benchmarks (salary × multiplier),
  //    adjusted by intangible performance factor. When real collector data is
  //    available (Salesforce, Stripe, QuickBooks), it replaces this estimate.
  const hasMeasured = countMeasuredDimensions(dimensions) > 0;
  const hardValue = estimateHardValue(
    employee.salary,
    employee.roleTitle,
    roleType,
    companyContext.industry,
    intangibleScore,
    hasMeasured
  );

  // 7. Calculate net value
  const netValue = calculateNetValue(hardValue, intangibleScore, intangibleMultiplier, totalCost);

  // 8. Determine confidence
  const confidence = determineConfidence(sources, employee.startDate);

  return {
    employeeId: employee.id,
    hardValue,
    totalCost,
    netValue,
    intangibleScore,
    dimensions,
    roleType,
    confidence,
    dataSources: [...new Set(sources)], // deduplicate
  };
}

// ─── Organization-Wide Scoring + Ranking ─────────────────────────────────────

/**
 * Score all employees in an organization, rank them by net value,
 * calculate rank changes from previous scores, and save results to Supabase.
 *
 * This is the main batch scoring function called on score update cycles.
 */
export async function scoreAllEmployees(
  orgId: string,
  dimensionDataByEmployee: Map<string, DimensionData>,
  companyContext: CompanyContext
): Promise<EmployeeScoreResult[]> {
  const supabase = createAdminClient();

  // 1. Fetch all active employees for this org
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, org_id, name, role_title, salary, start_date, role_type, status")
    .eq("org_id", orgId)
    .eq("status", "active");

  if (empError) {
    console.error("[scoring/engine] Failed to fetch employees:", empError);
    throw new Error(`Failed to fetch employees: ${empError.message}`);
  }

  if (!employees || employees.length === 0) {
    return [];
  }

  // 2. Fetch previous scores for rank change calculation
  const previousRanks = await fetchPreviousRanks(orgId);

  // 3. Score each employee
  const unsortedResults: Omit<EmployeeScoreResult, "rank" | "rankChange">[] = [];

  for (const emp of employees) {
    const input: EmployeeScoringInput = {
      id: emp.id,
      orgId: emp.org_id,
      name: emp.name,
      roleTitle: emp.role_title ?? null,
      salary: emp.salary ?? null,
      startDate: emp.start_date ?? null,
      roleType: emp.role_type as RoleType | null,
    };

    const dimensionData = dimensionDataByEmployee.get(emp.id) ?? emptyDimensionData();
    const result = scoreEmployee(input, dimensionData, companyContext);
    unsortedResults.push(result);
  }

  // 4. Rank by net value (highest first)
  const sorted = [...unsortedResults].sort((a, b) => b.netValue - a.netValue);

  const results: EmployeeScoreResult[] = sorted.map((result, index) => {
    const rank = index + 1;
    const previousRank = previousRanks.get(result.employeeId);
    // rankChange: positive = moved up, negative = moved down
    // If no previous rank, rankChange = 0 (new entry)
    const rankChange = previousRank !== undefined ? previousRank - rank : 0;

    return { ...result, rank, rankChange };
  });

  // 5. Save scores to Supabase
  await saveScores(orgId, results);

  // 6. Update employee current_score and current_rank
  await updateEmployeeSummaries(results);

  return results;
}

// ─── Database Operations ─────────────────────────────────────────────────────

/**
 * Fetch the most recent rank for each employee in an org.
 * Used to calculate rank_change when new scores are produced.
 */
async function fetchPreviousRanks(orgId: string): Promise<Map<string, number>> {
  const supabase = createAdminClient();
  const ranks = new Map<string, number>();

  // Get the most recent score for each employee in this org.
  // We use a distinct-on pattern: order by employee_id and scored_at DESC,
  // then take the first row per employee.
  const { data, error } = await supabase
    .from("employee_scores")
    .select("employee_id, rank")
    .eq("org_id", orgId)
    .order("scored_at", { ascending: false });

  if (error || !data) return ranks;

  // Take only the first (most recent) row per employee
  const seen = new Set<string>();
  for (const row of data) {
    if (!seen.has(row.employee_id) && row.rank !== null) {
      ranks.set(row.employee_id, row.rank);
      seen.add(row.employee_id);
    }
  }

  return ranks;
}

/**
 * Save score results to the employee_scores table.
 * Each call creates a new row per employee (rolling history).
 */
async function saveScores(
  orgId: string,
  results: EmployeeScoreResult[]
): Promise<void> {
  if (results.length === 0) return;

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const rows = results.map((r) => ({
    employee_id: r.employeeId,
    org_id: orgId,
    hard_value: r.hardValue,
    total_cost: r.totalCost,
    net_value: r.netValue,
    responsiveness: r.dimensions.responsiveness,
    output_volume: r.dimensions.outputVolume,
    quality_signal: r.dimensions.qualitySignal,
    collaboration: r.dimensions.collaboration,
    reliability: r.dimensions.reliability,
    manager_assessment: r.dimensions.managerAssessment,
    intangible_score: r.intangibleScore,
    role_type: r.roleType,
    confidence: r.confidence,
    data_sources: r.dataSources,
    rank: r.rank,
    rank_change: r.rankChange,
    scored_at: now,
    period_start: periodStart,
    period_end: now,
  }));

  const { error } = await supabase.from("employee_scores").insert(rows);

  if (error) {
    console.error("[scoring/engine] Failed to save scores:", error);
    throw new Error(`Failed to save scores: ${error.message}`);
  }
}

/**
 * Update the employees table with current_score and current_rank
 * so they are readily available without joining to employee_scores.
 */
async function updateEmployeeSummaries(
  results: EmployeeScoreResult[]
): Promise<void> {
  const supabase = createAdminClient();

  // Batch update: one update per employee
  const updates = results.map((r) =>
    supabase
      .from("employees")
      .update({
        current_score: r.intangibleScore,
        current_rank: r.rank,
        role_type: r.roleType,
        net_value_estimate: r.netValue,
      })
      .eq("id", r.employeeId)
  );

  const settled = await Promise.allSettled(updates);

  for (const result of settled) {
    if (result.status === "rejected") {
      console.error("[scoring/engine] Failed to update employee summary:", result.reason);
    }
  }
}

/**
 * Fetch scoring events for an employee within the 30-day window
 * from the scoring_events table.
 */
export async function fetchScoringEvents(
  employeeId: string,
  orgId: string
): Promise<ScoringEvent[]> {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("scoring_events")
    .select("id, employee_id, source, event_type, data, created_at")
    .eq("employee_id", employeeId)
    .eq("org_id", orgId)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    source: row.source,
    eventType: row.event_type,
    data: row.data || {},
    createdAt: row.created_at,
  }));
}

/**
 * Fetch the latest manager assessment score for an employee.
 * Returns null if no manager input exists.
 */
export async function fetchManagerAssessment(
  employeeId: string
): Promise<{ score: number; sources: string[] } | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("manager_inputs")
    .select("score, manager_id")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data || data.score === null) return null;

  return {
    score: data.score,
    sources: ["manager_input"],
  };
}

/**
 * Fetch the most recent score history for an employee.
 * Useful for trend analysis and the AI coach.
 */
export async function fetchScoreHistory(
  employeeId: string,
  limit: number = 30
): Promise<EmployeeScoreResult[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("employee_scores")
    .select("*")
    .eq("employee_id", employeeId)
    .order("scored_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    employeeId: row.employee_id,
    hardValue: row.hard_value ?? 0,
    totalCost: row.total_cost ?? 0,
    netValue: row.net_value ?? 0,
    intangibleScore: row.intangible_score ?? 0,
    dimensions: {
      responsiveness: row.responsiveness ?? null,
      outputVolume: row.output_volume ?? null,
      qualitySignal: row.quality_signal ?? null,
      collaboration: row.collaboration ?? null,
      reliability: row.reliability ?? null,
      managerAssessment: row.manager_assessment ?? null,
    },
    roleType: (row.role_type as RoleType) || "support",
    confidence: (row.confidence as ConfidenceTier) || "estimated",
    dataSources: Array.isArray(row.data_sources) ? row.data_sources : [],
    rank: row.rank ?? 0,
    rankChange: row.rank_change ?? 0,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create an empty DimensionData object (all null). */
function emptyDimensionData(): DimensionData {
  return {
    responsiveness: null,
    outputVolume: null,
    qualitySignal: null,
    collaboration: null,
    reliability: null,
    managerAssessment: null,
  };
}

/**
 * Count how many dimensions have actual data (non-null).
 * Useful for confidence assessment and UI display.
 */
export function countMeasuredDimensions(dimensions: DimensionScores): number {
  let count = 0;
  for (const dim of ALL_DIMENSIONS) {
    if (dimensions[dim] !== null && dimensions[dim] !== undefined) {
      count++;
    }
  }
  return count;
}

/**
 * Get the weakest dimensions for an employee (used for goal generation).
 * Returns dimensions sorted by score ascending, excluding nulls.
 */
export function getWeakestDimensions(
  dimensions: DimensionScores,
  roleType: RoleType,
  limit: number = 3
): { dimension: DimensionKey; score: number; weight: number }[] {
  const weights = DIMENSION_WEIGHTS[roleType];
  const scored: { dimension: DimensionKey; score: number; weight: number }[] = [];

  for (const dim of ALL_DIMENSIONS) {
    const score = dimensions[dim];
    if (score !== null && score !== undefined) {
      scored.push({ dimension: dim, score, weight: weights[dim] });
    }
  }

  // Sort by score ascending (weakest first), break ties by weight descending
  // (higher-weight dimensions are more impactful to improve)
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.weight - a.weight;
  });

  return scored.slice(0, limit);
}

/**
 * Calculate the projected impact of improving a dimension by a given amount.
 * Returns the change in intangible score.
 */
export function projectedImpact(
  currentDimensions: DimensionScores,
  roleType: RoleType,
  targetDimension: DimensionKey,
  improvement: number
): number {
  const currentScore = calculateIntangibleScore(currentDimensions, roleType);

  // Create a copy with the improved dimension
  const improved: DimensionScores = { ...currentDimensions };
  const currentValue = improved[targetDimension] ?? 50; // assume midpoint if null
  improved[targetDimension] = Math.min(100, currentValue + improvement);

  const newScore = calculateIntangibleScore(improved, roleType);
  return Math.round((newScore - currentScore) * 100) / 100;
}
