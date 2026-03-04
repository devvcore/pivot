/**
 * Pivot Share Store — Supabase PostgreSQL backend
 *
 * All functions are async (return Promises) since Supabase uses HTTP.
 * Callers MUST await these functions.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const supabase = createAdminClient();

export interface ShareLink {
  id: string;
  orgId: string;
  jobId: string;
  createdBy: string;
  role: "owner" | "employee" | "coach" | "other";
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

export async function createShareLink(params: {
  orgId: string;
  jobId: string;
  createdBy: string;
  role: "owner" | "employee" | "coach" | "other";
  employeeName?: string;
  expiresInDays?: number;
}): Promise<ShareLink> {
  const id = uuidv4();
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 86400000).toISOString()
    : null;

  const { error } = await supabase.from("share_links").insert({
    id,
    org_id: params.orgId,
    job_id: params.jobId,
    created_by: params.createdBy,
    role: params.role,
    employee_name: params.employeeName || null,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[share-store] createShareLink error:", error);
    throw new Error(`Failed to create share link: ${error.message}`);
  }

  const link = await getShareLinkById(id);
  if (!link) throw new Error("Failed to retrieve created share link");
  return link;
}

export async function getShareLinkByToken(token: string): Promise<ShareLink | undefined> {
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !data) return undefined;

  const link = mapRow(data);

  // Check expiry
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return undefined;

  // Increment use count
  await supabase
    .from("share_links")
    .update({ used_count: (link.usedCount || 0) + 1 })
    .eq("id", link.id);

  return link;
}

export async function getShareLinkById(id: string): Promise<ShareLink | undefined> {
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;
  return mapRow(data);
}

export async function listShareLinksForJob(jobId: string): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapRow);
}

export async function revokeShareLink(id: string): Promise<boolean> {
  const { error, count } = await supabase
    .from("share_links")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[share-store] revokeShareLink error:", error);
    return false;
  }

  // Supabase delete doesn't easily return count in all versions.
  // If no error, we assume it succeeded. Check if the link still exists.
  const check = await getShareLinkById(id);
  return !check;
}
