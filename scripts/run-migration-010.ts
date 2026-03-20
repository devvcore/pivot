#!/usr/bin/env npx tsx
/**
 * Run migration 010: User identity (first/last name) + relational integrity
 * Usage: npx tsx scripts/run-migration-010.ts
 */
import fs from "fs";
import path from "path";

// Load .env manually
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
  if (label) console.log(`[Migration 010] OK: ${label}`);
  return result;
}

async function main() {
  console.log(`[Migration 010] Project ref: ${PROJECT_REF}`);
  console.log(`[Migration 010] Running user identity + relational integrity migration...`);

  const migrationSQL = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/010_user_identity_and_relations.sql"),
    "utf-8"
  );

  await runSQL(migrationSQL, "Migration 010 applied successfully");

  // Verify the columns exist
  const verifySQL = `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name IN ('first_name', 'last_name')
    ORDER BY column_name;
  `;
  const result = await runSQL(verifySQL, "Verified new columns");
  console.log("[Migration 010] New profile columns:", JSON.stringify(result, null, 2));

  // Check FK constraints
  const fkSQL = `
    SELECT tc.constraint_name, tc.table_name, kcu.column_name,
           ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name LIKE 'fk_%'
    ORDER BY tc.table_name;
  `;
  const fkResult = await runSQL(fkSQL, "Verified FK constraints");
  console.log("[Migration 010] FK constraints:", JSON.stringify(fkResult, null, 2));

  console.log("[Migration 010] Done!");
}

main().catch((err) => {
  console.error("[Migration 010] Fatal error:", err);
  process.exit(1);
});
