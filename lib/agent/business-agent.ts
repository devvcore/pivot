/**
 * ARIA — Adaptive Revenue Intelligence Advisor
 *
 * Pivot's business intelligence AI agent. Powered by Gemini Flash.
 *
 * Architecture (token-efficient):
 * - Loads ~600-word AgentMemory summary (not full report) at conversation start
 * - Has 3 tools: web_search, get_report_section, analyze_website
 * - Client maintains conversation history; server is stateless per request
 * - Trims to last 16 messages to bound token usage
 *
 * Personality:
 * - Strict, matter-of-fact, data-driven
 * - Compassionate about the owner's position
 * - Affirms that joining Pivot was the right move
 * - Never sugarcoats; always gives next steps
 */
import { GoogleGenAI } from "@google/genai";
import { getAgentMemory } from "./memory";
import { analyzeWebsite } from "./website-analyzer";
import { getJob, listJobs } from "@/lib/job-store";
import type { ChatMessage, AgentMemory, MVPDeliverables } from "@/lib/types";

const FLASH_MODEL = "gemini-2.0-flash";
const MAX_HISTORY_MESSAGES = 16;

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_web",
    description:
      "Search the web for current market data, competitor information, industry benchmarks, or business intelligence. Use when the user asks about markets, trends, competitors, or when you need current external data.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query — be specific about industry/geography/topic",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_report_section",
    description:
      "Retrieve detailed data from a specific section of the business intelligence report. Use when the user asks for specifics you don't have in your memory summary.",
    parameters: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          enum: [
            "healthScore",
            "cashIntelligence",
            "revenueLeakAnalysis",
            "issuesRegister",
            "atRiskCustomers",
            "decisionBrief",
            "actionPlan",
            "marketIntelligence",
            "websiteAnalysis",
          ],
          description: "Which section of the report to retrieve",
        },
        runId: {
          type: "string",
          description: "The run ID of the report (optional — uses most recent if not specified)",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "analyze_website",
    description:
      "Analyze a business website for marketing effectiveness, offer clarity, and conversion optimization. Returns a grade (A-F), specific issues, and actionable recommendations.",
    parameters: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The full URL of the website to analyze",
        },
      },
      required: ["url"],
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  orgId: string
): Promise<string> {
  if (toolName === "search_web") {
    // Use Gemini's own knowledge for web-like queries (real grounding requires separate model call)
    return `[Web Search] Query: "${args.query}" — Search results would appear here. For now, drawing on training knowledge for this query.`;
  }

  if (toolName === "get_report_section") {
    const section = args.section as string;
    const runId = args.runId as string | undefined;

    // Find the job
    let job;
    if (runId) {
      job = getJob(runId);
    } else {
      // Get most recent completed job for this org
      const allJobs = listJobs();
      job = allJobs.find((j) => j.questionnaire.orgId === orgId && j.status === "completed")
        ?? allJobs.find((j) => j.status === "completed");
    }

    if (!job?.deliverables) return `No completed report found for section: ${section}`;

    const d = job.deliverables as MVPDeliverables;
    const sectionData = (d as any)[section];
    if (!sectionData) return `Section "${section}" not found in this report.`;

    return `[Report Section: ${section}]\n${JSON.stringify(sectionData, null, 2)}`;
  }

  if (toolName === "analyze_website") {
    const url = args.url as string;
    try {
      const analysis = await analyzeWebsite(url);
      return `[Website Analysis: ${url}]
Grade: ${analysis.grade} (${analysis.score}/100)
Synopsis: ${analysis.synopsis}
Actual Offer: ${analysis.actualOffer}
Offer Gap: ${analysis.offerGap}
Top Issues: ${analysis.topIssues.join("; ")}
Recommendations: ${analysis.recommendations.join("; ")}
Suggested Headline: "${analysis.suggestedHeadline}"
Marketing Direction: ${analysis.marketingDirection}
CTA Assessment: ${analysis.ctaAssessment}`;
    } catch (e) {
      return `Website analysis failed: ${String(e)}`;
    }
  }

  return `Unknown tool: ${toolName}`;
}

// ── Response sanitizer ────────────────────────────────────────────────────────

