/**
 * Industry Benchmark Data for the Employee Value Engine
 *
 * When no integration data is available for an employee (Tier 3: Minimal),
 * the system falls back to these industry benchmarks to estimate value.
 * All benchmarks are labeled with `_source: 'industry_estimate'` and
 * displayed differently in the UI so users know these are estimates.
 *
 * These are hardcoded lookup tables -- no AI calls. They get replaced
 * by real data as integrations are connected.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IndustryBenchmark {
  revenueMultiplier: number;   // salary x this = estimated revenue contribution
  intangibleScore: number;     // default 0-100 score
  _source: 'industry_estimate';
}

export interface FTEBenchmark {
  engineering: number;
  sales: number;
  marketing: number;
  operations: number;
  support: number;
  management: number;
  total: number;
  _source: 'industry_estimate';
}

export type RoleType = 'direct_revenue' | 'enabler' | 'support';

export type CompanySize = 'tiny' | 'small' | 'medium' | 'large';

export type Industry =
  | 'saas'
  | 'agency'
  | 'ecommerce'
  | 'consulting'
  | 'general';

// ---------------------------------------------------------------------------
// Company size classification
// ---------------------------------------------------------------------------

const SIZE_THRESHOLDS: { max: number; size: CompanySize }[] = [
  { max: 5, size: 'tiny' },
  { max: 20, size: 'small' },
  { max: 100, size: 'medium' },
  // anything above 100 is 'large'
];

export function classifyCompanySize(headcount: number): CompanySize {
  for (const { max, size } of SIZE_THRESHOLDS) {
    if (headcount <= max) return size;
  }
  return 'large';
}

// ---------------------------------------------------------------------------
// Size multiplier adjustment
// ---------------------------------------------------------------------------

// Smaller companies need each person to carry more weight.
// These factors scale the base revenue multiplier.
const SIZE_ADJUSTMENT: Record<CompanySize, number> = {
  tiny: 1.4,    // everyone wears many hats
  small: 1.2,   // still lean
  medium: 1.0,  // baseline
  large: 0.9,   // more specialization, lower per-person leverage
};

// ---------------------------------------------------------------------------
// Revenue multiplier benchmarks by industry + role title keyword
// ---------------------------------------------------------------------------

// Each entry maps a role keyword to: [revenueMultiplier, roleType]
// These are base values at "medium" company size.
type RoleEntry = [number, RoleType];

const INDUSTRY_ROLES: Record<Industry, Record<string, RoleEntry>> = {
  saas: {
    junior_dev:       [2.0, 'enabler'],
    senior_dev:       [3.0, 'enabler'],
    developer:        [2.5, 'enabler'],
    engineer:         [2.5, 'enabler'],
    sales:            [4.0, 'direct_revenue'],
    sales_rep:        [4.0, 'direct_revenue'],
    account_exec:     [4.0, 'direct_revenue'],
    pm:               [1.5, 'enabler'],
    product_manager:  [1.5, 'enabler'],
    designer:         [1.5, 'enabler'],
    marketing:        [2.0, 'direct_revenue'],
    admin:            [0.5, 'support'],
    hr:               [0.5, 'support'],
    finance:          [0.6, 'support'],
    customer_support: [0.8, 'support'],
    devops:           [2.0, 'enabler'],
    data:             [2.0, 'enabler'],
  },
  agency: {
    junior_dev:       [2.5, 'direct_revenue'],
    senior_dev:       [3.5, 'direct_revenue'],
    developer:        [3.0, 'direct_revenue'],
    engineer:         [3.0, 'direct_revenue'],
    account_manager:  [3.0, 'direct_revenue'],
    account_exec:     [3.0, 'direct_revenue'],
    pm:               [2.0, 'enabler'],
    project_manager:  [2.0, 'enabler'],
    designer:         [3.0, 'direct_revenue'],
    copywriter:       [2.5, 'direct_revenue'],
    strategist:       [2.5, 'direct_revenue'],
    admin:            [0.5, 'support'],
    hr:               [0.5, 'support'],
    marketing:        [2.0, 'direct_revenue'],
  },
  ecommerce: {
    marketing:        [2.5, 'direct_revenue'],
    operations:       [1.0, 'enabler'],
    ops:              [1.0, 'enabler'],
    customer_support: [0.8, 'support'],
    support:          [0.8, 'support'],
    developer:        [2.0, 'enabler'],
    engineer:         [2.0, 'enabler'],
    designer:         [1.5, 'enabler'],
    sales:            [3.0, 'direct_revenue'],
    logistics:        [1.0, 'enabler'],
    warehouse:        [0.7, 'support'],
    admin:            [0.5, 'support'],
  },
  consulting: {
    consultant:       [3.5, 'direct_revenue'],
    senior_consultant:[4.0, 'direct_revenue'],
    analyst:          [2.5, 'direct_revenue'],
    partner:          [5.0, 'direct_revenue'],
    principal:        [4.5, 'direct_revenue'],
    associate:        [2.0, 'direct_revenue'],
    pm:               [1.5, 'enabler'],
    project_manager:  [1.5, 'enabler'],
    admin:            [0.5, 'support'],
    hr:               [0.5, 'support'],
    marketing:        [1.5, 'enabler'],
    researcher:       [2.0, 'enabler'],
  },
  general: {
    // Fallback defaults by role type
    sales:            [2.5, 'direct_revenue'],
    marketing:        [2.0, 'direct_revenue'],
    developer:        [2.0, 'enabler'],
    engineer:         [2.0, 'enabler'],
    pm:               [1.5, 'enabler'],
    product_manager:  [1.5, 'enabler'],
    designer:         [1.5, 'enabler'],
    operations:       [1.0, 'enabler'],
    ops:              [1.0, 'enabler'],
    admin:            [0.7, 'support'],
    hr:               [0.7, 'support'],
    finance:          [0.7, 'support'],
    customer_support: [0.7, 'support'],
    support:          [0.7, 'support'],
  },
};

// Defaults when no role keyword matches, keyed by role type
const ROLE_TYPE_DEFAULTS: Record<RoleType, number> = {
  direct_revenue: 2.5,
  enabler: 1.5,
  support: 0.7,
};

// ---------------------------------------------------------------------------
// Intangible score benchmarks by role type
// ---------------------------------------------------------------------------

const INTANGIBLE_DEFAULTS: Record<RoleType, number> = {
  direct_revenue: 65,
  enabler: 60,
  support: 55,
};

// ---------------------------------------------------------------------------
// Normalize a job title into a lookup key
// ---------------------------------------------------------------------------

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Attempt to match a normalized title against the role entries for an industry.
 * Returns the first match found by checking if any key is contained in the title
 * or if the title is contained in any key.
 */
