import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Integrations API Tests
// Tests /api/integrations/connect endpoint
// ═══════════════════════════════════════════════════════════════

// Mock Supabase admin client
const mockInsert = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  })),
}));

// Mock OAuth config
vi.mock('@/lib/integrations/oauth', () => ({
  getOAuthConfig: vi.fn().mockReturnValue({
    provider: 'slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    scopes: ['channels:history', 'users:read'],
    redirectUri: 'http://localhost:3000/api/integrations/slack/callback',
  }),
}));

// Mock integration store
const mockGetByProvider = vi.fn().mockResolvedValue(null);
const mockCreateIntegration = vi.fn().mockResolvedValue({ id: 'test-id' });
vi.mock('@/lib/integrations/store', () => ({
  getIntegrationByProvider: (...args: any[]) => mockGetByProvider(...args),
  createIntegration: (...args: any[]) => mockCreateIntegration(...args),
}));

// Mock Gmail IMAP
vi.mock('@/lib/integrations/gmail-imap', () => ({
  isGmailIMAPConfigured: vi.fn().mockReturnValue(true),
}));

// Mock Stripe
vi.mock('@/lib/integrations/stripe-integration', () => ({
  isStripeConfigured: vi.fn().mockReturnValue(true),
}));

// ─── POST /api/integrations/connect Tests ──────────────────────

describe('POST /api/integrations/connect', () => {
  let handler: (req: Request) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockGetByProvider.mockResolvedValue(null);
    mockCreateIntegration.mockResolvedValue({ id: 'test-id' });

    const mod = await import('@/app/api/integrations/connect/route');
    handler = mod.POST;
  });

  it('returns 400 when provider is missing', async () => {
    const req = new Request('http://localhost:3000/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-123' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('provider and orgId are required');
  });

  it('returns 400 when orgId is missing', async () => {
    const req = new Request('http://localhost:3000/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'slack' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('provider and orgId are required');
  });

  it('returns 400 for invalid provider', async () => {
    const req = new Request('http://localhost:3000/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'notion', orgId: 'org-123' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Invalid provider');
  });

  it('returns redirectUrl for valid slack connection', async () => {
    const req = new Request('http://localhost:3000/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'slack', orgId: 'org-123' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.redirectUrl).toBeDefined();
    expect(data.redirectUrl).toContain('slack.com/oauth');
    expect(data.state).toBeDefined();
  });

  it('stores OAuth state token for CSRF protection', async () => {
    const req = new Request('http://localhost:3000/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'slack', orgId: 'org-123' }),
    });

    await handler(req);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-123',
        provider: 'slack',
      }),
    );
  });

  it('returns 500 when state storage fails', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } });

    const req = new Request('http://localhost:3000/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'slack', orgId: 'org-123' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain('Failed to initiate OAuth flow');
  });

  it('connects Gmail directly via IMAP when configured', async () => {
    const req = new Request('http://localhost:3000/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'gmail', orgId: 'org-123' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.connected).toBe(true);
    expect(data.provider).toBe('gmail');
  });

  it('connects Stripe directly via API key when configured', async () => {
    const req = new Request('http://localhost:3000/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'stripe', orgId: 'org-123' }),
    });

    const res = await handler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.connected).toBe(true);
    expect(data.provider).toBe('stripe');
  });

  it('accepts all valid provider names', async () => {
    const validProviders = [
      'slack', 'gmail', 'adp', 'workday',
      'quickbooks', 'salesforce', 'hubspot', 'stripe', 'jira',
    ];

    for (const provider of validProviders) {
      mockInsert.mockResolvedValue({ error: null });
      mockGetByProvider.mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, orgId: 'org-123' }),
      });

      const res = await handler(req);
      // Should not return 400 for valid providers
      expect(res.status).not.toBe(400);
    }
  });
});
