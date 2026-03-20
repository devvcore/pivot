-- ─────────────────────────────────────────────────────────────────────────────
-- 016: CRM Pipeline + Project Management
-- ─────────────────────────────────────────────────────────────────────────────

-- CRM Contacts: every person the business interacts with
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    -- Identity
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    title TEXT,
    -- Source tracking
    source TEXT DEFAULT 'manual', -- manual, stripe, gmail, slack, linkedin, form, referral
    source_id TEXT,               -- external ID (Stripe customer ID, etc.)
    -- CRM fields
    stage TEXT DEFAULT 'lead' CHECK (stage IN ('lead', 'prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'churned', 'active')),
    deal_value REAL,
    currency TEXT DEFAULT 'USD',
    tags TEXT[] DEFAULT '{}',
    -- Engagement tracking
    last_contacted_at TIMESTAMPTZ,
    last_activity TEXT,           -- "Email: Re: Proposal" or "Slack: #general"
    next_followup_at TIMESTAMPTZ,
    followup_note TEXT,
    -- Enrichment (from web/social scraping)
    website TEXT,
    linkedin_url TEXT,
    notes TEXT,
    ai_summary TEXT,              -- AI-generated relationship summary
    -- Metadata
    assigned_to TEXT,             -- team member
    score INTEGER DEFAULT 0,     -- lead score (0-100)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crm_contacts_org ON crm_contacts(org_id);
CREATE INDEX idx_crm_contacts_stage ON crm_contacts(org_id, stage);
CREATE INDEX idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX idx_crm_contacts_score ON crm_contacts(org_id, score DESC);

-- CRM Activities: every interaction with a contact
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
    -- Activity details
    type TEXT NOT NULL CHECK (type IN ('email_sent', 'email_received', 'call', 'meeting', 'slack_message', 'note', 'task_completed', 'stage_change', 'deal_update', 'social_interaction')),
    title TEXT NOT NULL,
    description TEXT,
    -- Metadata
    channel TEXT,                  -- gmail, slack, phone, linkedin, in-person
    sentiment TEXT,                -- positive, neutral, negative (AI-detected)
    automated BOOLEAN DEFAULT false, -- true if done by agent
    agent_id TEXT,                 -- which agent did this
    task_id UUID,                  -- linked execution task
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crm_activities_contact ON crm_activities(contact_id);
CREATE INDEX idx_crm_activities_org ON crm_activities(org_id);

-- CRM Pipeline stages (customizable per org)
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Sales Pipeline',
    stages JSONB NOT NULL DEFAULT '[
        {"id": "lead", "name": "Lead", "color": "#94a3b8", "order": 0},
        {"id": "prospect", "name": "Prospect", "color": "#60a5fa", "order": 1},
        {"id": "qualified", "name": "Qualified", "color": "#a78bfa", "order": 2},
        {"id": "proposal", "name": "Proposal", "color": "#f59e0b", "order": 3},
        {"id": "negotiation", "name": "Negotiation", "color": "#f97316", "order": 4},
        {"id": "won", "name": "Won", "color": "#22c55e", "order": 5},
        {"id": "lost", "name": "Lost", "color": "#ef4444", "order": 6}
    ]',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crm_pipelines_org ON crm_pipelines(org_id);

-- Project Management: tickets/tasks from conversations
CREATE TABLE IF NOT EXISTS pm_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    -- Ticket details
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'backlog' CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    type TEXT DEFAULT 'task' CHECK (type IN ('task', 'bug', 'feature', 'epic', 'story')),
    -- Assignment
    assigned_to TEXT,              -- team member or agent
    assigned_agent TEXT,           -- execution agent ID
    -- Relationships
    contact_id UUID REFERENCES crm_contacts(id),
    parent_id UUID REFERENCES pm_tickets(id),
    -- Tracking
    estimated_hours REAL,
    actual_hours REAL,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Source
    source TEXT DEFAULT 'manual',  -- manual, slack, email, agent, analysis
    source_message TEXT,           -- the original message that created this ticket
    execution_task_id UUID,        -- linked execution task if agent is working on it
    -- Tags and labels
    tags TEXT[] DEFAULT '{}',
    labels TEXT[] DEFAULT '{}',
    -- AI enrichment
    ai_summary TEXT,
    ai_complexity_score INTEGER,   -- 1-10
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pm_tickets_org ON pm_tickets(org_id);
CREATE INDEX idx_pm_tickets_status ON pm_tickets(org_id, status);
CREATE INDEX idx_pm_tickets_assigned ON pm_tickets(assigned_to);
CREATE INDEX idx_pm_tickets_contact ON pm_tickets(contact_id);
