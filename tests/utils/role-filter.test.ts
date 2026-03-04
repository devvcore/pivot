import { describe, it, expect } from 'vitest';
import { filterDeliverablesForRole } from '@/lib/role-filter';
import type { MVPDeliverables } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// Role Filter Tests
// Tests filterDeliverablesForRole for all four roles
// ═══════════════════════════════════════════════════════════════

// ─── Sample Deliverables ───────────────────────────────────────

const sampleDeliverables = {
  healthScore: {
    score: 72,
    grade: 'B',
    summary: 'Good health with growth areas',
    dimensions: [
      { name: 'Revenue', score: 80 },
      { name: 'Team', score: 65 },
    ],
  },
  actionPlan: {
    summary: 'Focus on growth',
    days: [
      {
        day: 1,
        title: 'Day 1 - Quick Wins',
        tasks: [
          { description: 'Fix critical bug', owner: 'John Doe' },
          { description: 'Review pipeline', owner: 'All Team' },
          { description: 'Update KPIs', owner: 'Jane Smith' },
          { description: 'Strategic meeting', owner: 'CEO' },
        ],
      },
      {
        day: 7,
        title: 'Week 1 - Foundation',
        tasks: [
          { description: 'Hire developer', owner: 'John Doe' },
          { description: 'Launch campaign', owner: 'Marketing Team' },
        ],
      },
    ],
  },
  goalTracker: { goals: ['Grow revenue 20%'] },
  kpis: { items: ['Revenue', 'Churn'] },
  healthChecklist: { items: ['Check 1', 'Check 2'] },
  milestoneTracker: { milestones: [] },
  benchmarkScore: { industry: 'SaaS', percentile: 65 },
  executiveSummary: { summary: 'Business is doing well' },
  swotAnalysis: { strengths: ['Strong team'] },
  decisionBrief: { brief: 'Decide on expansion' },
  hiringPlan: { recommendations: ['Fire underperformer', 'Hire 2 devs'] },
  teamPerformance: { performers: [] },
  issuesRegister: { issues: [{ title: 'Bug' }] },
  riskRegister: { risks: [] },
  kpiReport: { metrics: [] },
  scenarioPlanner: { scenarios: [] },
  competitiveMoat: { moats: [] },
  cashIntelligence: { burnRate: 50000, runway: 18 },
  revenueLeakAnalysis: { totalLeak: 120000 },
  atRiskCustomers: { customers: ['Acme'] },
  unitEconomics: { ltv: 5000, cac: 1200 },
  burnRateAnalysis: { burnRate: 45000 },
  debtStructure: { totalDebt: 100000 },
  investorReadiness: { score: 60 },
  revenueForecast: { forecast: [] },
  dataProvenance: { sources: ['document.pdf'] },
  claimValidations: { claims: [] },
  selectedSections: ['healthScore', 'actionPlan'],
} as unknown as MVPDeliverables;

// ─── Owner Role Tests ────────────────────────────────────────

describe('filterDeliverablesForRole - owner', () => {
  it('returns everything for owner role', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'owner');
    expect(result).toBe(sampleDeliverables); // exact same reference
  });
});

// ─── Employee Role Tests ─────────────────────────────────────

describe('filterDeliverablesForRole - employee', () => {
  it('includes employee-visible sections', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'employee', 'John Doe');

    expect(result.healthScore).toBeDefined();
    expect(result.goalTracker).toBeDefined();
    expect((result as any).kpis).toBeDefined();
    expect(result.healthChecklist).toBeDefined();
    expect(result.milestoneTracker).toBeDefined();
    expect(result.benchmarkScore).toBeDefined();
  });

  it('excludes owner-only sections', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'employee', 'John Doe');

    expect(result.cashIntelligence).toBeUndefined();
    expect(result.revenueLeakAnalysis).toBeUndefined();
    expect(result.atRiskCustomers).toBeUndefined();
    expect(result.unitEconomics).toBeUndefined();
    expect((result as any).burnRateAnalysis).toBeUndefined();
    expect((result as any).debtStructure).toBeUndefined();
    expect(result.investorReadiness).toBeUndefined();
    expect(result.revenueForecast).toBeUndefined();
    expect(result.hiringPlan).toBeUndefined();
  });

  it('excludes sections not in employee set', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'employee', 'John Doe');

    expect(result.executiveSummary).toBeUndefined();
    expect(result.swotAnalysis).toBeUndefined();
    expect(result.competitiveMoat).toBeUndefined();
    expect(result.issuesRegister).toBeUndefined();
  });

  it('filters action plan to only employee tasks', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'employee', 'John Doe');

    const ap = result.actionPlan as any;
    expect(ap).toBeDefined();
    expect(ap.days.length).toBeGreaterThan(0);

    // "John Doe" tasks and "All Team" tasks should remain
    const allTasks = ap.days.flatMap((d: any) => d.tasks);
    expect(allTasks.length).toBeGreaterThan(0);

    // Every remaining task should be assigned to John, All, or Team
    for (const task of allTasks) {
      const owner = task.owner.toLowerCase();
      expect(
        owner.includes('john doe') || owner.includes('all') || owner.includes('team')
      ).toBe(true);
    }
  });

  it('includes metadata fields regardless of role', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'employee', 'John Doe');

    expect(result.dataProvenance).toBeDefined();
    expect(result.claimValidations).toBeDefined();
    expect(result.selectedSections).toBeDefined();
  });
});

