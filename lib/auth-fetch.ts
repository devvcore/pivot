"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Authenticated fetch: attaches Supabase JWT as Bearer token.
 * Firebase Hosting strips all cookies except __session, so we must
 * send the auth token explicitly via the Authorization header.
 * Retries once after refreshing the session on 401.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const sb = createClient();
  const {
    data: { session },
  } = await sb.auth.getSession();

  const headers = new Headers(init?.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    // Try refreshing the session
    const {
      data: { session: refreshed },
      error,
    } = await sb.auth.refreshSession();
    if (!error && refreshed?.access_token) {
      headers.set("Authorization", `Bearer ${refreshed.access_token}`);
      return fetch(input, { ...init, headers });
    }
    // Refresh failed — session is truly expired. Redirect to login.
    if (typeof window !== "undefined") {
      window.location.href = "/?expired=1";
    }
  }
  return res;
}
