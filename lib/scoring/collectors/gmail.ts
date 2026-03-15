// ================================================================
// Pivot -- Gmail Score Collector
// Extracts per-employee metrics from Gmail integration data
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
  return 0;
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

export async function collectGmailMetrics(
  employeeId: string,
  orgId: string,
): Promise<CollectorResult> {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Look up the employee's email and name
  const { data: employee } = await supabase
    .from('employees')
    .select('name, email')
    .eq('id', employeeId)
    .single();

  if (!employee) {
    return {
      source: 'gmail',
      dimensions: {
        responsiveness: null,
        outputVolume: null,
        qualitySignal: null,
        collaboration: null,
        reliability: null,
      },
    };
  }

  const employeeName = employee.name;
  const employeeEmail = employee.email?.toLowerCase() ?? '';

  // 2. Fetch communication_insights for this org from Gmail within last 30 days
  const { data: insights } = await supabase
    .from('communication_insights')
    .select('*')
    .eq('org_id', orgId)
    .eq('source', 'gmail')
    .gte('created_at', thirtyDaysAgo);

  const allInsights = insights ?? [];

  // Filter insights relevant to this employee
  const employeeInsights = allInsights.filter((row) => {
    const subject = (row.subject_name ?? '').toLowerCase();
    const data = row.data ?? {};
    return (
      subject === employeeName?.toLowerCase() ||
      subject.includes(employeeName?.toLowerCase() ?? '') ||
      data.email === employeeEmail ||
      data.from_email === employeeEmail ||
      data.sender_email === employeeEmail
    );
  });

  // ── Responsiveness: email reply speed ─────────────────────────

  const responseTimeInsights = employeeInsights.filter(
    (i) => i.insight_type === 'response_time',
  );

  let responsiveness: number | null = null;
  if (responseTimeInsights.length > 0) {
    const scores = responseTimeInsights.map((i) => {
      const data = i.data ?? {};
      let score: number;

      if (typeof data.score === 'number') {
        score = data.score;
      } else if (typeof data.avg_response_minutes === 'number') {
        const mins = data.avg_response_minutes;
        // Email expectations are slower than Slack
        if (mins <= 15) score = 100;
        else if (mins <= 30) score = 85;
        else if (mins <= 60) score = 70;
        else if (mins <= 120) score = 55;
        else if (mins <= 240) score = 40;
        else if (mins <= 480) score = 25;
        else score = 10;
      } else if (typeof data.avg_response_hours === 'number') {
        const hours = data.avg_response_hours;
        if (hours <= 0.5) score = 100;
        else if (hours <= 1) score = 85;
        else if (hours <= 2) score = 70;
        else if (hours <= 4) score = 55;
        else if (hours <= 8) score = 40;
        else if (hours <= 24) score = 25;
        else score = 10;
      } else {
        score = 50;
      }
      return {
        value: clamp(score),
        weight: getTimeWeight(i.created_at),
      };
    });
    responsiveness = weightedAverage(scores);
  }

  // ── Output Volume: emails sent ────────────────────────────────

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
        // Derive from email counts
        const emailsSent = data.emails_sent ?? data.message_count ?? data.sent_count ?? 0;
        const days = data.period_days ?? 30;
        const perDay = emailsSent / Math.max(days, 1);

        // Email volume is typically lower than Slack messages
        if (perDay >= 20) score = 90;
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

  // ── Collaboration: threads with multiple people ───────────────

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
        // Derive from unique recipients / thread participation
        const uniqueRecipients = data.unique_recipients ?? data.contacts_count ?? 0;
        const threadCount = data.threads_participated ?? data.thread_count ?? 0;
        const combined = uniqueRecipients * 2 + threadCount;

        // Normalize: more unique contacts + threads = more collaborative
        if (combined >= 50) score = 90;
        else if (combined >= 30) score = 75;
        else if (combined >= 15) score = 55;
        else if (combined >= 5) score = 35;
        else score = 15;
      }
      return {
        value: clamp(score),
        weight: getTimeWeight(i.created_at),
      };
    });
    collaboration = weightedAverage(scores);
  }

  // ── Reliability: follow-up rate ───────────────────────────────

  let reliability: number | null = null;

  // Look for engagement insights that track follow-up behavior
  const followUpInsights = employeeInsights.filter(
    (i) =>
      i.insight_type === 'engagement' ||
      i.insight_type === 'risk_flag',
  );

  if (followUpInsights.length > 0) {
    const reliabilityScores: { value: number; weight: number }[] = [];

    for (const i of followUpInsights) {
      const data = i.data ?? {};

      // Direct follow-up rate if available
      if (typeof data.follow_up_rate === 'number') {
        reliabilityScores.push({
          value: clamp(data.follow_up_rate * 100),
          weight: getTimeWeight(i.created_at),
        });
      }

      // Dropped threads signal unreliability
      if (typeof data.dropped_threads === 'number' && typeof data.total_threads === 'number') {
        const dropRate = data.total_threads > 0
          ? data.dropped_threads / data.total_threads
          : 0;
        // Lower drop rate = more reliable
        const score = Math.max(10, 100 - dropRate * 200);
        reliabilityScores.push({
          value: clamp(score),
          weight: getTimeWeight(i.created_at),
        });
      }

      // Risk flags about unresponsiveness decrease reliability
      if (
        i.insight_type === 'risk_flag' &&
        typeof data.severity === 'string'
      ) {
        let penaltyScore: number;
        switch (data.severity) {
          case 'critical': penaltyScore = 15; break;
          case 'high': penaltyScore = 30; break;
          case 'medium': penaltyScore = 50; break;
          default: penaltyScore = 70; break;
        }
        reliabilityScores.push({
          value: clamp(penaltyScore),
          weight: getTimeWeight(i.created_at),
        });
      }
    }

    if (reliabilityScores.length > 0) {
      reliability = weightedAverage(reliabilityScores);
    }
  }

  return {
    source: 'gmail',
    dimensions: {
      responsiveness,
      outputVolume,
      qualitySignal: null, // Gmail does not provide quality signals
      collaboration,
      reliability,
    },
  };
}
