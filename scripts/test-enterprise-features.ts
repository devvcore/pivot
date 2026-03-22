/**
 * Enterprise Features Test Suite
 *
 * Tests pure functions from model-router and campaign-templates.
 * No DB or API calls required.
 *
 * Run with: npx tsx scripts/test-enterprise-features.ts
 */

import { selectModel, MODELS, calculateCost, getModelConfig } from '../lib/execution/model-router';
import {
  listCampaignTemplates,
  getCampaignTemplate,
  getTemplatesByCategory,
} from '../lib/execution/campaign-templates';

const results: { name: string; pass: boolean; error?: string }[] = [];

async function test(name: string, fn: () => boolean | Promise<boolean>) {
  try {
    const pass = await fn();
    results.push({ name, pass });
    console.log(`${pass ? '✓' : '✗'} ${name}`);
  } catch (err) {
    results.push({ name, pass: false, error: err instanceof Error ? err.message : String(err) });
    console.log(`✗ ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

// --- Helpers ---
function baseSignals(overrides: Partial<Parameters<typeof selectModel>[0]> = {}): Parameters<typeof selectModel>[0] {
  return {
    triageLevel: 'standard',
    agentId: 'marketer',
    taskTitle: 'Write a blog post',
    taskDescription: 'Write a short blog post about our product',
    costCeiling: 1.00,
    costSpent: 0.00,
    hasIntegrationData: false,
    toolCount: 5,
    ...overrides,
  };
}

async function main() {
  console.log('=== Enterprise Features Test Suite ===\n');

  // ─── Model Router Tests ───────────────────────────────────────────────────

  console.log('-- Model Router --');

  await test('QUICK task → flash', () => {
    const model = selectModel(baseSignals({ triageLevel: 'quick' }));
    return model.tier === 'flash';
  });

  await test('HEAVY task → pro', () => {
    const model = selectModel(baseSignals({ triageLevel: 'heavy' }));
    return model.tier === 'pro';
  });

  await test('Strategist agent → pro (regardless of triage level)', () => {
    const model = selectModel(baseSignals({ agentId: 'strategist', triageLevel: 'standard' }));
    return model.tier === 'pro';
  });

  await test('Low budget (<$0.05 remaining) → flash (overrides everything)', () => {
    // Even strategist + heavy should fall back to flash when budget is tight
    const model = selectModel(baseSignals({
      agentId: 'strategist',
      triageLevel: 'heavy',
      costCeiling: 0.10,
      costSpent: 0.07, // remaining = 0.03 < 0.05
    }));
    return model.tier === 'flash';
  });

  await test('Strategy keyword in title → pro', () => {
    const model = selectModel(baseSignals({ taskTitle: 'Go-to-market strategy for Q3' }));
    return model.tier === 'pro';
  });

  await test('Many tools (>15) → pro', () => {
    const model = selectModel(baseSignals({ toolCount: 16 }));
    return model.tier === 'pro';
  });

  await test('Standard task with no signals → flash (default)', () => {
    const model = selectModel(baseSignals());
    return model.tier === 'flash';
  });

  await test('Pro model has higher maxOutputTokens than flash', () => {
    return MODELS.pro.maxOutputTokens > MODELS.flash.maxOutputTokens;
  });

  await test('Deep model has higher maxOutputTokens than pro', () => {
    return MODELS.deep.maxOutputTokens > MODELS.pro.maxOutputTokens;
  });

  await test('calculateCost returns correct value', () => {
    // flash: input 0.15/M, output 0.60/M
    // 1000 input tokens + 2000 output tokens
    // = (1000/1_000_000)*0.15 + (2000/1_000_000)*0.60
    // = 0.00015 + 0.0012 = 0.00135
    const cost = calculateCost(MODELS.flash, 1000, 2000);
    const expected = (1000 / 1_000_000) * 0.15 + (2000 / 1_000_000) * 0.60;
    return Math.abs(cost - expected) < 1e-10;
  });

  // ─── Model Config Tests ───────────────────────────────────────────────────

  console.log('\n-- Model Config --');

  await test("Flash model ID is 'gemini-2.5-flash'", () => {
    return MODELS.flash.id === 'gemini-2.5-flash';
  });

  await test("Pro model ID is 'gemini-2.5-pro'", () => {
    return MODELS.pro.id === 'gemini-2.5-pro';
  });

  await test('Flash is cheapest (lowest inputPricePerMillion)', () => {
    return (
      MODELS.flash.inputPricePerMillion <= MODELS.pro.inputPricePerMillion &&
      MODELS.flash.inputPricePerMillion <= MODELS.deep.inputPricePerMillion
    );
  });

  await test('All models have strengths array with at least 3 items', () => {
    return Object.values(MODELS).every(m => Array.isArray(m.strengths) && m.strengths.length >= 3);
  });

  // ─── Campaign Template Tests ──────────────────────────────────────────────

  console.log('\n-- Campaign Templates --');

  const VALID_AGENT_IDS = new Set([
    'strategist', 'marketer', 'analyst', 'recruiter', 'operator', 'researcher', 'codebot',
  ]);

  await test('Has exactly 5 templates', () => {
    return listCampaignTemplates().length === 5;
  });

  await test('product-launch template exists with 7 steps', () => {
    const t = getCampaignTemplate('product-launch');
    return t !== undefined && t.steps.length === 7;
  });

  await test('content-calendar-week has 5 steps', () => {
    const t = getCampaignTemplate('content-calendar-week');
    return t !== undefined && t.steps.length === 5;
  });

  await test('hiring-pipeline has 5 steps', () => {
    const t = getCampaignTemplate('hiring-pipeline');
    return t !== undefined && t.steps.length === 5;
  });

  await test('financial-review has 5 steps', () => {
    const t = getCampaignTemplate('financial-review');
    return t !== undefined && t.steps.length === 5;
  });

  await test('competitor-intel has 5 steps', () => {
    const t = getCampaignTemplate('competitor-intel');
    return t !== undefined && t.steps.length === 5;
  });

  await test('All templates use valid agent IDs', () => {
    return listCampaignTemplates().every(template =>
      template.steps.every(step => VALID_AGENT_IDS.has(step.agentId))
    );
  });

  await test('All dependencies reference valid step numbers (1-indexed, within range)', () => {
    return listCampaignTemplates().every(template => {
      const stepCount = template.steps.length;
      return template.steps.every((step, idx) => {
        if (!step.dependsOn) return true;
        return step.dependsOn.every(dep => dep >= 1 && dep <= stepCount && dep !== idx + 1);
      });
    });
  });

  await test('product-launch last step has delayMinutes: 1440', () => {
    const t = getCampaignTemplate('product-launch');
    if (!t) return false;
    const lastStep = t.steps[t.steps.length - 1];
    return lastStep.delayMinutes === 1440;
  });

  await test("getTemplatesByCategory('marketing') returns 2 templates", () => {
    return getTemplatesByCategory('marketing').length === 2;
  });

  await test("getCampaignTemplate('nonexistent') returns undefined", () => {
    return getCampaignTemplate('nonexistent') === undefined;
  });

  // ─── Summary ─────────────────────────────────────────────────────────────

  console.log(`\n=== Results ===`);
  const passed = results.filter(r => r.pass).length;
  console.log(`${passed}/${results.length} passed (${((passed / results.length) * 100).toFixed(1)}%)`);

  if (passed < results.length) {
    console.log('\nFailed:');
    results
      .filter(r => !r.pass)
      .forEach(r => console.log(`  ✗ ${r.name}${r.error ? `: ${r.error}` : ''}`));
    process.exit(1);
  }
}

main().catch(console.error);