function findRoleEntry(
  industry: Industry,
  normalizedTitle: string,
): RoleEntry | null {
  const roles = INDUSTRY_ROLES[industry];
  if (!roles) return null;

  // Exact match first
  if (roles[normalizedTitle]) {
    return roles[normalizedTitle];
  }

  // Partial match: check if any known role key appears in the title
  for (const [key, entry] of Object.entries(roles)) {
    if (normalizedTitle.includes(key) || key.includes(normalizedTitle)) {
      return entry;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get industry benchmark for a role in a given industry/company size.
 *
 * Used for Tier 3 scoring (salary + job title only, no integration data).
 * Returns estimated revenue multiplier and intangible score.
 *
 * @param industry - Company industry (saas, agency, ecommerce, consulting, general)
 * @param companySize - Either a CompanySize string or headcount number
 * @param roleTitle - Job title or role keyword (e.g. "Senior Developer", "sales_rep")
 * @param roleType - Optional explicit role type override; inferred from title if omitted
 */
export function getIndustryBenchmark(
  industry: string,
  companySize: CompanySize | number,
  roleTitle: string,
  roleType?: RoleType,
): IndustryBenchmark {
  const ind = (industry?.toLowerCase() || 'general') as Industry;
  const validIndustry = INDUSTRY_ROLES[ind] ? ind : 'general';

  const size: CompanySize =
    typeof companySize === 'number'
      ? classifyCompanySize(companySize)
      : companySize;

  const sizeAdj = SIZE_ADJUSTMENT[size] ?? 1.0;
  const normalized = normalizeTitle(roleTitle || '');

  // Try to find a matching role entry in the specific industry, then fall back to general
  let entry = findRoleEntry(validIndustry, normalized);
  if (!entry && validIndustry !== 'general') {
    entry = findRoleEntry('general', normalized);
  }

  let multiplier: number;
  let inferredRoleType: RoleType;

  if (entry) {
    multiplier = entry[0];
    inferredRoleType = entry[1];
  } else {
    // No match at all -- use role type defaults
    inferredRoleType = roleType ?? 'enabler';
    multiplier = ROLE_TYPE_DEFAULTS[inferredRoleType];
  }

  // Allow explicit override of role type
  const finalRoleType = roleType ?? inferredRoleType;

  return {
    revenueMultiplier: Math.round(multiplier * sizeAdj * 100) / 100,
    intangibleScore: INTANGIBLE_DEFAULTS[finalRoleType] ?? 60,
    _source: 'industry_estimate',
  };
}

// ---------------------------------------------------------------------------
// FTE Benchmark data
// ---------------------------------------------------------------------------

// Revenue-per-employee ranges by industry (annual, USD).
// Used to scale FTE recommendations based on actual revenue.
const REVENUE_PER_EMPLOYEE: Record<Industry, number> = {
  saas: 200_000,
  agency: 150_000,
  ecommerce: 180_000,
  consulting: 175_000,
  general: 160_000,
};

// FTE distribution ratios by industry (% of total headcount).
// These represent typical team composition.
interface FTERatios {
  engineering: number;
  sales: number;
  marketing: number;
  operations: number;
  support: number;
  management: number;
}

const FTE_RATIOS: Record<Industry, FTERatios> = {
  saas: {
    engineering: 0.40,
    sales: 0.20,
    marketing: 0.10,
    operations: 0.10,
    support: 0.10,
    management: 0.10,
  },
  agency: {
    engineering: 0.35,
    sales: 0.15,
    marketing: 0.10,
    operations: 0.10,
    support: 0.10,
    management: 0.20,
  },
  ecommerce: {
    engineering: 0.20,
    sales: 0.15,
    marketing: 0.20,
    operations: 0.20,
    support: 0.15,
    management: 0.10,
  },
  consulting: {
    engineering: 0.10,
    sales: 0.20,
    marketing: 0.10,
    operations: 0.10,
    support: 0.15,
    management: 0.35,
  },
  general: {
    engineering: 0.25,
    sales: 0.15,
    marketing: 0.15,
    operations: 0.15,
    support: 0.15,
    management: 0.15,
  },
};

// Size-based minimum staffing (at least 1 person in each critical function).
// For tiny companies, many functions are shared/part-time.
const MIN_STAFF: Record<CompanySize, Partial<FTERatios>> = {
  tiny: {
    engineering: 1,
    management: 1,
  },
  small: {
    engineering: 2,
    sales: 1,
    management: 1,
  },
  medium: {
    engineering: 3,
    sales: 2,
    marketing: 1,
    operations: 1,
    support: 1,
    management: 2,
  },
  large: {
    engineering: 5,
    sales: 3,
    marketing: 2,
    operations: 2,
    support: 2,
    management: 3,
  },
};

/**
 * Get recommended FTE headcount breakdown for a company.
 *
 * Uses industry distribution ratios scaled to the company's revenue,
 * with minimums enforced by company size tier.
 *
 * @param industry - Company industry
 * @param companySize - Either a CompanySize string or headcount number
 * @param annualRevenue - Annual revenue in USD (used to estimate ideal total headcount)
 */
export function getFTEBenchmark(
  industry: string,
  companySize: CompanySize | number,
  annualRevenue: number,
): FTEBenchmark {
  const ind = (industry?.toLowerCase() || 'general') as Industry;
  const validIndustry = FTE_RATIOS[ind] ? ind : 'general';

  const size: CompanySize =
    typeof companySize === 'number'
      ? classifyCompanySize(companySize)
      : companySize;

  const revenuePerEmployee = REVENUE_PER_EMPLOYEE[validIndustry];
  const ratios = FTE_RATIOS[validIndustry];
  const mins = MIN_STAFF[size];

  // Estimate ideal total headcount from revenue
  const idealTotal = Math.max(1, Math.round(annualRevenue / revenuePerEmployee));

  // Distribute across functions using ratios
  const raw = {
    engineering: Math.round(idealTotal * ratios.engineering),
    sales: Math.round(idealTotal * ratios.sales),
    marketing: Math.round(idealTotal * ratios.marketing),
    operations: Math.round(idealTotal * ratios.operations),
    support: Math.round(idealTotal * ratios.support),
    management: Math.round(idealTotal * ratios.management),
  };

  // Enforce minimums for the company size
  const result = {
    engineering: Math.max(raw.engineering, mins.engineering ?? 0),
    sales: Math.max(raw.sales, mins.sales ?? 0),
    marketing: Math.max(raw.marketing, mins.marketing ?? 0),
    operations: Math.max(raw.operations, mins.operations ?? 0),
    support: Math.max(raw.support, mins.support ?? 0),
    management: Math.max(raw.management, mins.management ?? 0),
  };

  const total =
    result.engineering +
    result.sales +
    result.marketing +
    result.operations +
    result.support +
    result.management;

  return {
    ...result,
    total,
    _source: 'industry_estimate',
  };
}

// ---------------------------------------------------------------------------
// Convenience: get intangible score default by role type
// ---------------------------------------------------------------------------

/**
 * Returns the default intangible score for a role type when no data is available.
 */
export function getDefaultIntangibleScore(roleType: RoleType): number {
  return INTANGIBLE_DEFAULTS[roleType] ?? 60;
}

/**
 * Returns the default revenue multiplier for a role type when no
 * industry-specific or title-specific match can be found.
 */
export function getDefaultRevenueMultiplier(roleType: RoleType): number {
  return ROLE_TYPE_DEFAULTS[roleType] ?? 1.5;
}
