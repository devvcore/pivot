/**
 * Ticket Engine — Internal project management for Pivot
 *
 * Manages PM tickets stored in the pm_tickets table (migration 016).
 * Agents can create, update, assign, and prioritize tickets.
 * Tickets can be auto-generated from business analysis or conversations.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { GoogleGenAI } from '@google/genai';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TicketStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';
export type TicketType = 'task' | 'bug' | 'feature' | 'epic' | 'story';

export interface Ticket {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  assigned_to: string | null;
  assigned_agent: string | null;
  contact_id: string | null;
  parent_id: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  due_date: string | null;
  completed_at: string | null;
  source: string;
  source_message: string | null;
  execution_task_id: string | null;
  tags: string[];
  labels: string[];
  ai_summary: string | null;
  ai_complexity_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketOptions {
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  assigned_to?: string;
  assigned_agent?: string;
  contact_id?: string;
  parent_id?: string;
  estimated_hours?: number;
  due_date?: string;
  source?: string;
  source_message?: string;
  tags?: string[];
  labels?: string[];
}

export interface UpdateTicketFields {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  assigned_to?: string;
  assigned_agent?: string;
  contact_id?: string;
  parent_id?: string;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: string;
  completed_at?: string;
  tags?: string[];
  labels?: string[];
  ai_summary?: string;
  ai_complexity_score?: number;
}

export interface TicketFilters {
  status?: TicketStatus | TicketStatus[];
  priority?: TicketPriority | TicketPriority[];
  type?: TicketType;
  assigned_to?: string;
  assigned_agent?: string;
  contact_id?: string;
  parent_id?: string;
  source?: string;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface BoardColumn {
  status: TicketStatus;
  label: string;
  tickets: Ticket[];
  count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FLASH_MODEL = 'gemini-2.5-flash';

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: prompt,
    config: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return response.text ?? '[]';
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Create a PM ticket.
 */
export async function createTicket(
  orgId: string,
  title: string,
  description?: string,
  opts?: CreateTicketOptions
): Promise<Ticket> {
  const supabase = createAdminClient();

  const row = {
    org_id: orgId,
    title,
    description: description ?? opts?.description ?? null,
    status: opts?.status ?? 'backlog',
    priority: opts?.priority ?? 'medium',
    type: opts?.type ?? 'task',
    assigned_to: opts?.assigned_to ?? null,
    assigned_agent: opts?.assigned_agent ?? null,
    contact_id: opts?.contact_id ?? null,
    parent_id: opts?.parent_id ?? null,
    estimated_hours: opts?.estimated_hours ?? null,
    due_date: opts?.due_date ?? null,
    source: opts?.source ?? 'manual',
    source_message: opts?.source_message ?? null,
    tags: opts?.tags ?? [],
    labels: opts?.labels ?? [],
  };

  const { data, error } = await supabase
    .from('pm_tickets')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`Failed to create ticket: ${error.message}`);
  return data as Ticket;
}

/**
 * Update a ticket by ID.
 */
export async function updateTicket(
  ticketId: string,
  updates: UpdateTicketFields
): Promise<Ticket> {
  const supabase = createAdminClient();

  // Auto-set completed_at when moving to done
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  if (updates.status === 'done' && !updates.completed_at) {
    patch.completed_at = new Date().toISOString();
  }
  // Clear completed_at if moving out of done
  if (updates.status && updates.status !== 'done') {
    patch.completed_at = null;
  }

  const { data, error } = await supabase
    .from('pm_tickets')
    .update(patch)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update ticket: ${error.message}`);
  return data as Ticket;
}

/**
 * List tickets with optional filters.
 */
export async function listTickets(
  orgId: string,
  filters?: TicketFilters
): Promise<{ tickets: Ticket[]; total: number }> {
  const supabase = createAdminClient();
  const limit = Math.min(filters?.limit ?? 50, 200);
  const offset = filters?.offset ?? 0;

  let query = supabase
    .from('pm_tickets')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in('status', statuses);
  }
  if (filters?.priority) {
    const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
    query = query.in('priority', priorities);
  }
  if (filters?.type) {
    query = query.eq('type', filters.type);
  }
  if (filters?.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to);
  }
  if (filters?.assigned_agent) {
    query = query.eq('assigned_agent', filters.assigned_agent);
  }
  if (filters?.contact_id) {
    query = query.eq('contact_id', filters.contact_id);
  }
  if (filters?.parent_id) {
    query = query.eq('parent_id', filters.parent_id);
  }
  if (filters?.source) {
    query = query.eq('source', filters.source);
  }
  if (filters?.tag) {
    query = query.contains('tags', [filters.tag]);
  }
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list tickets: ${error.message}`);
  return { tickets: (data ?? []) as Ticket[], total: count ?? 0 };
}

