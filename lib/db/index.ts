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

// Ensure default org exists for MVP
const orgCheck = db.prepare("SELECT id FROM organizations WHERE id = 'default-org'").get();
if (!orgCheck) {
    db.prepare("INSERT INTO organizations (id, name) VALUES ('default-org', 'MVP Sandbox')").run();
}

export default db;
