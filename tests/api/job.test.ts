import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// Job API Tests
// Tests job CRUD, upload, list, and pipeline trigger endpoints
// ═══════════════════════════════════════════════════════════════

// Mock job-store
const mockGetJob = vi.fn();
const mockListJobs = vi.fn();
const mockCreateJob = vi.fn();
const mockUpdateJob = vi.fn();

vi.mock('@/lib/job-store', () => ({
  getJob: (...args: any[]) => mockGetJob(...args),
  listJobs: (...args: any[]) => mockListJobs(...args),
  createJob: (...args: any[]) => mockCreateJob(...args),
  updateJob: (...args: any[]) => mockUpdateJob(...args),
}));

// Mock pipeline run
vi.mock('@/lib/pipeline/run', () => ({
  runPipeline: vi.fn().mockResolvedValue(undefined),
}));

// Mock upload utilities
vi.mock('@/lib/upload', () => ({
  parseQuestionnaire: vi.fn().mockReturnValue({
    organizationName: 'Test Org',
    industry: 'Tech',
    revenueRange: '$1M - $10M',
    businessModel: 'SaaS',
    keyConcerns: 'Growth',
    oneDecisionKeepingOwnerUpAtNight: 'Hiring',
  }),
  saveUploadedFiles: vi.fn().mockResolvedValue({
    filePaths: ['run_123/doc.pdf'],
  }),
}));

// ─── Sample Data ───────────────────────────────────────────────

const sampleJob = {
  runId: 'run_12345',
  status: 'completed' as const,
  phase: 'COMPLETE',
  questionnaire: {
    organizationName: 'Test Org',
    industry: 'Technology',
    revenueRange: '$1M - $10M',
    businessModel: 'SaaS',
    keyConcerns: 'Growth',
    oneDecisionKeepingOwnerUpAtNight: 'Hiring',
  },
  filePaths: ['run_12345/doc.pdf'],
  parsedContext: 'Some parsed text',
  deliverables: {
    healthScore: { score: 72, grade: 'B', summary: 'Good health' },
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const pendingJob = {
  ...sampleJob,
  runId: 'run_99999',
  status: 'pending' as const,
  phase: 'INGEST',
  deliverables: undefined,
};

// ─── GET /api/job Tests ────────────────────────────────────────

describe('GET /api/job', () => {
  let handler: (req: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/job/route');
    handler = mod.GET;
  });

  it('returns 400 when runId is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/job');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('runId required');
  });

  it('returns 404 when job not found', async () => {
    mockGetJob.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost:3000/api/job?runId=nonexistent');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Job not found');
  });

  it('returns job data when found', async () => {
    mockGetJob.mockResolvedValue(sampleJob);

    const req = new NextRequest('http://localhost:3000/api/job?runId=run_12345');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.runId).toBe('run_12345');
    expect(data.status).toBe('completed');
    expect(data.deliverables.healthScore.score).toBe(72);
  });
});

// ─── POST /api/job Tests (pipeline trigger) ────────────────────

describe('POST /api/job', () => {
  let handler: (req: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/job/route');
    handler = mod.POST;
  });

  it('returns 400 when runId is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('runId required');
  });

  it('returns 404 when job not found', async () => {
    mockGetJob.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost:3000/api/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'nonexistent' }),
    });
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Job not found');
  });

  it('returns message when pipeline already completed', async () => {
    mockGetJob.mockResolvedValue(sampleJob);

    const req = new NextRequest('http://localhost:3000/api/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'run_12345' }),
    });
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe('Pipeline already completed');
  });

  it('starts pipeline for pending job', async () => {
    mockGetJob.mockResolvedValue(pendingJob);

    const req = new NextRequest('http://localhost:3000/api/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'run_99999' }),
    });
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('started');
    expect(data.runId).toBe('run_99999');
  });

  it('returns running status for in-progress jobs', async () => {
    const runningJob = { ...sampleJob, status: 'synthesizing' as const };
    mockGetJob.mockResolvedValue(runningJob);

    const req = new NextRequest('http://localhost:3000/api/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'run_12345' }),
    });
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe('Pipeline is running');
  });
});

// ─── GET /api/job/list Tests ──────────────────────────────────

describe('GET /api/job/list', () => {
  let handler: () => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/job/list/route');
    handler = mod.GET;
  });

  it('returns empty array when no jobs exist', async () => {
    mockListJobs.mockResolvedValue([]);

    const res = await handler();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });

  it('returns mapped job summaries', async () => {
    mockListJobs.mockResolvedValue([sampleJob, pendingJob]);

    const res = await handler();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].runId).toBe('run_12345');
    expect(data[0].orgName).toBe('Test Org');
    expect(data[0].healthScore).toBe(72);
    expect(data[0].healthGrade).toBe('B');
    expect(data[1].healthScore).toBeNull();
  });
});
