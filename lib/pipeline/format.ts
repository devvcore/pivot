import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type {
  MVPDeliverables,
  MarketIntelligence,
  WebsiteAnalysis,
  CompetitorAnalysis,
  TechOptimization,
  PricingIntelligence,
  MarketingStrategyReport,
  PitchDeckAnalysis,
} from "@/lib/types";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

export async function formatAndSave(runId: string, deliverables: MVPDeliverables): Promise<void> {
  const dir = path.join(UPLOADS_ROOT, runId);
  await mkdir(dir, { recursive: true });

  const [pdfBuf, docxBuf] = await Promise.all([
    buildPDF(deliverables),
    buildDOCX(deliverables),
  ]);

  await Promise.all([
    writeFile(path.join(dir, "report.pdf"), pdfBuf),
    writeFile(path.join(dir, "report.docx"), docxBuf),
  ]);
}

// ── PDF Builder ────────────────────────────────────────────────────────────────

interface PageState {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
  margin: number;
  pageWidth: number;
  pageHeight: number;
}

function sanitizePdfText(input: string): string {
  return input
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ")
    // Keep WinAnsi-safe range and common whitespace.
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

async function buildPDF(d: MVPDeliverables): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;

  const state: PageState = {
    doc,
    font,
    bold,
    page: doc.addPage([pageWidth, pageHeight]),
    y: pageHeight - margin,
    margin,
    pageWidth,
    pageHeight,
  };

  const newPage = () => {
    state.page = doc.addPage([pageWidth, pageHeight]);
    state.y = pageHeight - margin;
  };

  const ensureSpace = (needed: number) => {
    if (state.y < state.margin + needed) newPage();
  };

  const addText = (
    text: string,
    size = 10,
    isBold = false,
    color = rgb(0.1, 0.1, 0.1),
    indent = 0
  ) => {
    ensureSpace(size + 4);
    const f = isBold ? bold : font;
    // Truncate very long lines to fit page
    const maxWidth = state.pageWidth - state.margin * 2 - indent;
    const charLimit = Math.floor(maxWidth / (size * 0.55));
    const safeText = sanitizePdfText(text);
    const line = safeText.length > charLimit ? safeText.slice(0, charLimit - 3) + "..." : safeText;
    state.page.drawText(line, {
      x: state.margin + indent,
      y: state.y,
      size,
      font: f,
      color,
    });
    state.y -= size + 4;
  };

  const addWrappedText = (text: string, size = 9, indent = 0, maxLines = 4) => {
    const safeText = sanitizePdfText(text);
    const maxWidth = state.pageWidth - state.margin * 2 - indent;
    const charsPerLine = Math.floor(maxWidth / (size * 0.55));
    const words = safeText.split(" ");
    let line = "";
    let lineCount = 0;
    for (const word of words) {
      if (lineCount >= maxLines) {
        addText(line.trim() + (lineCount < maxLines ? "" : "..."), size, false, rgb(0.3, 0.3, 0.3), indent);
        break;
      }
      if ((line + " " + word).trim().length > charsPerLine) {
        addText(line.trim(), size, false, rgb(0.3, 0.3, 0.3), indent);
        line = word;
        lineCount++;
      } else {
        line = line ? line + " " + word : word;
      }
    }
    if (line.trim() && lineCount < maxLines) {
      addText(line.trim(), size, false, rgb(0.3, 0.3, 0.3), indent);
    }
  };

  const sectionHeader = (num: string, title: string) => {
    state.y -= 8;
    ensureSpace(30);
    // Draw accent bar
    state.page.drawRectangle({
      x: state.margin,
      y: state.y - 2,
      width: 4,
      height: 18,
      color: rgb(0.1, 0.1, 0.1),
    });
    addText(`${num}  ${title}`, 13, true, rgb(0.05, 0.05, 0.05), 10);
    state.y -= 4;
  };

  const divider = () => {
    state.page.drawLine({
      start: { x: state.margin, y: state.y },
      end: { x: state.pageWidth - state.margin, y: state.y },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    state.y -= 8;
  };

  // ── Cover Page ──
  state.y = pageHeight - 120;
  addText("PIVOT", 28, true, rgb(0.05, 0.05, 0.05));
  addText("Business Intelligence Report", 14, false, rgb(0.4, 0.4, 0.4));
  state.y -= 12;
  addText(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 9, false, rgb(0.5, 0.5, 0.5));
  addText("CONFIDENTIAL — For Internal Use Only", 9, false, rgb(0.7, 0.3, 0.3));
  state.y -= 20;
  divider();

  // ── 1. Health Score ──
  newPage();
  sectionHeader("01", "Business Health Score");
  addText(`Overall Score: ${d.healthScore.score}/100${d.healthScore.grade ? `  (Grade: ${d.healthScore.grade})` : ""}`, 12, true);
  if (d.healthScore.headline) addWrappedText(d.healthScore.headline, 10, 0, 2);
  if (d.healthScore.summary) addWrappedText(d.healthScore.summary, 9, 0, 3);
  state.y -= 6;
  addText("Dimensions:", 10, true);
  for (const dim of d.healthScore.dimensions || []) {
    addText(`  ${dim.name}: ${dim.score}/100${dim.grade ? ` (${dim.grade})` : ""}`, 9, false);
    if (dim.keyFinding || dim.driver) {
      addWrappedText(`  → ${dim.keyFinding || dim.driver}`, 8, 10, 2);
    }
  }

  // ── 2. Cash Intelligence ──
  newPage();
  sectionHeader("02", "Cash Intelligence Report (13-Week)");
  if (d.cashIntelligence.runwayWeeks != null) {
    addText(`Runway: ${d.cashIntelligence.runwayWeeks} weeks`, 10, true);
  }
  addWrappedText(d.cashIntelligence.summary, 9, 0, 4);
  state.y -= 6;
  if ((d.cashIntelligence.topRisks || []).length > 0) {
    addText("Top Cash Risks:", 10, true);
    for (const r of (d.cashIntelligence.topRisks || []).slice(0, 3)) {
      addWrappedText(`• ${r}`, 8, 8, 2);
    }
  } else if ((d.cashIntelligence.risks || []).length > 0) {
    addText("Priority Risks:", 10, true);
    for (const r of (d.cashIntelligence.risks || []).slice(0, 3)) {
      addWrappedText(`• ${r.description}`, 8, 8, 2);
    }
  }
  state.y -= 6;
  addText("Recommended Actions:", 10, true);
  for (const rec of (d.cashIntelligence.recommendations || []).slice(0, 4)) {
    addWrappedText(`→ ${rec}`, 8, 8, 2);
  }

  // ── 3. Revenue Leak Analysis ──
  newPage();
  const total = d.revenueLeakAnalysis.totalRecoverable ?? d.revenueLeakAnalysis.totalIdentified ?? 0;
  sectionHeader("03", `Revenue Leak Analysis — $${total.toLocaleString()} Recoverable`);
  if (d.revenueLeakAnalysis.day90RecoveryProjection) {
    addText(`90-Day Recovery Projection: $${d.revenueLeakAnalysis.day90RecoveryProjection.toLocaleString()}`, 9, true);
  }
  if (d.revenueLeakAnalysis.priorityAction) {
    addWrappedText(`Priority: ${d.revenueLeakAnalysis.priorityAction}`, 9, 0, 2);
  }
  addWrappedText(d.revenueLeakAnalysis.summary, 9, 0, 3);
  state.y -= 6;
  for (const item of (d.revenueLeakAnalysis.items || []).slice(0, 8)) {
    const amt = item.annualImpact ?? item.amount ?? 0;
    const conf = item.confidence ? ` [${item.confidence}]` : "";
    addText(`  #${item.rank ?? ""} ${item.category || ""}${conf}: $${amt.toLocaleString()}`, 9, false);
    addWrappedText(`  ${item.description}`, 8, 10, 2);
    if (item.recoveryPlan || item.rootCause) {
      addWrappedText(`  → ${item.recoveryPlan || item.rootCause}`, 8, 14, 1);
    }
  }

  // ── 4. Issues Register ──
  newPage();
  const totalExp = d.issuesRegister.totalFinancialExposure;
  sectionHeader("04", `Issues Register — ${d.issuesRegister.totalIssues ?? (d.issuesRegister.issues || []).length} Issues`);
  if (d.issuesRegister.criticalCount != null) {
    addText(`Critical: ${d.issuesRegister.criticalCount}  |  High: ${d.issuesRegister.highCount ?? 0}${totalExp ? `  |  Total Exposure: $${totalExp.toLocaleString()}` : ""}`, 9, true);
  }
  state.y -= 4;
  for (const iss of (d.issuesRegister.issues || []).slice(0, 12)) {
    const sev = iss.severity;
    const sevColor = (sev === "Critical" || sev === "HIGH")
      ? rgb(0.8, 0.1, 0.1)
      : (sev === "High" || sev === "MED")
      ? rgb(0.85, 0.45, 0)
      : rgb(0.5, 0.5, 0.5);
    addText(`  ${iss.id}${iss.title ? ` · ${iss.title}` : ""}  [${sev}]${iss.timeToImpact ? ` — ${iss.timeToImpact}` : ""}`, 9, true, sevColor);
    addWrappedText(`  ${iss.description}`, 8, 10, 2);
    if (iss.recommendedAction) addWrappedText(`  → ${iss.recommendedAction}`, 8, 14, 1);
    state.y -= 2;
  }

  // ── 5. At-Risk Customers ──
  newPage();
  const riskTotal = d.atRiskCustomers.totalRevenueAtRisk;
  sectionHeader("05", `At-Risk Customers${riskTotal ? ` — $${riskTotal.toLocaleString()} at Risk` : ""}`);
  if (d.atRiskCustomers.immediateAction) {
    addWrappedText(`Immediate Action: ${d.atRiskCustomers.immediateAction}`, 9, 0, 2);
  }
  if (d.atRiskCustomers.summary) addWrappedText(d.atRiskCustomers.summary, 9, 0, 2);
  state.y -= 6;
  for (const c of (d.atRiskCustomers.customers || [])) {
    addText(`  ${c.name}${c.riskScore != null ? ` — Risk Score: ${c.riskScore}/100` : ""}${c.churnProbability ? ` (${c.churnProbability} Risk)` : ""}`, 10, true);
    if (c.revenueAtRisk) addText(`  Annual Revenue at Risk: $${c.revenueAtRisk.toLocaleString()}`, 9, false);
    for (const sig of (c.warningSignals || []).slice(0, 3)) {
      addWrappedText(`  ⚠ ${sig}`, 8, 8, 1);
    }
    addWrappedText(`  → ${c.recommendation}`, 8, 8, 2);
    state.y -= 4;
  }

  // ── 6. Decision Brief ──
  newPage();
  sectionHeader("06", "First Decision Brief");
  addText(`Decision: ${d.decisionBrief.decision}`, 10, true);
  addWrappedText(d.decisionBrief.context, 9, 0, 3);
  state.y -= 6;
  for (const opt of (d.decisionBrief.options || [])) {
    const rec = opt.recommendation ? " ★ RECOMMENDED" : "";
    addText(`  Option: ${opt.label}${rec}`, 9, true);
    addWrappedText(`  Expected: ${opt.expectedOutcome || opt.outcome}`, 8, 10, 2);
    if (opt.pros?.length) addWrappedText(`  Pros: ${opt.pros.join("; ")}`, 8, 10, 1);
    if (opt.cons?.length) addWrappedText(`  Cons: ${opt.cons.join("; ")}`, 8, 10, 1);
    state.y -= 4;
  }
  state.y -= 4;
  addText("Recommendation:", 10, true);
  addWrappedText(d.decisionBrief.recommendation, 9, 0, 3);
  if (d.decisionBrief.rationale) {
    addText("Rationale:", 9, true);
    addWrappedText(d.decisionBrief.rationale, 8, 0, 3);
  }
  if (d.decisionBrief.nextStep) addWrappedText(`Next Step: ${d.decisionBrief.nextStep}`, 9, 0, 2);
  if (d.decisionBrief.deadlineSuggestion) addWrappedText(`Decide by: ${d.decisionBrief.deadlineSuggestion}`, 9, 0, 2);

  // ── 7. Action Plan ──
  newPage();
  sectionHeader("07", "Strategic Action Plan");
  addWrappedText(d.actionPlan.summary, 9, 0, 3);
  state.y -= 6;
  for (const day of (d.actionPlan.days || [])) {
    addText(`  Day ${day.day}: ${day.title}`, 10, true);
    for (const task of day.tasks) {
      addWrappedText(`  • ${task.description} (${task.owner})`, 8, 10, 2);
    }
    state.y -= 4;
  }

  // ── 8. Growth Intelligence ──
  if (d.marketIntelligence) {
    newPage();
    const mi = d.marketIntelligence;
    sectionHeader("08", "Growth Intelligence & Market Opportunities");
    if (mi.searchPowered) addText("  ✓ Powered by real-time market research", 8, false, rgb(0.1, 0.5, 0.1));
    addWrappedText(mi.industryContext, 9, 0, 3);
    state.y -= 6;

    if ((mi.lowHangingFruit || []).length > 0) {
      addText("Low-Hanging Fruit Opportunities:", 10, true);
      for (const lhf of (mi.lowHangingFruit || []).slice(0, 4)) {
        addText(`  ${lhf.rank}. ${lhf.opportunity} [${lhf.effort} effort] — ${lhf.monthlyRevenuePotential}/mo`, 9, false);
        addWrappedText(`  ${lhf.whyThisBusiness}`, 8, 10, 2);
      }
      state.y -= 4;
    }

    if ((mi.pivotOpportunities || []).length > 0) {
      addText("Pivot Opportunities:", 10, true);
      for (const pivot of (mi.pivotOpportunities || []).slice(0, 3)) {
        addText(`  ${pivot.rank}. ${pivot.direction} — ${pivot.startupCost}`, 9, false);
        addWrappedText(`  ${pivot.whySuited}`, 8, 10, 2);
        addWrappedText(`  Risk: ${pivot.risk}`, 8, 10, 1);
      }
      state.y -= 4;
    }

    if ((mi.quickWins || []).length > 0) {
      addText("Quick Wins (by timeline):", 10, true);
      for (const qw of (mi.quickWins || []).slice(0, 5)) {
        addText(`  ${qw.rank}. ${qw.action} [${qw.timeline}] — ${qw.expectedCashImpact}`, 9, false);
        addWrappedText(`  ${qw.instructions}`, 8, 10, 2);
      }
      state.y -= 4;
    }

    if (mi.urgentOpportunity) {
      addText("Urgent Opportunity:", 10, true, rgb(0.7, 0.2, 0.1));
      addWrappedText(mi.urgentOpportunity, 9, 0, 3);
    }

    if (mi.competitiveIntelligence) {
      addText("Competitive Intelligence:", 10, true);
      addWrappedText(mi.competitiveIntelligence, 9, 0, 3);
    }
  }

  // ── 9. Website Analysis ──
  if (d.websiteAnalysis) {
    newPage();
    sectionHeader("09", `Website Analysis - Grade ${d.websiteAnalysis.grade}`);
    addText(`Score: ${d.websiteAnalysis.score}/100  |  URL: ${d.websiteAnalysis.url}`, 10, true);
    if (d.websiteAnalysis.synopsis) addWrappedText(d.websiteAnalysis.synopsis, 9, 0, 3);
    state.y -= 6;
    addText("Actual Offer:", 9, true);
    addWrappedText(d.websiteAnalysis.actualOffer, 8, 8, 2);
    addText("Perceived Offer:", 9, true);
    addWrappedText(d.websiteAnalysis.perceivedOffer, 8, 8, 2);
    addText("Offer Gap:", 9, true, rgb(0.8, 0.4, 0));
    addWrappedText(d.websiteAnalysis.offerGap, 8, 8, 2);
    addText("Suggested Headline:", 9, true);
    addWrappedText(`"${d.websiteAnalysis.suggestedHeadline}"`, 9, 8, 2);
    if (d.websiteAnalysis.topIssues?.length) {
      addText("Top Issues:", 9, true);
      for (const issue of d.websiteAnalysis.topIssues.slice(0, 5)) {
        addWrappedText(`  * ${issue}`, 8, 8, 2);
      }
    }
    if (d.websiteAnalysis.recommendations?.length) {
      addText("Recommendations:", 9, true);
      for (const rec of d.websiteAnalysis.recommendations.slice(0, 5)) {
        addWrappedText(`  -> ${rec}`, 8, 8, 2);
      }
    }
    addText("Marketing Direction:", 9, true);
    addWrappedText(d.websiteAnalysis.marketingDirection, 8, 8, 2);
    addText("CTA Assessment:", 9, true);
    addWrappedText(d.websiteAnalysis.ctaAssessment, 8, 8, 2);
  }

  // ── 10. Competitor Analysis ──
  if (d.competitorAnalysis) {
    newPage();
    sectionHeader("10", "Competitor & Market Positioning");
    addText("Suggested Positioning:", 10, true);
    addWrappedText(d.competitorAnalysis.suggestedPositioning, 9, 0, 3);
    addText("Differentiation Opportunity:", 9, true);
    addWrappedText(d.competitorAnalysis.differentiationOpportunity, 8, 8, 2);
    if (d.competitorAnalysis.headlineComparison) {
      state.y -= 6;
      addText("Headline Comparison:", 10, true);
      if (d.competitorAnalysis.headlineComparison.current) {
        addWrappedText(`Current: "${d.competitorAnalysis.headlineComparison.current}"`, 8, 8, 1);
      }
      addWrappedText(`Leaders: "${d.competitorAnalysis.headlineComparison.theirs}"`, 8, 8, 1);
      addWrappedText(`Suggested: "${d.competitorAnalysis.headlineComparison.suggested}"`, 8, 8, 1);
    }
    if (d.competitorAnalysis.repositioningRecommendations?.length) {
      state.y -= 6;
      addText("Repositioning Recommendations:", 10, true);
      for (const rec of d.competitorAnalysis.repositioningRecommendations) {
        addText(`  ${rec.rank}. ${rec.recommendation}`, 9, false);
        addWrappedText(`     ${rec.rationale}`, 8, 10, 2);
      }
    }
    const allComps = [...d.competitorAnalysis.competitors, ...d.competitorAnalysis.industryLeaders];
    if (allComps.length) {
      state.y -= 6;
      addText("Competitive Landscape:", 10, true);
      for (const c of allComps.slice(0, 6)) {
        addText(`  ${c.name}${c.isIndustryLeader ? " (Leader)" : ""} - Grade ${c.websiteGrade ?? "N/A"}`, 9, true);
        addWrappedText(`  ${c.offer}`, 8, 10, 1);
      }
    }
  }

  // ── 11. Tech Optimization ──
  if (d.techOptimization) {
    newPage();
    sectionHeader("11", "Tech Cost Optimization");
    if (d.techOptimization.potentialSavings) {
      addText(`Potential Monthly Savings: $${d.techOptimization.potentialSavings.toLocaleString()}`, 10, true, rgb(0.1, 0.5, 0.1));
    }
    if (d.techOptimization.currentEstimatedMonthlyCost) {
      addText(`Current Tech Cost: $${d.techOptimization.currentEstimatedMonthlyCost.toLocaleString()}/mo`, 9, false);
    }
    addWrappedText(d.techOptimization.summary, 9, 0, 3);
    state.y -= 6;
    for (const rec of d.techOptimization.recommendations ?? []) {
      addText(`  ${rec.rank}. ${rec.currentTool} -> ${rec.suggestedAlternative} [${rec.migrationEffort} effort]`, 9, true);
      addWrappedText(`     ${rec.rationale}`, 8, 10, 2);
      addText(`     Save: ${rec.estimatedSaving}`, 8, false, rgb(0.1, 0.5, 0.1));
    }
  }

  // ── 12. Pricing Intelligence ──
  if (d.pricingIntelligence) {
    newPage();
    sectionHeader("12", "Pricing Intelligence");
    addText("Current Assessment:", 10, true);
    addWrappedText(d.pricingIntelligence.currentPricingAssessment, 9, 0, 3);
    if (d.pricingIntelligence.suggestedPricing?.length) {
      state.y -= 6;
      addText("Recommended Pricing Tiers:", 10, true);
      for (const tier of d.pricingIntelligence.suggestedPricing) {
        addText(`  ${tier.tier}: ${tier.range}`, 9, true);
        addWrappedText(`  Target: ${tier.targetSegment}`, 8, 10, 1);
        addWrappedText(`  ${tier.rationale}`, 8, 10, 2);
      }
    }
    if (d.pricingIntelligence.competitivePosition) {
      state.y -= 4;
      addText("Competitive Position:", 9, true);
      addWrappedText(d.pricingIntelligence.competitivePosition, 8, 8, 2);
    }
    if (d.pricingIntelligence.marginOptimization) {
      addText("Margin Optimization:", 9, true);
      addWrappedText(d.pricingIntelligence.marginOptimization, 8, 8, 2);
    }
    addWrappedText(d.pricingIntelligence.summary, 9, 0, 3);
  }

  // ── 13. Marketing Strategy ──
  if (d.marketingStrategy) {
    newPage();
    sectionHeader("13", "Marketing Intelligence");
    addWrappedText(d.marketingStrategy.summary, 9, 0, 3);
    if (d.marketingStrategy.currentChannels?.length) {
      addText(`Current Channels: ${d.marketingStrategy.currentChannels.join(", ")}`, 9, false);
    }
    if (d.marketingStrategy.channelRecommendations?.length) {
      state.y -= 6;
      addText("Top Channel Recommendations:", 10, true);
      for (const rec of d.marketingStrategy.channelRecommendations) {
        addText(`  ${rec.rank}. ${rec.channel} [${rec.effort} effort]`, 9, true);
        addWrappedText(`     ${rec.why}`, 8, 10, 2);
        addWrappedText(`     Impact: ${rec.expectedImpact}`, 8, 10, 1);
      }
    }
    if (d.marketingStrategy.socialMediaStrategy?.length) {
      state.y -= 6;
      addText("Social Media Audit:", 10, true);
      for (const s of d.marketingStrategy.socialMediaStrategy) {
        addText(`  ${s.platform} - Grade: ${s.currentGrade ?? "N/A"} vs Competitor: ${s.vsCompetitorGrade ?? "N/A"}`, 9, true);
        for (const imp of (s.improvements ?? []).slice(0, 2)) {
          addWrappedText(`  * ${imp}`, 8, 10, 1);
        }
      }
    }
    if (d.marketingStrategy.websiteCopyRecommendations?.length) {
      state.y -= 6;
      addText("Website Copy Changes:", 10, true);
      for (const rec of d.marketingStrategy.websiteCopyRecommendations) {
        addText(`  ${rec.section}:`, 9, true);
        addWrappedText(`  Current: ${rec.current}`, 8, 10, 1);
        addWrappedText(`  Suggested: ${rec.suggested}`, 8, 10, 1);
      }
    }
    if (d.marketingStrategy.offerPositioning) {
      state.y -= 6;
      addText("Offer Positioning:", 10, true);
      addWrappedText(`Current: ${d.marketingStrategy.offerPositioning.currentPositioning}`, 8, 8, 2);
      addWrappedText(`Recommended: ${d.marketingStrategy.offerPositioning.suggestedRepositioning}`, 8, 8, 2);
    }
    if (d.marketingStrategy.contentStrategy) {
      addText("Content Strategy:", 9, true);
      addWrappedText(d.marketingStrategy.contentStrategy, 8, 8, 3);
    }
    if (d.marketingStrategy.adSpendRecommendation) {
      addText("Ad Spend:", 9, true);
      addWrappedText(d.marketingStrategy.adSpendRecommendation, 8, 8, 2);
    }
  }

  // ── Section 14: Pitch Deck Analysis ───────────────────────────────────
  if (d.pitchDeckAnalysis) {
    const pd = d.pitchDeckAnalysis;
    sectionHeader("14", `Pitch Deck Review — ${pd.fileName}`);
    addText(`Score: ${pd.overallScore}/100 (Grade: ${pd.overallGrade})`, 12, true);
    state.y -= 4;
    addWrappedText(pd.headline, 10, 8, 2);

    if (pd.strengths.length) {
      addText("Strengths:", 10, true);
      for (const s of pd.strengths) addWrappedText(`  + ${s}`, 8, 10, 1);
    }
    if (pd.weaknesses.length) {
      state.y -= 4;
      addText("Weaknesses:", 10, true);
      for (const w of pd.weaknesses) addWrappedText(`  - ${w}`, 8, 10, 1);
    }
    if (pd.missingSlides.length) {
      state.y -= 4;
      addText("Missing Essential Slides:", 10, true);
      addWrappedText(pd.missingSlides.join(", "), 8, 8, 2);
    }
    if (pd.recommendations.length) {
      state.y -= 4;
      addText("Recommendations:", 10, true);
      for (const rec of pd.recommendations) {
        addText(`  ${rec.rank}. ${rec.area}`, 9, true);
        addWrappedText(`  Current: ${rec.current}`, 8, 10, 1);
        addWrappedText(`  Suggested: ${rec.suggested}`, 8, 10, 1);
        addWrappedText(`  Why: ${rec.rationale}`, 8, 10, 1);
      }
    }
    if (pd.suggestedInfographics.length) {
      state.y -= 4;
      addText("Suggested Visuals:", 10, true);
      for (const info of pd.suggestedInfographics) {
        addWrappedText(`  ${info.slide} — ${info.type}: ${info.description}`, 8, 10, 1);
      }
    }
    if (pd.positioningAdvice) {
      state.y -= 4;
      addText("Positioning Strategy:", 10, true);
      addWrappedText(pd.positioningAdvice, 8, 8, 3);
    }
  }

  return doc.save();
}

// ── DOCX Builder ───────────────────────────────────────────────────────────────

async function buildDOCX(d: MVPDeliverables): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: "PIVOT — Business Intelligence Report",
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),

    // 1. Health Score
    new Paragraph({ text: "01 · Business Health Score", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [
        new TextRun({ text: `Overall: ${d.healthScore.score}/100`, bold: true }),
        d.healthScore.grade ? new TextRun({ text: `  Grade: ${d.healthScore.grade}` }) : new TextRun(""),
      ],
    }),
    ...(d.healthScore.headline ? [new Paragraph({ text: d.healthScore.headline })] : []),
    ...(d.healthScore.summary ? [new Paragraph({ text: d.healthScore.summary })] : []),
    ...(d.healthScore.dimensions ?? []).map(
      (dim) => new Paragraph({
        text: `  ${dim.name}: ${dim.score}${dim.grade ? ` (${dim.grade})` : ""} — ${dim.keyFinding || dim.driver || ""}`,
        spacing: { before: 0, after: 0 },
      })
    ),

    // 2. Cash Intelligence
    new Paragraph({ text: "02 · Cash Intelligence Report", heading: HeadingLevel.HEADING_1 }),
    ...(d.cashIntelligence.runwayWeeks != null ? [new Paragraph({ children: [new TextRun({ text: `Runway: ${d.cashIntelligence.runwayWeeks} weeks`, bold: true })] })] : []),
    new Paragraph({ text: d.cashIntelligence.summary }),
    ...(d.cashIntelligence.topRisks ?? d.cashIntelligence.risks.map((r) => r.description) ?? []).slice(0, 3).map(
      (r) => new Paragraph({ text: `• ${r}`, bullet: { level: 0 } })
    ),
    ...(d.cashIntelligence.recommendations ?? []).slice(0, 4).map(
      (r) => new Paragraph({ text: `→ ${r}`, bullet: { level: 0 } })
    ),

    // 3. Revenue Leak Analysis
    new Paragraph({ text: "03 · Revenue Leak Analysis", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `Total Recoverable: $${((d.revenueLeakAnalysis.totalRecoverable ?? d.revenueLeakAnalysis.totalIdentified) || 0).toLocaleString()}` }),
    new Paragraph({ text: d.revenueLeakAnalysis.summary }),
    ...(d.revenueLeakAnalysis.items ?? []).slice(0, 8).map(
      (i) => new Paragraph({ text: `  #${i.rank ?? ""} ${i.description}: $${(i.annualImpact ?? i.amount ?? 0).toLocaleString()}`, bullet: { level: 0 } })
    ),

    // 4. Issues Register
    new Paragraph({ text: "04 · Issues Register", heading: HeadingLevel.HEADING_1 }),
    ...(d.issuesRegister.issues ?? []).slice(0, 15).map(
      (i) => new Paragraph({ text: `[${i.severity}] ${i.id}${i.title ? ` · ${i.title}` : ""}: ${i.description}${i.financialImpact != null ? ` ($${i.financialImpact.toLocaleString()})` : ""}` })
    ),

    // 5. At-Risk Customers
    new Paragraph({ text: "05 · At-Risk Customers", heading: HeadingLevel.HEADING_1 }),
    ...(d.atRiskCustomers.summary ? [new Paragraph({ text: d.atRiskCustomers.summary })] : []),
    ...(d.atRiskCustomers.customers ?? []).flatMap((c) => [
      new Paragraph({ children: [new TextRun({ text: `${c.name} — Risk Score: ${c.riskScore ?? "N/A"}/100`, bold: true })] }),
      new Paragraph({ text: c.recommendation }),
    ]),

    // 6. Decision Brief
    new Paragraph({ text: "06 · First Decision Brief", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: `Decision: ${d.decisionBrief.decision}`, bold: true })] }),
    new Paragraph({ text: d.decisionBrief.context }),
    ...(d.decisionBrief.options ?? []).map(
      (o) => new Paragraph({ text: `${o.recommendation ? "★ " : ""}${o.label}: ${o.expectedOutcome || o.outcome}` })
    ),
    new Paragraph({ children: [new TextRun({ text: `Recommendation: ${d.decisionBrief.recommendation}`, bold: true })] }),
    ...(d.decisionBrief.rationale ? [new Paragraph({ text: `Rationale: ${d.decisionBrief.rationale}` })] : []),
    ...(d.decisionBrief.nextStep ? [new Paragraph({ text: `Next Step: ${d.decisionBrief.nextStep}` })] : []),

    // 7. Action Plan
    new Paragraph({ text: "07 · Strategic Action Plan", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: d.actionPlan.summary }),
    ...(d.actionPlan.days ?? []).flatMap((day) => [
      new Paragraph({ children: [new TextRun({ text: `Day ${day.day}: ${day.title}`, bold: true })] }),
      ...day.tasks.map((t) => new Paragraph({ text: `• ${t.description} (${t.owner})`, bullet: { level: 0 } })),
    ]),

    // 8. Growth Intelligence
    ...(d.marketIntelligence ? buildGrowthIntelDOCX(d.marketIntelligence) : []),

    // 9-13. Additional deliverables
    ...(d.websiteAnalysis ? buildWebsiteAnalysisDOCX(d.websiteAnalysis) : []),
    ...(d.competitorAnalysis ? buildCompetitorAnalysisDOCX(d.competitorAnalysis) : []),
    ...(d.techOptimization ? buildTechOptimizationDOCX(d.techOptimization) : []),
    ...(d.pricingIntelligence ? buildPricingIntelligenceDOCX(d.pricingIntelligence) : []),
    ...(d.marketingStrategy ? buildMarketingStrategyDOCX(d.marketingStrategy) : []),
    ...(d.pitchDeckAnalysis ? buildPitchDeckDOCX(d.pitchDeckAnalysis) : []),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

