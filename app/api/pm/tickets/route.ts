/**
 * PM Tickets API
 *
 * GET  /api/pm/tickets?orgId=...&status=...&priority=...&assigned_to=...&search=...
 * POST /api/pm/tickets  { orgId, title, description?, ...opts } or { orgId, generateFrom: "text", text: "..." }
 * PATCH /api/pm/tickets { ticketId, ...updates }
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/supabase/auth-api';
import {
  createTicket,
  listTickets,
  updateTicket,
  generateTicketsFromConversation,
  type TicketStatus,
  type TicketPriority,
  type TicketType,
} from '@/lib/pm/ticket-engine';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = request.nextUrl;
    const orgId = searchParams.get('orgId');
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    const status = searchParams.get('status') as TicketStatus | null;
    const priority = searchParams.get('priority') as TicketPriority | null;
    const type = searchParams.get('type') as TicketType | null;
    const assigned_to = searchParams.get('assigned_to');
    const assigned_agent = searchParams.get('assigned_agent');
    const contact_id = searchParams.get('contact_id');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await listTickets(orgId, {
      status: status ?? undefined,
      priority: priority ?? undefined,
      type: type ?? undefined,
      assigned_to: assigned_to ?? undefined,
      assigned_agent: assigned_agent ?? undefined,
      contact_id: contact_id ?? undefined,
      search: search ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { orgId } = body;
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    // Auto-generate tickets from text
    if (body.generateFrom === 'text' && body.text) {
      const messages = [{ role: 'user', content: String(body.text) }];
      const tickets = await generateTicketsFromConversation(orgId, messages);
      return NextResponse.json({ tickets, count: tickets.length });
    }

    // Auto-generate tickets from business analysis
    if (body.generateFrom === 'analysis') {
      const { generateTicketsFromAnalysis } = await import('@/lib/pm/ticket-engine');
      // Load latest analysis
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();
      const { data: job } = await supabase
        .from('jobs')
        .select('results_json')
        .eq('organization_id', orgId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!job?.results_json) {
        return NextResponse.json({ error: 'No completed analysis found. Run an analysis first.' }, { status: 404 });
      }

      const tickets = await generateTicketsFromAnalysis(orgId, job.results_json as Record<string, unknown>);
      return NextResponse.json({ tickets, count: tickets.length }, { status: 201 });
    }

    // Standard ticket creation
    if (!body.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const ticket = await createTicket(orgId, body.title, body.description, {
      status: body.status,
      priority: body.priority,
      type: body.type,
      assigned_to: body.assigned_to,
      assigned_agent: body.assigned_agent,
      contact_id: body.contact_id,
      parent_id: body.parent_id,
      estimated_hours: body.estimated_hours,
      due_date: body.due_date,
      source: body.source,
      source_message: body.source_message,
      tags: body.tags,
      labels: body.labels,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { ticketId, ...updates } = body;
    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
    }

    const ticket = await updateTicket(ticketId, updates);
    return NextResponse.json({ ticket });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
