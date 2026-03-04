#!/usr/bin/env npx tsx
/**
 * Pivot — Supabase Schema Setup
 *
 * Runs the SQL migration against Supabase using the Management API.
 * Usage: npx tsx scripts/setup-supabase.ts
 */
import fs from "fs";
import path from "path";

// Load .env manually (avoid dotenv dependency)
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN!;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

async function runSQL(sql: string, label?: string): Promise<any> {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase API error (${response.status}): ${text}`);
  }

  const result = await response.json();
  if (label) console.log(`[Setup] OK: ${label}`);
  return result;
}

async function main() {
  console.log(`[Setup] Project ref: ${PROJECT_REF}`);

  // Step 1: Create tables (run as one block)
  const tablesSQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    website TEXT,
    industry TEXT,
    revenue_range TEXT,
    business_model TEXT,
    key_concerns TEXT,
    one_decision TEXT,
    primary_objective TEXT,
    owner_user_id TEXT,
    agent_memory_json JSONB,
    website_analysis_json JSONB,
    icon_url TEXT,
    theme_color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'MEMBER',
    organization_id TEXT REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_organizations (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'OWNER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    run_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    phase TEXT DEFAULT 'PLAN',
    organization_id TEXT NOT NULL DEFAULT 'default-org',
    questionnaire_json JSONB,
    file_paths_json JSONB DEFAULT '[]'::jsonb,
    parsed_context TEXT,
    knowledge_graph_json JSONB,
    results_json JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL,
    job_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    employee_name TEXT,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role_title TEXT,
    department TEXT,
    salary REAL,
    start_date TEXT,
    net_value_estimate REAL,
    roi_score REAL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_conversations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL,
    user_id TEXT,
    messages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    job_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_agent TEXT,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

  await runSQL(tablesSQL, "Created all tables");

  // Step 2: Create indexes
  const indexesSQL = `
CREATE INDEX IF NOT EXISTS idx_jobs_run_id ON jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_job ON share_links(job_id);
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_org ON agent_conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_job ON tasks(job_id);
`;

  await runSQL(indexesSQL, "Created indexes");

  // Step 3: Seed default org
  await runSQL(
    `INSERT INTO organizations (id, name) VALUES ('default-org', 'MVP Sandbox') ON CONFLICT (id) DO NOTHING;`,
    "Seeded default org"
  );

  // Step 4: Enable RLS
  const rlsSQL = `
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
`;

  await runSQL(rlsSQL, "Enabled RLS on all tables");

  // Step 5: Create RLS policies using DO blocks to handle "already exists"
  const policies = [
    // Profiles
    { name: "profiles_select_own", table: "profiles", cmd: "SELECT", using: "id = auth.uid()" },
    { name: "profiles_update_own", table: "profiles", cmd: "UPDATE", using: "id = auth.uid()" },
    { name: "profiles_insert_own", table: "profiles", cmd: "INSERT", check: "id = auth.uid()" },
    // Organizations
    { name: "orgs_select_member", table: "organizations", cmd: "SELECT", using: "id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR id = 'default-org'" },
    { name: "orgs_update_member", table: "organizations", cmd: "UPDATE", using: "id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    { name: "orgs_insert_auth", table: "organizations", cmd: "INSERT", check: "auth.uid() IS NOT NULL" },
    // User organizations
    { name: "user_orgs_select_own", table: "user_organizations", cmd: "SELECT", using: "user_id = auth.uid()" },
    { name: "user_orgs_insert_own", table: "user_organizations", cmd: "INSERT", check: "user_id = auth.uid()" },
    // Jobs
    { name: "jobs_select_org", table: "jobs", cmd: "SELECT", using: "organization_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR organization_id = 'default-org'" },
    { name: "jobs_insert_org", table: "jobs", cmd: "INSERT", check: "organization_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR organization_id = 'default-org'" },
    { name: "jobs_update_org", table: "jobs", cmd: "UPDATE", using: "organization_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR organization_id = 'default-org'" },
    // Share links
    { name: "share_links_select_public", table: "share_links", cmd: "SELECT", using: "true" },
    { name: "share_links_insert_org", table: "share_links", cmd: "INSERT", check: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR org_id = 'default-org'" },
    { name: "share_links_delete_org", table: "share_links", cmd: "DELETE", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR org_id = 'default-org'" },
    // Employees
    { name: "employees_select_org", table: "employees", cmd: "SELECT", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR org_id = 'default-org'" },
    { name: "employees_insert_org", table: "employees", cmd: "INSERT", check: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR org_id = 'default-org'" },
    { name: "employees_update_org", table: "employees", cmd: "UPDATE", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR org_id = 'default-org'" },
    { name: "employees_delete_org", table: "employees", cmd: "DELETE", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR org_id = 'default-org'" },
    // Agent conversations
    { name: "agent_convos_select_org", table: "agent_conversations", cmd: "SELECT", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR org_id = 'default-org'" },
    { name: "agent_convos_insert_org", table: "agent_conversations", cmd: "INSERT", check: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR org_id = 'default-org'" },
    { name: "agent_convos_update_org", table: "agent_conversations", cmd: "UPDATE", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR org_id = 'default-org'" },
    // Tasks
    { name: "tasks_select_org", table: "tasks", cmd: "SELECT", using: "job_id IN (SELECT run_id FROM jobs WHERE organization_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR organization_id = 'default-org')" },
    { name: "tasks_insert_org", table: "tasks", cmd: "INSERT", check: "job_id IN (SELECT run_id FROM jobs WHERE organization_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid()) OR organization_id = 'default-org')" },
  ];

  let policySuccesses = 0;
  let policySkips = 0;

  for (const p of policies) {
    const clause = p.cmd === "INSERT"
      ? `FOR INSERT WITH CHECK (${p.check})`
      : `FOR ${p.cmd} USING (${p.using})`;

    const sql = `
DO $$ BEGIN
    CREATE POLICY "${p.name}" ON ${p.table} ${clause};
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;
    try {
      await runSQL(sql);
      policySuccesses++;
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("already exists") || msg.includes("duplicate")) {
        policySkips++;
      } else {
        console.error(`[Setup] Policy "${p.name}" failed: ${msg.slice(0, 200)}`);
      }
    }
  }

  console.log(`[Setup] Policies: ${policySuccesses} created, ${policySkips} already existed`);

  // Step 6: Create updated_at trigger function and triggers
  const triggerFnSQL = `
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;
  await runSQL(triggerFnSQL, "Created update_updated_at function");

  const triggerTables = ["organizations", "profiles", "jobs", "employees", "agent_conversations"];
  for (const table of triggerTables) {
    const triggerSQL = `
DO $$ BEGIN
    CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;
    try {
      await runSQL(triggerSQL);
      console.log(`[Setup] OK: Trigger for ${table}`);
    } catch (e: any) {
      console.log(`[Setup] Trigger for ${table} skipped (likely exists)`);
    }
  }

  console.log("[Setup] Migration completed successfully!");
}

main().catch((err) => {
  console.error("[Setup] Fatal error:", err);
  process.exit(1);
});
