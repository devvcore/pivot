// ================================================================
// Pivot -- Slack Score Collector
// Extracts per-employee metrics from Slack integration data
// and maps them to scoring dimensions.
// ================================================================

import { createAdminClient } from '@/lib/supabase/admin';

import type { CollectorResult } from './index';

// ── Time-weight buckets (30-day rolling) ────────────────────────

function getTimeWeight(dateStr: string): number {
  const now = Date.now();
  const eventTime = new Date(dateStr).getTime();
  const daysAgo = (now - eventTime) / (1000 * 60 * 60 * 24);

  if (daysAgo <= 7) return 3;
  if (daysAgo <= 14) return 2;
  if (daysAgo <= 30) return 1;
  return 0; // older than 30 days — excluded
}

function weightedAverage(values: { value: number; weight: number }[]): number | null {
  const valid = values.filter((v) => v.weight > 0);
  if (valid.length === 0) return null;

  const totalWeight = valid.reduce((sum, v) => sum + v.weight, 0);
  const weightedSum = valid.reduce((sum, v) => sum + v.value * v.weight, 0);
  return Math.round(weightedSum / totalWeight);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ── Collector ───────────────────────────────────────────────────

export async function collectSlackMetrics(
  employeeId: string,
  orgId: string,
): Promise<CollectorResult> {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Look up the employee's slack_user_id and name
  const { data: employee } = await supabase
    .from('employees')
    .select('slack_user_id, name, email')
    .eq('id', employeeId)
    .single();

  if (!employee) {
    return {
      source: 'slack',
      dimensions: {
        responsiveness: null,
        outputVolume: null,
        qualitySignal: null,
        collaboration: null,
        reliability: null,
      },
    };
  }

  const slackUserId = employee.slack_user_id;
  const employeeName = employee.name;

  // 2. Fetch communication_insights for this org from Slack within last 30 days
  const { data: insights } = await supabase
    .from('communication_insights')
    .select('*')
    .eq('org_id', orgId)
    .eq('source', 'slack')
    .gte('created_at', thirtyDaysAgo);

  const allInsights = insights ?? [];

  // Filter insights relevant to this employee
  // subject_name can be the employee's name, or contain it (e.g., "Alice <-> Bob")
  const employeeInsights = allInsights.filter((row) => {
    const subject = row.subject_name ?? '';
    return (
      subject === employeeName ||
      subject.includes(employeeName) ||
      (slackUserId && row.data?.user_id === slackUserId) ||
      (slackUserId && row.data?.sender_id === slackUserId)
    );
  });

  // ── Responsiveness: DM reply time, thread response time ───────

  const responseTimeInsights = employeeInsights.filter(
    (i) => i.insight_type === 'response_time',
  );

  let responsiveness: number | null = null;
  if (responseTimeInsights.length > 0) {
    const scores = responseTimeInsights.map((i) => {
      const data = i.data ?? {};
      // data may contain avg_response_minutes, score, etc.
      // Best-effort: use a direct score if present, otherwise derive from response time
      let score: number;
      if (typeof data.score === 'number') {
        score = data.score;
      } else if (typeof data.avg_response_minutes === 'number') {
        // Under 5 min = 100, under 15 = 80, under 30 = 60, under 60 = 40, over 60 = 20
        const mins = data.avg_response_minutes;
        if (mins <= 5) score = 100;
        else if (mins <= 15) score = 85;
        else if (mins <= 30) score = 65;
        else if (mins <= 60) score = 45;
        else if (mins <= 120) score = 25;
        else score = 10;
      } else {
        score = 50; // default mid-score if data is unclear
      }
      return {
        value: clamp(score),
        weight: getTimeWeight(i.created_at),
      };
    });
    responsiveness = weightedAverage(scores);
  }

  // ── Output Volume: messages sent, threads started ─────────────

  const engagementInsights = employeeInsights.filter(
    (i) => i.insight_type === 'engagement',
  );

  let outputVolume: number | null = null;
  if (engagementInsights.length > 0) {
    const scores = engagementInsights.map((i) => {
      const data = i.data ?? {};
      let score: number;
      if (typeof data.engagement_score === 'number') {
        score = data.engagement_score;
      } else if (typeof data.score === 'number') {
        score = data.score;
      } else {
        // Try to derive from message counts
        const messageCount = data.messages_sent ?? data.message_count ?? 0;
        // Rough heuristic: 0-5 msgs/day = low, 5-15 = medium, 15+ = high
        // Over 30 days, we expect a baseline. Normalize per day if period is available.
        const days = data.period_days ?? 30;
        const perDay = messageCount / Math.max(days, 1);
        if (perDay >= 15) score = 90;
        else if (perDay >= 10) score = 75;
        else if (perDay >= 5) score = 60;
        else if (perDay >= 2) score = 40;
        else score = 20;
      }
      return {
        value: clamp(score),
        weight: getTimeWeight(i.created_at),
      };
    });
    outputVolume = weightedAverage(scores);
  }

  // ── Collaboration: cross-team threads, reactions given ─────────

  const relationshipInsights = employeeInsights.filter(
    (i) =>
      i.insight_type === 'relationship_score' ||
      i.insight_type === 'engagement',
  );

  let collaboration: number | null = null;
  if (relationshipInsights.length > 0) {
    const scores = relationshipInsights.map((i) => {
      const data = i.data ?? {};
      let score: number;
      if (typeof data.collaboration_score === 'number') {
        score = data.collaboration_score;
      } else if (typeof data.relationship_score === 'number') {
        score = data.relationship_score;
      } else if (typeof data.score === 'number') {
        score = data.score;
      } else {
        // Derive from cross-channel participation, reactions given
        const crossTeamThreads = data.cross_team_threads ?? data.threads_participated ?? 0;
        const reactionsGiven = data.reactions_given ?? 0;
        const combined = crossTeamThreads * 3 + reactionsGiven;
        // Normalize: 0 = 10, 50+ = 90
        score = Math.min(90, 10 + combined * 1.6);
      }
      return {
        value: clamp(score),
        weight: getTimeWeight(i.created_at),
      };
    });
    collaboration = weightedAverage(scores);
  }

  return {
    source: 'slack',
    dimensions: {
      responsiveness,
      outputVolume,
      qualitySignal: null, // Slack does not provide quality signals
      collaboration,
      reliability: null, // Slack does not provide reliability signals
    },
  };
}
