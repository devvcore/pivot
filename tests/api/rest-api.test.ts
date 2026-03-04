import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// REST API v1 Tests
// Tests /api/v1/analyses endpoints with API key authentication
// ═══════════════════════════════════════════════════════════════

// Mock job-store
const mockGetJob = vi.fn();
const mockListJobs = vi.fn();

vi.mock('@/lib/job-store', () => ({
  getJob: (...args: any[]) => mockGetJob(...args),
  listJobs: (...args: any[]) => mockListJobs(...args),
}));

// Mock types
vi.mock('@/lib/types', () => ({}));

// ─── Sample Data ───────────────────────────────────────────────

const completedJob = {
  runId: 'run_12345',
  status: 'completed',
  questionnaire: {
    organizationName: 'Acme Corp',
    industry: 'SaaS',
  },
  createdAt: 1700000000000,
  deliverables: {
    healthScore: {
      score: 78,
      grade: 'B+',
      summary: 'Healthy business with room for improvement',
      dimensions: [{ name: 'Revenue', score: 80 }],
    },
    cashIntelligence: { burnRate: 50000, runway: 18 },
    revenueLeakAnalysis: { totalLeak: 120000 },
    issuesRegister: {
      issues: [
        { title: 'Bug', severity: 'High' },
        { title: 'Performance', severity: 'Medium' },
      ],
    },
    riskRegister: { risks: [] },
    actionPlan: {
      summary: 'Grow revenue',
      days: [
        {
          day: 1,
          title: 'Day 1',
          tasks: [
            { description: 'Fix bug', owner: 'CTO', priority: 'high' },
            { description: 'Review', owner: 'CEO', priority: 'medium' },
          ],
        },
      ],
    },
    competitorAnalysis: { competitors: [] },
    competitiveWinLoss: null,
    competitiveMoat: null,
    competitiveIntelFeed: null,
    marketIntelligence: null,
    executiveSummary: { summary: 'All good' },
    swotAnalysis: { strengths: [] },
    decisionBrief: { brief: 'Make decisions' },
    strategicInitiatives: null,
    benchmarkScore: null,
    healthChecklist: null,
    unitEconomics: null,
    revenueForecast: null,
    financialRatios: null,
    cashOptimization: null,
    cashFlowSensitivity: null,
    cashConversionCycle: null,
    revenueAttribution: null,
    dataProvenance: { sources: [] },
  },
};

const pendingJob = {
  runId: 'run_99999',
  status: 'pending',
  questionnaire: { organizationName: 'Pending Co', industry: 'Retail' },
  createdAt: 1700000000000,
  deliverables: undefined,
};

// ─── Helper to create request with API key ────────────────────

function createApiRequest(url: string, apiKey?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (apiKey) headers['x-api-key'] = apiKey;
  return new NextRequest(url, { headers });
}

// ─── API Key Auth Tests ─────────────────────────────────────────

describe('API Key Authentication', () => {
  let handler: (req: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/v1/analyses/route');
    handler = mod.GET;
  });

  it('returns 401 when API key is missing', async () => {
    const req = createApiRequest('http://localhost:3000/api/v1/analyses');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });

  it('returns 401 when API key is invalid', async () => {
    const req = createApiRequest('http://localhost:3000/api/v1/analyses', 'wrong-key');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });

  it('allows requests with valid API key', async () => {
    mockListJobs.mockResolvedValue([]);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses', 'test-api-key-12345');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.analyses).toBeDefined();
  });
});

// ─── GET /api/v1/analyses Tests ─────────────────────────────────

describe('GET /api/v1/analyses', () => {
  let handler: (req: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/v1/analyses/route');
    handler = mod.GET;
  });

  it('returns empty list when no completed jobs', async () => {
    mockListJobs.mockResolvedValue([pendingJob]);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses', 'test-api-key-12345');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.analyses).toEqual([]);
    expect(data.count).toBe(0);
  });

  it('returns completed analyses only', async () => {
    mockListJobs.mockResolvedValue([completedJob, pendingJob]);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses', 'test-api-key-12345');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.analyses[0].runId).toBe('run_12345');
    expect(data.analyses[0].healthScore).toBe(78);
    expect(data.analyses[0].grade).toBe('B+');
  });
});

// ─── GET /api/v1/analyses/[runId] Tests ──────────────────────────

describe('GET /api/v1/analyses/[runId]', () => {
  let handler: (req: any, ctx: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/v1/analyses/[runId]/route');
    handler = mod.GET;
  });

  it('returns 404 for nonexistent analysis', async () => {
    mockGetJob.mockResolvedValue(undefined);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_nope', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_nope' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Analysis not found');
  });

  it('returns 422 for incomplete analysis', async () => {
    mockGetJob.mockResolvedValue(pendingJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_99999', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_99999' }) });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain('not yet complete');
  });

  it('returns full analysis for completed job', async () => {
    mockGetJob.mockResolvedValue(completedJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_12345', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_12345' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.runId).toBe('run_12345');
    expect(data.healthScore.score).toBe(78);
    expect(data.cashIntelligence).toBeDefined();
    expect(data.executiveSummary).toBeDefined();
  });
});

