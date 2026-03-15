/**
 * Stage 1: Async file-micro-agent ingestion
 *
 * Agentic pattern:
 *  1) Spawn cheap per-file micro-agents in parallel
 *  2) Orchestrator reviews confidence + gaps
 *  3) Launches targeted re-investigation passes on weak files
 *  4) Consolidates all file intelligence into a BusinessPacket
 */
import { GoogleGenAI } from "@google/genai";
import type { ParsedFile } from "./parse";
import type { Questionnaire, BusinessPacket, FinancialFact, CompanyIdentity, IntegrationContext } from "@/lib/types";
import { formatIntegrationContextAsText } from "@/lib/integrations/collect";

const MICRO_MODEL = process.env.MICRO_AGENT_MODEL || "gemini-2.5-flash";
const ORCHESTRATOR_MODEL = process.env.ORCHESTRATOR_MODEL || "gemini-2.5-flash";
const MICRO_PARALLELISM = Number(process.env.MICRO_AGENT_PARALLELISM || "4");

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
  confidence: number;
  evidenceGaps: string[];
  extractionNotes?: string;
}

function safeParseJsonObject(raw: string): Record<string, unknown> {
  const text = (raw ?? "").trim();
  if (!text) return {};
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() || text;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length || 1));
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runner(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: safeConcurrency }, () => runner()));
  return results;
}

async function extractDocument(
  genai: GoogleGenAI,
  filename: string,
  text: string
): Promise<DocExtract> {
  const excerpt = text.slice(0, 12000);
  const prompt = `You are a low-cost file intelligence micro-agent.
Analyze one business file and extract verifiable, structured intelligence only.

Document: ${filename}
Content:
---
${excerpt}
---

Return valid JSON ONLY:
{
  "category": "<one of: ${SCHEMA_CATEGORIES.join(", ")}>",
  "keyFacts": ["<specific fact with numbers>", ...],
  "criticalIssues": ["<issue with financial impact if possible>", ...],
  "financialAmounts": {"<label>": <number>, ...},
  "confidence": <integer 0-100>,
  "evidenceGaps": ["<missing info that prevents stronger extraction>", ...],
  "extractionNotes": "<short note on uncertainty or caveats>"
}

Rules:
- keyFacts: max 10, must be specific (include names, amounts, dates)
- criticalIssues: max 6, problems/risks only
- financialAmounts: extract any dollar amounts mentioned (as raw numbers, no $ signs)
- confidence should reflect evidence quality in this file alone
- Do NOT include generic observations or opinions`;

  try {
    const resp = await genai.models.generateContent({
      model: MICRO_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 1200,
      } as Record<string, unknown>,
    });
    const parsed = safeParseJsonObject(resp.text ?? "{}");
    return {
      category: typeof parsed.category === "string" ? parsed.category : guessCategory(filename),
      keyFacts: Array.isArray(parsed.keyFacts)
        ? parsed.keyFacts.filter((x): x is string => typeof x === "string").slice(0, 10)
        : [],
      criticalIssues: Array.isArray(parsed.criticalIssues)
        ? parsed.criticalIssues.filter((x): x is string => typeof x === "string").slice(0, 6)
        : [],
      financialAmounts: typeof parsed.financialAmounts === "object" && parsed.financialAmounts !== null
        ? Object.fromEntries(
            Object.entries(parsed.financialAmounts as Record<string, unknown>).filter(
              ([, v]) => typeof v === "number" && Number.isFinite(v)
            )
          ) as Record<string, number>
        : {},
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(100, parsed.confidence))
          : 45,
      evidenceGaps: Array.isArray(parsed.evidenceGaps)
        ? parsed.evidenceGaps.filter((x): x is string => typeof x === "string").slice(0, 6)
        : [],
      extractionNotes:
        typeof parsed.extractionNotes === "string" ? parsed.extractionNotes : undefined,
    };
  } catch {
    return {
      category: guessCategory(filename),
      keyFacts: [],
      criticalIssues: [],
      financialAmounts: {},
      confidence: 25,
      evidenceGaps: ["Extraction failed on first pass"],
    };
  }
}

