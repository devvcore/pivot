/**
 * LEGACY: SQLite database (better-sqlite3)
 *
 * This module is no longer the primary data store. All data operations
 * have been migrated to Supabase PostgreSQL. See:
 *   - lib/job-store.ts (jobs)
 *   - lib/share-store.ts (share links)
 *   - lib/employee-store.ts (employees)
 *   - lib/supabase/admin.ts (admin client)
 *
 * This file is kept for backwards compatibility and local development fallback.
 * Do NOT add new features using this SQLite database.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'pivot.db');
const SCHEMA_PATH = path.join(process.cwd(), 'lib', 'db', 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize schema on first run
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
if (!tableCheck) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);
    console.log("[DB] Schema initialized.");
}

// ── Runtime migrations (additive-only, safe to run every startup) ──────────

function addColumnIfMissing(table: string, column: string, type: string) {
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`[DB] Migration: added ${table}.${column}`);
    } catch {
        // Column already exists — expected on subsequent runs
    }
}

// Organizations: multi-org + AI feature columns
addColumnIfMissing("organizations", "website", "TEXT");
addColumnIfMissing("organizations", "owner_user_id", "TEXT");
addColumnIfMissing("organizations", "agent_memory_json", "TEXT");
addColumnIfMissing("organizations", "website_analysis_json", "TEXT");
addColumnIfMissing("organizations", "icon_url", "TEXT");        // favicon URL (or null → show initial)
addColumnIfMissing("organizations", "theme_color", "TEXT");    // hex accent color per org

// user_organizations join table (multi-org support)
db.exec(`
    CREATE TABLE IF NOT EXISTS user_organizations (
        user_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        role TEXT DEFAULT 'OWNER',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, org_id)
    )
`);

// agent_conversations table
db.exec(`
    CREATE TABLE IF NOT EXISTS agent_conversations (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        user_id TEXT,
        messages_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Jobs: knowledge graph column for schema coverage tracking
addColumnIfMissing("jobs", "knowledge_graph_json", "TEXT");

// Normalize existing user emails to lowercase (one-time migration)
try {
    const users = db.prepare("SELECT id, email FROM users WHERE email != LOWER(email)").all() as Array<{ id: string; email: string }>;
    if (users.length > 0) {
        const updateEmail = db.prepare("UPDATE users SET email = LOWER(?) WHERE id = ?");
        const updateTransaction = db.transaction((usersToUpdate: Array<{ id: string; email: string }>) => {
            for (const user of usersToUpdate) {
                updateEmail.run(user.email.toLowerCase(), user.id);
            }
        });
        updateTransaction(users);
        console.log(`[DB] Migration: normalized ${users.length} user email(s) to lowercase`);
    }
} catch (error) {
    // Migration failed, but don't crash - log and continue
    console.warn("[DB] Email normalization migration failed:", error);
}

// Share links for role-based access to analyses
db.exec(`
    CREATE TABLE IF NOT EXISTS share_links (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee',
        employee_name TEXT,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME,
        used_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Employee roster for team management
db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role_title TEXT,
        department TEXT,
        salary REAL,
        start_date TEXT,
        net_value_estimate REAL,
        roi_score REAL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Ensure default org exists for MVP
const orgCheck = db.prepare("SELECT id FROM organizations WHERE id = 'default-org'").get();
if (!orgCheck) {
    db.prepare("INSERT INTO organizations (id, name) VALUES ('default-org', 'MVP Sandbox')").run();
}

export default db;