function buildGrowthIntelDOCX(mi: MarketIntelligence): Paragraph[] {
  return [
    new Paragraph({ text: "08 · Growth Intelligence & Market Opportunities", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `Industry: ${mi.industry}${mi.searchPowered ? " (Search-powered)" : ""}` }),
    new Paragraph({ text: mi.industryContext }),

    new Paragraph({ children: [new TextRun({ text: "Low-Hanging Fruit Opportunities", bold: true })] }),
    ...(mi.lowHangingFruit ?? []).slice(0, 4).map((lhf) =>
      new Paragraph({ text: `${lhf.rank}. ${lhf.opportunity} [${lhf.effort}] — ${lhf.monthlyRevenuePotential}/mo: ${lhf.whyThisBusiness}`, bullet: { level: 0 } })
    ),

    new Paragraph({ children: [new TextRun({ text: "Pivot Opportunities", bold: true })] }),
    ...(mi.pivotOpportunities ?? []).slice(0, 3).map((p) =>
      new Paragraph({ text: `${p.rank}. ${p.direction} (${p.startupCost}): ${p.whySuited}`, bullet: { level: 0 } })
    ),

    new Paragraph({ children: [new TextRun({ text: "Quick Wins", bold: true })] }),
    ...(mi.quickWins ?? []).slice(0, 5).map((qw) =>
      new Paragraph({ text: `${qw.rank}. ${qw.action} [${qw.timeline}]: ${qw.instructions}`, bullet: { level: 0 } })
    ),

    new Paragraph({ children: [new TextRun({ text: "Urgent Opportunity", bold: true })] }),
    new Paragraph({ text: mi.urgentOpportunity }),

    new Paragraph({ children: [new TextRun({ text: "Competitive Intelligence", bold: true })] }),
    new Paragraph({ text: mi.competitiveIntelligence }),
  ];
}

