import type { BusinessTerminology, Questionnaire } from "../types";

/** Detect business model type and generate appropriate terminology */
export function detectTerminology(q: Questionnaire): BusinessTerminology {
  const model = (q.businessModel || "").toLowerCase();
  const industry = (q.industry || "").toLowerCase();

  let businessType: BusinessTerminology["businessType"] = "other";

  if (/saas|software|platform|app|tech/.test(model) || /saas|software|tech/.test(industry)) {
    businessType = "saas";
  } else if (/service|consult|agency|freelanc|professional/.test(model) || /consult|agency|legal|accounting/.test(industry)) {
    businessType = "services";
  } else if (/retail|ecommerce|e-commerce|shop|store/.test(model) || /retail|fashion|food/.test(industry)) {
    businessType = "retail";
  } else if (/b2b|enterprise|wholesale/.test(model) || /manufacturing|industrial/.test(industry)) {
    businessType = "b2b";
  } else if (/b2c|consumer|direct/.test(model)) {
    businessType = "b2c";
  } else if (/marketplace|platform/.test(model)) {
    businessType = "marketplace";
  }

  const TERMINOLOGY_MAP: Record<string, BusinessTerminology["terms"]> = {
    saas: {
      customer: "user",
      revenue: "MRR",
      churn: "churn rate",
      acquisition: "signup",
      product: "platform",
      upsell: "expansion revenue",
      pipeline: "conversion funnel",
    },
    services: {
      customer: "client",
      revenue: "retainer revenue",
      churn: "client attrition",
      acquisition: "client acquisition",
      product: "service",
      upsell: "scope expansion",
      pipeline: "sales pipeline",
    },
    retail: {
      customer: "customer",
      revenue: "sales revenue",
      churn: "customer loss",
      acquisition: "purchase",
      product: "product",
      upsell: "cross-sell",
      pipeline: "order flow",
    },
    b2b: {
      customer: "account",
      revenue: "contract value",
      churn: "account attrition",
      acquisition: "deal close",
      product: "solution",
      upsell: "account expansion",
      pipeline: "deal pipeline",
    },
    b2c: {
      customer: "customer",
      revenue: "revenue",
      churn: "customer churn",
      acquisition: "acquisition",
      product: "product",
      upsell: "upsell",
      pipeline: "purchase funnel",
    },
    marketplace: {
      customer: "user",
      revenue: "GMV",
      churn: "user churn",
      acquisition: "user signup",
      product: "marketplace",
      upsell: "premium listing",
      pipeline: "transaction flow",
    },
    other: {
      customer: "customer",
      revenue: "revenue",
      churn: "customer loss",
      acquisition: "new business",
      product: "offering",
      upsell: "additional services",
      pipeline: "sales process",
    },
  };

  return {
    businessType,
    terms: TERMINOLOGY_MAP[businessType] || TERMINOLOGY_MAP.other,
  };
}

/** Format terminology instructions for AI prompts */
export function terminologyPromptBlock(t: BusinessTerminology): string {
  return `
BUSINESS TERMINOLOGY (use these terms consistently):
- Business type: ${t.businessType}
- Refer to their buyers as "${t.terms.customer}" (not "client" or "user" unless that's what's listed)
- Revenue metric: ${t.terms.revenue}
- Churn metric: ${t.terms.churn}
- New business: ${t.terms.acquisition}
- Their offering: ${t.terms.product}
- Growth lever: ${t.terms.upsell}
- Sales process: ${t.terms.pipeline}
`.trim();
}
