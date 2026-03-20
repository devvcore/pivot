/**
 * PM Tools — Internal project management tools for execution agents
 *
 * These are Pivot's internal PM tickets (pm_tickets table), distinct from
 * external tools like create_jira_ticket which use Composio.
 */

import type { Tool, ToolContext, ToolResult } from './index';
import { registerTools } from './index';
import {
  createTicket,
  listTickets,
  updateTicket,
  assignTicketToAgent,
  type TicketStatus,
  type TicketPriority,
  type TicketType,
} from '@/lib/pm/ticket-engine';

// ── Tool Definitions ─────────────────────────────────────────────────────────

const createTicketTool: Tool = {
  name: 'create_ticket',
  description: 'Create an internal PM ticket to track work. Use this for action items, tasks, bugs, features, or epics that need tracking. Different from create_jira_ticket — this is Pivot\'s built-in project management.',
  parameters: {
    title: {
      type: 'string',
      description: 'Ticket title — start with an action verb (e.g., "Implement user onboarding flow").',
    },
    description: {
      type: 'string',
      description: 'Detailed description of what needs to be done and why.',
    },
    priority: {
      type: 'string',
      description: 'Ticket priority.',
      enum: ['critical', 'high', 'medium', 'low'],
    },
    type: {
      type: 'string',
      description: 'Ticket type.',
      enum: ['task', 'bug', 'feature', 'epic', 'story'],
    },
    assigned_to: {
      type: 'string',
      description: 'Team member to assign to (name or role).',
    },
    estimated_hours: {
      type: 'number',
      description: 'Estimated hours to complete.',
    },
    due_date: {
      type: 'string',
      description: 'Due date in ISO format (e.g., "2026-04-01").',
    },
    tags: {
      type: 'string',
      description: 'Comma-separated tags (e.g., "marketing,urgent,q2").',
    },
    labels: {
      type: 'string',
      description: 'Comma-separated labels (e.g., "frontend,backend").',
    },
  },
  required: ['title'],
  category: 'operations',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const title = String(args.title ?? '');
      if (!title) return { success: false, output: 'Title is required.' };

      const tags = args.tags ? String(args.tags).split(',').map(t => t.trim()).filter(Boolean) : [];
      const labels = args.labels ? String(args.labels).split(',').map(l => l.trim()).filter(Boolean) : [];

      const ticket = await createTicket(context.orgId, title, args.description ? String(args.description) : undefined, {
        priority: (args.priority as TicketPriority) ?? 'medium',
        type: (args.type as TicketType) ?? 'task',
        assigned_to: args.assigned_to ? String(args.assigned_to) : undefined,
        estimated_hours: args.estimated_hours ? Number(args.estimated_hours) : undefined,
        due_date: args.due_date ? String(args.due_date) : undefined,
        source: 'agent',
        tags,
        labels,
      });

      return {
        success: true,
        output: `Created ticket "${ticket.title}" (${ticket.id}) — priority: ${ticket.priority}, status: ${ticket.status}${ticket.assigned_to ? `, assigned to: ${ticket.assigned_to}` : ''}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Failed to create ticket: ${msg}` };
    }
  },
};

const listTicketsTool: Tool = {
  name: 'list_tickets',
  description: 'List internal PM tickets with optional filters. Returns tickets sorted by most recent. Use to check existing work items, find assigned tasks, or review the backlog.',
  parameters: {
    status: {
      type: 'string',
      description: 'Filter by status.',
      enum: ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'],
    },
    priority: {
      type: 'string',
      description: 'Filter by priority.',
      enum: ['critical', 'high', 'medium', 'low'],
    },
    assigned_to: {
      type: 'string',
      description: 'Filter by assignee (name or role).',
    },
    search: {
      type: 'string',
      description: 'Search tickets by title or description.',
    },
    limit: {
      type: 'number',
      description: 'Max tickets to return (default 20, max 50).',
    },
  },
  required: [],
  category: 'operations',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const limit = Math.min(Number(args.limit ?? 20), 50);

      const { tickets, total } = await listTickets(context.orgId, {
        status: args.status as TicketStatus | undefined,
        priority: args.priority as TicketPriority | undefined,
        assigned_to: args.assigned_to ? String(args.assigned_to) : undefined,
        search: args.search ? String(args.search) : undefined,
        limit,
      });

      if (tickets.length === 0) {
        return { success: true, output: 'No tickets found matching the filters.' };
      }

      const lines = tickets.map(t => {
        const parts = [
          `- **${t.title}** (${t.id.slice(0, 8)})`,
          `  Status: ${t.status} | Priority: ${t.priority} | Type: ${t.type}`,
        ];
        if (t.assigned_to) parts.push(`  Assigned to: ${t.assigned_to}`);
        if (t.assigned_agent) parts.push(`  Agent: ${t.assigned_agent}`);
        if (t.due_date) parts.push(`  Due: ${t.due_date}`);
        if (t.estimated_hours) parts.push(`  Est: ${t.estimated_hours}h`);
        return parts.join('\n');
      });

      return {
        success: true,
        output: `Found ${total} ticket(s)${total > limit ? ` (showing first ${limit})` : ''}:\n\n${lines.join('\n\n')}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Failed to list tickets: ${msg}` };
    }
  },
};

