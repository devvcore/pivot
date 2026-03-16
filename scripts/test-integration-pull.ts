/**
 * Test script: Verify pullFreshIntegrationData works with connected integrations.
 * Usage: export $(grep -v '^#' .env | xargs) && npx tsx scripts/test-integration-pull.ts
 */
import { pullFreshIntegrationData, collectIntegrationContext } from '../lib/integrations/collect';
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  // List connected integrations
  const { data: integrations, error } = await supabase
    .from('integrations')
    .select('org_id, provider, status')
    .eq('status', 'connected')
    .limit(20);

  if (error) {
    console.log('Error querying integrations:', error.message);
    process.exit(1);
  }

  console.log('Connected integrations:', JSON.stringify(integrations, null, 2));

  if (!integrations || integrations.length === 0) {
    console.log('No connected integrations found');
    process.exit(0);
  }

  const orgId = integrations[0].org_id;
  console.log('\nUsing orgId:', orgId);
  const providers = integrations.map((i: any) => i.provider);
  console.log('Connected providers:', providers.join(', '));

  // Run the fresh pull
  console.log('\n=== Running pullFreshIntegrationData ===');
  const start = Date.now();
  await pullFreshIntegrationData(orgId);
  const elapsed = Date.now() - start;
  console.log(`Pull completed in ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);

  // Now collect and see what we got
  console.log('\n=== Running collectIntegrationContext ===');
  const ctx = await collectIntegrationContext(orgId);
  console.log('Providers with data:', ctx.providers.join(', '));
  console.log('Total records:', ctx.records.length);
  console.log('Last synced:', ctx.lastSyncedAt);

  for (const rec of ctx.records) {
    let dataPreview: string;
    if (rec.data === null || rec.data === undefined) {
      dataPreview = '(null)';
    } else if (Array.isArray(rec.data)) {
      dataPreview = `${rec.data.length} items`;
      if (rec.data.length > 0 && typeof rec.data[0] === 'object') {
        dataPreview += ` (keys: ${Object.keys(rec.data[0]).slice(0, 4).join(', ')})`;
      }
    } else if (typeof rec.data === 'object') {
      const keys = Object.keys(rec.data);
      dataPreview = `{${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}}`;
    } else {
      dataPreview = String(rec.data).slice(0, 100);
    }
    console.log(`  - ${rec.provider}/${rec.recordType}: ${dataPreview}`);
  }

  console.log('\n=== RESULT: SUCCESS ===');
}

main().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
