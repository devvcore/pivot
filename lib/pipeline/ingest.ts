/**
 * Stage 1: Gemini Flash Lite Ingestion Agent
 *
 * Takes raw parsed document text + questionnaire.
 * Produces a lean BusinessPacket — structured, compressed intelligence
 * with NO raw text excerpts. Only extracted facts, metrics, and risks.
 *
 * This is what Stage 2 (Gemini Flash synthesis agents) receives.
 * Drastically reduces tokens vs passing raw KnowledgeGraph text.
 *
 * Flow:
 *   1. Per-document categorization + extraction (Lite, ~1K tokens each)
 *   2. Cross-document consolidation into BusinessPacket (Lite, 1 call)
 */
import { GoogleGenAI } from "@google/genai";
import type { ParsedFile } from "./parse";
import type { Questionnaire, BusinessPacket } from "@/lib/types";

const LITE_MODEL = "gemini-2.0-flash-lite";

const SCHEMA_CATEGORIES = [
  "Team Structure",
  "Compensation & HR",
  "Financial Position",
  "Revenue Model",
  "Customer Portfolio",
  "Operations",
  "Sales & Pipeline",
  "Market & Competition",
  "Strategy & Planning",
  "Risk & Compliance",
  "Other",
] as const;

// ── Per-document extraction ──────────────────────────────────────────────────

interface DocExtract {
  category: string;
  keyFacts: string[];
  criticalIssues: string[];
  financialAmounts: Record<string, number>;
}

async function extractDocument(
  genai: GoogleGenAI,
  filename: string,
  text: string
): Promise<DocExtract> {
  const excerpt = text.slice(0, 6000);
  const prompt = `You are a business intelligence extraction agent. Analyze this business document and extract ONLY concrete, specific facts.

Document: ${filename}
Content:
---
${excerpt}
---

Extract structured intelligence. Return valid JSON ONLY:
{
  "category": "<one of: ${SCHEMA_CATEGORIES.join(", ")}>",
  "keyFacts": ["<specific fact with numbers>", ...],
  "criticalIssues": ["<issue with financial impact if possible>", ...],
  "financialAmounts": {"<label>": <number>, ...}
}

Rules:
- keyFacts: max 8, must be specific (include names, amounts, dates)
- criticalIssues: max 5, problems/risks only
- financialAmounts: extract any dollar amounts mentioned (as raw numbers, no $ signs)
- Do NOT include generic observations or opinions`;

  try {
    const resp = await genai.models.generateContent({
      model: LITE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 1200,
      } as Record<string, unknown>,
    });
    const raw = resp.text ?? "{}";
    return JSON.parse(raw) as DocExtract;
  } catch {
    return {
      category: guessCategory(filename),
      keyFacts: [],
      criticalIssues: [],
      financialAmounts: {},
    };
  }
}

// ── Cross-document consolidation ─────────────────────────────────────────────

