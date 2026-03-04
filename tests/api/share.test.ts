import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// Share API Tests
// Tests share link create, validate, list, and revoke endpoints
// ═══════════════════════════════════════════════════════════════

// Mock job-store
const mockGetJob = vi.fn();
vi.mock('@/lib/job-store', () => ({
  getJob: (...args: any[]) => mockGetJob(...args),
}));

// Mock share-store
const mockCreateShareLink = vi.fn();
const mockGetShareLinkByToken = vi.fn();
const mockListShareLinksForJob = vi.fn();
const mockRevokeShareLink = vi.fn();

vi.mock('@/lib/share-store', () => ({
  createShareLink: (...args: any[]) => mockCreateShareLink(...args),
  getShareLinkByToken: (...args: any[]) => mockGetShareLinkByToken(...args),
  listShareLinksForJob: (...args: any[]) => mockListShareLinksForJob(...args),
  revokeShareLink: (...args: any[]) => mockRevokeShareLink(...args),
}));

// Mock role-filter
const mockFilterDeliverablesForRole = vi.fn();
vi.mock('@/lib/role-filter', () => ({
  filterDeliverablesForRole: (...args: any[]) => mockFilterDeliverablesForRole(...args),
}));

// Mock types
vi.mock('@/lib/types', () => ({}));

// ─── Sample Data ───────────────────────────────────────────────

const sampleJob = {
  runId: 'run_12345',
  status: 'completed',
  questionnaire: {
    organizationName: 'Test Org',
    orgId: 'org-123',
  },
  deliverables: {
    healthScore: { score: 72, grade: 'B', summary: 'Good health' },
    actionPlan: { summary: 'Grow', days: [] },
    cashIntelligence: { burnRate: 50000 },
  },
};

const sampleShareLink = {
  id: 'share-id-1',
  orgId: 'org-123',
  jobId: 'run_12345',
  createdBy: 'owner',
  role: 'owner' as const,
  employeeName: undefined,
  token: 'abc123token',
  expiresAt: undefined,
  usedCount: 0,
  createdAt: '2024-01-01T00:00:00Z',
};

// ─── POST /api/share/create Tests ──────────────────────────────

describe('POST /api/share/create', () => {
  let handler: (req: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/share/create/route');
    handler = mod.POST;
  });

  it('returns 400 when runId is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'owner' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('runId and role are required');
  });

  it('returns 400 when role is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'run_12345' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('runId and role are required');
  });

  it('returns 400 for invalid role', async () => {
    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'run_12345', role: 'admin' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('role must be owner, employee, coach, or other');
  });

  it('returns 400 when employee role missing employeeName', async () => {
    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'run_12345', role: 'employee' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('employeeName is required for employee role');
  });

  it('returns 404 when job not found', async () => {
    mockGetJob.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'run_nonexist', role: 'owner' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Job not found');
  });

  it('creates share link for owner role', async () => {
    mockGetJob.mockResolvedValue(sampleJob);
    mockCreateShareLink.mockResolvedValue(sampleShareLink);

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'run_12345', role: 'owner' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.token).toBe('abc123token');
    expect(data.role).toBe('owner');
    expect(data.url).toBe('/shared/abc123token');
  });

  it('creates share link for employee role with name', async () => {
    mockGetJob.mockResolvedValue(sampleJob);
    const empLink = { ...sampleShareLink, role: 'employee', employeeName: 'John Doe' };
    mockCreateShareLink.mockResolvedValue(empLink);

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: 'run_12345',
        role: 'employee',
        employeeName: 'John Doe',
      }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.employeeName).toBe('John Doe');
    expect(data.role).toBe('employee');
  });

  it('creates share link for coach role', async () => {
    mockGetJob.mockResolvedValue(sampleJob);
    const coachLink = { ...sampleShareLink, role: 'coach' };
    mockCreateShareLink.mockResolvedValue(coachLink);

    const req = new NextRequest('http://localhost:3000/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: 'run_12345', role: 'coach' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe('coach');
  });
});

// ─── GET /api/share/{token} Tests ──────────────────────────────

describe('GET /api/share/[token]', () => {
  let handler: (req: any, ctx: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/share/[token]/route');
    handler = mod.GET;
  });

  it('returns 404 for invalid token', async () => {
    mockGetShareLinkByToken.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost:3000/api/share/badtoken');
    const res = await handler(req, { params: Promise.resolve({ token: 'badtoken' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Invalid or expired share link');
  });

  it('returns 404 when job has no deliverables', async () => {
    mockGetShareLinkByToken.mockResolvedValue(sampleShareLink);
    mockGetJob.mockResolvedValue({ ...sampleJob, deliverables: undefined });

    const req = new NextRequest('http://localhost:3000/api/share/abc123token');
    const res = await handler(req, { params: Promise.resolve({ token: 'abc123token' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Analysis not found or not yet complete');
  });

  it('returns filtered data for owner role', async () => {
    mockGetShareLinkByToken.mockResolvedValue(sampleShareLink);
    mockGetJob.mockResolvedValue(sampleJob);
    mockFilterDeliverablesForRole.mockReturnValue(sampleJob.deliverables);

    const req = new NextRequest('http://localhost:3000/api/share/abc123token');
    const res = await handler(req, { params: Promise.resolve({ token: 'abc123token' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe('owner');
    expect(data.orgName).toBe('Test Org');
    expect(data.deliverables).toBeDefined();
  });

  it('calls filter with correct role and employeeName', async () => {
    const empLink = { ...sampleShareLink, role: 'employee', employeeName: 'Jane' };
    mockGetShareLinkByToken.mockResolvedValue(empLink);
    mockGetJob.mockResolvedValue(sampleJob);
    mockFilterDeliverablesForRole.mockReturnValue({ healthScore: { score: 72 } });

    const req = new NextRequest('http://localhost:3000/api/share/abc123token');
    const res = await handler(req, { params: Promise.resolve({ token: 'abc123token' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe('employee');
    expect(data.employeeName).toBe('Jane');
    expect(mockFilterDeliverablesForRole).toHaveBeenCalledWith(
      sampleJob.deliverables,
      'employee',
      'Jane',
    );
  });
});

// ─── GET /api/share/list Tests ─────────────────────────────────

describe('GET /api/share/list', () => {
  let handler: (req: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/share/list/route');
    handler = mod.GET;
  });

  it('returns 400 when runId is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/share/list');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('runId query parameter is required');
  });

  it('returns empty array when no links exist', async () => {
    mockListShareLinksForJob.mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3000/api/share/list?runId=run_12345');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });

  it('returns list of share links', async () => {
    mockListShareLinksForJob.mockResolvedValue([sampleShareLink]);

    const req = new NextRequest('http://localhost:3000/api/share/list?runId=run_12345');
    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].token).toBe('abc123token');
  });
});

// ─── POST /api/share/revoke Tests ──────────────────────────────

describe('POST /api/share/revoke', () => {
  let handler: (req: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/share/revoke/route');
    handler = mod.POST;
  });

  it('returns 400 when id is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/share/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('id is required');
  });

  it('returns 404 when share link not found', async () => {
    mockRevokeShareLink.mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/share/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'nonexistent-id' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Share link not found');
  });

  it('revokes share link successfully', async () => {
    mockRevokeShareLink.mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/share/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'share-id-1' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});
