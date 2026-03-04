/**
 * Pivot Job Store — Supabase PostgreSQL backend
 *
 * All functions are async (return Promises) since Supabase uses HTTP.
 * Callers MUST await these functions.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { Job, Questionnaire, JobStatus, MVPDeliverables, KnowledgeGraph } from "./types";
import { v4 as uuidv4 } from "uuid";

const supabase = createAdminClient();

function mapDbToJob(row: any): Job {
  return {
    runId: row.run_id,
    status: row.status as JobStatus,
    phase: row.phase as any,
    questionnaire: typeof row.questionnaire_json === "string"
      ? JSON.parse(row.questionnaire_json)
      : row.questionnaire_json,
    filePaths: typeof row.file_paths_json === "string"
      ? JSON.parse(row.file_paths_json || "[]")
      : (row.file_paths_json || []),
    parsedContext: row.parsed_context,
    knowledgeGraph: row.knowledge_graph_json
      ? (typeof row.knowledge_graph_json === "string"
        ? JSON.parse(row.knowledge_graph_json)
        : row.knowledge_graph_json)
      : undefined,
    error: row.error,
    deliverables: row.results_json
      ? (typeof row.results_json === "string"
        ? JSON.parse(row.results_json)
        : row.results_json)
      : undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function createJob(questionnaire: Questionnaire, filePaths: string[], orgId?: string): Promise<Job> {
  const runId = `run_${Date.now()}`;
  const id = uuidv4();
  const resolvedOrgId = orgId || "default-org";

  const { error } = await supabase.from("jobs").insert({
    id,
    run_id: runId,
    status: "pending",
    phase: "INGEST",
    organization_id: resolvedOrgId,
    questionnaire_json: questionnaire,
    file_paths_json: filePaths,
  });

  if (error) {
    console.error("[job-store] createJob error:", error);
    throw new Error(`Failed to create job: ${error.message}`);
  }

  const job = await getJob(runId);
  if (!job) throw new Error("Failed to retrieve created job");
  return job;
}

export async function getJob(runId: string): Promise<Job | undefined> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("run_id", runId)
    .single();

  if (error || !data) return undefined;
  return mapDbToJob(data);
}

export async function updateJob(
  runId: string,
  updates: Partial<Pick<Job, "status" | "parsedContext" | "knowledgeGraph" | "deliverables" | "error" | "filePaths" | "phase" | "questionnaire">>
): Promise<Job | undefined> {
  const updateData: Record<string, any> = {};

  if (updates.status) updateData.status = updates.status;
  if (updates.phase) updateData.phase = updates.phase;
  if (updates.questionnaire) updateData.questionnaire_json = updates.questionnaire;
  if (updates.parsedContext !== undefined) updateData.parsed_context = updates.parsedContext ?? null;
  if (updates.knowledgeGraph !== undefined) updateData.knowledge_graph_json = updates.knowledgeGraph ?? null;
  if (updates.deliverables !== undefined) updateData.results_json = updates.deliverables ?? null;
  if (updates.error !== undefined) updateData.error = updates.error ?? null;
  if (updates.filePaths) updateData.file_paths_json = updates.filePaths;

  if (Object.keys(updateData).length === 0) return getJob(runId);

  const { error } = await supabase
    .from("jobs")
    .update(updateData)
    .eq("run_id", runId);

  if (error) {
    console.error("[job-store] updateJob error:", error);
  }

  return getJob(runId);
}

export async function listJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("[job-store] listJobs error:", error);
    return [];
  }

  return data.map(mapDbToJob);
}