function buildWebsiteAnalysisDOCX(wa: WebsiteAnalysis): Paragraph[] {
  return [
    new Paragraph({ text: "09 · Website Analysis", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: `Grade: ${wa.grade} (${wa.score}/100)  |  ${wa.url}`, bold: true })] }),
    ...(wa.synopsis ? [new Paragraph({ text: wa.synopsis })] : []),
    new Paragraph({ children: [new TextRun({ text: "Actual Offer: ", bold: true }), new TextRun(wa.actualOffer)] }),
    new Paragraph({ children: [new TextRun({ text: "Perceived Offer: ", bold: true }), new TextRun(wa.perceivedOffer)] }),
    new Paragraph({ children: [new TextRun({ text: "Offer Gap: ", bold: true }), new TextRun(wa.offerGap)] }),
    new Paragraph({ children: [new TextRun({ text: "Suggested Headline: ", bold: true }), new TextRun(`"${wa.suggestedHeadline}"`)] }),
    new Paragraph({ children: [new TextRun({ text: "CTA Assessment: ", bold: true }), new TextRun(wa.ctaAssessment)] }),
    new Paragraph({ children: [new TextRun({ text: "Marketing Direction: ", bold: true }), new TextRun(wa.marketingDirection)] }),
    ...(wa.topIssues ?? []).map((i) => new Paragraph({ text: `* ${i}`, bullet: { level: 0 } })),
    ...(wa.recommendations ?? []).map((r) => new Paragraph({ text: `-> ${r}`, bullet: { level: 0 } })),
  ];
}