async function investigateDocument(
  genai: GoogleGenAI,
  filename: string,
  text: string,
  firstPass: DocExtract
): Promise<DocExtract> {
  const excerpt = text.slice(0, 14000);
  const gaps = firstPass.evidenceGaps.length
    ? firstPass.evidenceGaps.join("; ")
    : "Identify any missing customer, revenue, risk, and operational facts.";
  const currentFacts = firstPass.keyFacts.join("; ") || "none";
  const currentIssues = firstPass.criticalIssues.join("; ") || "none";

  const prompt = `You are a file investigator micro-agent.
Re-investigate this single file with focused questions to improve extraction quality.

Document: ${filename}
Current pass:
- category: ${firstPass.category}
- confidence: ${firstPass.confidence}
- keyFacts: ${currentFacts}
- criticalIssues: ${currentIssues}
- evidenceGaps: ${gaps}

Document content:
---
${excerpt}
---

Return valid JSON ONLY:
{
  "category": "<one of: ${SCHEMA_CATEGORIES.join(", ")}>",
  "keyFacts": ["..."],
  "criticalIssues": ["..."],
  "financialAmounts": {"label": 1234},
  "confidence": <0-100>,
  "evidenceGaps": ["..."],
  "extractionNotes": "<what improved, what still missing>"
}

Rules:
- Only include facts directly supported by this file
- Prefer higher precision over broader but vague extraction
- If no improvement is possible, keep confidence low and explain why`;

  try {
    const resp = await genai.models.generateContent({
      model: MICRO_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 1400,
      } as Record<string, unknown>,
    });
    const parsed = safeParseJsonObject(resp.text ?? "{}");
    const refined: DocExtract = {
      category:
        typeof parsed.category === "string" ? parsed.category : firstPass.category,
      keyFacts: Array.isArray(parsed.keyFacts)
        ? parsed.keyFacts.filter((x): x is string => typeof x === "string").slice(0, 12)
        : firstPass.keyFacts,
      criticalIssues: Array.isArray(parsed.criticalIssues)
        ? parsed.criticalIssues.filter((x): x is string => typeof x === "string").slice(0, 8)
        : firstPass.criticalIssues,
      financialAmounts:
        typeof parsed.financialAmounts === "object" && parsed.financialAmounts !== null
          ? Object.fromEntries(
              Object.entries(parsed.financialAmounts as Record<string, unknown>).filter(
                ([, v]) => typeof v === "number" && Number.isFinite(v)
              )
            ) as Record<string, number>
          : firstPass.financialAmounts,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(100, parsed.confidence))
          : firstPass.confidence,
      evidenceGaps: Array.isArray(parsed.evidenceGaps)
        ? parsed.evidenceGaps.filter((x): x is string => typeof x === "string").slice(0, 6)
        : firstPass.evidenceGaps,
      extractionNotes:
        typeof parsed.extractionNotes === "string"
          ? parsed.extractionNotes
          : firstPass.extractionNotes,
    };
    return refined.confidence >= firstPass.confidence ? refined : firstPass;
  } catch {
    return firstPass;
  }
}

// ── Cross-document consolidation ─────────────────────────────────────────────

