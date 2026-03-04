import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Auth API Tests
// Tests signup, login, session, logout, reset-password endpoints
// ═══════════════════════════════════════════════════════════════

// Mock Supabase admin client
const mockCreateUser = vi.fn();
const mockGenerateLink = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        generateLink: mockGenerateLink,
      },
    },
    from: vi.fn(() => ({
      insert: mockInsert.mockReturnThis(),
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          single: mockSingle,
        }),
      }),
      eq: mockEq.mockReturnValue({
        single: mockSingle,
      }),
    })),
  })),
}));

// Mock @supabase/supabase-js createClient (used by reset-password route directly)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
  })),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

// ─── Signup Tests ─────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  let handler: (req: Request) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/auth/signup/route');
    handler = mod.POST;
  });

  it('returns 400 when fields are missing', async () => {
    const req = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('All fields are required');
  });

  it('returns 400 when email is missing', async () => {
    const req = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'password123',
        name: 'Test User',
        organizationName: 'Test Org',
      }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('All fields are required');
  });

  it('creates user and org on valid signup', async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockInsert.mockReturnValue({ then: () => Promise.resolve() });

    const req = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'Test@Example.COM',
        password: 'password123',
        name: 'Test User',
        organizationName: 'Test Org',
      }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.userId).toBe('user-123');

    // Verify email was lowercased
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        password: 'password123',
        email_confirm: true,
      }),
    );
  });

  it('returns 400 when Supabase auth fails', async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    });

    const req = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
        organizationName: 'Test Org',
      }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('User already registered');
  });

  it('returns 500 on unexpected error', async () => {
    mockCreateUser.mockRejectedValue(new Error('Network error'));

    const req = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        organizationName: 'Test Org',
      }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Network error');
  });
});

// ─── Reset Password Tests ────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  let handler: (req: Request) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/auth/reset-password/route');
    handler = mod.POST;
  });

  it('returns 400 when email is missing', async () => {
    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Email required');
  });

  it('always returns success to prevent email enumeration', async () => {
    mockGenerateLink.mockResolvedValue({ error: null });

    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns success even when generateLink fails', async () => {
    mockGenerateLink.mockResolvedValue({
      error: { message: 'User not found' },
    });

    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fake@example.com' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
