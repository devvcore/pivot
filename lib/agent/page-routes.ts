/**
 * Page Route Registry for Pivvy Navigation
 *
 * Maps user intent ("show me my revenue leaks") to specific chapters/tabs
 * in ResultsView. Used by both business-agent and coach-agent via the
 * navigate_to_page function-calling tool.
 */

export interface PageRoute {
  id: string;
  label: string;
  description: string;
  chapter: string;     // chapter ID in ResultsView (e.g. "dashboard", "financial")
  coreTab?: number;    // specific core tab within dashboard chapter (0-6)
  keywords: string[];  // trigger words for matching
}

export const PAGE_ROUTES: PageRoute[] = [
  // ── Dashboard Core Tabs ────────────────────────────────────────────────────
  {
    id: "health-score",
    label: "Health Score",
    description: "Overall business health score with radar chart and dimension breakdown",
    chapter: "dashboard",
    coreTab: 0,
    keywords: [
      "health score", "health", "score", "grade", "rating", "overall health",
      "business health", "how is my business", "how am i doing", "overview",
      "summary", "dashboard", "home", "main", "start",
    ],
  },
  {
    id: "cash-intelligence",
    label: "Cash Intelligence",
    description: "Cash position, runway, burn rate, and cash flow analysis",
    chapter: "dashboard",
    coreTab: 1,
    keywords: [
      "cash", "cash intelligence", "money", "finances", "cash flow",
      "runway", "burn rate", "bank", "balance", "liquidity",
      "cash position", "how much money", "cash runway",
    ],
  },
  {
    id: "revenue-leaks",
    label: "Revenue Leaks",
    description: "Revenue leak analysis showing where money is being lost",
    chapter: "dashboard",
    coreTab: 2,
    keywords: [
      "revenue leaks", "leaks", "leak", "revenue loss", "losing money",
      "lost revenue", "revenue at risk", "bleeding", "hemorrhaging",
      "where am i losing", "money lost", "revenue problems",
    ],
  },
  {
    id: "issues",
    label: "Issues Register",
    description: "Critical business issues ranked by severity",
    chapter: "dashboard",
    coreTab: 3,
    keywords: [
      "issues", "problems", "risks", "critical issues", "issues register",
      "what's wrong", "concerns", "red flags", "warnings", "alerts",
      "urgent", "critical", "blockers", "what needs fixing",
    ],
  },
  {
    id: "at-risk-clients",
    label: "At-Risk Clients",
    description: "Customers at risk of churning with revenue impact",
    chapter: "dashboard",
    coreTab: 4,
    keywords: [
      "at-risk clients", "at risk", "churn risk", "customer risk",
      "losing customers", "client risk", "risky clients",
      "customers leaving", "attrition", "retention risk",
    ],
  },
  {
    id: "decision-brief",
    label: "Decision Brief",
    description: "Executive decision brief with key recommendations",
    chapter: "dashboard",
    coreTab: 5,
    keywords: [
      "decision brief", "brief", "executive brief", "decisions",
      "recommendations", "what should i do", "next steps",
      "priorities", "executive summary",
    ],
  },
  {
    id: "action-plan",
    label: "Action Plan",
    description: "Prioritized daily action plan with tasks and owners",
    chapter: "dashboard",
    coreTab: 6,
    keywords: [
      "action plan", "actions", "tasks", "to do", "todo", "plan",
      "daily plan", "what to do", "action items", "priorities",
      "daily tasks", "task list", "work plan", "today",
    ],
  },

  // ── Chapter-Level Routes ───────────────────────────────────────────────────
  {
    id: "financial",
    label: "Financial Intelligence",
    description: "Cash, revenue, financial ratios, unit economics, and financial health",
    chapter: "financial",
    keywords: [
      "financial", "finances", "financial intelligence", "revenue",
      "profit", "profitability", "margins", "unit economics",
      "financial ratios", "burn", "cash burn", "financial health",
      "income", "expenses", "cost", "costs", "budget",
      "revenue forecast", "cash optimization", "revenue diversification",
      "break even", "gross margin", "operating leverage",
      "working capital", "debt", "tax", "billing", "subscription metrics",
    ],
  },
  {
    id: "customers",
    label: "Customers & Revenue",
    description: "Customer insights, segmentation, retention, churn, and lifetime value",
    chapter: "customers",
    keywords: [
      "customers", "clients", "customer", "retention", "churn",
      "lifetime value", "clv", "ltv", "segmentation", "segments",
      "nps", "net promoter", "customer health", "customer journey",
      "onboarding", "renewal", "expansion", "upsell", "cross-sell",
      "customer success", "support tickets", "advocacy", "referral",
      "loyalty", "testimonial", "case study",
    ],
  },
  {
    id: "market",
    label: "Market & Competition",
    description: "Competitive landscape, market sizing, pricing, and market intelligence",
    chapter: "market",
    keywords: [
      "market", "competition", "competitors", "competitive",
      "market size", "market sizing", "tam", "sam", "som",
      "pricing", "pricing strategy", "competitive moat",
      "market share", "market position", "industry", "trends",
      "market entry", "market intelligence", "competitive intel",
      "battlecards", "market timing", "disruption",
      "ecosystem", "category", "win loss",
    ],
  },
  {
    id: "growth",
    label: "Growth & Strategy",
    description: "Strategic planning, growth playbooks, funding, OKRs, and exit readiness",
    chapter: "growth",
    keywords: [
      "growth", "strategy", "strategic", "swot", "planning",
      "goals", "okrs", "objectives", "milestones", "roadmap",
      "funding", "investors", "investor", "board deck", "pitch",
      "exit", "acquisition", "ipo", "fundraising",
      "product market fit", "pmf", "innovation", "stakeholder",
      "decision log", "scenario", "expansion",
    ],
  },
  {
    id: "marketing",
    label: "Marketing & Brand",
    description: "Marketing strategy, brand health, SEO, content, social media, and digital presence",
    chapter: "marketing",
    keywords: [
      "marketing", "brand", "branding", "seo", "content",
      "social media", "advertising", "ads", "campaigns",
      "email marketing", "conversion", "demand gen",
      "influencer", "digital presence", "website", "lead gen",
      "brand health", "brand equity", "messaging", "visual",
      "content calendar", "social calendar", "attribution",
      "paid media", "events",
    ],
  },
  {
    id: "operations",
    label: "Operations & Team",
    description: "Operational efficiency, technology, hiring, team performance, and sales operations",
    chapter: "operations",
    keywords: [
      "operations", "team", "hiring", "talent", "employees",
      "tech", "technology", "tech stack", "api", "platform",
      "product", "features", "roadmap", "tech debt",
      "sales", "sales playbook", "pipeline", "deals",
      "efficiency", "automation", "process", "vendor",
      "onboarding", "engagement", "compensation", "culture",
      "workforce", "skills gap", "burnout", "remote work",
      "devops", "release", "quality", "testing",
    ],
  },
  {
    id: "risk",
    label: "Risk & Compliance",
    description: "Risk management, issues, regulatory compliance, security, and ESG",
    chapter: "risk",
    keywords: [
      "risk", "compliance", "regulatory", "regulation",
      "legal", "audit", "security", "cybersecurity",
      "crisis", "contingency", "privacy", "data governance",
      "esg", "sustainability", "carbon", "ethics",
      "incident", "access control", "penetration testing",
      "contract", "ip", "intellectual property", "policy",
    ],
  },
];

