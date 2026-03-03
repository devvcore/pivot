import db from "./db";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export interface ShareLink {
  id: string;
  orgId: string;
  jobId: string;
  createdBy: string;
  role: "owner" | "employee" | "coach";
  employeeName?: string;
  token: string;
  expiresAt?: string;
  usedCount: number;
  createdAt: string;
}

function mapRow(row: any): ShareLink {
  return {
    id: row.id,
    orgId: row.org_id,
    jobId: row.job_id,
    createdBy: row.created_by,
    role: row.role,
    employeeName: row.employee_name || undefined,
    token: row.token,
    expiresAt: row.expires_at || undefined,
    usedCount: row.used_count,
    createdAt: row.created_at,
  };
}

export function createShareLink(params: {
  orgId: string;
  jobId: string;
  createdBy: string;
  role: "owner" | "employee" | "coach";
  employeeName?: string;
  expiresInDays?: number;
}): ShareLink {
  const id = uuidv4();
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 86400000).toISOString()
    : null;

  db.prepare(`
    INSERT INTO share_links (id, org_id, job_id, created_by, role, employee_name, token, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, params.orgId, params.jobId, params.createdBy, params.role, params.employeeName || null, token, expiresAt);

  return getShareLinkById(id)!;
}

export function getShareLinkByToken(token: string): ShareLink | undefined {
  const row = db.prepare("SELECT * FROM share_links WHERE token = ?").get(token);
  if (!row) return undefined;
  const link = mapRow(row);

  // Check expiry
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return undefined;

  // Increment use count
  db.prepare("UPDATE share_links SET used_count = used_count + 1 WHERE id = ?").run(link.id);
  return link;
}

export function getShareLinkById(id: string): ShareLink | undefined {
  const row = db.prepare("SELECT * FROM share_links WHERE id = ?").get(id);
  return row ? mapRow(row) : undefined;
}

export function listShareLinksForJob(jobId: string): ShareLink[] {
  const rows = db.prepare("SELECT * FROM share_links WHERE job_id = ? ORDER BY created_at DESC").all(jobId);
  return rows.map(mapRow);
}

export function revokeShareLink(id: string): boolean {
  const result = db.prepare("DELETE FROM share_links WHERE id = ?").run(id);
  return result.changes > 0;
}
