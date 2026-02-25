import db from "./db";
import type { Job, Questionnaire, JobStatus, MVPDeliverables } from "./types";
import { v4 as uuidv4 } from "uuid";

function mapDbToJob(row: any): Job {
  return {
    runId: row.run_id,
    status: row.status as JobStatus,
    phase: row.phase as any,
    questionnaire: JSON.parse(row.questionnaire_json),
    filePaths: JSON.parse(row.file_paths_json || "[]"),
    parsedContext: row.parsed_context,
    error: row.error,
    deliverables: row.results_json ? JSON.parse(row.results_json) : undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function createJob(questionnaire: Questionnaire, filePaths: string[]): Job {
  const runId = `run_${Date.now()}`;
  const id = uuidv4();

  // For MVP, we'll use a placeholder organization_id if none provided
  // In a real flow, this would come from the auth'd user
  const orgId = "default-org";

  const stmt = db.prepare(`
    INSERT INTO jobs (id, run_id, status, organization_id, questionnaire_json, file_paths_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    runId,
    "pending",
    orgId,
    JSON.stringify(questionnaire),
    JSON.stringify(filePaths)
  );

  return getJob(runId)!;
}

export function getJob(runId: string): Job | undefined {
  const row = db.prepare("SELECT * FROM jobs WHERE run_id = ?").get(runId);
  return row ? mapDbToJob(row) : undefined;
}

export function updateJob(
  runId: string,
  updates: Partial<Pick<Job, "status" | "parsedContext" | "deliverables" | "error" | "filePaths" | "phase">>
): Job | undefined {
  const params: any[] = [];
  const sets: string[] = [];

  if (updates.status) { sets.push("status = ?"); params.push(updates.status); }
  if (updates.phase) { sets.push("phase = ?"); params.push(updates.phase); }
  if (updates.parsedContext !== undefined) { sets.push("parsed_context = ?"); params.push(updates.parsedContext); }
  if (updates.deliverables) { sets.push("results_json = ?"); params.push(JSON.stringify(updates.deliverables)); }
  if (updates.error) { sets.push("error = ?"); params.push(updates.error); }
  if (updates.filePaths) { sets.push("file_paths_json = ?"); params.push(JSON.stringify(updates.filePaths)); }

  if (sets.length === 0) return getJob(runId);

  params.push(runId);
  db.prepare(`UPDATE jobs SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE run_id = ?`).run(...params);

  return getJob(runId);
}

export function listJobs(): Job[] {
  const rows = db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all();
  return rows.map(mapDbToJob);
}