async function consolidateToPacket(
  genai: GoogleGenAI,
  extracts: { filename: string; extract: DocExtract }[],
  questionnaire: Questionnaire
): Promise<Omit<BusinessPacket, "questionnaire" | "orgName" | "industry" | "location" | "website" | "documentCount">> {
  const context = extracts
    .map(
      ({ filename, extract }) =>
        `[${extract.category}] ${filename}\nFacts: ${extract.keyFacts.join("; ")}\nIssues: ${extract.criticalIssues.join("; ")}\nAmounts: ${JSON.stringify(extract.financialAmounts)}`
    )
    .join("\n\n");

  const prompt = `You are a business intelligence consolidation agent. Synthesize this extracted business data into a structured intelligence packet.

BUSINESS CONTEXT:
Company: ${questionnaire.organizationName}
Industry: ${questionnaire.industry}
Revenue Range: ${questionnaire.revenueRange}
Business Model: ${questionnaire.businessModel}
Key Concerns: ${questionnaire.keyConcerns}
Critical Decision: ${questionnaire.oneDecisionKeepingOwnerUpAtNight}
Key Customers: ${questionnaire.keyCustomers ?? "Not specified"}
Key Competitors: ${questionnaire.keyCompetitors ?? "Not specified"}

EXTRACTED DOCUMENT DATA:
${context}

Synthesize into a BusinessPacket. Return valid JSON ONLY:
{
  "keyMetrics": {
    "estimatedMonthlyRevenue": <number or null>,
    "estimatedMonthlyExpenses": <number or null>,
    "cashPosition": <number or null>,
    "cashRunwayWeeks": <number or null>,
    "employeeCount": <number or null>,
    "grossMarginPct": <number or null>,
    "topCustomers": ["<name>", ...],
    "topCompetitors": ["<name>", ...]
  },
  "categoryDossiers": [
    {
      "category": "<category name>",
      "keyFacts": ["<fact>", ...],
      "criticalIssues": ["<issue>", ...],
      "financialAmounts": {"<label>": <number>}
    }
  ],
  "consolidatedRisks": ["<specific risk with dollar impact if possible>", ...],
  "consolidatedOpportunities": ["<specific opportunity>", ...],
  "dataCoverage": {"<category>": true/false, ...}
}

Rules:
- consolidatedRisks: top 10 most critical risks across all documents
- consolidatedOpportunities: top 5 concrete opportunities
- categoryDossiers: only categories with actual data (skip empty ones)
- All numbers must be raw integers/floats (no currency symbols)`;

  try {
    const resp = await genai.models.generateContent({
      model: LITE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 3000,
      } as Record<string, unknown>,
    });
    const raw = resp.text ?? "{}";
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[Ingest] Consolidation failed:", e);
    // Fallback: assemble from raw extracts
    const dossiers = extracts.map(({ extract }) => ({
      category: extract.category,
      keyFacts: extract.keyFacts,
      criticalIssues: extract.criticalIssues,
      financialAmounts: extract.financialAmounts,
    }));
    return {
      keyMetrics: { topCustomers: [], topCompetitors: [] },
      categoryDossiers: dossiers,
      consolidatedRisks: extracts.flatMap((e) => e.extract.criticalIssues).slice(0, 10),
      consolidatedOpportunities: [],
      dataCoverage: {},
    };
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function ingestDocuments(
  parsedFiles: ParsedFile[],
  questionnaire: Questionnaire
): Promise<BusinessPacket> {
  const apiKey = process.env.GEMINI_API_KEY;
  const genai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  const extracts: { filename: string; extract: DocExtract }[] = [];

  for (const file of parsedFiles) {
    if (!file.text.trim()) {
      extracts.push({
        filename: file.filename,
        extract: {
          category: "Other",
          keyFacts: [],
          criticalIssues: [],
          financialAmounts: {},
        },
      });
      continue;
    }

    if (genai) {
      const extract = await extractDocument(genai, file.filename, file.text);
      extracts.push({ filename: file.filename, extract });
    } else {
      // No API key — basic fallback
      extracts.push({
        filename: file.filename,
        extract: {
          category: guessCategory(file.filename),
          keyFacts: [],
          criticalIssues: [],
          financialAmounts: {},
        },
      });
    }
  }

  let consolidated;
  if (genai) {
    consolidated = await consolidateToPacket(genai, extracts, questionnaire);
  } else {
    const dossiers = extracts.map(({ extract }) => ({
      category: extract.category,
      keyFacts: extract.keyFacts,
      criticalIssues: extract.criticalIssues,
      financialAmounts: extract.financialAmounts,
    }));
    consolidated = {
      keyMetrics: { topCustomers: [], topCompetitors: [] },
      categoryDossiers: dossiers,
      consolidatedRisks: [],
      consolidatedOpportunities: [],
      dataCoverage: {},
    };
  }

  return {
    orgName: questionnaire.organizationName,
    industry: questionnaire.industry,
    location: questionnaire.location,
    website: questionnaire.website,
    questionnaire,
    documentCount: parsedFiles.length,
    ...consolidated,
  } as BusinessPacket;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function guessCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("financial") || lower.includes("cash") || lower.includes("p&l") || lower.includes("balance")) return "Financial Position";
  if (lower.includes("customer") || lower.includes("client") || lower.includes("account")) return "Customer Portfolio";
  if (lower.includes("revenue") || lower.includes("sales") || lower.includes("invoice")) return "Revenue Model";
  if (lower.includes("team") || lower.includes("staff") || lower.includes("org")) return "Team Structure";
  if (lower.includes("hr") || lower.includes("payroll") || lower.includes("compensation")) return "Compensation & HR";
  if (lower.includes("strategy") || lower.includes("plan") || lower.includes("roadmap")) return "Strategy & Planning";
  if (lower.includes("risk") || lower.includes("compliance") || lower.includes("legal")) return "Risk & Compliance";
  if (lower.includes("market") || lower.includes("competitor")) return "Market & Competition";
  if (lower.includes("operation") || lower.includes("process")) return "Operations";
  return "Other";
}

