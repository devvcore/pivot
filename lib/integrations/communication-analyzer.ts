// ================================================================
// Pivot -- Unified Communication Analyzer
// Combines Slack + Gmail insights into a comprehensive
// CommunicationReport with scores, rankings, and recommendations.
// ================================================================

import type { CommunicationInsight } from "@/lib/integrations/types";

// ── Report Types ────────────────────────────────────────────────

export interface CommunicationReport {
  teamHealthScore: number; // 0-100
  topFindings: string[];
  employeeRankings: EmployeeCommRanking[];
  bottlenecks: BottleneckInfo[];
  relationshipMap: RelationshipEdge[];
  recommendations: string[];
  riskFlags: RiskFlag[];
}

export interface EmployeeCommRanking {
  name: string;
  responsiveness: number; // 0-100
  engagement: number; // 0-100
  sentiment: number; // 0-100
  meetingAttendance: number; // 0-100
  overallScore: number; // 0-100
  strengths: string[];
  improvements: string[];
}

export interface BottleneckInfo {
  personName: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  evidence: string;
  recommendation: string;
  source: "slack" | "gmail" | "combined";
}

export interface RelationshipEdge {
  person1: string;
  person2: string;
  score: number; // 0-100
  frequency: string;
  sentiment: string;
  source: "slack" | "gmail" | "combined";
}

export interface RiskFlag {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  involvedPeople: string[];
  evidence: string;
  recommendation: string;
  source: "slack" | "gmail" | "combined";
}

// ── Helper: Group insights by person ────────────────────────────

function groupByPerson(insights: CommunicationInsight[]): Map<string, CommunicationInsight[]> {
  const map = new Map<string, CommunicationInsight[]>();
  for (const insight of insights) {
    const name = insight.subjectName;
    if (!name) continue;

    // Handle relationship pairs (e.g., "Alice <-> Bob")
    if (name.includes(" <-> ")) {
      const [p1, p2] = name.split(" <-> ");
      if (!map.has(p1)) map.set(p1, []);
      if (!map.has(p2)) map.set(p2, []);
      map.get(p1)!.push(insight);
      map.get(p2)!.push(insight);
    } else if (name.includes(", ")) {
      // Handle comma-separated lists (bottleneck participants)
      for (const person of name.split(", ")) {
        const trimmed = person.trim();
        if (!map.has(trimmed)) map.set(trimmed, []);
        map.get(trimmed)!.push(insight);
      }
    } else {
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(insight);
    }
  }
  return map;
}

// ── Helper: Extract numeric score from insight data ─────────────

function extractScore(insight: CommunicationInsight, ...keys: string[]): number | null {
  for (const key of keys) {
    const val = insight.data?.[key];
    if (typeof val === "number") return val;
  }
  return null;
}

function ratingToScore(rating: string | undefined): number {
  switch (rating) {
    case "excellent": return 95;
    case "good": return 80;
    case "average": return 60;
    case "slow": return 35;
    case "unresponsive": return 10;
    case "highly_engaged": return 95;
    case "engaged": return 80;
    case "moderate": return 60;
    case "disengaged": return 30;
    case "silent": return 10;
    default: return 50;
  }
}

function severityToWeight(severity: string): number {
  switch (severity) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 1;
  }
}

// ── Build Employee Rankings ─────────────────────────────────────

function buildEmployeeRankings(
  allInsights: CommunicationInsight[],
): EmployeeCommRanking[] {
  const byPerson = groupByPerson(allInsights);
  const rankings: EmployeeCommRanking[] = [];

  for (const [name, insights] of byPerson) {
    // Skip if this is an email address (external contact)
    if (name.includes("@")) continue;

    let responsiveness = 50;
    let engagement = 50;
    let sentiment = 50;
    let meetingAttendance = 50;
    const strengths: string[] = [];
    const improvements: string[] = [];
    let scoresFound = 0;

    for (const insight of insights) {
      switch (insight.insightType) {
        case "response_time": {
          const rating = insight.data?.rating;
          responsiveness = ratingToScore(rating);
          scoresFound++;
          if (responsiveness >= 80) {
            strengths.push("Fast responder");
          } else if (responsiveness < 50) {
            improvements.push("Improve response times");
          }
          break;
        }
        case "engagement": {
          const engScore = extractScore(insight, "engagementScore");
          const engRating = insight.data?.overallEngagement;
          engagement = engScore ?? ratingToScore(engRating);
          scoresFound++;
          if (engagement >= 80) {
            strengths.push("Highly engaged communicator");
          } else if (engagement < 40) {
            improvements.push("Increase team participation");
          }
          break;
        }
        case "sentiment": {
          // Per-person sentiment within overall insight
          const perPerson = insight.data?.perPerson;
          if (Array.isArray(perPerson)) {
            const match = perPerson.find(
              (p: any) => p.personName === name,
            );
            if (match?.score != null) {
              sentiment = match.score;
              scoresFound++;
            }
          }
          break;
        }
        case "meeting_attendance": {
          const standupRate = extractScore(insight, "standupPresenceRate");
          const threadRate = extractScore(insight, "threadParticipationRate");
          const followUpRate = extractScore(insight, "followUpRate");
          meetingAttendance = standupRate ?? threadRate ?? followUpRate ?? 50;
          scoresFound++;
          if (meetingAttendance >= 80) {
            strengths.push("Reliable meeting participant");
          } else if (meetingAttendance < 50) {
            improvements.push("Improve meeting/standup attendance");
          }
          break;
        }
        case "bottleneck": {
          const sev = insight.data?.severity;
          if (sev === "high" || sev === "critical") {
            improvements.push(`Bottleneck risk: ${insight.data?.type ?? "unknown"}`);
          }
          break;
        }
        case "risk_flag": {
          const riskType = insight.data?.type;
          if (riskType === "burnout") {
            improvements.push("Burnout risk detected -- review workload");
          } else if (riskType === "flight_risk") {
            improvements.push("Possible flight risk -- check engagement");
          }
          break;
        }
      }
    }

    // Deduplicate
    const uniqueStrengths = [...new Set(strengths)];
    const uniqueImprovements = [...new Set(improvements)];

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      responsiveness * 0.3 +
      engagement * 0.3 +
      sentiment * 0.2 +
      meetingAttendance * 0.2,
    );

    rankings.push({
      name,
      responsiveness,
      engagement,
      sentiment,
      meetingAttendance,
      overallScore,
      strengths: uniqueStrengths,
      improvements: uniqueImprovements,
    });
  }

  // Sort by overall score descending
  rankings.sort((a, b) => b.overallScore - a.overallScore);
  return rankings;
}

