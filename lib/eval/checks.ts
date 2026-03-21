/**
 * Quality Checks Library
 *
 * Consolidated check functions used across all eval suites.
 * Each check maps to a scoring dimension (accuracy, hallucination, relevance, quality, efficiency).
 */

import type { QualityCheck, CheckMeta } from './types';

// ── Accuracy Checks ──────────────────────────────────────────────────────────

export function containsAny(...keywords: string[]): QualityCheck {
  return {
    name: `Contains: ${keywords.slice(0, 3).join('/')}${keywords.length > 3 ? '...' : ''}`,
    dimension: 'accuracy',
    check: (r) => {
      const lower = r.toLowerCase();
      return keywords.some(k => lower.includes(k.toLowerCase()));
    },
  };
}

export function containsAll(...keywords: string[]): QualityCheck {
  return {
    name: `Contains all: ${keywords.slice(0, 3).join('/')}${keywords.length > 3 ? '...' : ''}`,
    dimension: 'accuracy',
    check: (r) => {
      const lower = r.toLowerCase();
      return keywords.every(k => lower.includes(k.toLowerCase()));
    },
  };
}

export function hasConnectMarker(provider: string): QualityCheck {
  return {
    name: `Has [connect:${provider}]`,
    dimension: 'accuracy',
    check: (r) => r.includes(`[connect:${provider}]`),
  };
}

export function usedTool(toolName: string): QualityCheck {
  return {
    name: `Used tool: ${toolName}`,
    dimension: 'accuracy',
    check: (_r, meta) => meta?.toolsUsed?.includes(toolName) ?? false,
  };
}

export function didNotUseTool(toolName: string): QualityCheck {
  return {
    name: `Did not use: ${toolName}`,
    dimension: 'accuracy',
    check: (_r, meta) => !(meta?.toolsUsed?.includes(toolName) ?? false),
  };
}

export function matchesPattern(name: string, pattern: RegExp): QualityCheck {
  return {
    name,
    dimension: 'accuracy',
    check: (r) => pattern.test(r),
  };
}

// ── Hallucination Checks ─────────────────────────────────────────────────────

export function noHallucination(): QualityCheck {
  return {
    name: 'No hallucination markers',
    dimension: 'hallucination',
    check: (r) => {
      const lower = r.toLowerCase();
      const redFlags = [
        '"as a [', 'john doe', 'jane doe', 'xyz corp', 'abc company',
        'acme corp', 'acme inc', 'sample company', 'test company',
      ];
      return !redFlags.some(f => lower.includes(f));
    },
  };
}

export function noFabricatedNumbers(): QualityCheck {
  return {
    name: 'No fabricated financials',
    dimension: 'hallucination',
    check: (r) => {
      const lower = r.toLowerCase();
      // Red flags: suspiciously round numbers in expense breakdowns without data source
      const patterns = [
        /estimated burn rate.*\$[\d,]+/i,
        /operations:\s*\$[\d,]+.*marketing:\s*\$[\d,]+/i,
        /monthly expenses.*\$[\d,]+.*\$[\d,]+.*\$[\d,]+/i,
      ];
      return !patterns.some(p => p.test(lower));
    },
  };
}

export function noPlaceholders(): QualityCheck {
  return {
    name: 'No bracket placeholders',
    dimension: 'relevance',
    check: (r) => {
      // Catch ANY bracket that looks like a placeholder or template
      // Only allow: [from X] (source citations), [connect:X] (connection markers)
      const brackets = r.match(/\[[^\]]{3,}\]/g) ?? [];
      const badBrackets = brackets.filter(b => {
        const lower = b.toLowerCase();
        // These are valid, structured markers — allow them
        if (lower.startsWith('[from ')) return false;
        if (lower.startsWith('[connect:')) return false;
        if (lower.startsWith('[source:')) return false;
        // Everything else with placeholder-like content is bad
        return (
          lower.includes('name') || lower.includes('project') || lower.includes('insert') ||
          lower.includes('mention') || lower.includes('your ') || lower.includes('client') ||
          lower.includes('company') || lower.includes('website') || lower.includes('e.g.') ||
          lower.includes('benchmark') || lower.includes('estimated') || lower.includes('placeholder') ||
          lower.includes('specify') || lower.includes('enter ') || lower.includes('fill in') ||
          lower.includes('tbd') || lower.includes('example')
        );
      });
      return badBrackets.length === 0;
    },
  };
}