function buildCompetitorAnalysisDOCX(ca: CompetitorAnalysis): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({ text: "10 · Competitor & Market Positioning", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: "Suggested Positioning: ", bold: true }), new TextRun(ca.suggestedPositioning)] }),
    new Paragraph({ children: [new TextRun({ text: "Differentiation: ", bold: true }), new TextRun(ca.differentiationOpportunity)] }),
  ];
  if (ca.headlineComparison) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Headline Comparison", bold: true })] }));
    if (ca.headlineComparison.current) paras.push(new Paragraph({ text: `Current: "${ca.headlineComparison.current}"` }));
    paras.push(new Paragraph({ text: `Leaders: "${ca.headlineComparison.theirs}"` }));
    paras.push(new Paragraph({ text: `Suggested: "${ca.headlineComparison.suggested}"` }));
  }
  for (const rec of ca.repositioningRecommendations ?? []) {
    paras.push(new Paragraph({ text: `${rec.rank}. ${rec.recommendation}: ${rec.rationale}`, bullet: { level: 0 } }));
  }
  for (const c of [...ca.competitors, ...ca.industryLeaders].slice(0, 6)) {
    paras.push(new Paragraph({ children: [new TextRun({ text: `${c.name}${c.isIndustryLeader ? " (Leader)" : ""}: `, bold: true }), new TextRun(c.offer)] }));
  }
  return paras;
}

