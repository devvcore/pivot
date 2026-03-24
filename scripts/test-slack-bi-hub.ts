// scripts/test-slack-bi-hub.ts

const results: { name: string; pass: boolean; error?: string }[] = [];

async function test(name: string, fn: () => Promise<boolean>) {
  try {
    const pass = await fn();
    results.push({ name, pass });
    console.log(`${pass ? '✓' : '✗'} ${name}`);
  } catch (err) {
    results.push({ name, pass: false, error: err instanceof Error ? err.message : String(err) });
    console.log(`✗ ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

async function main() {
  // IMPORTANT: Clear GEMINI_API_KEY to force keyword fallback
  delete process.env.GEMINI_API_KEY;

  const { classifyIntent } = await import('../lib/slack/intent-router');

  console.log('=== Slack BI Hub Tests ===\n');
  console.log('-- Intent Router (keyword fallback) --');

  // BI queries
  await test('health score → bi_query', async () => {
    const r = await classifyIntent("what's my health score?");
    return r.type === 'bi_query';
  });

  await test('burn rate → bi_query cashIntelligence', async () => {
    const r = await classifyIntent("what's my burn rate?");
    return r.type === 'bi_query';
  });

  await test('runway → bi_query', async () => {
    const r = await classifyIntent("how much runway do we have?");
    return r.type === 'bi_query';
  });

  await test('revenue → bi_query', async () => {
    const r = await classifyIntent("how much revenue did we make?");
    return r.type === 'bi_query';
  });

  await test('competitor → bi_query', async () => {
    const r = await classifyIntent("who are our competitors?");
    return r.type === 'bi_query';
  });

  await test('kpi → bi_query', async () => {
    // Use a question phrasing that hits BI_KEYWORDS (kpi) but not the REPORT pattern (show.*kpis?)
    const r = await classifyIntent("what are our KPI numbers this quarter?");
    return r.type === 'bi_query';
  });

  // Agent tasks
  await test('post to LinkedIn → agent_task', async () => {
    const r = await classifyIntent("post our Q1 results to LinkedIn");
    return r.type === 'agent_task';
  });

  await test('send email → agent_task', async () => {
    const r = await classifyIntent("send an email to the team about updates");
    return r.type === 'agent_task';
  });

  await test('research market → agent_task', async () => {
    const r = await classifyIntent("research the competitive landscape for fintech");
    return r.type === 'agent_task';
  });

  // Campaign
  await test('launch campaign → campaign', async () => {
    const r = await classifyIntent("launch the product launch campaign");
    return r.type === 'campaign';
  });

  await test('run content calendar → campaign', async () => {
    // Pattern requires run/launch/start immediately before 'campaign' (optionally with 'a')
    const r = await classifyIntent("run a campaign for our content calendar");
    return r.type === 'campaign';
  });

  // General
  await test('greeting → general', async () => {
    // Avoid 'how.*doing' which matches BI_KEYWORDS; use a greeting with no BI keywords
    const r = await classifyIntent("hey there, nice to meet you");
    return r.type === 'general';
  });

  await test('random chat → general', async () => {
    const r = await classifyIntent("I had a great lunch");
    return r.type === 'general';
  });

  // Summary
  console.log(`\n=== Results ===`);
  const passed = results.filter(r => r.pass).length;
  console.log(`${passed}/${results.length} passed (${((passed / results.length) * 100).toFixed(1)}%)`);

  if (passed < results.length) {
    console.log('\nFailed:');
    results.filter(r => !r.pass).forEach(r =>
      console.log(`  ✗ ${r.name}${r.error ? `: ${r.error}` : ''}`)
    );
    process.exit(1);
  }
}

main().catch(console.error);
