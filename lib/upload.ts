import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Questionnaire } from "./types";

const ACCEPTED_EXTENSIONS = new Set(
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv".split(",").map((e) => e.trim().toLowerCase())
);
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

export function getUploadDir(runId: string): string {
  const root = process.cwd();
  return path.join(root, "uploads", runId);
}

export function getUploadPath(runId: string, filename: string): string {
  const base = path.basename(filename);
  return path.join(getUploadDir(runId), base);
}

export function parseQuestionnaire(formData: FormData): Questionnaire {
  const visitorsRaw = formData.get("websiteVisitorsPerDay") as string | null;
  const competitorUrlsRaw = formData.get("competitorUrls") as string | null;

  let competitorUrls: string[] | undefined;
  if (competitorUrlsRaw) {
    try {
      const parsed = JSON.parse(competitorUrlsRaw);
      competitorUrls = Array.isArray(parsed) ? parsed : undefined;
    } catch {
      // single URL or comma-separated
      competitorUrls = competitorUrlsRaw.split(",").map((u) => u.trim()).filter(Boolean);
    }
  }

  return {
    organizationName: (formData.get("organizationName") as string) || "",
    industry: (formData.get("industry") as string) || "",
    revenueRange: (formData.get("revenueRange") as string) || "$0 - $10M",
    businessModel: (formData.get("businessModel") as string) || "",
    keyConcerns: (formData.get("keyConcerns") as string) || "",
    oneDecisionKeepingOwnerUpAtNight: (formData.get("oneDecisionKeepingOwnerUpAtNight") as string) || "",
    primaryObjective: (formData.get("primaryObjective") as string) || undefined,
    keyCustomers: (formData.get("keyCustomers") as string) || undefined,
    keyCompetitors: (formData.get("keyCompetitors") as string) || undefined,
    location: (formData.get("location") as string) || undefined,
    website: (formData.get("website") as string) || undefined,
    websiteVisitorsPerDay: visitorsRaw ? parseInt(visitorsRaw, 10) || undefined : undefined,
    competitorUrls,
    techStack: (formData.get("techStack") as string) || undefined,
    orgId: (formData.get("orgId") as string) || undefined,
  };
}

export async function saveUploadedFiles(
  runId: string,
  formData: FormData
): Promise<{ filePaths: string[]; error?: string }> {
  const dir = getUploadDir(runId);
  await mkdir(dir, { recursive: true });

  const filePaths: string[] = [];
  const files = formData.getAll("files") as File[];

  if (!files?.length) {
    return { filePaths };
  }

  for (const file of files) {
    if (!(file instanceof File) || !file.size) continue;
    const ext = path.extname(file.name).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.has(ext)) continue;
    if (file.size > MAX_FILE_BYTES) {
      return { filePaths, error: `File ${file.name} exceeds 50MB limit` };
    }
    const safeName = `${Date.now()}_${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(dir, safeName);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buf);
    filePaths.push(path.join(runId, safeName));
  }

  return { filePaths };
}