/**
 * Auto-generate tickets from business analysis deliverables.
 * Parses action items, strategic initiatives, and health checklist items.
 *
 * Ported from Ultron's ticket-writer: each ticket includes acceptance criteria,
 * architecture notes with primary + alternative approaches, complexity sizing,
 * and explicit dependency ordering.
 */
export async function generateTicketsFromAnalysis(
  orgId: string,
  deliverables: Record<string, unknown>
): Promise<Ticket[]> {
  // Build a compact summary of actionable items from the analysis
  const parts: string[] = [];
  if (deliverables.strategicInitiatives) {
    parts.push(`Strategic Initiatives: ${JSON.stringify(deliverables.strategicInitiatives).slice(0, 3000)}`);
  }
  if (deliverables.healthChecklist) {
    parts.push(`Health Checklist: ${JSON.stringify(deliverables.healthChecklist).slice(0, 2000)}`);
  }
  if (deliverables.riskRegister) {
    parts.push(`Risk Register: ${JSON.stringify(deliverables.riskRegister).slice(0, 2000)}`);
  }
  if (deliverables.actionPlan) {
    parts.push(`Action Plan: ${JSON.stringify(deliverables.actionPlan).slice(0, 3000)}`);
  }
  if (deliverables.kpis) {
    parts.push(`KPIs: ${JSON.stringify(deliverables.kpis).slice(0, 1000)}`);
  }

  if (parts.length === 0) return [];

  // Check for existing tickets to avoid duplicates (Ultron pattern)
  const { tickets: existingTickets } = await listTickets(orgId, { status: ['backlog', 'todo', 'in_progress', 'review'], limit: 100 });
  const existingTitles = existingTickets.map(t => t.title).join(', ');

  const prompt = `You are a senior technical project manager. Extract actionable tickets from this business analysis.
Each ticket must be SPECIFIC and SELF-CONTAINED — someone should be able to act on it immediately without asking follow-up questions.

ANALYSIS DATA:
${parts.join('\n\n')}

${existingTitles ? `EXISTING TICKETS (DO NOT DUPLICATE):\n${existingTitles}\n\nOnly create NEW tickets for work not already covered above.\n` : ''}
Return a JSON array of tickets. Each ticket:
{
  "title": "Short actionable title (imperative verb + noun)",
  "description": "What needs to be done and WHY (include business context so the person understands the purpose)",
  "acceptanceCriteria": ["specific testable condition 1", "specific testable condition 2"],
  "architectureNotes": "Primary approach — detailed implementation steps, specific tools/services to use",
  "alternativeApproach": "Alternative approach — equally actionable but using different tools/methods, with tradeoffs noted",
  "priority": "critical" | "high" | "medium" | "low",
  "type": "task" | "feature" | "epic",
  "complexity": "S" | "M" | "L" | "XL",
  "estimated_hours": number or null,
  "dependencies": ["title of ticket that must be done first"],
  "tags": ["relevant", "tags"],
  "labels": ["domain-label"]
}

Rules:
- Extract 5-15 concrete tickets, not vague goals
- Title must start with a verb: "Implement...", "Set up...", "Research...", "Fix..."
- Priority based on business impact + urgency
- Complexity: S (hours), M (1-2 days), L (3-5 days), XL (1+ week, should be broken down)
- Estimated hours should be realistic (2-40h range)
- Acceptance criteria must be TESTABLE — not "works correctly" but specific measurable conditions
- Architecture notes: be exact about tools, APIs, services, and steps
- Alternative approach: a genuinely different path (not just "do it manually")
- Dependencies: reference other ticket titles that must be completed first
- Order tickets: foundation first, then core work, then integrations, then polish
- Tags: use domain keywords. Labels: use category like "strategy", "ops", "marketing", "finance", "hr", "engineering"`;

  const raw = await callGemini(prompt);
  let ticketDefs: Array<{
    title: string;
    description?: string;
    acceptanceCriteria?: string[];
    architectureNotes?: string;
    alternativeApproach?: string;
    priority?: TicketPriority;
    type?: TicketType;
    complexity?: string;
    estimated_hours?: number;
    dependencies?: string[];
    tags?: string[];
    labels?: string[];
  }>;

  try {
    ticketDefs = JSON.parse(raw);
    if (!Array.isArray(ticketDefs)) ticketDefs = [];
  } catch {
    ticketDefs = [];
  }

  const created: Ticket[] = [];
  for (const def of ticketDefs.slice(0, 20)) {
    if (!def.title) continue;

    // Build enriched description with acceptance criteria, architecture, and alternative
    const descParts: string[] = [];
    if (def.description) descParts.push(def.description);
    if (def.acceptanceCriteria?.length) {
      descParts.push('\n**Acceptance Criteria:**\n' + def.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n'));
    }
    if (def.architectureNotes) {
      descParts.push('\n**Implementation (Primary):**\n' + def.architectureNotes);
    }
    if (def.alternativeApproach) {
      descParts.push('\n**Alternative Approach:**\n' + def.alternativeApproach);
    }
    if (def.dependencies?.length) {
      descParts.push('\n**Dependencies:** ' + def.dependencies.join(', '));
    }
    if (def.complexity) {
      descParts.push(`\n**Complexity:** ${def.complexity}`);
    }

    try {
      const ticket = await createTicket(orgId, def.title, descParts.join('\n'), {
        priority: def.priority ?? 'medium',
        type: def.type ?? 'task',
        estimated_hours: (def.estimated_hours ?? undefined) as number | undefined,
        source: 'analysis',
        tags: def.tags ?? [],
        labels: def.labels ?? [],
      });
      created.push(ticket);
    } catch (err) {
      console.error(`[TicketEngine] Failed to create ticket "${def.title}":`, err);
    }
  }

  return created;
}

/**
 * Extract actionable items from conversation messages and create tickets.
 * Enhanced with Ultron patterns: acceptance criteria, dedup, and adaptive status
 * (if a task was completed via alternative means, it's still marked done).
 */
export async function generateTicketsFromConversation(
  orgId: string,
  messages: Array<{ role: string; content: string }>
): Promise<Ticket[]> {
  const conversationText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')
    .slice(0, 6000);

  // Check for existing tickets to avoid duplicates
  const { tickets: existingTickets } = await listTickets(orgId, { status: ['backlog', 'todo', 'in_progress', 'review'], limit: 100 });
  const existingTitles = existingTickets.map(t => t.title).join(', ');

  const prompt = `You are a project manager. Extract actionable tasks from this conversation and return them as tickets.
Each ticket must be SELF-CONTAINED — someone should be able to act on it without reading the conversation.

CONVERSATION:
${conversationText}

${existingTitles ? `EXISTING TICKETS (DO NOT DUPLICATE):\n${existingTitles}\n\nOnly create tickets for NEW work not already covered.\n` : ''}
Return a JSON array of tickets. Each ticket:
{
  "title": "Short actionable title (imperative verb + noun)",
  "description": "What needs to be done and WHY, with enough context to act without reading the conversation",
  "acceptanceCriteria": ["specific testable condition 1", "specific testable condition 2"],
  "priority": "critical" | "high" | "medium" | "low",
  "type": "task" | "bug" | "feature",
  "complexity": "S" | "M" | "L",
  "tags": ["relevant", "tags"]
}

Rules:
- Only extract ACTIONABLE items (things someone needs to do)
- Ignore greetings, questions, and status updates
- Title must start with a verb
- Acceptance criteria: specific, testable conditions (not "works correctly")
- Complexity: S (hours), M (1-2 days), L (3-5 days)
- If conversation indicates a feature was completed via alternative approach (e.g., no-code tool), mark status as "done" with a note
- Return empty array [] if no actionable items found`;

  const raw = await callGemini(prompt);
  let ticketDefs: Array<{
    title: string;
    description?: string;
    acceptanceCriteria?: string[];
    priority?: TicketPriority;
    type?: TicketType;
    complexity?: string;
    tags?: string[];
    status?: string;
  }>;

  try {
    ticketDefs = JSON.parse(raw);
    if (!Array.isArray(ticketDefs)) ticketDefs = [];
  } catch {
    ticketDefs = [];
  }

  const created: Ticket[] = [];
  for (const def of ticketDefs.slice(0, 15)) {
    if (!def.title) continue;

    // Build enriched description
    const descParts: string[] = [];
    if (def.description) descParts.push(def.description);
    if (def.acceptanceCriteria?.length) {
      descParts.push('\n**Acceptance Criteria:**\n' + def.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n'));
    }
    if (def.complexity) {
      descParts.push(`\n**Complexity:** ${def.complexity}`);
    }

    // Adaptive status: if conversation says it's done, create as done
    const resolvedStatus: TicketStatus = def.status === 'done' ? 'done' : 'backlog';

    try {
      const ticket = await createTicket(orgId, def.title, descParts.join('\n'), {
        priority: def.priority ?? 'medium',
        type: def.type ?? 'task',
        status: resolvedStatus,
        source: 'conversation',
        source_message: conversationText.slice(0, 500),
        tags: def.tags ?? [],
      });
      created.push(ticket);
    } catch (err) {
      console.error(`[TicketEngine] Failed to create ticket "${def.title}":`, err);
    }
  }

  return created;
}

/**
 * Assign a ticket to an execution agent and optionally create an execution task.
 */
export async function assignTicketToAgent(
  ticketId: string,
  agentId: string
): Promise<Ticket> {
  const supabase = createAdminClient();

  // Fetch the ticket first
  const { data: ticket, error: fetchErr } = await supabase
    .from('pm_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (fetchErr || !ticket) throw new Error(`Ticket not found: ${ticketId}`);

  // Update ticket assignment
  const updated = await updateTicket(ticketId, {
    assigned_agent: agentId,
    status: ticket.status === 'backlog' ? 'todo' : ticket.status,
  });

  // Create an execution task for the agent
  const { data: task, error: taskErr } = await supabase
    .from('execution_tasks')
    .insert({
      org_id: ticket.org_id,
      agent_id: agentId,
      message: `[PM Ticket] ${ticket.title}\n\n${ticket.description ?? ''}`,
      status: 'pending',
      priority: ticket.priority,
    })
    .select('id')
    .single();

  if (!taskErr && task) {
    await updateTicket(ticketId, { execution_task_id: task.id } as UpdateTicketFields & { execution_task_id: string });
  }

  return updated;
}

/**
 * Get Kanban board data — tickets grouped by status with counts.
 */
export async function getTicketBoard(orgId: string): Promise<BoardColumn[]> {
  const supabase = createAdminClient();

  const statusOrder: TicketStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'];

  const { data, error } = await supabase
    .from('pm_tickets')
    .select('*')
    .eq('org_id', orgId)
    .in('status', statusOrder)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(`Failed to load board: ${error.message}`);

  const tickets = (data ?? []) as Ticket[];
  const grouped: Record<string, Ticket[]> = {};
  for (const s of statusOrder) grouped[s] = [];
  for (const t of tickets) {
    if (grouped[t.status]) grouped[t.status].push(t);
  }

  return statusOrder.map(status => ({
    status,
    label: STATUS_LABELS[status],
    tickets: grouped[status],
    count: grouped[status].length,
  }));
}

/**
 * AI-powered backlog prioritization.
 * Re-ranks backlog tickets by business impact, urgency, and dependencies.
 */
export async function prioritizeBacklog(orgId: string): Promise<Ticket[]> {
  const { tickets } = await listTickets(orgId, { status: 'backlog', limit: 50 });
  if (tickets.length <= 1) return tickets;

  const ticketSummaries = tickets.map(t => ({
    id: t.id,
    title: t.title,
    description: (t.description ?? '').slice(0, 200),
    priority: t.priority,
    type: t.type,
    estimated_hours: t.estimated_hours,
    tags: t.tags,
  }));

  const prompt = `You are a product manager. Prioritize these backlog tickets by business impact and urgency.

TICKETS:
${JSON.stringify(ticketSummaries, null, 1)}

Return a JSON array of objects with the ticket ID and new priority:
[
  { "id": "uuid", "priority": "critical" | "high" | "medium" | "low", "reason": "brief reason" }
]

Prioritization rules:
- Revenue-impacting items → critical/high
- Customer-facing bugs → high
- Internal improvements → medium
- Nice-to-haves → low
- Consider dependencies: blockers should be higher priority
- Max 3 critical, max 5 high — be selective`;

  const raw = await callGemini(prompt);
  let rankings: Array<{ id: string; priority: TicketPriority; reason?: string }>;

  try {
    rankings = JSON.parse(raw);
    if (!Array.isArray(rankings)) rankings = [];
  } catch {
    rankings = [];
  }

  const updated: Ticket[] = [];
  for (const rank of rankings) {
    const ticket = tickets.find(t => t.id === rank.id);
    if (!ticket || ticket.priority === rank.priority) continue;
    try {
      const u = await updateTicket(rank.id, {
        priority: rank.priority,
        ai_summary: rank.reason ?? undefined,
      });
      updated.push(u);
    } catch {
      // skip failed updates
    }
  }

  return updated.length > 0 ? updated : tickets;
}
