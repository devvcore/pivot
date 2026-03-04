import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// API Auth (validateApiKey) Tests
// Tests API key validation logic for REST API
// ═══════════════════════════════════════════════════════════════

// We need to test the actual function, so we import it directly
// Note: the setup.ts sets PIVOT_API_KEY = 'test-api-key-12345'

describe('validateApiKey', () => {
  let validateApiKey: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/api-auth');
    validateApiKey = mod.validateApiKey;
  });

  it('returns 401 when x-api-key header is missing', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyses');

    const result = validateApiKey(req);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('returns 401 when x-api-key is wrong', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyses', {
      headers: { 'x-api-key': 'wrong-key' },
    });

    const result = validateApiKey(req);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('returns null (allow) when x-api-key is correct', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyses', {
      headers: { 'x-api-key': 'test-api-key-12345' },
    });

    const result = validateApiKey(req);

    expect(result).toBeNull();
  });

  it('returns null when no PIVOT_API_KEY is configured (dev mode)', async () => {
    const originalKey = process.env.PIVOT_API_KEY;
    delete process.env.PIVOT_API_KEY;

    // Re-import to get fresh module with updated env
    vi.resetModules();
    const mod = await import('@/lib/api-auth');

    const req = new NextRequest('http://localhost:3000/api/v1/analyses');
    const result = mod.validateApiKey(req);

    expect(result).toBeNull();

    // Restore
    process.env.PIVOT_API_KEY = originalKey;
  });

  it('error response body contains descriptive message', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyses', {
      headers: { 'x-api-key': 'invalid' },
    });

    const result = validateApiKey(req);
    const body = await result!.json();

    expect(body.error).toContain('Unauthorized');
    expect(body.error).toContain('x-api-key');
  });
});