function buildTechOptimizationDOCX(tech: TechOptimization): Paragraph[] {
  return [
    new Paragraph({ text: "11 · Tech Cost Optimization", heading: HeadingLevel.HEADING_1 }),
    ...(tech.potentialSavings ? [new Paragraph({ children: [new TextRun({ text: `Potential Monthly Savings: $${tech.potentialSavings.toLocaleString()}`, bold: true })] })] : []),
    ...(tech.currentEstimatedMonthlyCost ? [new Paragraph({ text: `Current Tech Cost: $${tech.currentEstimatedMonthlyCost.toLocaleString()}/mo` })] : []),
    new Paragraph({ text: tech.summary }),
    ...(tech.recommendations ?? []).map((r) =>
      new Paragraph({ text: `${r.rank}. ${r.currentTool} -> ${r.suggestedAlternative} [${r.migrationEffort}]: ${r.rationale} (Save: ${r.estimatedSaving})`, bullet: { level: 0 } })
    ),
  ];
}

function buildPricingIntelligenceDOCX(pi: PricingIntelligence): Paragraph[] {
  return [
    new Paragraph({ text: "12 · Pricing Intelligence", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: "Current Assessment: ", bold: true }), new TextRun(pi.currentPricingAssessment)] }),
    ...(pi.suggestedPricing ?? []).map((t) =>
      new Paragraph({ text: `${t.tier}: ${t.range} (${t.targetSegment}) — ${t.rationale}`, bullet: { level: 0 } })
    ),
    new Paragraph({ children: [new TextRun({ text: "Competitive Position: ", bold: true }), new TextRun(pi.competitivePosition)] }),
    new Paragraph({ children: [new TextRun({ text: "Margin Optimization: ", bold: true }), new TextRun(pi.marginOptimization)] }),
    new Paragraph({ text: pi.summary }),
  ];
}