// ─── Coach Role Tests ────────────────────────────────────────

describe('filterDeliverablesForRole - coach', () => {
  it('includes coach-visible sections', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'coach');

    expect(result.healthScore).toBeDefined();
    expect(result.actionPlan).toBeDefined();
    expect(result.executiveSummary).toBeDefined();
    expect(result.swotAnalysis).toBeDefined();
    expect(result.decisionBrief).toBeDefined();
    expect(result.hiringPlan).toBeDefined();
    expect(result.teamPerformance).toBeDefined();
    expect(result.issuesRegister).toBeDefined();
    expect(result.riskRegister).toBeDefined();
    expect(result.kpiReport).toBeDefined();
    expect(result.scenarioPlanner).toBeDefined();
    expect(result.competitiveMoat).toBeDefined();
  });

  it('excludes financial sections', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'coach');

    expect(result.cashIntelligence).toBeUndefined();
    expect(result.revenueLeakAnalysis).toBeUndefined();
    expect(result.unitEconomics).toBeUndefined();
    expect((result as any).burnRateAnalysis).toBeUndefined();
    expect((result as any).debtStructure).toBeUndefined();
    expect(result.investorReadiness).toBeUndefined();
  });

  it('does not filter action plan tasks for coach', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'coach');

    const ap = result.actionPlan as any;
    const allTasks = ap.days.flatMap((d: any) => d.tasks);
    // Coach sees all tasks (no filtering by employee name)
    expect(allTasks.length).toBe(6);
  });
});

// ─── Other Role Tests ────────────────────────────────────────

describe('filterDeliverablesForRole - other', () => {
  it('includes only minimal sections', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'other');

    expect(result.healthScore).toBeDefined();
    expect(result.actionPlan).toBeDefined();
    expect(result.healthChecklist).toBeDefined();
  });

  it('excludes most sections', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'other');

    expect(result.executiveSummary).toBeUndefined();
    expect(result.swotAnalysis).toBeUndefined();
    expect(result.cashIntelligence).toBeUndefined();
    expect(result.issuesRegister).toBeUndefined();
    expect(result.competitiveMoat).toBeUndefined();
    expect(result.goalTracker).toBeUndefined();
    expect((result as any).kpis).toBeUndefined();
  });

  it('strips healthScore down to score/grade/summary only', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'other');

    const hs = result.healthScore as any;
    expect(hs.score).toBe(72);
    expect(hs.grade).toBe('B');
    expect(hs.summary).toBeDefined();
    expect(hs.dimensions).toBeUndefined();
  });

  it('strips owner names from action plan tasks', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'other');

    const ap = result.actionPlan as any;
    if (ap?.days) {
      for (const day of ap.days) {
        for (const task of day.tasks) {
          expect(task.owner).toBeUndefined();
          expect(task.description).toBeDefined();
        }
      }
    }
  });

  it('excludes dataProvenance to prevent document name leaking', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'other');
    expect(result.dataProvenance).toBeUndefined();
  });

  it('includes claimValidations and selectedSections metadata', () => {
    const result = filterDeliverablesForRole(sampleDeliverables, 'other');
    expect(result.claimValidations).toBeDefined();
    expect(result.selectedSections).toBeDefined();
  });
});