// ─── GET /api/v1/analyses/[runId]/health Tests ──────────────────

describe('GET /api/v1/analyses/[runId]/health', () => {
  let handler: (req: any, ctx: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/v1/analyses/[runId]/health/route');
    handler = mod.GET;
  });

  it('returns health score data', async () => {
    mockGetJob.mockResolvedValue(completedJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_12345/health', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_12345' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.runId).toBe('run_12345');
    expect(data.score).toBe(78);
    expect(data.grade).toBe('B+');
    expect(data.dimensions).toHaveLength(1);
  });

  it('returns 404 when health score is missing', async () => {
    const noHealthJob = {
      ...completedJob,
      deliverables: { ...completedJob.deliverables, healthScore: undefined },
    };
    mockGetJob.mockResolvedValue(noHealthJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_12345/health', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_12345' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('not available');
  });
});

// ─── GET /api/v1/analyses/[runId]/issues Tests ──────────────────

describe('GET /api/v1/analyses/[runId]/issues', () => {
  let handler: (req: any, ctx: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/v1/analyses/[runId]/issues/route');
    handler = mod.GET;
  });

  it('returns issues with severity counts', async () => {
    mockGetJob.mockResolvedValue(completedJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_12345/issues', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_12345' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.runId).toBe('run_12345');
    expect(data.totalIssues).toBe(2);
    expect(data.severityCounts.High).toBe(1);
    expect(data.severityCounts.Medium).toBe(1);
    expect(data.issues).toHaveLength(2);
  });

  it('returns 404 when issues register is missing', async () => {
    const noIssuesJob = {
      ...completedJob,
      deliverables: { ...completedJob.deliverables, issuesRegister: undefined },
    };
    mockGetJob.mockResolvedValue(noIssuesJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_12345/issues', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_12345' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('not available');
  });
});

// ─── GET /api/v1/analyses/[runId]/financials Tests ───────────────

describe('GET /api/v1/analyses/[runId]/financials', () => {
  let handler: (req: any, ctx: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/v1/analyses/[runId]/financials/route');
    handler = mod.GET;
  });

  it('returns financial data', async () => {
    mockGetJob.mockResolvedValue(completedJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_12345/financials', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_12345' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.runId).toBe('run_12345');
    expect(data.cashIntelligence).toBeDefined();
    expect(data.revenueLeakAnalysis).toBeDefined();
  });

  it('returns 422 for incomplete analysis', async () => {
    mockGetJob.mockResolvedValue(pendingJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_99999/financials', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_99999' }) });
    const data = await res.json();

    expect(res.status).toBe(422);
  });
});

// ─── GET /api/v1/analyses/[runId]/recommendations Tests ──────────

describe('GET /api/v1/analyses/[runId]/recommendations', () => {
  let handler: (req: any, ctx: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/v1/analyses/[runId]/recommendations/route');
    handler = mod.GET;
  });

  it('returns recommendations with tasks extracted', async () => {
    mockGetJob.mockResolvedValue(completedJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_12345/recommendations', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_12345' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.runId).toBe('run_12345');
    expect(data.summary).toBe('Grow revenue');
    expect(data.totalTasks).toBe(2);
    expect(data.tasks[0].description).toBe('Fix bug');
    expect(data.tasks[0].owner).toBe('CTO');
    expect(data.tasks[0].day).toBe(1);
  });

  it('returns 404 when action plan is missing', async () => {
    const noAPJob = {
      ...completedJob,
      deliverables: { ...completedJob.deliverables, actionPlan: undefined },
    };
    mockGetJob.mockResolvedValue(noAPJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_12345/recommendations', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_12345' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('not available');
  });
});

// ─── GET /api/v1/analyses/[runId]/competitors Tests ──────────────

describe('GET /api/v1/analyses/[runId]/competitors', () => {
  let handler: (req: any, ctx: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/v1/analyses/[runId]/competitors/route');
    handler = mod.GET;
  });

  it('returns competitor data', async () => {
    mockGetJob.mockResolvedValue(completedJob);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_12345/competitors', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_12345' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.runId).toBe('run_12345');
    expect(data.competitorAnalysis).toBeDefined();
    expect(data.swotAnalysis).toBeDefined();
  });

  it('returns 404 for nonexistent analysis', async () => {
    mockGetJob.mockResolvedValue(undefined);

    const req = createApiRequest('http://localhost:3000/api/v1/analyses/run_nope/competitors', 'test-api-key-12345');
    const res = await handler(req, { params: Promise.resolve({ runId: 'run_nope' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
  });
});
