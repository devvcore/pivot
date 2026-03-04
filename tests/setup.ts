import { vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Global test setup for Pivot
// ═══════════════════════════════════════════════════════════════

// Set test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.PIVOT_API_KEY = 'test-api-key-12345';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock next/server's NextResponse and NextRequest
vi.mock('next/server', () => {
  class MockNextResponse {
    private _body: any;
    private _init: ResponseInit;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this._body = body;
      this._init = init || {};
    }

    get status() {
      return (this._init as any).status || 200;
    }

    get headers() {
      return new Headers((this._init as any).headers);
    }

    async json() {
      if (typeof this._body === 'string') return JSON.parse(this._body);
      return this._body;
    }

    static json(data: any, init?: ResponseInit) {
      const resp = new MockNextResponse(JSON.stringify(data), {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init?.headers as Record<string, string>),
        },
      });
      // Attach the parsed data directly for easy test access
      (resp as any)._jsonData = data;
      return resp;
    }
  }

  class MockNextRequest {
    public url: string;
    public method: string;
    public headers: Headers;
    public nextUrl: URL;
    private _body: any;

    constructor(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers || {});
      this.nextUrl = new URL(url);
      this._body = init?.body;
    }

    async json() {
      return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
    }

    async formData() {
      return this._body;
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: MockNextRequest,
  };
});

// Mock next/headers cookies
vi.mock('next/headers', () => {
  const cookieStore = new Map<string, string>();
  return {
    cookies: vi.fn().mockResolvedValue({
      getAll: () => Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value })),
      get: (name: string) => {
        const value = cookieStore.get(name);
        return value ? { name, value } : undefined;
      },
      set: (name: string, value: string, _options?: any) => {
        cookieStore.set(name, value);
      },
      delete: (name: string) => {
        cookieStore.delete(name);
      },
    }),
  };
});

// Mock @supabase/ssr createServerClient
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  })),
}));

// Mock @supabase/supabase-js createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn(),
        generateLink: vi.fn(),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  })),
}));