async function consolidateToPacket(
  genai: GoogleGenAI,
  extracts: { filename: string; extract: DocExtract }[],
  questionnaire: Questionnaire
): Promise<Omit<BusinessPacket, "questionnaire" | "orgName" | "industry" | "location" | "website" | "documentCount">> {
  // Determine recency: files with higher timestamps are newer uploads
  const withTimestamps = extracts.map(({ filename, extract }) => {
    const match = filename.match(/^(?:.*\/)?(\d+)_/);
    return { filename, extract, uploadedAt: match ? parseInt(match[1], 10) : 0 };
  });
  // Find the most recent upload batch (all files within 60s of the newest)
  const maxTs = Math.max(...withTimestamps.map(e => e.uploadedAt));
  const recentCutoff = maxTs - 60_000;

  const context = withTimestamps
    .sort((a, b) => b.uploadedAt - a.uploadedAt) // newest first
    .map(
      ({ filename, extract, uploadedAt }) => {
        const isRecent = uploadedAt > recentCutoff && recentCutoff > 0;
        return `${isRecent ? "[RECENT UPLOAD — HIGHER PRIORITY] " : ""}[${extract.category}] ${filename}
Confidence: ${extract.confidence}/100
Facts: ${extract.keyFacts.join("; ")}
Issues: ${extract.criticalIssues.join("; ")}
Amounts: ${JSON.stringify(extract.financialAmounts)}
Gaps: ${extract.evidenceGaps.join("; ")}`;
      }
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
- All numbers must be raw integers/floats (no currency symbols)
- RECENCY PRIORITY: When data conflicts exist between documents, ALWAYS prefer the most recently uploaded file (marked [RECENT UPLOAD]). Newer files represent the latest state of the business and supersede older data.
- Even if document data is sparse, use the questionnaire fields, company name, industry, revenue range, and any available context to infer reasonable business intelligence. Never report 'no data' or 'data gaps' — instead provide your best analysis based on what IS available.`;

  try {
    const resp = await genai.models.generateContent({
      model: ORCHESTRATOR_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 3000,
      } as Record<string, unknown>,
    });
    const parsed = safeParseJsonObject(resp.text ?? "{}");
    return parsed as Omit<BusinessPacket, "questionnaire" | "orgName" | "industry" | "location" | "website" | "documentCount">;
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

// ── Normalize consolidation output ───────────────────────────────────────────

function normalizeConsolidated(
  value: Partial<Omit<BusinessPacket, "questionnaire" | "orgName" | "industry" | "location" | "website" | "documentCount">>
): Omit<BusinessPacket, "questionnaire" | "orgName" | "industry" | "location" | "website" | "documentCount"> {
  return {
    keyMetrics: {
      estimatedMonthlyRevenue:
        typeof value.keyMetrics?.estimatedMonthlyRevenue === "number" ? value.keyMetrics.estimatedMonthlyRevenue : undefined,
      estimatedMonthlyExpenses:
        typeof value.keyMetrics?.estimatedMonthlyExpenses === "number" ? value.keyMetrics.estimatedMonthlyExpenses : undefined,
      cashPosition:
        typeof value.keyMetrics?.cashPosition === "number" ? value.keyMetrics.cashPosition : undefined,
      cashRunwayWeeks:
        typeof value.keyMetrics?.cashRunwayWeeks === "number" ? value.keyMetrics.cashRunwayWeeks : undefined,
      employeeCount:
        typeof value.keyMetrics?.employeeCount === "number" ? value.keyMetrics.employeeCount : undefined,
      grossMarginPct:
        typeof value.keyMetrics?.grossMarginPct === "number" ? value.keyMetrics.grossMarginPct : undefined,
      topCustomers: Array.isArray(value.keyMetrics?.topCustomers)
        ? value.keyMetrics.topCustomers.filter((x): x is string => typeof x === "string").slice(0, 10)
        : [],
      topCompetitors: Array.isArray(value.keyMetrics?.topCompetitors)
        ? value.keyMetrics.topCompetitors.filter((x): x is string => typeof x === "string").slice(0, 10)
        : [],
    },
    categoryDossiers: Array.isArray(value.categoryDossiers)
      ? value.categoryDossiers.map((d) => ({
          category: typeof d.category === "string" ? d.category : "Other",
          keyFacts: Array.isArray(d.keyFacts) ? d.keyFacts.filter((x): x is string => typeof x === "string").slice(0, 12) : [],
          criticalIssues: Array.isArray(d.criticalIssues)
            ? d.criticalIssues.filter((x): x is string => typeof x === "string").slice(0, 10) : [],
          financialAmounts:
            typeof d.financialAmounts === "object" && d.financialAmounts !== null
              ? Object.fromEntries(Object.entries(d.financialAmounts).filter(([, v]) => typeof v === "number" && Number.isFinite(v)))
              : {},
        }))
      : [],
    consolidatedRisks: Array.isArray(value.consolidatedRisks)
      ? value.consolidatedRisks.filter((x): x is string => typeof x === "string").slice(0, 12) : [],
    consolidatedOpportunities: Array.isArray(value.consolidatedOpportunities)
      ? value.consolidatedOpportunities.filter((x): x is string => typeof x === "string").slice(0, 8) : [],
    dataCoverage:
      typeof value.dataCoverage === "object" && value.dataCoverage !== null
        ? Object.fromEntries(Object.entries(value.dataCoverage).map(([k, v]) => [k, Boolean(v)]))
        : {},
  };
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function ingestDocuments(
  parsedFiles: ParsedFile[],
  questionnaire: Questionnaire
): Promise<BusinessPacket> {
  const apiKey = process.env.GEMINI_API_KEY;
  const genai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  let extracts: { filename: string; extract: DocExtract }[] = [];

  if (genai) {
    // Step 1: parallel micro-agent extraction
    extracts = await runWithConcurrency(parsedFiles, MICRO_PARALLELISM, async (file) => {
      if (!file.text.trim()) {
        return {
          filename: file.filename,
          extract: {
            category: guessCategory(file.filename),
            keyFacts: [],
            criticalIssues: [],
            financialAmounts: {},
            confidence: 10,
            evidenceGaps: ["Document parsing was limited. Analysis will rely primarily on website data, questionnaire responses, and industry benchmarks to provide actionable intelligence."],
          },
        };
      }
      const firstPass = await extractDocument(genai, file.filename, file.text);
      return { filename: file.filename, extract: firstPass };
    });

    // Step 2: orchestrator-triggered targeted re-investigation
    const weakIdx = extracts
      .map((x, i) => ({ x, i }))
      .filter(({ x }) =>
        x.extract.confidence < 60 ||
        x.extract.keyFacts.length < 2 ||
        (x.extract.criticalIssues.length === 0 &&
          Object.keys(x.extract.financialAmounts).length === 0)
      )
      .map(({ i }) => i)
      .slice(0, Math.min(4, extracts.length));

    if (weakIdx.length > 0) {
      const improvements = await runWithConcurrency(weakIdx, 2, async (idx) => {
        const file = parsedFiles[idx];
        const current = extracts[idx].extract;
        if (!file?.text?.trim()) return { idx, extract: current };
        const refined = await investigateDocument(genai, file.filename, file.text, current);
        return { idx, extract: refined };
      });
      for (const improved of improvements) {
        extracts[improved.idx] = { ...extracts[improved.idx], extract: improved.extract };
      }
    }
  } else {
    extracts = parsedFiles.map((file) => ({
      filename: file.filename,
      extract: {
        category: guessCategory(file.filename),
        keyFacts: [],
        criticalIssues: [],
        financialAmounts: {},
        confidence: 10,
        evidenceGaps: ["No model API key configured"],
      },
    }));
  }

  // ── Build financial facts registry (anti-hallucination) ──
  const financialFacts: FinancialFact[] = [];
  for (const { filename, extract } of extracts) {
    for (const [label, value] of Object.entries(extract.financialAmounts)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        financialFacts.push({
          label,
          value,
          sourceFile: filename,
          confidence: extract.confidence,
        });
      }
    }
  }

  // ── Build company identity anchor ──
  const identity = await buildCompanyIdentity(questionnaire, extracts);

  let consolidated;
  if (genai) {
    const raw = await consolidateToPacket(genai, extracts, questionnaire);
    consolidated = normalizeConsolidated(raw);
  } else {
    const dossiers = extracts.map(({ extract }) => ({
      category: extract.category,
      keyFacts: extract.keyFacts,
      criticalIssues: extract.criticalIssues,
      financialAmounts: extract.financialAmounts,
    }));
    consolidated = normalizeConsolidated({
      keyMetrics: { topCustomers: [], topCompetitors: [] },
      categoryDossiers: dossiers,
      consolidatedRisks: [],
      consolidatedOpportunities: [],
      dataCoverage: {},
    });
  }

  return {
    orgName: questionnaire.organizationName,
    industry: questionnaire.industry,
    location: questionnaire.location,
    website: questionnaire.website,
    questionnaire,
    documentCount: parsedFiles.length,
    financialFacts,
    identity,
    ...consolidated,
  } as BusinessPacket;
}

// ── Company Identity Anchoring ────────────────────────────────────────────────

async function buildCompanyIdentity(
  questionnaire: Questionnaire,
  extracts: { filename: string; extract: DocExtract }[]
): Promise<CompanyIdentity> {
  let domain: string | null = null;
  if (questionnaire.website) {
    try {
      domain = new URL(
        questionnaire.website.startsWith("http")
          ? questionnaire.website
          : `https://${questionnaire.website}`
      ).hostname.replace(/^www\./, "");
    } catch { /* invalid URL */ }
  }

  let verifiedDomain = false;
  if (domain) {
    try {
      const resp = await fetch(`https://${domain}`, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      verifiedDomain = resp.ok;
    } catch { /* domain not reachable */ }
  }

  // Collect company name variations from documents
  const aliases = new Set<string>();
  const orgLower = questionnaire.organizationName.toLowerCase();
  for (const { extract } of extracts) {
    for (const fact of extract.keyFacts) {
      const words = fact.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) ?? [];
      for (const w of words) {
        if (w.toLowerCase() !== orgLower && w.length > 3 &&
            (orgLower.includes(w.toLowerCase()) || w.toLowerCase().includes(orgLower))) {
          aliases.add(w);
        }
      }
    }
  }

  return {
    name: questionnaire.organizationName,
    domain,
    verifiedDomain,
    aliases: Array.from(aliases).slice(0, 5),
  };
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

  // Add verified financial facts section (anti-hallucination)
  if (packet.financialFacts && packet.financialFacts.length > 0) {
    lines.push("", "══ VERIFIED FINANCIAL FACTS (from source documents — use these exactly) ══");
    for (const fact of packet.financialFacts) {
      lines.push(`  ${fact.label}: $${fact.value.toLocaleString()} [FROM: ${fact.sourceFile}] (confidence: ${fact.confidence}/100)`);
    }
    lines.push(
      "",
      "IMPORTANT: The numbers above were extracted directly from uploaded documents.",
      "Use them exactly as stated. Do NOT round, adjust, or override them with estimates.",
      "If you need a number that is NOT in this list, clearly mark it as [ESTIMATED].",
    );
  }

  // Add identity anchor
  if (packet.identity) {
    lines.push(
      "",
      `══ COMPANY IDENTITY ANCHOR ══`,
      `Name: ${packet.identity.name}`,
      packet.identity.domain ? `Domain: ${packet.identity.domain}` : "",
      packet.identity.aliases.length > 0 ? `Aliases: ${packet.identity.aliases.join(", ")}` : "",
      `All analysis MUST be about THIS specific entity only. Do not confuse with similarly-named companies.`,
    );
  }

  // Add connected tool data (from Composio integrations)
  const integrationBlock = formatIntegrationContextAsText(packet.integrationData);
  if (integrationBlock) {
    lines.push(integrationBlock);
  }

  return lines.filter((l) => l !== "").join("\n");
}

// ── Website Content Scraping ────────────────────────────────────────────────

/**
 * Fetches a website's HTML and extracts text content.
 * Used to understand what the business actually does when questionnaire data is sparse.
 */
export async function scrapeWebsiteContent(url: string): Promise<string> {
  try {
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const resp = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PivotBot/1.0; Business Intelligence)",
        "Accept": "text/html",
      },
    });
    if (!resp.ok) return "";
    const html = await resp.text();

    // Strip scripts, styles, and HTML tags to get readable text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text.slice(0, 4000);
  } catch {
    return "";
  }
}
