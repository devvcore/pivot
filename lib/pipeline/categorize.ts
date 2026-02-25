/**
 * Document Categorization & Knowledge Graph Assembly
 *
 * Ported from ItelSys ingestion_pipeline.py:
 * - Step 1: Parse each file (via parse.ts)
 * - Step 2: Categorize each doc using Gemini Flash Lite (fast + cheap)
 * - Step 3: Assemble structured knowledge graph grouped by schema category
 */
import { GoogleGenAI } from "@google/genai";
import type { ParsedFile } from "./parse";
import type { Questionnaire, KnowledgeGraph, CategorizedDoc } from "@/lib/types";

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

const CATEGORY_LIST = SCHEMA_CATEGORIES.join(", ");

export async function categorizeAndBuildGraph(
  parsedFiles: ParsedFile[],
  questionnaire: Questionnaire
): Promise<KnowledgeGraph> {
  const apiKey = process.env.GEMINI_API_KEY;

  const categorizedDocs: CategorizedDoc[] = [];

  for (const file of parsedFiles) {
    if (!file.text.trim()) {
      // No extractable text — still include with fallback category
      categorizedDocs.push({
        filename: file.filename,
        fileType: getFileType(file.filename),
        category: "Other",
        summary: "No text could be extracted from this file.",
        keyPoints: [],
        entities: { people: [], amounts: [], dates: [], companies: [] },
        rawTextExcerpt: "",
      });
      continue;
    }

    if (apiKey) {
      const result = await categorizeDocument(apiKey, file.filename, file.text);
      const entities = (result.entities ?? {}) as Record<string, string[]>;
      categorizedDocs.push({
        filename: file.filename,
        fileType: getFileType(file.filename),
        category: (result.category as string) || "Other",
        summary: (result.summary as string) || "",
        keyPoints: (result.key_points as string[]) || [],
        entities: {
          people: entities.people || [],
          amounts: entities.amounts || [],
          dates: entities.dates || [],
          companies: entities.companies || [],
        },
        rawTextExcerpt: file.text.slice(0, 2000),
      });
    } else {
      // No API key — use raw text with basic classification
      categorizedDocs.push({
        filename: file.filename,
        fileType: getFileType(file.filename),
        category: guessCategory(file.filename),
        summary: `Document: ${file.filename}`,
        keyPoints: [],
        entities: { people: [], amounts: [], dates: [], companies: [] },
        rawTextExcerpt: file.text.slice(0, 2000),
      });
    }
  }

  return buildKnowledgeGraph(categorizedDocs, questionnaire);
}

async function categorizeDocument(
  apiKey: string,
  filename: string,
  text: string
): Promise<Record<string, unknown>> {
  const genai = new GoogleGenAI({ apiKey });
  const excerpt = text.slice(0, 8000); // cap per-doc context

  const prompt = `You are analyzing a business document for a management intelligence platform.

Document filename: ${filename}
Document content (excerpt):
---
${excerpt}
---

Categorize this document and extract key information.

Return valid JSON only with this exact structure:
{
  "category": "<one of: ${CATEGORY_LIST}>",
  "summary": "<2-3 sentence plain-English summary of what this document contains>",
  "key_points": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],
  "entities": {
    "people": ["<name>"],
    "amounts": ["<$X>"],
    "dates": ["<date>"],
    "companies": ["<name>"]
  }
}`;

  try {
    const resp = await genai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 1500,
      } as Record<string, unknown>,
    });
    const raw = resp.text ?? "{}";
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (e) {
    console.warn(`Categorization failed for ${filename}:`, e);
    return {
      category: guessCategory(filename),
      summary: `Document: ${filename}`,
      key_points: [],
      entities: { people: [], amounts: [], dates: [], companies: [] },
    };
  }
}

function buildKnowledgeGraph(docs: CategorizedDoc[], questionnaire: Questionnaire): KnowledgeGraph {
  // Group by category
  const categories: Record<string, CategorizedDoc[]> = {};
  for (const cat of SCHEMA_CATEGORIES) {
    categories[cat] = [];
  }

  for (const doc of docs) {
    const cat = SCHEMA_CATEGORIES.includes(doc.category as typeof SCHEMA_CATEGORIES[number])
      ? doc.category
      : "Other";
    categories[cat].push(doc);
  }

  const schemaCoverage: Record<string, boolean> = {};
  for (const cat of SCHEMA_CATEGORIES) {
    schemaCoverage[cat] = categories[cat].length > 0;
  }

  return {
    questionnaire,
    documentCount: docs.length,
    categories,
    schemaCoverage,
    allDocuments: docs,
  };
}

function getFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "unknown";
  return ext;
}

function guessCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("financial") || lower.includes("finance") || lower.includes("cash") || lower.includes("p&l") || lower.includes("balance")) return "Financial Position";
  if (lower.includes("customer") || lower.includes("client") || lower.includes("account")) return "Customer Portfolio";
  if (lower.includes("revenue") || lower.includes("sales") || lower.includes("invoice")) return "Revenue Model";
  if (lower.includes("team") || lower.includes("staff") || lower.includes("org")) return "Team Structure";
  if (lower.includes("hr") || lower.includes("payroll") || lower.includes("compensation")) return "Compensation & HR";
  if (lower.includes("strategy") || lower.includes("plan") || lower.includes("roadmap")) return "Strategy & Planning";
  if (lower.includes("risk") || lower.includes("compliance") || lower.includes("legal")) return "Risk & Compliance";
  if (lower.includes("market") || lower.includes("competitor") || lower.includes("competitive")) return "Market & Competition";
  if (lower.includes("operation") || lower.includes("process") || lower.includes("procedure")) return "Operations";
  return "Other";
}