export function noAITells(): QualityCheck {
  return {
    name: 'No AI chatbot tells',
    dimension: 'quality',
    check: (r) => {
      const lower = r.toLowerCase();
      const tells = [
        'as an ai', 'as a language model', 'i\'d be happy to', 'certainly!',
        'great question!', 'absolutely!', 'i hope this helps',
        'let me help you with that', 'sure thing!', 'of course!',
      ];
      return !tells.some(t => lower.includes(t));
    },
  };
}

export function noFakeTestimonials(): QualityCheck {
  return {
    name: 'No fake testimonials',
    dimension: 'hallucination',
    check: (r) => {
      const lower = r.toLowerCase();
      const patterns = [
        /case study:.*"[^"]{50,}"/i,
        /testimonial.*"[^"]{30,}".*(?:ceo|cto|founder)/i,
      ];
      return !patterns.some(p => p.test(lower));
    },
  };
}

// ── Relevance Checks ─────────────────────────────────────────────────────────

export function notGeneric(): QualityCheck {
  return {
    name: 'Not generic filler',
    dimension: 'relevance',
    check: (r) => {
      const lower = r.toLowerCase();
      const genericPhrases = [
        'lorem ipsum', 'insert company name', 'your company name here',
        '[company name]', '[your company]', '[your name]', '[insert',
        'placeholder', 'example company', 'xyz corp', 'abc company',
      ];
      return !genericPhrases.some(p => lower.includes(p));
    },
  };
}

export function noVerboseGuidance(): QualityCheck {
  return {
    name: 'No verbose connection guidance',
    dimension: 'relevance',
    check: (r) => {
      const lower = r.toLowerCase();
      const bannedPhrases = [
        'settings → integrations', 'settings > integrations',
        'connect via settings', 'go to settings',
        'navigate to integrations', 'click the connection panel',
      ];
      return !bannedPhrases.some(p => lower.includes(p));
    },
  };
}

export function minLength(n: number): QualityCheck {
  return {
    name: `Output > ${n} chars`,
    dimension: 'relevance',
    check: (r) => r.length > n,
  };
}

export function maxLength(n: number): QualityCheck {
  return {
    name: `Output < ${n} chars`,
    dimension: 'relevance',
    check: (r) => r.length < n,
  };
}

// ── Quality Checks ───────────────────────────────────────────────────────────

export function isConversational(): QualityCheck {
  return {
    name: 'Conversational tone',
    dimension: 'quality',
    check: (r) => {
      const lower = r.toLowerCase();
      const markers = [
        'would you like', 'want me to', 'next step', 'let me know',
        'shall i', 'i can also', "here's what", 'here are',
        'happy to', 'i recommend', "i'd suggest", 'should i',
        "i've", 'i found', 'i pulled',
      ];
      return markers.some(m => lower.includes(m));
    },
  };
}

export function usesMarkdown(): QualityCheck {
  return {
    name: 'Uses markdown',
    dimension: 'quality',
    check: (r) => /#{1,3}\s/.test(r) || /\*\*[^*]+\*\*/.test(r),
  };
}

export function hasHeaders(): QualityCheck {
  return {
    name: 'Has section headers',
    dimension: 'quality',
    check: (r) => /^#{1,3}\s/m.test(r),
  };
}

export function hasBulletPoints(): QualityCheck {
  return {
    name: 'Has bullet points',
    dimension: 'quality',
    check: (r) => /^[\s]*[-*•]\s/m.test(r),
  };
}

export function hasNumberedList(): QualityCheck {
  return {
    name: 'Has numbered list',
    dimension: 'quality',
    check: (r) => /^\s*\d+[.)]\s/m.test(r),
  };
}

// ── Efficiency Checks ────────────────────────────────────────────────────────

export function maxToolCalls(n: number): QualityCheck {
  return {
    name: `≤${n} tool calls`,
    dimension: 'efficiency',
    check: (_r, meta) => (meta?.toolCalls ?? 0) <= n,
  };
}

export function maxLatency(ms: number): QualityCheck {
  return {
    name: `Latency < ${ms}ms`,
    dimension: 'efficiency',
    check: (_r, meta) => (meta?.latencyMs ?? 0) < ms,
  };
}

export function maxTokens(n: number): QualityCheck {
  return {
    name: `≤${n} tokens`,
    dimension: 'efficiency',
    check: (_r, meta) => (meta?.tokensUsed ?? 0) <= n,
  };
}
