import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Authenticate an API route request.
 *
 * Supports two auth flows:
 * 1. Cookie-based (browser): Uses @supabase/ssr with the cookie jar
 * 2. Bearer token (API clients): Uses Authorization header with Supabase anon key
 *
 * Returns the authenticated user or null.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ user: { id: string; email?: string }; error?: never } | { user?: never; error: NextResponse }> {
  const authHeader = request.headers.get('Authorization');

  // Flow 1: Bearer token auth (API clients, mobile, etc.)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    return { user: { id: user.id, email: user.email } };
  }

  // Flow 2: Cookie-based auth (browser)
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try { cookieStore.set(name, value, options); } catch { /* read-only */ }
            });
          },
        },
      }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    return { user: { id: user.id, email: user.email } };
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
}