// ── Build Bottleneck List ───────────────────────────────────────

function buildBottlenecks(allInsights: CommunicationInsight[]): BottleneckInfo[] {
  const bottleneckInsights = allInsights.filter(
    (i) => i.insightType === "bottleneck",
  );

  return bottleneckInsights.map((i) => ({
    personName: i.subjectName ?? "Unknown",
    type: i.data?.type ?? "unknown",
    severity: (i.data?.severity ?? "medium") as BottleneckInfo["severity"],
    evidence: i.data?.evidence ?? i.data?.reason ?? "",
    recommendation: i.data?.recommendation ?? "",
    source: i.source as BottleneckInfo["source"],
  })).sort((a, b) => severityToWeight(b.severity) - severityToWeight(a.severity));
}

// ── Build Relationship Map ──────────────────────────────────────

function buildRelationshipMap(allInsights: CommunicationInsight[]): RelationshipEdge[] {
  const relInsights = allInsights.filter(
    (i) => i.insightType === "relationship_score",
  );

  const edgeMap = new Map<string, RelationshipEdge>();

  for (const i of relInsights) {
    const p1 = i.data?.person1 ?? "";
    const p2 = i.data?.person2 ?? "";
    if (!p1 || !p2) continue;

    const key = [p1, p2].sort().join("|");
    const existing = edgeMap.get(key);

    if (existing) {
      // Merge: average scores from multiple sources
      existing.score = Math.round((existing.score + (i.data?.score ?? i.data?.healthScore ?? 50)) / 2);
      existing.source = "combined";
    } else {
      edgeMap.set(key, {
        person1: p1,
        person2: p2,
        score: i.data?.score ?? i.data?.healthScore ?? 50,
        frequency: i.data?.frequency ?? "unknown",
        sentiment: i.data?.sentiment ?? "neutral",
        source: i.source as RelationshipEdge["source"],
      });
    }
  }

  return Array.from(edgeMap.values()).sort((a, b) => b.score - a.score);
}

// ── Build Risk Flags ────────────────────────────────────────────

function buildRiskFlags(allInsights: CommunicationInsight[]): RiskFlag[] {
  const riskInsights = allInsights.filter(
    (i) => i.insightType === "risk_flag",
  );

  return riskInsights.map((i) => ({
    type: i.data?.type ?? "unknown",
    severity: (i.data?.severity ?? "medium") as RiskFlag["severity"],
    involvedPeople: i.data?.involvedPeople ?? (i.subjectName ? [i.subjectName] : []),
    evidence: i.data?.evidence ?? "",
    recommendation: i.data?.recommendation ?? "",
    source: i.source as RiskFlag["source"],
  })).sort((a, b) => severityToWeight(b.severity) - severityToWeight(a.severity));
}

// ── Generate Top Findings ───────────────────────────────────────