function sanitize(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\u2014/g, " - ")   // em dash
    .replace(/\u2013/g, " - ")   // en dash
    .replace(/---/g, " - ")
    .replace(/--/g, " - ")
    .trim();
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(memory: AgentMemory): string {
  return `You are Pivvy, Pivot's AI business advisor.

You are the thinking partner this business owner never had. You are strict, matter-of-fact, and data-driven. You tell people what they need to hear, not what they want to hear. At the same time, you are deeply understanding of the pressure, stress, and uncertainty that comes with running a business. You are compassionate, but never soft.

When first engaging with this client, acknowledge: joining Pivot was the right move, and with the right data and decisions, things can absolutely get back on track. Then get to work.

STYLE RULES:
- Lead with numbers, not feelings
- Give specific next steps, not vague advice
- Reference the actual business data in your memory
- When you don't know something, use your tools, don't guess
- Keep responses focused and actionable (not long essays)
- Use bullet points and structure when listing actions
- Do NOT use em dashes, en dashes, double dashes, or asterisks. Use plain text only.

YOUR TOOLS:
- search_web(query): Search for current market data, competitors, benchmarks
- get_report_section(section): Get full details from the intelligence report
- analyze_website(url): Grade and analyze any website for marketing effectiveness

BUSINESS INTELLIGENCE MEMORY (${memory.orgName}):
${memory.summary}

KEY NUMBERS:
- Health Score: ${memory.keyNumbers.healthScore ?? "?"}/100 Grade ${memory.keyNumbers.healthGrade ?? "?"}
- Cash Runway: ${memory.keyNumbers.cashRunway ?? "?"} weeks
- Revenue at Risk: $${memory.keyNumbers.revenueAtRisk?.toLocaleString() ?? "?"}
- Total Revenue Leaks: $${memory.keyNumbers.totalLeaks?.toLocaleString() ?? "?"}
- Website Grade: ${memory.websiteGrade ?? "Not analyzed"}

RECENT ANALYSES:
${memory.reportSummaries
  .slice(0, 5)
  .map((r) => `- ${new Date(r.date).toLocaleDateString()}: ${r.headline} (Score: ${r.score ?? "?"}/${r.grade ?? "?"})`)
  .join("\n")}

Remember: You have access to their full report via tools. Use get_report_section when you need specifics.`;
}

// ── Main agent function ────────────────────────────────────────────────────────

export interface AgentRequest {
  orgId: string;
  messages: ChatMessage[];     // full conversation history from client
  message: string;             // current user message
}

export interface AgentResponse {
  message: string;
  toolsUsed?: string[];
}

export async function runBusinessAgent(req: AgentRequest): Promise<AgentResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { message: "Pivvy is not available. GEMINI_API_KEY is not configured." };
  }

  const memory = getAgentMemory(req.orgId);
  if (!memory) {
    return {
      message: `I don't have a memory built for this organization yet. Please complete a full analysis first, then I'll have everything I need to advise you effectively.`,
    };
  }

  const genai = new GoogleGenAI({ apiKey });

  // Trim history to last N messages for token efficiency
  const trimmedHistory = req.messages.slice(-MAX_HISTORY_MESSAGES);

  // Build Gemini contents array
  const contents = [
    ...trimmedHistory.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    {
      role: "user" as const,
      parts: [{ text: req.message }],
    },
  ];

  const toolsUsed: string[] = [];

  try {
    // First call — may request tool use
    const resp = await genai.models.generateContent({
      model: FLASH_MODEL,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(memory),
        temperature: 0.4,
        maxOutputTokens: 2000,
        tools: [{ functionDeclarations: TOOLS }],
        toolConfig: { functionCallingMode: "AUTO" },
      } as Record<string, unknown>,
    });

    // Check if model requested tool calls
    const candidate = resp.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const fnCalls = parts.filter((p: any) => p.functionCall);

    if (fnCalls.length > 0) {
      // Execute all requested tools
      const toolResults = await Promise.all(
        fnCalls.map(async (part: any) => {
          const { name, args } = part.functionCall;
          toolsUsed.push(name);
          const result = await executeTool(name, args as Record<string, unknown>, req.orgId);
          return { name, result };
        })
      );

      // Second call with tool results
      const contentsWithTools = [
        ...contents,
        { role: "model" as const, parts },
        {
          role: "user" as const,
          parts: toolResults.map((tr) => ({
            functionResponse: { name: tr.name, response: { result: tr.result } },
          })),
        },
      ];

      const resp2 = await genai.models.generateContent({
        model: FLASH_MODEL,
        contents: contentsWithTools,
        config: {
          systemInstruction: buildSystemPrompt(memory),
          temperature: 0.4,
          maxOutputTokens: 2000,
        } as Record<string, unknown>,
      });

      return {
        message: sanitize(resp2.text ?? "I encountered an issue generating a response. Please try again."),
        toolsUsed,
      };
    }

    return {
      message: sanitize(resp.text ?? "I encountered an issue generating a response. Please try again."),
      toolsUsed,
    };
  } catch (e) {
    console.error("[Pivvy] Agent error:", e);
    return {
      message: "I ran into a technical issue. Please try again in a moment.",
      toolsUsed,
    };
  }
}