/**
 * Find the best matching route for a user query.
 * Uses keyword scoring with bonus for exact phrase matches.
 */
export function findRoute(query: string): PageRoute | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  let bestRoute: PageRoute | null = null;
  let bestScore = 0;

  for (const route of PAGE_ROUTES) {
    let score = 0;

    // Check label match (high value)
    if (q.includes(route.label.toLowerCase())) {
      score += 10;
    }
    if (route.label.toLowerCase().includes(q)) {
      score += 8;
    }

    // Check keyword matches
    for (const kw of route.keywords) {
      if (q.includes(kw)) {
        // Longer keyword matches are more specific, so worth more
        score += 2 + kw.split(" ").length;
      } else {
        // Partial: check if any word in the keyword appears in the query
        const kwWords = kw.split(" ");
        const matchedWords = kwWords.filter((w) => w.length > 2 && q.includes(w));
        if (matchedWords.length > 0) {
          score += matchedWords.length * 0.5;
        }
      }
    }

    // Check route ID match
    if (q.includes(route.id.replace(/-/g, " "))) {
      score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRoute = route;
    }
  }

  // Require a minimum score to avoid false positives
  return bestScore >= 2 ? bestRoute : null;
}

/**
 * Find a route by its exact ID.
 */
export function findRouteById(routeId: string): PageRoute | null {
  return PAGE_ROUTES.find((r) => r.id === routeId) ?? null;
}