const updateTicketTool: Tool = {
  name: 'update_ticket',
  description: 'Update an internal PM ticket — change status, priority, assignment, description, or other fields. Use the ticket ID from list_tickets.',
  parameters: {
    ticket_id: {
      type: 'string',
      description: 'Ticket ID (UUID or first 8 chars).',
    },
    status: {
      type: 'string',
      description: 'New status.',
      enum: ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'],
    },
    priority: {
      type: 'string',
      description: 'New priority.',
      enum: ['critical', 'high', 'medium', 'low'],
    },
    assigned_to: {
      type: 'string',
      description: 'New assignee.',
    },
    title: {
      type: 'string',
      description: 'Updated title.',
    },
    description: {
      type: 'string',
      description: 'Updated description.',
    },
    estimated_hours: {
      type: 'number',
      description: 'Updated estimate in hours.',
    },
    due_date: {
      type: 'string',
      description: 'Updated due date in ISO format.',
    },
  },
  required: ['ticket_id'],
  category: 'operations',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const ticketId = String(args.ticket_id ?? '');
      if (!ticketId) return { success: false, output: 'ticket_id is required.' };

      // If short ID provided, look up full ID
      let fullId = ticketId;
      if (ticketId.length < 36) {
        const { tickets } = await listTickets(context.orgId, { search: ticketId, limit: 1 });
        if (tickets.length > 0 && tickets[0].id.startsWith(ticketId)) {
          fullId = tickets[0].id;
        }
      }

      const updates: Record<string, unknown> = {};
      if (args.status) updates.status = args.status;
      if (args.priority) updates.priority = args.priority;
      if (args.assigned_to) updates.assigned_to = args.assigned_to;
      if (args.title) updates.title = args.title;
      if (args.description) updates.description = args.description;
      if (args.estimated_hours) updates.estimated_hours = Number(args.estimated_hours);
      if (args.due_date) updates.due_date = args.due_date;

      if (Object.keys(updates).length === 0) {
        return { success: false, output: 'No updates provided. Specify at least one field to change.' };
      }

      const ticket = await updateTicket(fullId, updates);
      return {
        success: true,
        output: `Updated ticket "${ticket.title}" — status: ${ticket.status}, priority: ${ticket.priority}${ticket.assigned_to ? `, assigned to: ${ticket.assigned_to}` : ''}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Failed to update ticket: ${msg}` };
    }
  },
};

const assignTicketTool: Tool = {
  name: 'assign_ticket',
  description: 'Assign an internal PM ticket to a team member or execution agent. If assigning to an agent, also creates an execution task for the agent to work on.',
  parameters: {
    ticket_id: {
      type: 'string',
      description: 'Ticket ID to assign.',
    },
    assigned_to: {
      type: 'string',
      description: 'Team member name or role to assign to.',
    },
    agent_id: {
      type: 'string',
      description: 'Execution agent to assign to (strategist, marketer, analyst, recruiter, operator, researcher, codebot). Creates an execution task.',
      enum: ['strategist', 'marketer', 'analyst', 'recruiter', 'operator', 'researcher', 'codebot'],
    },
  },
  required: ['ticket_id'],
  category: 'operations',
  costTier: 'free',

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const ticketId = String(args.ticket_id ?? '');
      if (!ticketId) return { success: false, output: 'ticket_id is required.' };

      // If short ID provided, look up full ID
      let fullId = ticketId;
      if (ticketId.length < 36) {
        const { tickets } = await listTickets(context.orgId, { search: ticketId, limit: 1 });
        if (tickets.length > 0 && tickets[0].id.startsWith(ticketId)) {
          fullId = tickets[0].id;
        }
      }

      // Assign to agent (creates execution task)
      if (args.agent_id) {
        const ticket = await assignTicketToAgent(fullId, String(args.agent_id));
        return {
          success: true,
          output: `Assigned ticket "${ticket.title}" to agent ${ticket.assigned_agent}. An execution task has been created for the agent to work on this.`,
        };
      }

      // Assign to team member
      if (args.assigned_to) {
        const ticket = await updateTicket(fullId, {
          assigned_to: String(args.assigned_to),
          status: 'todo',
        });
        return {
          success: true,
          output: `Assigned ticket "${ticket.title}" to ${ticket.assigned_to}.`,
        };
      }

      return { success: false, output: 'Provide either assigned_to (team member) or agent_id (execution agent).' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Failed to assign ticket: ${msg}` };
    }
  },
};

// ── Register ──────────────────────────────────────────────────────────────────

export const pmTools: Tool[] = [
  createTicketTool,
  listTicketsTool,
  updateTicketTool,
  assignTicketTool,
];
registerTools(pmTools);