// ── Format packet as prompt context (used by synthesize.ts) ─────────────────

export function formatPacketAsContext(packet: BusinessPacket): string {
  const q = packet.questionnaire;
  const m = packet.keyMetrics;

  const lines: string[] = [
    `BUSINESS: ${packet.orgName} | ${packet.industry} | ${packet.location ?? "Location not specified"}`,
    `WEBSITE: ${packet.website ?? "None provided"}`,
    `REVENUE RANGE: ${q.revenueRange} | BUSINESS MODEL: ${q.businessModel}`,
    `KEY CONCERNS: ${q.keyConcerns}`,
    `CRITICAL DECISION: ${q.oneDecisionKeepingOwnerUpAtNight}`,
    `PRIMARY OBJECTIVE: ${q.primaryObjective ?? "Not specified"}`,
    "",
    "── KEY METRICS ──",
    m.estimatedMonthlyRevenue ? `Monthly Revenue: $${m.estimatedMonthlyRevenue.toLocaleString()}` : "",
    m.estimatedMonthlyExpenses ? `Monthly Expenses: $${m.estimatedMonthlyExpenses.toLocaleString()}` : "",
    m.cashPosition ? `Cash Position: $${m.cashPosition.toLocaleString()}` : "",
    m.cashRunwayWeeks ? `Cash Runway: ${m.cashRunwayWeeks} weeks` : "",
    m.employeeCount ? `Employees: ${m.employeeCount}` : "",
    m.grossMarginPct ? `Gross Margin: ${m.grossMarginPct}%` : "",
    m.topCustomers.length ? `Top Customers: ${m.topCustomers.join(", ")}` : "",
    m.topCompetitors.length ? `Top Competitors: ${m.topCompetitors.join(", ")}` : "",
    `Known Customers (from questionnaire): ${q.keyCustomers ?? "Not listed"}`,
    `Known Competitors (from questionnaire): ${q.keyCompetitors ?? "Not listed"}`,
    "",
    "── TOP RISKS ──",
    ...packet.consolidatedRisks.map((r, i) => `${i + 1}. ${r}`),
    "",
    "── TOP OPPORTUNITIES ──",
    ...packet.consolidatedOpportunities.map((o, i) => `${i + 1}. ${o}`),
    "",
    "── DOCUMENT DOSSIERS ──",
    ...packet.categoryDossiers.map(
      (d) =>
        `[${d.category}]\n  Facts: ${d.keyFacts.slice(0, 5).join(" | ")}\n  Issues: ${d.criticalIssues.slice(0, 3).join(" | ")}\n  Amounts: ${JSON.stringify(d.financialAmounts)}`
    ),
  ];

  return lines.filter((l) => l !== "").join("\n");
}
