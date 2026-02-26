/**
 * Pivot Pipeline Runner — resumable
 *
 * Each stage persists its output before moving on. If the pipeline crashes,
 * calling runPipeline again on the same runId picks up where it left off.
 */
import { getJob, updateJob } from "@/lib/job-store";
import { parseFiles } from "./parse";
import { ingestDocuments } from "./ingest";
import { categorizeAndBuildGraph } from "./categorize";
import {
  synthesizeDeliverables,
  synthesizeTechOptimization,
  synthesizePricingIntelligence,
} from "./synthesize";
import { formatAndSave } from "./format";
import { analyzeWebsite } from "@/lib/agent/website-analyzer";
import { buildAgentMemory, saveWebsiteAnalysis } from "@/lib/agent/memory";
import {
  analyzeCompetitorWebsites,
  findIndustryLeaderUrls,
  buildCompetitorAnalysis,
} from "@/lib/agent/competitor-analyzer";
import {
  gatherSocialProfiles,
  synthesizeMarketingStrategy,
} from "@/lib/pipeline/marketing";
import type { BusinessPacket, MVPDeliverables, WebsiteAnalysis } from "@/lib/types";

const RESUMABLE_ENTRY_STATUSES = new Set(["pending", "parsing", "ingesting", "synthesizing", "formatting", "failed"]);

export async function runPipeline(runId: string): Promise<void> {
  const job = getJob(runId);
  if (!job) return;
  if (!RESUMABLE_ENTRY_STATUSES.has(job.status)) return;

  // Reset failed status so the pipeline can proceed.
  if (job.status === "failed") {
    updateJob(runId, { error: undefined });
  }

  try {
    // ── Step 1: Parse ──────────────────────────────────────────────────────
    // Skip if we already have a businessPacket from a prior run.
    let businessPacket: BusinessPacket | null = null;
    if (job.parsedContext) {
      try {
        businessPacket = JSON.parse(job.parsedContext) as BusinessPacket;
      } catch { /* corrupt — re-parse */ }
    }

    if (!businessPacket) {
      updateJob(runId, { status: "parsing" });
      const parsedFiles = await parseFiles(runId, job.filePaths);

      updateJob(runId, { status: "ingesting" });
      const [bp, knowledgeGraph] = await Promise.all([
        ingestDocuments(parsedFiles, job.questionnaire),
        categorizeAndBuildGraph(parsedFiles, job.questionnaire),
      ]);
      businessPacket = bp;
      updateJob(runId, {
        parsedContext: JSON.stringify(businessPacket),
        knowledgeGraph,
      });
    }

    // ── Step 2: Synthesize ─────────────────────────────────────────────────
    // Skip if deliverables already exist (e.g. crashed during formatting).
    const fresh = getJob(runId);
    let deliverables: MVPDeliverables;

    if (fresh?.deliverables && Object.keys(fresh.deliverables).length > 3) {
      deliverables = fresh.deliverables;
    } else {
      updateJob(runId, { status: "synthesizing" });
      deliverables = await synthesizeDeliverables(job.questionnaire, businessPacket);
      updateJob(runId, { deliverables });
    }

    // ── Step 3: Website + competitor analysis (best-effort) ────────────────
    const orgId = job.questionnaire.orgId ?? "default-org";
    const websiteUrl = job.questionnaire.website;
    let websiteAnalysis: WebsiteAnalysis | undefined = deliverables.websiteAnalysis;

    if (websiteUrl && !websiteAnalysis) {
      try {
        websiteAnalysis = await analyzeWebsite(websiteUrl, { runId, label: "primary" });
        deliverables = { ...deliverables, websiteAnalysis };
        saveWebsiteAnalysis(orgId, websiteAnalysis);
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Website analysis failed (non-fatal):", e);
      }
    }

    const competitorUrls = job.questionnaire.competitorUrls ?? [];
    let competitorResults: { url: string; analysis: WebsiteAnalysis | null }[] = [];

    if (competitorUrls.length > 0 && !deliverables.competitorAnalysis) {
      try {
        competitorResults = await analyzeCompetitorWebsites(competitorUrls);
      } catch (e) {
        console.warn("[Pivot] Competitor analysis failed (non-fatal):", e);
      }
    }

    let industryLeaderResults: { url: string; analysis: WebsiteAnalysis | null }[] = [];

    if (!deliverables.competitorAnalysis) {
      try {
        const leaderUrls = await findIndustryLeaderUrls(
          businessPacket.industry,
          job.questionnaire.businessModel ?? businessPacket.questionnaire.businessModel
        );
        if (leaderUrls.length > 0) {
          industryLeaderResults = await analyzeCompetitorWebsites(leaderUrls);
        }
      } catch (e) {
        console.warn("[Pivot] Industry leader analysis failed (non-fatal):", e);
      }
    }

    if (!deliverables.competitorAnalysis && (competitorResults.length > 0 || industryLeaderResults.length > 0)) {
      try {
        const competitorAnalysis = await buildCompetitorAnalysis(
          websiteAnalysis ?? null,
          competitorResults,
          industryLeaderResults,
          businessPacket
        );
        deliverables = { ...deliverables, competitorAnalysis };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Competitor report build failed (non-fatal):", e);
      }
    }

    if (!deliverables.techOptimization || !deliverables.pricingIntelligence) {
      try {
        const [techOpt, priceInt] = await Promise.allSettled([
          deliverables.techOptimization ? Promise.resolve(null) : synthesizeTechOptimization(businessPacket, job.questionnaire),
          deliverables.pricingIntelligence ? Promise.resolve(null) : synthesizePricingIntelligence(businessPacket, job.questionnaire, deliverables.competitorAnalysis),
        ]);
        if (techOpt.status === "fulfilled" && techOpt.value) deliverables = { ...deliverables, techOptimization: techOpt.value };
        if (priceInt.status === "fulfilled" && priceInt.value) deliverables = { ...deliverables, pricingIntelligence: priceInt.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Tech/pricing synthesis failed (non-fatal):", e);
      }
    }

    // ── Step 4: Marketing intelligence (social scrape + synthesis) ─────────
    if (!deliverables.marketingStrategy) {
      try {
        console.log("[Pivot] Gathering social profiles + marketing intelligence...");
        const competitorNames = businessPacket.keyMetrics.topCompetitors.slice(0, 3);
        const { userProfiles, competitorProfiles, userRawData, competitorRawData } = await gatherSocialProfiles(
          job.questionnaire,
          competitorNames
        );

        const marketingStrategy = await synthesizeMarketingStrategy(
          job.questionnaire,
          businessPacket,
          websiteAnalysis ?? null,
          deliverables.competitorAnalysis ?? null,
          userProfiles,
          competitorProfiles,
          userRawData,
          competitorRawData
        );
        deliverables = { ...deliverables, marketingStrategy };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Marketing intelligence failed (non-fatal):", e);
      }
    }

    // ── Step 5: Agent memory (best-effort) ─────────────────────────────────
    try {
      await buildAgentMemory(orgId, job.questionnaire.organizationName, runId, deliverables, websiteAnalysis);
    } catch (e) {
      console.warn("[Pivot] Agent memory build failed (non-fatal):", e);
    }

    // ── Step 5: Format PDF + DOCX ──────────────────────────────────────────
    updateJob(runId, { status: "formatting" });
    await formatAndSave(runId, deliverables);

    updateJob(runId, { status: "completed", phase: "PLAN" });
    console.log("[Pivot] Pipeline complete for run:", runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Pivot] Pipeline failed:", message);
    updateJob(runId, { status: "failed", error: message });
  }
}
