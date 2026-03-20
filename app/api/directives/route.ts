/**
 * GET  /api/directives?orgId=... — List active directives for org
 * POST /api/directives           — Create a new directive
 * DELETE /api/directives?id=...  — Deactivate a directive
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import { saveDirective, loadDirectives, deactivateDirective } from '@/lib/execution/directives';
import type { DirectiveType, DirectiveSource } from '@/lib/execution/directives';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const directives = await loadDirectives(orgId);
  return NextResponse.json({ directives });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { orgId, type, content, source } = body as {
    orgId?: string;
    type?: DirectiveType;
    content?: string;
    source?: DirectiveSource;
  };

  if (!orgId || !type || !content) {
    return NextResponse.json(
      { error: 'orgId, type, and content are required' },
      { status: 400 }
    );
  }

  const validTypes: DirectiveType[] = ['never', 'always', 'prefer', 'ignore'];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    );
  }

  const directive = await saveDirective(orgId, type, content, source ?? 'user');
  if (!directive) {
    return NextResponse.json({ error: 'Failed to save directive' }, { status: 500 });
  }

  return NextResponse.json({ directive }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const directiveId = req.nextUrl.searchParams.get('id');
  if (!directiveId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const success = await deactivateDirective(directiveId);
  if (!success) {
    return NextResponse.json({ error: 'Failed to deactivate directive' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