function buildMarketingStrategyDOCX(ms: MarketingStrategyReport): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({ text: "13 · Marketing Intelligence", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: ms.summary }),
  ];
  if (ms.currentChannels?.length) {
    paras.push(new Paragraph({ text: `Current Channels: ${ms.currentChannels.join(", ")}` }));
  }
  if (ms.channelRecommendations?.length) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Channel Recommendations", bold: true })] }));
    for (const rec of ms.channelRecommendations) {
      paras.push(new Paragraph({ text: `${rec.rank}. ${rec.channel} [${rec.effort}]: ${rec.why} — Impact: ${rec.expectedImpact}`, bullet: { level: 0 } }));
    }
  }
  if (ms.socialMediaStrategy?.length) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Social Media Audit", bold: true })] }));
    for (const s of ms.socialMediaStrategy) {
      paras.push(new Paragraph({ text: `${s.platform}: Grade ${s.currentGrade ?? "N/A"} vs ${s.vsCompetitorGrade ?? "N/A"}` }));
      for (const imp of (s.improvements ?? []).slice(0, 3)) {
        paras.push(new Paragraph({ text: `* ${imp}`, bullet: { level: 0 } }));
      }
    }
  }
  if (ms.websiteCopyRecommendations?.length) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Website Copy Changes", bold: true })] }));
    for (const rec of ms.websiteCopyRecommendations) {
      paras.push(new Paragraph({ text: `${rec.section}: "${rec.current}" -> "${rec.suggested}" (${rec.rationale})` }));
    }
  }
  if (ms.offerPositioning) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Offer Positioning", bold: true })] }));
    paras.push(new Paragraph({ text: `Current: ${ms.offerPositioning.currentPositioning}` }));
    paras.push(new Paragraph({ text: `Recommended: ${ms.offerPositioning.suggestedRepositioning}` }));
  }
  if (ms.contentStrategy) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Content Strategy", bold: true })] }));
    paras.push(new Paragraph({ text: ms.contentStrategy }));
  }
  if (ms.adSpendRecommendation) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Ad Spend", bold: true })] }));
    paras.push(new Paragraph({ text: ms.adSpendRecommendation }));
  }
  return paras;
}

