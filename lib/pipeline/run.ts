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
  synthesizeKPIs,
  synthesizeRoadmap,
  synthesizeHealthChecklist,
  synthesizeSWOT,
  synthesizeUnitEconomics,
  synthesizeCustomerSegmentation,
  synthesizeCompetitiveWinLoss,
  synthesizeInvestorOnePager,
  synthesizeHiringPlan,
  synthesizeRevenueForecast,
  synthesizeChurnPlaybook,
  synthesizeSalesPlaybook,
  synthesizeGoalTracker,
  synthesizeBenchmarkScore,
  synthesizeExecutiveSummary,
  synthesizeMilestoneTracker,
  synthesizeRiskRegister,
  synthesizePartnershipOpportunities,
  synthesizeFundingReadiness,
  synthesizeMarketSizing,
  synthesizeScenarioPlanner,
  synthesizeOperationalEfficiency,
  synthesizeCLVAnalysis,
  synthesizeRetentionPlaybook,
  synthesizeRevenueAttribution,
  synthesizeBoardDeck,
  synthesizeCompetitiveMoat,
  synthesizeGTMScorecard,
  synthesizeCashOptimization,
  synthesizeTalentGapAnalysis,
  synthesizeRevenueDiversification,
  synthesizeCustomerJourneyMap,
  synthesizeComplianceChecklist,
  synthesizeExpansionPlaybook,
  synthesizeVendorScorecard,
  synthesizeProductMarketFit,
  synthesizeBrandHealth,
  synthesizePricingElasticity,
  synthesizeStrategicInitiatives,
  synthesizeCashConversionCycle,
  synthesizeInnovationPipeline,
  synthesizeStakeholderMap,
  synthesizeDecisionLog,
  synthesizeCultureAssessment,
  synthesizeIPPortfolio,
  synthesizeExitReadiness,
  synthesizeSustainabilityScore,
} from "./synthesize";
import { detectTerminology } from "./terminology";
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
import { analyzePitchDeck } from "@/lib/agent/pitch-deck-analyzer";
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

    // ── Step 4b: Pitch deck analysis (best-effort) ────────────────────────
    if (!deliverables.pitchDeckAnalysis) {
      // Detect pitch deck files (.pptx, .ppt, or files with "pitch" or "deck" in name)
      const pitchDeckFiles = job.filePaths.filter((fp) => {
        const lower = fp.toLowerCase();
        return lower.endsWith(".pptx") || lower.endsWith(".ppt") ||
          lower.includes("pitch") || lower.includes("deck");
      });

      if (pitchDeckFiles.length > 0) {
        try {
          console.log("[Pivot] Analyzing pitch deck:", pitchDeckFiles[0]);
          const parsedDeck = await parseFiles(runId, [pitchDeckFiles[0]]);
          const deckText = parsedDeck[0]?.text ?? "";
          if (deckText.length > 50) {
            const pitchDeckAnalysis = await analyzePitchDeck(
              deckText,
              parsedDeck[0].filename,
              businessPacket,
              job.questionnaire
            );
            deliverables = { ...deliverables, pitchDeckAnalysis };
            updateJob(runId, { deliverables });
          }
        } catch (e) {
          console.warn("[Pivot] Pitch deck analysis failed (non-fatal):", e);
        }
      }
    }

    // ── Step 4c: Terminology + KPIs + Roadmap + Health Checklist ────────────
    // Detect business model terminology
    if (!deliverables.terminology) {
      try {
        deliverables = { ...deliverables, terminology: detectTerminology(job.questionnaire) };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Terminology detection failed (non-fatal):", e);
      }
    }

    // KPI identification
    if (!deliverables.kpiReport) {
      try {
        console.log("[Pivot] Identifying KPIs...");
        const kpiReport = await synthesizeKPIs(businessPacket, job.questionnaire);
        if (kpiReport) {
          deliverables = { ...deliverables, kpiReport };
          updateJob(runId, { deliverables });
        }
      } catch (e) {
        console.warn("[Pivot] KPI synthesis failed (non-fatal):", e);
      }
    }

    // Health checklist
    if (!deliverables.healthChecklist) {
      try {
        console.log("[Pivot] Generating business health checklist...");
        const healthChecklist = await synthesizeHealthChecklist(businessPacket, job.questionnaire);
        if (healthChecklist) {
          deliverables = { ...deliverables, healthChecklist };
          updateJob(runId, { deliverables });
        }
      } catch (e) {
        console.warn("[Pivot] Health checklist failed (non-fatal):", e);
      }
    }

    // 30-day roadmap (depends on other deliverables for context)
    if (!deliverables.roadmap) {
      try {
        console.log("[Pivot] Building 30-day roadmap...");
        const roadmap = await synthesizeRoadmap(businessPacket, job.questionnaire, deliverables);
        if (roadmap) {
          deliverables = { ...deliverables, roadmap };
          updateJob(runId, { deliverables });
        }
      } catch (e) {
        console.warn("[Pivot] Roadmap synthesis failed (non-fatal):", e);
      }
    }

    // ── Step 4d: Wave 2 intelligence (SWOT, unit economics, etc.) ──────────
    // Run pairs in parallel where possible to save time
    if (!deliverables.swotAnalysis || !deliverables.unitEconomics) {
      try {
        console.log("[Pivot] Synthesizing SWOT + unit economics...");
        const [swot, ue] = await Promise.allSettled([
          deliverables.swotAnalysis ? Promise.resolve(null) : synthesizeSWOT(businessPacket, job.questionnaire),
          deliverables.unitEconomics ? Promise.resolve(null) : synthesizeUnitEconomics(businessPacket, job.questionnaire),
        ]);
        if (swot.status === "fulfilled" && swot.value) deliverables = { ...deliverables, swotAnalysis: swot.value };
        if (ue.status === "fulfilled" && ue.value) deliverables = { ...deliverables, unitEconomics: ue.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] SWOT/UnitEcon failed (non-fatal):", e);
      }
    }

    if (!deliverables.customerSegmentation || !deliverables.competitiveWinLoss) {
      try {
        console.log("[Pivot] Synthesizing customer segmentation + competitive win/loss...");
        const [cs, cwl] = await Promise.allSettled([
          deliverables.customerSegmentation ? Promise.resolve(null) : synthesizeCustomerSegmentation(businessPacket, job.questionnaire, deliverables),
          deliverables.competitiveWinLoss ? Promise.resolve(null) : synthesizeCompetitiveWinLoss(businessPacket, job.questionnaire, deliverables),
        ]);
        if (cs.status === "fulfilled" && cs.value) deliverables = { ...deliverables, customerSegmentation: cs.value };
        if (cwl.status === "fulfilled" && cwl.value) deliverables = { ...deliverables, competitiveWinLoss: cwl.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Segmentation/WinLoss failed (non-fatal):", e);
      }
    }

    if (!deliverables.revenueForecast || !deliverables.hiringPlan) {
      try {
        console.log("[Pivot] Synthesizing revenue forecast + hiring plan...");
        const [rf, hp] = await Promise.allSettled([
          deliverables.revenueForecast ? Promise.resolve(null) : synthesizeRevenueForecast(businessPacket, job.questionnaire),
          deliverables.hiringPlan ? Promise.resolve(null) : synthesizeHiringPlan(businessPacket, job.questionnaire, deliverables),
        ]);
        if (rf.status === "fulfilled" && rf.value) deliverables = { ...deliverables, revenueForecast: rf.value };
        if (hp.status === "fulfilled" && hp.value) deliverables = { ...deliverables, hiringPlan: hp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Forecast/Hiring failed (non-fatal):", e);
      }
    }

    if (!deliverables.churnPlaybook || !deliverables.salesPlaybook) {
      try {
        console.log("[Pivot] Synthesizing churn playbook + sales playbook...");
        const [cp, sp] = await Promise.allSettled([
          deliverables.churnPlaybook ? Promise.resolve(null) : synthesizeChurnPlaybook(businessPacket, job.questionnaire, deliverables),
          deliverables.salesPlaybook ? Promise.resolve(null) : synthesizeSalesPlaybook(businessPacket, job.questionnaire, deliverables),
        ]);
        if (cp.status === "fulfilled" && cp.value) deliverables = { ...deliverables, churnPlaybook: cp.value };
        if (sp.status === "fulfilled" && sp.value) deliverables = { ...deliverables, salesPlaybook: sp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Churn/Sales playbook failed (non-fatal):", e);
      }
    }

    if (!deliverables.investorOnePager || !deliverables.goalTracker) {
      try {
        console.log("[Pivot] Synthesizing investor one-pager + goal tracker...");
        const [io, gt] = await Promise.allSettled([
          deliverables.investorOnePager ? Promise.resolve(null) : synthesizeInvestorOnePager(businessPacket, job.questionnaire, deliverables),
          deliverables.goalTracker ? Promise.resolve(null) : synthesizeGoalTracker(businessPacket, job.questionnaire, deliverables),
        ]);
        if (io.status === "fulfilled" && io.value) deliverables = { ...deliverables, investorOnePager: io.value };
        if (gt.status === "fulfilled" && gt.value) deliverables = { ...deliverables, goalTracker: gt.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Investor/Goals failed (non-fatal):", e);
      }
    }

    if (!deliverables.benchmarkScore || !deliverables.executiveSummary) {
      try {
        console.log("[Pivot] Synthesizing benchmark score + executive summary...");
        const [bs, es] = await Promise.allSettled([
          deliverables.benchmarkScore ? Promise.resolve(null) : synthesizeBenchmarkScore(businessPacket, job.questionnaire, deliverables),
          deliverables.executiveSummary ? Promise.resolve(null) : synthesizeExecutiveSummary(businessPacket, job.questionnaire, deliverables),
        ]);
        if (bs.status === "fulfilled" && bs.value) deliverables = { ...deliverables, benchmarkScore: bs.value };
        if (es.status === "fulfilled" && es.value) deliverables = { ...deliverables, executiveSummary: es.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Benchmark/ExecSummary failed (non-fatal):", e);
      }
    }

    // ── Step 4e: Wave 4 intelligence (milestones, risk, partnerships, etc.) ──
    if (!deliverables.milestoneTracker || !deliverables.riskRegister) {
      try {
        console.log("[Pivot] Synthesizing milestone tracker + risk register...");
        const [mt, rr] = await Promise.allSettled([
          deliverables.milestoneTracker ? Promise.resolve(null) : synthesizeMilestoneTracker(businessPacket, job.questionnaire),
          deliverables.riskRegister ? Promise.resolve(null) : synthesizeRiskRegister(businessPacket, job.questionnaire),
        ]);
        if (mt.status === "fulfilled" && mt.value) deliverables = { ...deliverables, milestoneTracker: mt.value };
        if (rr.status === "fulfilled" && rr.value) deliverables = { ...deliverables, riskRegister: rr.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Milestone/Risk failed (non-fatal):", e);
      }
    }

    if (!deliverables.partnershipOpportunities || !deliverables.fundingReadiness) {
      try {
        console.log("[Pivot] Synthesizing partnership opportunities + funding readiness...");
        const [po, fr] = await Promise.allSettled([
          deliverables.partnershipOpportunities ? Promise.resolve(null) : synthesizePartnershipOpportunities(businessPacket, job.questionnaire),
          deliverables.fundingReadiness ? Promise.resolve(null) : synthesizeFundingReadiness(businessPacket, job.questionnaire, deliverables),
        ]);
        if (po.status === "fulfilled" && po.value) deliverables = { ...deliverables, partnershipOpportunities: po.value };
        if (fr.status === "fulfilled" && fr.value) deliverables = { ...deliverables, fundingReadiness: fr.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Partnership/Funding failed (non-fatal):", e);
      }
    }

    if (!deliverables.marketSizing || !deliverables.scenarioPlanner) {
      try {
        console.log("[Pivot] Synthesizing market sizing + scenario planner...");
        const [ms, sp] = await Promise.allSettled([
          deliverables.marketSizing ? Promise.resolve(null) : synthesizeMarketSizing(businessPacket, job.questionnaire),
          deliverables.scenarioPlanner ? Promise.resolve(null) : synthesizeScenarioPlanner(businessPacket, job.questionnaire),
        ]);
        if (ms.status === "fulfilled" && ms.value) deliverables = { ...deliverables, marketSizing: ms.value };
        if (sp.status === "fulfilled" && sp.value) deliverables = { ...deliverables, scenarioPlanner: sp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] MarketSizing/Scenario failed (non-fatal):", e);
      }
    }

    if (!deliverables.operationalEfficiency || !deliverables.clvAnalysis) {
      try {
        console.log("[Pivot] Synthesizing operational efficiency + CLV analysis...");
        const [oe, clv] = await Promise.allSettled([
          deliverables.operationalEfficiency ? Promise.resolve(null) : synthesizeOperationalEfficiency(businessPacket, job.questionnaire),
          deliverables.clvAnalysis ? Promise.resolve(null) : synthesizeCLVAnalysis(businessPacket, job.questionnaire),
        ]);
        if (oe.status === "fulfilled" && oe.value) deliverables = { ...deliverables, operationalEfficiency: oe.value };
        if (clv.status === "fulfilled" && clv.value) deliverables = { ...deliverables, clvAnalysis: clv.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] OpsEfficiency/CLV failed (non-fatal):", e);
      }
    }

    // ── Step 4i: Wave 5 intelligence (retention, attribution) ───────────────
    if (!deliverables.retentionPlaybook || !deliverables.revenueAttribution) {
      try {
        console.log("[Pivot] Synthesizing retention playbook + revenue attribution...");
        const [rp, ra] = await Promise.allSettled([
          deliverables.retentionPlaybook ? Promise.resolve(null) : synthesizeRetentionPlaybook(businessPacket, job.questionnaire),
          deliverables.revenueAttribution ? Promise.resolve(null) : synthesizeRevenueAttribution(businessPacket, job.questionnaire),
        ]);
        if (rp.status === "fulfilled" && rp.value) deliverables = { ...deliverables, retentionPlaybook: rp.value };
        if (ra.status === "fulfilled" && ra.value) deliverables = { ...deliverables, revenueAttribution: ra.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Retention/Attribution failed (non-fatal):", e);
      }
    }

    // ── Step 4j: Wave 5 intelligence (board deck, competitive moat) ─────────
    if (!deliverables.boardDeck || !deliverables.competitiveMoat) {
      try {
        console.log("[Pivot] Synthesizing board deck + competitive moat...");
        const [bd, cm] = await Promise.allSettled([
          deliverables.boardDeck ? Promise.resolve(null) : synthesizeBoardDeck(businessPacket, job.questionnaire),
          deliverables.competitiveMoat ? Promise.resolve(null) : synthesizeCompetitiveMoat(businessPacket, job.questionnaire),
        ]);
        if (bd.status === "fulfilled" && bd.value) deliverables = { ...deliverables, boardDeck: bd.value };
        if (cm.status === "fulfilled" && cm.value) deliverables = { ...deliverables, competitiveMoat: cm.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] BoardDeck/Moat failed (non-fatal):", e);
      }
    }

    // ── Step 4k: Wave 5 intelligence (GTM scorecard, cash optimization) ─────
    if (!deliverables.gtmScorecard || !deliverables.cashOptimization) {
      try {
        console.log("[Pivot] Synthesizing GTM scorecard + cash optimization...");
        const [gs, co] = await Promise.allSettled([
          deliverables.gtmScorecard ? Promise.resolve(null) : synthesizeGTMScorecard(businessPacket, job.questionnaire),
          deliverables.cashOptimization ? Promise.resolve(null) : synthesizeCashOptimization(businessPacket, job.questionnaire),
        ]);
        if (gs.status === "fulfilled" && gs.value) deliverables = { ...deliverables, gtmScorecard: gs.value };
        if (co.status === "fulfilled" && co.value) deliverables = { ...deliverables, cashOptimization: co.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] GTM/CashOptimization failed (non-fatal):", e);
      }
    }

    // ── Step 4l: Wave 6 intelligence (talent gap analysis, revenue diversification) ──
    if (!deliverables.talentGapAnalysis || !deliverables.revenueDiversification) {
      try {
        console.log("[Pivot] Synthesizing talent gap analysis + revenue diversification...");
        const [tga, rd] = await Promise.allSettled([
          deliverables.talentGapAnalysis ? Promise.resolve(null) : synthesizeTalentGapAnalysis(businessPacket, job.questionnaire),
          deliverables.revenueDiversification ? Promise.resolve(null) : synthesizeRevenueDiversification(businessPacket, job.questionnaire),
        ]);
        if (tga.status === "fulfilled" && tga.value) deliverables = { ...deliverables, talentGapAnalysis: tga.value };
        if (rd.status === "fulfilled" && rd.value) deliverables = { ...deliverables, revenueDiversification: rd.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] TalentGap/RevenueDiversification failed (non-fatal):", e);
      }
    }

    // ── Step 4m: Wave 6 intelligence (customer journey map, compliance checklist) ──
    if (!deliverables.customerJourneyMap || !deliverables.complianceChecklist) {
      try {
        console.log("[Pivot] Synthesizing customer journey map + compliance checklist...");
        const [cjm, cc] = await Promise.allSettled([
          deliverables.customerJourneyMap ? Promise.resolve(null) : synthesizeCustomerJourneyMap(businessPacket, job.questionnaire),
          deliverables.complianceChecklist ? Promise.resolve(null) : synthesizeComplianceChecklist(businessPacket, job.questionnaire),
        ]);
        if (cjm.status === "fulfilled" && cjm.value) deliverables = { ...deliverables, customerJourneyMap: cjm.value };
        if (cc.status === "fulfilled" && cc.value) deliverables = { ...deliverables, complianceChecklist: cc.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CustomerJourney/Compliance failed (non-fatal):", e);
      }
    }

    // ── Step 4n: Wave 6 intelligence (expansion playbook, vendor scorecard) ──
    if (!deliverables.expansionPlaybook || !deliverables.vendorScorecard) {
      try {
        console.log("[Pivot] Synthesizing expansion playbook + vendor scorecard...");
        const [ep, vs] = await Promise.allSettled([
          deliverables.expansionPlaybook ? Promise.resolve(null) : synthesizeExpansionPlaybook(businessPacket, job.questionnaire),
          deliverables.vendorScorecard ? Promise.resolve(null) : synthesizeVendorScorecard(businessPacket, job.questionnaire),
        ]);
        if (ep.status === "fulfilled" && ep.value) deliverables = { ...deliverables, expansionPlaybook: ep.value };
        if (vs.status === "fulfilled" && vs.value) deliverables = { ...deliverables, vendorScorecard: vs.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] Expansion/VendorScorecard failed (non-fatal):", e);
      }
    }

    // ── Step 4o: Wave 7 intelligence (product-market fit, brand health) ──
    if (!deliverables.productMarketFit || !deliverables.brandHealth) {
      try {
        console.log("[Pivot] Synthesizing product-market fit + brand health...");
        const [pmf, bh] = await Promise.allSettled([
          deliverables.productMarketFit ? Promise.resolve(null) : synthesizeProductMarketFit(businessPacket, job.questionnaire),
          deliverables.brandHealth ? Promise.resolve(null) : synthesizeBrandHealth(businessPacket, job.questionnaire),
        ]);
        if (pmf.status === "fulfilled" && pmf.value) deliverables = { ...deliverables, productMarketFit: pmf.value };
        if (bh.status === "fulfilled" && bh.value) deliverables = { ...deliverables, brandHealth: bh.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] ProductMarketFit/BrandHealth failed (non-fatal):", e);
      }
    }

    // ── Step 4p: Wave 7 intelligence (pricing elasticity, strategic initiatives) ──
    if (!deliverables.pricingElasticity || !deliverables.strategicInitiatives) {
      try {
        console.log("[Pivot] Synthesizing pricing elasticity + strategic initiatives...");
        const [pe, si] = await Promise.allSettled([
          deliverables.pricingElasticity ? Promise.resolve(null) : synthesizePricingElasticity(businessPacket, job.questionnaire),
          deliverables.strategicInitiatives ? Promise.resolve(null) : synthesizeStrategicInitiatives(businessPacket, job.questionnaire),
        ]);
        if (pe.status === "fulfilled" && pe.value) deliverables = { ...deliverables, pricingElasticity: pe.value };
        if (si.status === "fulfilled" && si.value) deliverables = { ...deliverables, strategicInitiatives: si.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] PricingElasticity/StrategicInitiatives failed (non-fatal):", e);
      }
    }

    // ── Step 4q: Wave 7 intelligence (cash conversion cycle, innovation pipeline) ──
    if (!deliverables.cashConversionCycle || !deliverables.innovationPipeline) {
      try {
        console.log("[Pivot] Synthesizing cash conversion cycle + innovation pipeline...");
        const [ccc, ip] = await Promise.allSettled([
          deliverables.cashConversionCycle ? Promise.resolve(null) : synthesizeCashConversionCycle(businessPacket, job.questionnaire),
          deliverables.innovationPipeline ? Promise.resolve(null) : synthesizeInnovationPipeline(businessPacket, job.questionnaire),
        ]);
        if (ccc.status === "fulfilled" && ccc.value) deliverables = { ...deliverables, cashConversionCycle: ccc.value };
        if (ip.status === "fulfilled" && ip.value) deliverables = { ...deliverables, innovationPipeline: ip.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CashConversionCycle/InnovationPipeline failed (non-fatal):", e);
      }
    }

    // ── Step 4r: Wave 8 intelligence (stakeholder map, decision log) ────────
    if (!deliverables.stakeholderMap || !deliverables.decisionLog) {
      try {
        console.log("[Pivot] Synthesizing stakeholder map + decision log...");
        const [sm, dl] = await Promise.allSettled([
          deliverables.stakeholderMap ? Promise.resolve(null) : synthesizeStakeholderMap(businessPacket, job.questionnaire),
          deliverables.decisionLog ? Promise.resolve(null) : synthesizeDecisionLog(businessPacket, job.questionnaire),
        ]);
        if (sm.status === "fulfilled" && sm.value) deliverables = { ...deliverables, stakeholderMap: sm.value };
        if (dl.status === "fulfilled" && dl.value) deliverables = { ...deliverables, decisionLog: dl.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] StakeholderMap/DecisionLog failed (non-fatal):", e);
      }
    }

    // ── Step 4s: Wave 8 intelligence (culture assessment, IP portfolio) ─────
    if (!deliverables.cultureAssessment || !deliverables.ipPortfolio) {
      try {
        console.log("[Pivot] Synthesizing culture assessment + IP portfolio...");
        const [ca, ipp] = await Promise.allSettled([
          deliverables.cultureAssessment ? Promise.resolve(null) : synthesizeCultureAssessment(businessPacket, job.questionnaire),
          deliverables.ipPortfolio ? Promise.resolve(null) : synthesizeIPPortfolio(businessPacket, job.questionnaire),
        ]);
        if (ca.status === "fulfilled" && ca.value) deliverables = { ...deliverables, cultureAssessment: ca.value };
        if (ipp.status === "fulfilled" && ipp.value) deliverables = { ...deliverables, ipPortfolio: ipp.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] CultureAssessment/IPPortfolio failed (non-fatal):", e);
      }
    }

    // ── Step 4t: Wave 8 intelligence (exit readiness, sustainability score) ──
    if (!deliverables.exitReadiness || !deliverables.sustainabilityScore) {
      try {
        console.log("[Pivot] Synthesizing exit readiness + sustainability score...");
        const [er, ss] = await Promise.allSettled([
          deliverables.exitReadiness ? Promise.resolve(null) : synthesizeExitReadiness(businessPacket, job.questionnaire),
          deliverables.sustainabilityScore ? Promise.resolve(null) : synthesizeSustainabilityScore(businessPacket, job.questionnaire),
        ]);
        if (er.status === "fulfilled" && er.value) deliverables = { ...deliverables, exitReadiness: er.value };
        if (ss.status === "fulfilled" && ss.value) deliverables = { ...deliverables, sustainabilityScore: ss.value };
        updateJob(runId, { deliverables });
      } catch (e) {
        console.warn("[Pivot] ExitReadiness/SustainabilityScore failed (non-fatal):", e);
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
