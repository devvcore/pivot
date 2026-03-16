-- ═══════════════════════════════════════════════════════════════
-- Pivot — Execution System Tables
-- Agent execution, sessions, events, costs, approvals,
-- classifier training, and knowledge graph
-- ═══════════════════════════════════════════════════════════════

-- ─── Execution Tasks ──────────────────────────────────────────────────────────
-- Core table for agent work items. Each row represents a discrete task
-- assigned to an agent with lifecycle tracking.
CREATE TABLE IF NOT EXISTS execution_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    agent_id TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'queued' CHECK (status IN (
        'queued', 'in_progress', 'review', 'revision',
        'completed', 'failed', 'cancelled'
    )),
    acceptance_criteria JSONB DEFAULT '[]'::jsonb,
    result TEXT,
    artifacts JSONB DEFAULT '[]'::jsonb,
    review_feedback TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    cost_spent REAL DEFAULT 0,
    cost_ceiling REAL DEFAULT 1.0,
    trigger_run_id TEXT,
    source_recommendation_id TEXT, -- Links back to analysis recommendation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exec_tasks_org_id ON execution_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_exec_tasks_agent_id ON execution_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_exec_tasks_status ON execution_tasks(status);
CREATE INDEX IF NOT EXISTS idx_exec_tasks_priority ON execution_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_exec_tasks_created ON execution_tasks(created_at DESC);

-- ─── Agent Sessions ──────────────────────────────────────────────────────────
-- Persistent agent conversation state. Allows agents to resume context
-- across multiple task executions.
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_org ON agent_sessions(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_sessions_unique ON agent_sessions(agent_id, org_id);

-- ─── Execution Events ────────────────────────────────────────────────────────
-- Activity feed for all agent actions. Provides full audit trail and
-- powers the real-time activity view in the UI.
CREATE TABLE IF NOT EXISTS execution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES execution_tasks(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'tool_call', 'tool_result', 'thinking', 'output',
        'approval_request', 'approval_response',
        'error', 'cost_update', 'status_change',
        'session_start', 'session_end'
    )),
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exec_events_task ON execution_events(task_id);
CREATE INDEX IF NOT EXISTS idx_exec_events_agent ON execution_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_exec_events_org ON execution_events(org_id);
CREATE INDEX IF NOT EXISTS idx_exec_events_type ON execution_events(event_type);
CREATE INDEX IF NOT EXISTS idx_exec_events_created ON execution_events(created_at DESC);

-- ─── Execution Costs ─────────────────────────────────────────────────────────
-- Granular cost tracking per model call. Rolled up by org/agent/day
-- in the costs API.
CREATE TABLE IF NOT EXISTS execution_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    task_id UUID REFERENCES execution_tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exec_costs_org ON execution_costs(org_id);
CREATE INDEX IF NOT EXISTS idx_exec_costs_agent ON execution_costs(agent_id);
CREATE INDEX IF NOT EXISTS idx_exec_costs_task ON execution_costs(task_id);
CREATE INDEX IF NOT EXISTS idx_exec_costs_created ON execution_costs(created_at DESC);

-- ─── Execution Approvals ─────────────────────────────────────────────────────
-- Human-in-the-loop approval gates. Agents request approval for
-- high-risk or high-cost actions; humans approve/reject/revise.
CREATE TABLE IF NOT EXISTS execution_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES execution_tasks(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    action_description TEXT NOT NULL,
    reasoning TEXT,
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    preview JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'revision_requested'
    )),
    feedback TEXT,
    decided_by TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exec_approvals_task ON execution_approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_exec_approvals_org ON execution_approvals(org_id);
CREATE INDEX IF NOT EXISTS idx_exec_approvals_status ON execution_approvals(status);
CREATE INDEX IF NOT EXISTS idx_exec_approvals_created ON execution_approvals(created_at DESC);