function buildPitchDeckDOCX(pd: PitchDeckAnalysis): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({ text: "14 · Pitch Deck Review", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `File: ${pd.fileName} | Score: ${pd.overallScore}/100 (Grade: ${pd.overallGrade})` }),
    new Paragraph({ text: pd.headline }),
  ];

  if (pd.strengths.length) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Strengths", bold: true })] }));
    for (const s of pd.strengths) {
      paras.push(new Paragraph({ text: `+ ${s}`, bullet: { level: 0 } }));
    }
  }
  if (pd.weaknesses.length) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Weaknesses", bold: true })] }));
    for (const w of pd.weaknesses) {
      paras.push(new Paragraph({ text: `- ${w}`, bullet: { level: 0 } }));
    }
  }
  if (pd.missingSlides.length) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Missing Essential Slides", bold: true })] }));
    paras.push(new Paragraph({ text: pd.missingSlides.join(", ") }));
  }
  if (pd.recommendations.length) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Improvement Recommendations", bold: true })] }));
    for (const rec of pd.recommendations) {
      paras.push(new Paragraph({ text: `${rec.rank}. ${rec.area}: "${rec.current}" -> "${rec.suggested}" (${rec.rationale})` }));
    }
  }
  if (pd.suggestedInfographics.length) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Suggested Visuals", bold: true })] }));
    for (const info of pd.suggestedInfographics) {
      paras.push(new Paragraph({ text: `${info.slide} - ${info.type}: ${info.description}`, bullet: { level: 0 } }));
    }
  }
  if (pd.positioningAdvice) {
    paras.push(new Paragraph({ children: [new TextRun({ text: "Positioning Strategy", bold: true })] }));
    paras.push(new Paragraph({ text: pd.positioningAdvice }));
  }
  return paras;
}

export function getReportPath(runId: string, format: "pdf" | "docx"): string {
  return path.join(UPLOADS_ROOT, runId, format === "pdf" ? "report.pdf" : "report.docx");
}
