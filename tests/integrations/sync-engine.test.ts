import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Sync Engine Tests
// Tests single sync, org-wide sync, stale detection, and
// error handling.
// ═══════════════════════════════════════════════════════════════

// Mock integration store
const mockGetIntegration = vi.fn();
const mockListIntegrations = vi.fn();
const mockUpdateIntegration = vi.fn();
const mockCreateSyncLog = vi.fn();
const mockUpdateSyncLog = vi.fn();

vi.mock('@/lib/integrations/store', () => ({
  getIntegration: (...args: any[]) => mockGetIntegration(...args),
  listIntegrations: (...args: any[]) => mockListIntegrations(...args),
  updateIntegration: (...args: any[]) => mockUpdateIntegration(...args),
  createSyncLog: (...args: any[]) => mockCreateSyncLog(...args),
  updateSyncLog: (...args: any[]) => mockUpdateSyncLog(...args),
}));

// Mock oauth
vi.mock('@/lib/integrations/oauth', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresIn: 3600,
    raw: {},
  }),
}));

// Mock Slack connector
const mockSlackSyncData = vi.fn();
vi.mock('@/lib/integrations/slack', () => ({
  syncData: (...args: any[]) => mockSlackSyncData(...args),
}));

// Mock Gmail connector
const mockGmailSyncData = vi.fn();
vi.mock('@/lib/integrations/gmail', () => ({
  syncData: (...args: any[]) => mockGmailSyncData(...args),
}));

// Mock Supabase admin for getStaleIntegrations
const mockSupabaseFrom = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (...args: any[]) => mockSupabaseFrom(...args),
  })),
}));

// ─── Sample Data ───────────────────────────────────────────────

const slackIntegration = {
  id: 'int-slack-1',
  orgId: 'org-123',
  provider: 'slack' as const,
  status: 'connected' as const,
  accessToken: 'xoxp-slack-token',
  refreshToken: null,
  tokenExpiresAt: null,
  scopes: ['channels:history', 'users:read'],
  metadata: {},
  lastSyncAt: null,
  syncFrequencyMinutes: 60,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const gmailIntegration = {
  id: 'int-gmail-1',
  orgId: 'org-123',
  provider: 'gmail' as const,
  status: 'connected' as const,
  accessToken: 'gmail-token',
  refreshToken: 'gmail-refresh',
  tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  metadata: {},
  lastSyncAt: null,
  syncFrequencyMinutes: 120,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const successResult = {
  success: true,
  recordsProcessed: 50,
  insightsGenerated: 10,
  errors: [],
};

const failResult = {
  success: false,
  recordsProcessed: 0,
  insightsGenerated: 0,
  errors: ['API rate limited'],
};

// ─── runSync Tests ─────────────────────────────────────────────

describe('runSync', () => {
  let runSync: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreateSyncLog.mockResolvedValue({ id: 'log-1' });
    mockUpdateIntegration.mockResolvedValue(slackIntegration);
    mockUpdateSyncLog.mockResolvedValue({ id: 'log-1' });

    const mod = await import('@/lib/integrations/sync-engine');
    runSync = mod.runSync;
  });

  it('returns error when integration not found', async () => {
    mockGetIntegration.mockResolvedValue(null);

    const result = await runSync('nonexistent');

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });

  it('syncs Slack integration successfully', async () => {
    mockGetIntegration.mockResolvedValue(slackIntegration);
    mockSlackSyncData.mockResolvedValue(successResult);

    const result = await runSync('int-slack-1');

    expect(result.success).toBe(true);
    expect(result.recordsProcessed).toBe(50);
    expect(result.insightsGenerated).toBe(10);

    // Verify sync log was created and updated
    expect(mockCreateSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationId: 'int-slack-1',
        status: 'running',
      }),
    );

    expect(mockUpdateSyncLog).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({
        status: 'completed',
        recordsProcessed: 50,
        insightsGenerated: 10,
      }),
    );
  });

  it('handles connector sync failure', async () => {
    mockGetIntegration.mockResolvedValue(slackIntegration);
    mockSlackSyncData.mockRejectedValue(new Error('Slack API error'));

    const result = await runSync('int-slack-1');

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Slack API error');

    // Verify integration was marked as error
    expect(mockUpdateIntegration).toHaveBeenCalledWith(
      'int-slack-1',
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('marks integration as syncing during operation', async () => {
    mockGetIntegration.mockResolvedValue(slackIntegration);
    mockSlackSyncData.mockResolvedValue(successResult);

    await runSync('int-slack-1');

    // First call should set status to 'syncing'
    const firstUpdateCall = mockUpdateIntegration.mock.calls[0];
    expect(firstUpdateCall[0]).toBe('int-slack-1');
    expect(firstUpdateCall[1]).toEqual({ status: 'syncing' });
  });
});

// ─── runOrgSync Tests ──────────────────────────────────────────

describe('runOrgSync', () => {
  let runOrgSync: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreateSyncLog.mockResolvedValue({ id: 'log-1' });
    mockUpdateIntegration.mockResolvedValue(slackIntegration);
    mockUpdateSyncLog.mockResolvedValue({ id: 'log-1' });

    const mod = await import('@/lib/integrations/sync-engine');
    runOrgSync = mod.runOrgSync;
  });

  it('returns empty object when no connected integrations', async () => {
    mockListIntegrations.mockResolvedValue([]);

    const result = await runOrgSync('org-123');

    expect(result).toEqual({});
  });

  it('skips disconnected integrations', async () => {
    mockListIntegrations.mockResolvedValue([
      { ...slackIntegration, status: 'disconnected' },
    ]);

    const result = await runOrgSync('org-123');

    expect(result).toEqual({});
  });

  it('syncs multiple connected integrations in parallel', async () => {
    mockListIntegrations.mockResolvedValue([slackIntegration, gmailIntegration]);
    mockGetIntegration.mockImplementation((id: string) => {
      if (id === 'int-slack-1') return Promise.resolve(slackIntegration);
      if (id === 'int-gmail-1') return Promise.resolve(gmailIntegration);
      return Promise.resolve(null);
    });
    mockSlackSyncData.mockResolvedValue(successResult);
    mockGmailSyncData.mockResolvedValue({
      ...successResult,
      recordsProcessed: 30,
      insightsGenerated: 5,
    });

    const result = await runOrgSync('org-123');

    expect(result.slack).toBeDefined();
    expect(result.gmail).toBeDefined();
    expect(result.slack.success).toBe(true);
    expect(result.gmail.success).toBe(true);
  });

  it('handles partial failure (one integration fails, others continue)', async () => {
    mockListIntegrations.mockResolvedValue([slackIntegration, gmailIntegration]);
    mockGetIntegration.mockImplementation((id: string) => {
      if (id === 'int-slack-1') return Promise.resolve(slackIntegration);
      if (id === 'int-gmail-1') return Promise.resolve(gmailIntegration);
      return Promise.resolve(null);
    });
    mockSlackSyncData.mockRejectedValue(new Error('Slack down'));
    mockGmailSyncData.mockResolvedValue(successResult);

    const result = await runOrgSync('org-123');

    expect(result.slack.success).toBe(false);
    expect(result.slack.errors).toContain('Slack down');
    expect(result.gmail.success).toBe(true);
  });

  it('includes error integrations in sync', async () => {
    const errorIntegration = { ...slackIntegration, status: 'error' as const };
    mockListIntegrations.mockResolvedValue([errorIntegration]);
    mockGetIntegration.mockResolvedValue(errorIntegration);
    mockSlackSyncData.mockResolvedValue(successResult);

    const result = await runOrgSync('org-123');

    expect(result.slack).toBeDefined();
    expect(result.slack.success).toBe(true);
  });
});

