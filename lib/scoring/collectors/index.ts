// ================================================================
// Pivot -- Score Collectors Index
// Unified entry point that runs all available collectors in parallel
// and merges their dimension scores.
// ================================================================

import { createAdminClient } from '@/lib/supabase/admin';

import { collectSlackMetrics } from './slack';
import { collectGitHubMetrics } from './github';
import { collectJiraMetrics } from './jira';
import { collectGmailMetrics } from './gmail';

// ── Types ───────────────────────────────────────────────────────

export interface CollectorResult {
  source: string; // 'slack' | 'github' | 'jira' | 'gmail'
  dimensions: {
    responsiveness: number | null;
    outputVolume: number | null;
    qualitySignal: number | null;
    collaboration: number | null;
    reliability: number | null;
  };
}

export interface MergedDimensionData {
  dimensions: {
    responsiveness: number | null;
    outputVolume: number | null;
    qualitySignal: number | null;
    collaboration: number | null;
    reliability: number | null;
  };
  dataSources: string[];
}

type DimensionKey = keyof CollectorResult['dimensions'];

const ALL_DIMENSIONS: DimensionKey[] = [
  'responsiveness',
  'outputVolume',
  'qualitySignal',
  'collaboration',
  'reliability',
];

// ── Main entry point ────────────────────────────────────────────

/**
 * Runs all available score collectors in parallel for a given employee,
 * merges their results (averaging when multiple collectors score the
 * same dimension), and returns the unified dimension data.
 */
export async function collectDimensionData(
  employeeId: string,
  orgId: string,
): Promise<MergedDimensionData> {
  // Check which integrations are connected for this org
  const supabase = createAdminClient();
  const { data: integrations } = await supabase
    .from('integrations')
    .select('provider, status')
    .eq('org_id', orgId)
    .eq('status', 'connected');

  const connectedProviders = new Set(
    (integrations ?? []).map((i) => i.provider as string),
  );

  // Build collector list based on connected integrations
  const collectorPromises: Promise<CollectorResult>[] = [];

  if (connectedProviders.has('slack')) {
    collectorPromises.push(collectSlackMetrics(employeeId, orgId));
  }
  if (connectedProviders.has('github')) {
    collectorPromises.push(collectGitHubMetrics(employeeId, orgId));
  }
  if (connectedProviders.has('jira')) {
    collectorPromises.push(collectJiraMetrics(employeeId, orgId));
  }
  if (connectedProviders.has('gmail')) {
    collectorPromises.push(collectGmailMetrics(employeeId, orgId));
  }

  // If no integrations are connected, return all nulls
  if (collectorPromises.length === 0) {
    return {
      dimensions: {
        responsiveness: null,
        outputVolume: null,
        qualitySignal: null,
        collaboration: null,
        reliability: null,
      },
      dataSources: [],
    };
  }

  // Run all collectors in parallel — never let one failure kill everything
  const results = await Promise.allSettled(collectorPromises);

  const successfulResults: CollectorResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      successfulResults.push(result.value);
    } else {
      console.error(
        '[score-collectors] Collector failed:',
        result.reason,
      );
    }
  }

  // Merge results: average scores across collectors for each dimension
  const merged: MergedDimensionData['dimensions'] = {
    responsiveness: null,
    outputVolume: null,
    qualitySignal: null,
    collaboration: null,
    reliability: null,
  };

  for (const dim of ALL_DIMENSIONS) {
    const scores: number[] = [];
    for (const result of successfulResults) {
      const score = result.dimensions[dim];
      if (score !== null) {
        scores.push(score);
      }
    }

    if (scores.length > 0) {
      merged[dim] = Math.round(
        scores.reduce((sum, s) => sum + s, 0) / scores.length,
      );
    }
  }

  // Collect data sources that actually contributed non-null scores
  const dataSources = successfulResults
    .filter((r) =>
      ALL_DIMENSIONS.some((dim) => r.dimensions[dim] !== null),
    )
    .map((r) => r.source);

  return {
    dimensions: merged,
    dataSources,
  };
}

// ── Re-exports for direct use ───────────────────────────────────

export { collectSlackMetrics } from './slack';
export { collectGitHubMetrics } from './github';
export { collectJiraMetrics } from './jira';
export { collectGmailMetrics } from './gmail';
