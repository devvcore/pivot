#!/usr/bin/env npx tsx
/**
 * Pivot — Run Migration 002: Integration Tables
 *
 * Runs supabase/migrations/002_integrations.sql against Supabase
 * using the Management API (same pattern as setup-supabase.ts).
 *
 * Usage: npx tsx scripts/run-migration-002.ts
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
  if (label) console.log(`[Migration 002] OK: ${label}`);
  return result;
}

async function main() {
  console.log(`[Migration 002] Project ref: ${PROJECT_REF}`);
  console.log("[Migration 002] Running integration tables migration...\n");

  // Step 1: Create tables + indexes (idempotent with IF NOT EXISTS)
  const tablesSQL = `
CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN (
        'slack', 'gmail', 'adp', 'workday',
        'quickbooks', 'salesforce', 'hubspot', 'stripe', 'jira'
    )),
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN (
        'connected', 'disconnected', 'error', 'syncing'
    )),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_sync_at TIMESTAMPTZ,
    sync_frequency_minutes INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN (
        'running', 'completed', 'failed'
    )),
    records_processed INTEGER NOT NULL DEFAULT 0,
    insights_generated INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS communication_insights (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id TEXT,
    source TEXT NOT NULL CHECK (source IN ('slack', 'gmail')),
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'relationship_score', 'meeting_attendance', 'response_time',
        'bottleneck', 'sentiment', 'engagement', 'risk_flag'
    )),
    subject_name TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_employee_data (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('adp', 'workday', 'manual')),
    external_id TEXT,
    employee_name TEXT NOT NULL,
    email TEXT,
    department TEXT,
    job_title TEXT,
    hire_date TEXT,
    salary REAL,
    pay_frequency TEXT,
    employment_status TEXT,
    manager_name TEXT,
    performance_rating REAL,
    last_review_date TEXT,
    benefits JSONB,
    time_off_balance JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, source, external_id)
);
`;

  await runSQL(tablesSQL, "Created integration tables");

  // Step 2: Create indexes (idempotent)
  const indexesSQL = `
CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_integration_id ON integration_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_org_id ON integration_sync_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON integration_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_comm_insights_org_id ON communication_insights(org_id);
CREATE INDEX IF NOT EXISTS idx_comm_insights_source ON communication_insights(source);
CREATE INDEX IF NOT EXISTS idx_comm_insights_type ON communication_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_comm_insights_period ON communication_insights(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_hr_employees_org_id ON hr_employee_data(org_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_source ON hr_employee_data(source);
CREATE INDEX IF NOT EXISTS idx_hr_employees_department ON hr_employee_data(department);
`;

  await runSQL(indexesSQL, "Created indexes");

  // Step 3: Create trigger (reuses update_updated_at from 001)
  const triggerSQL = `
DO $$ BEGIN
    CREATE TRIGGER update_integrations_updated_at
        BEFORE UPDATE ON integrations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;

  await runSQL(triggerSQL, "Created update trigger for integrations");

  // Step 4: Enable RLS
  const rlsSQL = `
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employee_data ENABLE ROW LEVEL SECURITY;
`;

  await runSQL(rlsSQL, "Enabled RLS on integration tables");

  // Step 5: Create RLS policies (wrapped in DO blocks to handle "already exists")
  const policies = [
    // Integrations
    { name: "integrations_select_org", table: "integrations", cmd: "SELECT", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    { name: "integrations_insert_org", table: "integrations", cmd: "INSERT", check: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    { name: "integrations_update_org", table: "integrations", cmd: "UPDATE", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    { name: "integrations_delete_org", table: "integrations", cmd: "DELETE", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    // Sync Logs
    { name: "sync_logs_select_org", table: "integration_sync_logs", cmd: "SELECT", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    { name: "sync_logs_insert_org", table: "integration_sync_logs", cmd: "INSERT", check: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    { name: "sync_logs_update_org", table: "integration_sync_logs", cmd: "UPDATE", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    // Communication Insights
    { name: "comm_insights_select_org", table: "communication_insights", cmd: "SELECT", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    { name: "comm_insights_insert_org", table: "communication_insights", cmd: "INSERT", check: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    // HR Employee Data
    { name: "hr_data_select_org", table: "hr_employee_data", cmd: "SELECT", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    { name: "hr_data_insert_org", table: "hr_employee_data", cmd: "INSERT", check: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    { name: "hr_data_update_org", table: "hr_employee_data", cmd: "UPDATE", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
    { name: "hr_data_delete_org", table: "hr_employee_data", cmd: "DELETE", using: "org_id IN (SELECT org_id FROM user_organizations WHERE user_id = auth.uid())" },
  ];

  let policySuccesses = 0;
  let policySkips = 0;

  for (const p of policies) {
    const clause =
      p.cmd === "INSERT"
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
        console.error(`[Migration 002] Policy "${p.name}" failed: ${msg.slice(0, 200)}`);
      }
    }
  }

  console.log(
    `[Migration 002] Policies: ${policySuccesses} created, ${policySkips} already existed`
  );

  // Step 6: Verify tables exist
  console.log("\n[Migration 002] Verifying tables...");

  const verifySQL = `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('integrations', 'integration_sync_logs', 'communication_insights', 'hr_employee_data')
ORDER BY table_name;
`;

  const verifyResult = await runSQL(verifySQL, "Table verification query");
  console.log("[Migration 002] Tables found:", JSON.stringify(verifyResult, null, 2));

  // Also verify column counts
  const colCountSQL = `
SELECT table_name, COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('integrations', 'integration_sync_logs', 'communication_insights', 'hr_employee_data')
GROUP BY table_name
ORDER BY table_name;
`;

  const colResult = await runSQL(colCountSQL, "Column count verification");
  console.log("[Migration 002] Column counts:", JSON.stringify(colResult, null, 2));

  console.log("\n[Migration 002] Migration 002 completed successfully!");
}

main().catch((err) => {
  console.error("[Migration 002] Fatal error:", err);
  process.exit(1);
});