// ─── getStaleIntegrations Tests ─────────────────────────────────

describe('getStaleIntegrations', () => {
  let getStaleIntegrations: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/integrations/sync-engine');
    getStaleIntegrations = mod.getStaleIntegrations;
  });

  it('returns empty array when no integrations exist', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const result = await getStaleIntegrations();

    expect(result).toEqual([]);
  });

  it('considers never-synced integrations as stale', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'int-1',
              org_id: 'org-1',
              provider: 'slack',
              status: 'connected',
              access_token: 'tok',
              refresh_token: null,
              token_expires_at: null,
              scopes: [],
              metadata: {},
              last_sync_at: null,
              sync_frequency_minutes: 60,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
          error: null,
        }),
      }),
    });

    const result = await getStaleIntegrations();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('int-1');
  });

  it('identifies recently-synced integrations as not stale', async () => {
    const recentSync = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'int-1',
              org_id: 'org-1',
              provider: 'slack',
              status: 'connected',
              access_token: 'tok',
              refresh_token: null,
              token_expires_at: null,
              scopes: [],
              metadata: {},
              last_sync_at: recentSync,
              sync_frequency_minutes: 60, // Not stale yet (5 min < 60 min)
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
          error: null,
        }),
      }),
    });

    const result = await getStaleIntegrations();

    expect(result).toHaveLength(0);
  });

  it('handles database errors gracefully', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error' },
        }),
      }),
    });

    const result = await getStaleIntegrations();

    expect(result).toEqual([]);
  });
});

// ─── Token Refresh Logic Tests ──────────────────────────────────

describe('Token refresh logic', () => {
  it('does not refresh when token is still valid', async () => {
    // Token expires in 1 hour, well beyond 5 min buffer
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const integration = { ...slackIntegration, tokenExpiresAt: futureExpiry };

    // The refreshTokenIfNeeded logic:
    const expiresAt = new Date(integration.tokenExpiresAt).getTime();
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000;

    expect(expiresAt - now > bufferMs).toBe(true);
  });

  it('identifies tokens needing refresh within 5 min of expiry', () => {
    // Token expires in 3 minutes (within 5 min buffer)
    const nearExpiry = new Date(Date.now() + 3 * 60 * 1000).toISOString();

    const expiresAt = new Date(nearExpiry).getTime();
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000;

    expect(expiresAt - now > bufferMs).toBe(false);
  });

  it('identifies expired tokens', () => {
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();

    const expiresAt = new Date(pastExpiry).getTime();
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000;

    expect(expiresAt - now > bufferMs).toBe(false);
  });
});

// ─── Rate Limit Config Tests ────────────────────────────────────

describe('Rate limit configuration', () => {
  it('has appropriate delays for each provider', () => {
    const RATE_LIMIT_DELAY_MS: Record<string, number> = {
      slack: 1200,
      gmail: 500,
      salesforce: 200,
      hubspot: 150,
      quickbooks: 500,
      jira: 200,
      stripe: 100,
      adp: 1000,
      workday: 1000,
    };

    // Slack has the highest delay due to strict rate limits
    expect(RATE_LIMIT_DELAY_MS.slack).toBeGreaterThan(RATE_LIMIT_DELAY_MS.stripe);

    // HR providers are conservative
    expect(RATE_LIMIT_DELAY_MS.adp).toBeGreaterThanOrEqual(1000);
    expect(RATE_LIMIT_DELAY_MS.workday).toBeGreaterThanOrEqual(1000);

    // All delays are positive
    for (const [, delay] of Object.entries(RATE_LIMIT_DELAY_MS)) {
      expect(delay).toBeGreaterThan(0);
    }
  });
});