-- ─── Classifier Training Data ────────────────────────────────────────────────
-- Self-training router data. Each row records how a message was classified
-- for tools, context depth, and history window. Used to fine-tune the
-- classifier over time.
CREATE TABLE IF NOT EXISTS classifier_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    recent_context TEXT,
    tools_label TEXT NOT NULL,
    context_label TEXT NOT NULL,
    history_label TEXT NOT NULL,
    source TEXT DEFAULT 'llm' CHECK (source IN ('llm', 'human')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classifier_source ON classifier_training_data(source);
CREATE INDEX IF NOT EXISTS idx_classifier_created ON classifier_training_data(created_at DESC);

-- ─── Knowledge Graph Nodes ───────────────────────────────────────────────────
-- Entities extracted from agent conversations and business data.
-- Supports org-scoped knowledge persistence.
CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL CHECK (node_type IN (
        'entity', 'person', 'decision', 'fact', 'preference',
        'company', 'product', 'metric', 'goal'
    )),
    name TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    aliases TEXT[] DEFAULT '{}',
    mentions INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_org ON knowledge_graph_nodes(org_id);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON knowledge_graph_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_name ON knowledge_graph_nodes(name);

-- ─── Knowledge Graph Edges ───────────────────────────────────────────────────
-- Relationships between knowledge graph nodes.
CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
    edge_type TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON knowledge_graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON knowledge_graph_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_type ON knowledge_graph_edges(edge_type);

-- ═══════════════════════════════════════════════════════════════
-- Auto-update triggers (reuses update_updated_at() from 001)
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
    CREATE TRIGGER update_execution_tasks_updated_at
        BEFORE UPDATE ON execution_tasks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_agent_sessions_updated_at
        BEFORE UPDATE ON agent_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_kg_nodes_updated_at
        BEFORE UPDATE ON knowledge_graph_nodes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security (RLS) Policies
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE execution_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE classifier_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_graph_edges ENABLE ROW LEVEL SECURITY;

-- Execution Tasks: org members can CRUD
CREATE POLICY "exec_tasks_select_org" ON execution_tasks
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "exec_tasks_insert_org" ON execution_tasks
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "exec_tasks_update_org" ON execution_tasks
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "exec_tasks_delete_org" ON execution_tasks
    FOR DELETE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );

-- Agent Sessions: org members can access
CREATE POLICY "agent_sessions_select_org" ON agent_sessions
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "agent_sessions_insert_org" ON agent_sessions
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "agent_sessions_update_org" ON agent_sessions
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );

-- Execution Events: org members can read, service role inserts
CREATE POLICY "exec_events_select_org" ON execution_events
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "exec_events_insert_org" ON execution_events
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );

-- Execution Costs: org members can read
CREATE POLICY "exec_costs_select_org" ON execution_costs
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "exec_costs_insert_org" ON execution_costs
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );

-- Execution Approvals: org members can CRUD
CREATE POLICY "exec_approvals_select_org" ON execution_approvals
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "exec_approvals_insert_org" ON execution_approvals
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "exec_approvals_update_org" ON execution_approvals
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );

-- Classifier Training Data: service role only (no user-facing RLS)
CREATE POLICY "classifier_insert_service" ON classifier_training_data
    FOR INSERT WITH CHECK (true);
CREATE POLICY "classifier_select_service" ON classifier_training_data
    FOR SELECT USING (true);

-- Knowledge Graph Nodes: org members can access
CREATE POLICY "kg_nodes_select_org" ON knowledge_graph_nodes
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "kg_nodes_insert_org" ON knowledge_graph_nodes
    FOR INSERT WITH CHECK (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );
CREATE POLICY "kg_nodes_update_org" ON knowledge_graph_nodes
    FOR UPDATE USING (
        org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
        OR org_id = 'default-org'
    );

-- Knowledge Graph Edges: accessible if source node's org is accessible
CREATE POLICY "kg_edges_select" ON knowledge_graph_edges
    FOR SELECT USING (
        source_id IN (
            SELECT id FROM knowledge_graph_nodes WHERE
            org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
            OR org_id = 'default-org'
        )
    );
CREATE POLICY "kg_edges_insert" ON knowledge_graph_edges
    FOR INSERT WITH CHECK (
        source_id IN (
            SELECT id FROM knowledge_graph_nodes WHERE
            org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
            OR org_id = 'default-org'
        )
    );
CREATE POLICY "kg_edges_delete" ON knowledge_graph_edges
    FOR DELETE USING (
        source_id IN (
            SELECT id FROM knowledge_graph_nodes WHERE
            org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())
            OR org_id = 'default-org'
        )
    );
