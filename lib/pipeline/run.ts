/**
 * Pivot Pipeline Runner
 *
 * Two-stage AI pipeline:
 *   Stage 1 (Gemini Flash Lite): ingestDocuments → BusinessPacket
 *     - Per-document extraction (facts, issues, amounts)
 *     - Cross-document consolidation into lean structured JSON
 *
 *   Stage 2 (Gemini Flash): synthesizeDeliverables → MVPDeliverables
 *     - 8 focused deliverable generators using BusinessPacket context
 *     - Rate-limit retry built into each call
 *
 *   Post-pipeline:
 *     - Website analysis — user's site (Flash Lite)
 *     - Competitor website analysis — up to 3 URLs (Flash Lite)
 *     - Industry leader discovery + analysis (Flash + Lite)
 *     - Competitor repositioning report (Flash)
 *     - Tech cost optimization (Flash)
 *     - Pricing intelligence (Flash)
 *     - Agent memory build (~600-word ARIA context)
 *     - PDF/DOCX report generation
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

export async function runPipeline(runId: string): Promise<void> {
  const job = getJob(runId);
  if (!job || job.status !== "pending") return;

  try {
    // ── Step 1: Parse each uploaded file ──────────────────────────────────
    updateJob(runId, { status: "parsing" });
    const parsedFiles = await parseFiles(runId, job.filePaths);

    // ── Step 2: Stage 1 — Parallel ingestion ─────────────────────────────
    // Run both paths concurrently:
    //   a) BusinessPacket (lean extraction for synthesis prompts)
    //   b) Knowledge Graph (rich categorization for schema coverage tracking)
    updateJob(runId, { status: "ingesting" });
    const [businessPacket, knowledgeGraph] = await Promise.all([
      ingestDocuments(parsedFiles, job.questionnaire),
      categorizeAndBuildGraph(parsedFiles, job.questionnaire),
    ]);
    updateJob(runId, {
      parsedContext: JSON.stringify(businessPacket),
      knowledgeGraph,
    });

    // ── Step 3: Stage 2 — Gemini Flash synthesis → 8 deliverables ────────
    updateJob(runId, { status: "synthesizing" });
    let deliverables = await synthesizeDeliverables(job.questionnaire, businessPacket);

    // ── Step 4: User's website analysis (Flash Lite) ──────────────────────
    const orgId = job.questionnaire.orgId ?? "default-org";
    const websiteUrl = job.questionnaire.website;
    let websiteAnalysis;

    if (websiteUrl) {
      try {
        console.log("[Pivot] Analyzing website:", websiteUrl);
        websiteAnalysis = await analyzeWebsite(websiteUrl);
        deliverables = { ...deliverables, websiteAnalysis };
        saveWebsiteAnalysis(orgId, websiteAnalysis);
      } catch (e) {
        console.warn("[Pivot] Website analysis failed:", e);
      }
    }

    // ── Step 4.5: Competitor website analysis (Flash Lite, parallel) ──────
    const competitorUrls = job.questionnaire.competitorUrls ?? [];
    let competitorResults: { url: string; analysis: import("@/lib/types").WebsiteAnalysis | null }[] = [];

    if (competitorUrls.length > 0) {
      try {
        console.log("[Pivot] Analyzing competitor websites:", competitorUrls);
        competitorResults = await analyzeCompetitorWebsites(competitorUrls);
      } catch (e) {
        console.warn("[Pivot] Competitor analysis failed:", e);
      }
    }

    // ── Step 4.6: Find + analyze industry leaders (Flash + Flash Lite) ────
    let industryLeaderResults: { url: string; analysis: import("@/lib/types").WebsiteAnalysis | null }[] = [];

    try {
      console.log("[Pivot] Finding industry leaders for:", businessPacket.industry);
      const leaderUrls = await findIndustryLeaderUrls(
        businessPacket.industry,
        job.questionnaire.businessModel ?? businessPacket.questionnaire.businessModel
      );
      if (leaderUrls.length > 0) {
        industryLeaderResults = await analyzeCompetitorWebsites(leaderUrls);
      }
    } catch (e) {
      console.warn("[Pivot] Industry leader analysis failed:", e);
    }

    // ── Step 4.7: Build competitor analysis report (Flash) ────────────────
    if (competitorResults.length > 0 || industryLeaderResults.length > 0) {
      try {
        console.log("[Pivot] Building competitor analysis report...");
        const competitorAnalysis = await buildCompetitorAnalysis(
          websiteAnalysis ?? null,
          competitorResults,
          industryLeaderResults,
          businessPacket
        );
        deliverables = { ...deliverables, competitorAnalysis };
      } catch (e) {
        console.warn("[Pivot] Competitor report build failed:", e);
      }
    }

    // ── Step 4.8: Tech optimization + Pricing intelligence (Flash, parallel)
    try {
      console.log("[Pivot] Synthesizing tech optimization + pricing intelligence...");
      const [techOptimization, pricingIntelligence] = await Promise.allSettled([
        synthesizeTechOptimization(businessPacket, job.questionnaire),
        synthesizePricingIntelligence(
          businessPacket,
          job.questionnaire,
          deliverables.competitorAnalysis
        ),
      ]);

      if (techOptimization.status === "fulfilled" && techOptimization.value) {
        deliverables = { ...deliverables, techOptimization: techOptimization.value };
      }
      if (pricingIntelligence.status === "fulfilled" && pricingIntelligence.value) {
        deliverables = { ...deliverables, pricingIntelligence: pricingIntelligence.value };
      }
    } catch (e) {
      console.warn("[Pivot] Tech/pricing synthesis failed:", e);
    }

    // Persist all deliverables
    updateJob(runId, { deliverables });

    // ── Step 5: Build agent memory ────────────────────────────────────────
    try {
      await buildAgentMemory(orgId, job.questionnaire.organizationName, runId, deliverables, websiteAnalysis);
      console.log("[Pivot] Agent memory built for org:", orgId);
    } catch (e) {
      console.warn("[Pivot] Agent memory build failed (non-fatal):", e);
    }

    // ── Step 6: Format and save PDF + DOCX ───────────────────────────────
    updateJob(runId, { status: "formatting" });
    await formatAndSave(runId, deliverables);

    updateJob(runId, { status: "completed", phase: "PLAN" });
    console.log("[Pivot] Pipeline complete for run:", runId, "— transitioned to PLAN phase");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Pivot] Pipeline failed:", message);
    updateJob(runId, { status: "failed", error: message });
  }
}
