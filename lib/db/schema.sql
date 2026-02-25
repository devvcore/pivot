-- ═══════════════════════════════════════════════════════════════
-- Pivot SQLite Schema  (source of truth for Supabase migration)
-- See SUPABASE_SCHEMA.md for full migration guide
-- ═══════════════════════════════════════════════════════════════

-- Users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'MEMBER',
    organization_id TEXT NOT NULL,        -- default / active org
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Organizations (multi-org: one user can own many businesses)
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    website TEXT,                          -- business website URL
    industry TEXT,
    revenue_range TEXT,
    business_model TEXT,
    key_concerns TEXT,
    one_decision TEXT,
    primary_objective TEXT,
    owner_user_id TEXT,                    -- who created this org
    agent_memory_json TEXT,               -- compressed AgentMemory JSON (~600 words)
    website_analysis_json TEXT,           -- latest WebsiteAnalysis JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User <> Organization membership (many-to-many for multi-org support)
CREATE TABLE user_organizations (
    user_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    role TEXT DEFAULT 'OWNER',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, org_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Analysis Jobs
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    run_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    phase TEXT DEFAULT 'PLAN',
    organization_id TEXT NOT NULL,
    questionnaire_json TEXT,
    file_paths_json TEXT,
    parsed_context TEXT,                  -- BusinessPacket JSON (Stage 1 output)
    knowledge_graph_json TEXT,            -- KnowledgeGraph JSON (categorized docs + schema coverage)
    results_json TEXT,                    -- MVPDeliverables JSON
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Execution Tasks (Phase 3)
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    assigned_agent TEXT,
    due_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);

-- Agent Conversation History
CREATE TABLE agent_conversations (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT,
    messages_json TEXT NOT NULL,          -- JSON array of ChatMessage (last 20)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id)
);
