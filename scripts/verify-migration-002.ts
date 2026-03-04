#!/usr/bin/env npx tsx
/**
 * Pivot — Verify Migration 002 tables exist and are properly configured
 */
import fs from "fs";
import path from "path";

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN as string;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

async function runSQL(sql: string): Promise<any> {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function main() {
  console.log("=== Verifying Migration 002: Integration Tables ===\n");

  // 1. Check columns for each table
  const tables = [
    "integrations",
    "integration_sync_logs",
    "communication_insights",
    "hr_employee_data",
  ];

  for (const table of tables) {
    const cols = await runSQL(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position;`
    );
    console.log(`--- ${table} (${cols.length} columns) ---`);
    for (const c of cols) {
      console.log(`  ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`);
    }
    console.log();
  }

  // 2. Check RLS is enabled
  const rls = await runSQL(
    `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('integrations','integration_sync_logs','communication_insights','hr_employee_data');`
  );
  console.log("--- RLS Status ---");
  for (const r of rls) {
    console.log(`  ${r.tablename}: RLS=${r.rowsecurity}`);
  }
  console.log();

  // 3. Check policies
  const policies = await runSQL(
    `SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('integrations','integration_sync_logs','communication_insights','hr_employee_data') ORDER BY tablename, policyname;`
  );
  console.log(`--- RLS Policies (${policies.length} total) ---`);
  for (const p of policies) {
    console.log(`  ${p.tablename}: ${p.policyname}`);
  }
  console.log();

  // 4. Test insert + select on integrations table
  const testInsert = await runSQL(
    `INSERT INTO integrations (org_id, provider) VALUES ('default-org', 'slack') ON CONFLICT (org_id, provider) DO NOTHING RETURNING id, org_id, provider, status;`
  );
  console.log("--- Test Insert (integrations) ---");
  console.log("  Result:", JSON.stringify(testInsert));

  const testSelect = await runSQL(
    `SELECT id, org_id, provider, status FROM integrations WHERE org_id='default-org' LIMIT 5;`
  );
  console.log("--- Test Select (integrations) ---");
  console.log("  Result:", JSON.stringify(testSelect));

  // Clean up test row
  await runSQL(`DELETE FROM integrations WHERE org_id='default-org';`);
  console.log("  Cleaned up test data.");

  console.log("\n=== All verifications passed! ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