function generateTopFindings(
  rankings: EmployeeCommRanking[],
  bottlenecks: BottleneckInfo[],
  riskFlags: RiskFlag[],
  relationships: RelationshipEdge[],
  allInsights: CommunicationInsight[],
): string[] {
  const findings: string[] = [];

  // Top performer
  if (rankings.length > 0) {
    const top = rankings[0];
    findings.push(
      `${top.name} is the top communicator (score: ${top.overallScore}/100) with strengths in ${top.strengths.join(", ") || "overall communication"}.`,
    );
  }

  // Biggest concern
  if (rankings.length > 0) {
    const bottom = rankings[rankings.length - 1];
    if (bottom.overallScore < 50) {
      findings.push(
        `${bottom.name} has the lowest communication score (${bottom.overallScore}/100). Areas for improvement: ${bottom.improvements.join(", ") || "overall engagement"}.`,
      );
    }
  }

  // Critical bottlenecks
  const criticalBottlenecks = bottlenecks.filter((b) => b.severity === "critical" || b.severity === "high");
  if (criticalBottlenecks.length > 0) {
    findings.push(
      `${criticalBottlenecks.length} critical/high-severity bottleneck(s) detected involving: ${criticalBottlenecks.map((b) => b.personName).join(", ")}.`,
    );
  }

  // Risk flags
  const criticalRisks = riskFlags.filter((r) => r.severity === "critical" || r.severity === "high");
  if (criticalRisks.length > 0) {
    findings.push(
      `${criticalRisks.length} high-priority risk flag(s): ${criticalRisks.map((r) => r.type).join(", ")}.`,
    );
  }

  // Strongest relationship
  if (relationships.length > 0) {
    const strongest = relationships[0];
    findings.push(
      `Strongest working relationship: ${strongest.person1} and ${strongest.person2} (score: ${strongest.score}/100).`,
    );
  }

  // Team sentiment
  const sentimentInsights = allInsights.filter((i) => i.insightType === "sentiment");
  if (sentimentInsights.length > 0) {
    const scores = sentimentInsights
      .map((i) => i.data?.overallScore)
      .filter((s): s is number => typeof s === "number");
    if (scores.length > 0) {
      const avgSentiment = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      findings.push(`Team sentiment averages ${avgSentiment}/100 across communication channels.`);
    }
  }

  return findings.slice(0, 6); // Keep top 6 findings
}

// ── Generate Recommendations ────────────────────────────────────

function generateRecommendations(
  rankings: EmployeeCommRanking[],
  bottlenecks: BottleneckInfo[],
  riskFlags: RiskFlag[],
): string[] {
  const recs: string[] = [];

  // From bottleneck data
  for (const bn of bottlenecks) {
    if (bn.recommendation && (bn.severity === "critical" || bn.severity === "high")) {
      recs.push(bn.recommendation);
    }
  }

  // From risk flags
  for (const rf of riskFlags) {
    if (rf.recommendation && (rf.severity === "critical" || rf.severity === "high")) {
      recs.push(rf.recommendation);
    }
  }

  // From employee improvements
  const lowPerformers = rankings.filter((r) => r.overallScore < 50);
  if (lowPerformers.length > 0) {
    recs.push(
      `Schedule 1:1s with ${lowPerformers.map((r) => r.name).join(", ")} to discuss communication engagement and identify blockers.`,
    );
  }

  // General recommendations based on patterns
  const avgResponsiveness =
    rankings.reduce((sum, r) => sum + r.responsiveness, 0) / Math.max(rankings.length, 1);
  if (avgResponsiveness < 60) {
    recs.push(
      "Team-wide response times are below average. Consider setting SLA expectations for internal and client communications.",
    );
  }

  const avgEngagement =
    rankings.reduce((sum, r) => sum + r.engagement, 0) / Math.max(rankings.length, 1);
  if (avgEngagement < 60) {
    recs.push(
      "Overall team engagement is low. Consider introducing structured check-ins, async standups, or team-building activities.",
    );
  }

  // Deduplicate and limit
  return [...new Set(recs)].slice(0, 8);
}

// ── Main: Generate Communication Report ─────────────────────────

export async function generateCommunicationReport(
  orgId: string,
  slackInsights: CommunicationInsight[],
  gmailInsights: CommunicationInsight[],
): Promise<CommunicationReport> {
  // Stamp orgId on all insights
  const allInsights = [
    ...slackInsights.map((i) => ({ ...i, orgId })),
    ...gmailInsights.map((i) => ({ ...i, orgId })),
  ];

  // Build report components
  const employeeRankings = buildEmployeeRankings(allInsights);
  const bottlenecks = buildBottlenecks(allInsights);
  const relationshipMap = buildRelationshipMap(allInsights);
  const riskFlags = buildRiskFlags(allInsights);

  const topFindings = generateTopFindings(
    employeeRankings,
    bottlenecks,
    riskFlags,
    relationshipMap,
    allInsights,
  );

  const recommendations = generateRecommendations(
    employeeRankings,
    bottlenecks,
    riskFlags,
  );

  // Calculate team health score
  const avgOverall =
    employeeRankings.length > 0
      ? employeeRankings.reduce((sum, r) => sum + r.overallScore, 0) / employeeRankings.length
      : 50;

  // Penalty for bottlenecks and risk flags
  const bottleneckPenalty = bottlenecks.reduce(
    (sum, b) => sum + severityToWeight(b.severity) * 2,
    0,
  );
  const riskPenalty = riskFlags.reduce(
    (sum, r) => sum + severityToWeight(r.severity) * 3,
    0,
  );

  const teamHealthScore = Math.max(
    0,
    Math.min(100, Math.round(avgOverall - bottleneckPenalty - riskPenalty)),
  );

  return {
    teamHealthScore,
    topFindings,
    employeeRankings,
    bottlenecks,
    relationshipMap,
    recommendations,
    riskFlags,
  };
}
