// ═══════════════════════════════════════════════════════════════
// Pivot — AI-Powered HR Analytics Engine
// Analyzes combined HR data (ADP/Workday) + communication
// insights using Gemini Flash for workforce intelligence
// ═══════════════════════════════════════════════════════════════

import { GoogleGenAI } from "@google/genai";
import type { HREmployeeData, CommunicationInsight } from "./types";

// ─── HR Analytics Types ──────────────────────────────────────────────────────

export interface EmployeeAnalytics {
  name: string;
  source: "adp" | "workday" | "manual";
  // From HR data
  department: string | null;
  jobTitle: string | null;
  tenure: number; // months since hire date
  salary: number | null;
  // Calculated
  netValue: number; // estimated revenue contribution - salary cost
  roi: number; // revenue generated / salary (ratio)
  riskScore: number; // 0-100, risk of leaving or underperforming
  performanceScore: number; // 0-100
  // AI-generated
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  retentionRisk: "low" | "medium" | "high";
  fireKeepRecommendation: "keep" | "develop" | "transition" | "urgent_review";
}

export interface DepartmentBreakdown {
  headcount: number;
  avgSalary: number;
  avgPerformance: number;
  avgTenure: number;
  totalPayroll: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface WorkforceAnalyticsResult {
  employees: EmployeeAnalytics[];
  teamHealthScore: number; // 0-100
  departmentBreakdown: Record<string, DepartmentBreakdown>;
  totalPayrollCost: number;
  estimatedROI: number;
  avgTenure: number;
  turnoverRisk: number; // percentage of employees at high risk
  recommendations: string[];
  analyzedAt: string;
}

// ─── Core Analysis Function ──────────────────────────────────────────────────

/**
 * Analyzes workforce data from HR systems + communication patterns
 * using Gemini Flash to produce comprehensive workforce intelligence.
 */
export async function analyzeWorkforce(
  orgId: string,
  hrData: HREmployeeData[],
  communicationInsights?: CommunicationInsight[],
  businessContext?: string
): Promise<WorkforceAnalyticsResult> {
  if (hrData.length === 0) {
    return {
      employees: [],
      teamHealthScore: 0,
      departmentBreakdown: {},
      totalPayrollCost: 0,
      estimatedROI: 0,
      avgTenure: 0,
      turnoverRisk: 0,
      recommendations: ["No employee data available. Connect ADP or Workday to begin analysis."],
      analyzedAt: new Date().toISOString(),
    };
  }

  // ── Step 1: Pre-compute base metrics per employee ────────────────
  const employeeMetrics = hrData.map((emp) => computeBaseMetrics(emp, communicationInsights));

  // ── Step 2: Use Gemini to analyze patterns and generate insights ─
  const aiInsights = await generateAIInsights(employeeMetrics, communicationInsights, businessContext);

  // ── Step 3: Merge AI insights with computed metrics ──────────────
  const employees: EmployeeAnalytics[] = employeeMetrics.map((metrics, i) => {
    const aiEmployee: AIInsightsResponse["employees"][number] | undefined =
      aiInsights.employees?.[i];
    return {
      name: metrics.name,
      source: metrics.source,
      department: metrics.department,
      jobTitle: metrics.jobTitle,
      tenure: metrics.tenure,
      salary: metrics.salary,
      netValue: aiEmployee?.netValue ?? metrics.estimatedNetValue,
      roi: aiEmployee?.roi ?? metrics.estimatedROI,
      riskScore: aiEmployee?.riskScore ?? metrics.baseRiskScore,
      performanceScore: aiEmployee?.performanceScore ?? metrics.basePerformanceScore,
      strengths: aiEmployee?.strengths || [],
      weaknesses: aiEmployee?.weaknesses || [],
      recommendations: aiEmployee?.recommendations || [],
      retentionRisk: aiEmployee?.retentionRisk || categorizeRisk(aiEmployee?.riskScore ?? metrics.baseRiskScore),
      fireKeepRecommendation: aiEmployee?.fireKeepRecommendation || "keep",
    };
  });

  // ── Step 4: Calculate aggregate metrics ──────────────────────────
  const totalPayrollCost = employees.reduce((sum, e) => sum + (e.salary || 0), 0);
  const totalNetValue = employees.reduce((sum, e) => sum + e.netValue, 0);
  const estimatedROI = totalPayrollCost > 0 ? totalNetValue / totalPayrollCost : 0;

  const avgTenure = employees.length > 0
    ? employees.reduce((sum, e) => sum + e.tenure, 0) / employees.length
    : 0;

  const highRiskCount = employees.filter((e) => e.retentionRisk === "high").length;
  const turnoverRisk = employees.length > 0
    ? (highRiskCount / employees.length) * 100
    : 0;

  // ── Step 5: Department breakdown ─────────────────────────────────
  const departmentBreakdown: Record<string, DepartmentBreakdown> = {};
  for (const emp of employees) {
    const dept = emp.department || "Unassigned";
    if (!departmentBreakdown[dept]) {
      departmentBreakdown[dept] = {
        headcount: 0,
        avgSalary: 0,
        avgPerformance: 0,
        avgTenure: 0,
        totalPayroll: 0,
        riskDistribution: { low: 0, medium: 0, high: 0 },
      };
    }

    const d = departmentBreakdown[dept];
    d.headcount++;
    d.totalPayroll += emp.salary || 0;
    d.avgPerformance += emp.performanceScore;
    d.avgTenure += emp.tenure;
    d.riskDistribution[emp.retentionRisk]++;
  }

  for (const dept of Object.values(departmentBreakdown)) {
    if (dept.headcount > 0) {
      dept.avgSalary = dept.totalPayroll / dept.headcount;
      dept.avgPerformance = dept.avgPerformance / dept.headcount;
      dept.avgTenure = dept.avgTenure / dept.headcount;
    }
  }

  // ── Step 6: Calculate team health score ──────────────────────────
  const teamHealthScore = calculateTeamHealth(employees, departmentBreakdown);

  // ── Step 7: Org-level recommendations ────────────────────────────
  const recommendations = aiInsights.orgRecommendations || generateOrgRecommendations(
    employees,
    departmentBreakdown,
    turnoverRisk,
    teamHealthScore
  );

  return {
    employees,
    teamHealthScore,
    departmentBreakdown,
    totalPayrollCost,
    estimatedROI,
    avgTenure,
    turnoverRisk,
    recommendations,
    analyzedAt: new Date().toISOString(),
  };
}

// ─── Base Metric Computation ─────────────────────────────────────────────────

interface EmployeeBaseMetrics {
  name: string;
  source: "adp" | "workday" | "manual";
  department: string | null;
  jobTitle: string | null;
  salary: number | null;
  tenure: number;
  employmentStatus: string | null;
  performanceRating: number | null;
  timeOffBalance: Record<string, any> | null;
  managerName: string | null;
  communicationData: {
    avgResponseTime: number | null;
    engagementScore: number | null;
    sentimentScore: number | null;
    hasRiskFlags: boolean;
  };
  // Computed base scores
  baseRiskScore: number;
  basePerformanceScore: number;
  estimatedNetValue: number;
  estimatedROI: number;
}

function computeBaseMetrics(
  emp: HREmployeeData,
  communicationInsights?: CommunicationInsight[]
): EmployeeBaseMetrics {
  // Compute tenure in months
  let tenure = 0;
  if (emp.hireDate) {
    const hireDate = new Date(emp.hireDate);
    const now = new Date();
    tenure = Math.max(
      0,
      (now.getFullYear() - hireDate.getFullYear()) * 12 +
        (now.getMonth() - hireDate.getMonth())
    );
  }

  // Extract communication data for this employee
  const empInsights = (communicationInsights || []).filter(
    (ci) =>
      ci.subjectName &&
      emp.employeeName &&
      ci.subjectName.toLowerCase().includes(emp.employeeName.split(" ")[0].toLowerCase())
  );

  let avgResponseTime: number | null = null;
  let engagementScore: number | null = null;
  let sentimentScore: number | null = null;
  let hasRiskFlags = false;

  for (const insight of empInsights) {
    if (insight.insightType === "response_time" && insight.data.avgResponseMinutes) {
      avgResponseTime = insight.data.avgResponseMinutes;
    }
    if (insight.insightType === "engagement" && insight.data.score !== undefined) {
      engagementScore = insight.data.score;
    }
    if (insight.insightType === "sentiment" && insight.data.score !== undefined) {
      sentimentScore = insight.data.score;
    }
    if (insight.insightType === "risk_flag") {
      hasRiskFlags = true;
    }
  }

  // Base performance score: from HR rating + communication signals
  let basePerformanceScore = 50; // default
  if (emp.performanceRating !== null) {
    // Normalize from 1-5 scale to 0-100
    basePerformanceScore = Math.round(((emp.performanceRating - 1) / 4) * 100);
  }
  if (engagementScore !== null) {
    // Blend engagement into performance
    basePerformanceScore = Math.round(basePerformanceScore * 0.7 + engagementScore * 0.3);
  }
  basePerformanceScore = Math.max(0, Math.min(100, basePerformanceScore));

  // Base risk score: flight risk calculation
  let baseRiskScore = 20; // default low risk

  // High salary + low engagement = flight risk
  if (emp.salary && emp.salary > 100000 && engagementScore !== null && engagementScore < 40) {
    baseRiskScore += 30;
  }

  // Short tenure (< 12 months) or very long tenure (> 60 months) without promotion
  if (tenure < 12) {
    baseRiskScore += 15; // new employees are settling in
  } else if (tenure > 60) {
    baseRiskScore += 10; // possible stagnation
  }

  // Negative sentiment increases risk
  if (sentimentScore !== null && sentimentScore < 30) {
    baseRiskScore += 20;
  }

  // Communication risk flags
  if (hasRiskFlags) {
    baseRiskScore += 25;
  }

  // Slow response times indicate disengagement
  if (avgResponseTime !== null && avgResponseTime > 120) {
    baseRiskScore += 10;
  }

  baseRiskScore = Math.max(0, Math.min(100, baseRiskScore));

  // Estimated net value: rough calculation based on role and performance
  const annualSalary = emp.salary || 50000;
  const performanceMultiplier = basePerformanceScore / 50; // 1.0 at 50, 2.0 at 100
  const estimatedRevenueContribution = annualSalary * performanceMultiplier * 1.5;
  const estimatedNetValue = estimatedRevenueContribution - annualSalary;
  const estimatedROI = annualSalary > 0 ? estimatedRevenueContribution / annualSalary : 0;

  return {
    name: emp.employeeName,
    source: emp.source,
    department: emp.department,
    jobTitle: emp.jobTitle,
    salary: emp.salary,
    tenure,
    employmentStatus: emp.employmentStatus,
    performanceRating: emp.performanceRating,
    timeOffBalance: emp.timeOffBalance,
    managerName: emp.managerName,
    communicationData: {
      avgResponseTime,
      engagementScore,
      sentimentScore,
      hasRiskFlags,
    },
    baseRiskScore,
    basePerformanceScore,
    estimatedNetValue,
    estimatedROI,
  };
}

// ─── AI Insights Generation ─────────────────────────────────────────────────

interface AIInsightsResponse {
  employees: {
    netValue: number;
    roi: number;
    riskScore: number;
    performanceScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    retentionRisk: "low" | "medium" | "high";
    fireKeepRecommendation: "keep" | "develop" | "transition" | "urgent_review";
  }[];
  orgRecommendations: string[];
}

async function generateAIInsights(
  employeeMetrics: EmployeeBaseMetrics[],
  communicationInsights?: CommunicationInsight[],
  businessContext?: string
): Promise<AIInsightsResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[hr-analyzer] GEMINI_API_KEY not set, using computed metrics only");
    return { employees: [], orgRecommendations: [] };
  }

  const ai = new GoogleGenAI({ apiKey });

  // Build the prompt with employee data summaries
  const employeeSummaries = employeeMetrics.map((m, i) => {
    const commData = m.communicationData;
    return `Employee ${i + 1}: ${m.name}
  - Department: ${m.department || "Unknown"}
  - Title: ${m.jobTitle || "Unknown"}
  - Tenure: ${m.tenure} months
  - Salary: ${m.salary ? `$${m.salary.toLocaleString()}` : "Unknown"}
  - Status: ${m.employmentStatus || "Active"}
  - Performance Rating (HR): ${m.performanceRating !== null ? `${m.performanceRating}/5` : "Not rated"}
  - Manager: ${m.managerName || "Unknown"}
  - Time Off Balance: ${m.timeOffBalance ? JSON.stringify(m.timeOffBalance) : "N/A"}
  - Communication: Response Time=${commData.avgResponseTime !== null ? `${commData.avgResponseTime}min` : "N/A"}, Engagement=${commData.engagementScore !== null ? `${commData.engagementScore}/100` : "N/A"}, Sentiment=${commData.sentimentScore !== null ? `${commData.sentimentScore}/100` : "N/A"}, Risk Flags=${commData.hasRiskFlags}
  - Computed: Performance=${m.basePerformanceScore}/100, Risk=${m.baseRiskScore}/100, Net Value=$${m.estimatedNetValue.toLocaleString()}`;
  });

  // Build communication context
  let commContext = "";
  if (communicationInsights && communicationInsights.length > 0) {
    const bottlenecks = communicationInsights
      .filter((ci) => ci.insightType === "bottleneck")
      .slice(0, 5);
    const riskFlags = communicationInsights
      .filter((ci) => ci.insightType === "risk_flag")
      .slice(0, 5);

    if (bottlenecks.length > 0) {
      commContext += "\nCommunication Bottlenecks:\n";
      for (const b of bottlenecks) {
        commContext += `- ${b.subjectName || "Unknown"}: ${JSON.stringify(b.data)}\n`;
      }
    }
    if (riskFlags.length > 0) {
      commContext += "\nRisk Flags:\n";
      for (const r of riskFlags) {
        commContext += `- ${r.subjectName || "Unknown"}: ${JSON.stringify(r.data)}\n`;
      }
    }
  }

  const prompt = `You are a workforce analytics AI. Analyze the following employee data and provide detailed insights.

${businessContext ? `Business Context: ${businessContext}\n` : ""}

EMPLOYEES:
${employeeSummaries.join("\n\n")}

${commContext}

For EACH employee, provide:
1. netValue: estimated annual revenue contribution minus salary cost (number)
2. roi: revenue / salary ratio (number, e.g. 1.5 means 150% return)
3. riskScore: 0-100, likelihood of attrition or underperformance
4. performanceScore: 0-100, overall effectiveness
5. strengths: 2-3 specific strengths based on available data
6. weaknesses: 1-2 areas of concern
7. recommendations: 1-3 actionable recommendations
8. retentionRisk: "low", "medium", or "high"
9. fireKeepRecommendation: "keep" (strong performer), "develop" (has potential, needs investment), "transition" (consider role change), or "urgent_review" (immediate attention needed)

Also provide 3-5 organization-level recommendations.

IMPORTANT: Base your analysis on the data provided. When data is limited, be conservative in your assessments. Do not fabricate specific metrics - use the computed values as a baseline and adjust based on patterns you identify.

Respond in JSON format:
{
  "employees": [
    {
      "netValue": number,
      "roi": number,
      "riskScore": number,
      "performanceScore": number,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "recommendations": ["..."],
      "retentionRisk": "low|medium|high",
      "fireKeepRecommendation": "keep|develop|transition|urgent_review"
    }
  ],
  "orgRecommendations": ["..."]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    const text = response.text ?? "";
    // Clean potential markdown fences
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed: AIInsightsResponse = JSON.parse(cleaned);

    // Validate structure
    if (!Array.isArray(parsed.employees)) {
      console.warn("[hr-analyzer] AI response missing employees array");
      return { employees: [], orgRecommendations: parsed.orgRecommendations || [] };
    }

    return parsed;
  } catch (err: any) {
    console.error("[hr-analyzer] AI analysis failed:", err.message);
    return { employees: [], orgRecommendations: [] };
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function categorizeRisk(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function calculateTeamHealth(
  employees: EmployeeAnalytics[],
  departments: Record<string, DepartmentBreakdown>
): number {
  if (employees.length === 0) return 0;

  // Factors that contribute to team health (0-100)
  const factors: number[] = [];

  // Average performance score
  const avgPerf = employees.reduce((s, e) => s + e.performanceScore, 0) / employees.length;
  factors.push(avgPerf);

  // Inverse of average risk score
  const avgRisk = employees.reduce((s, e) => s + e.riskScore, 0) / employees.length;
  factors.push(100 - avgRisk);

  // Retention distribution (more "low" risk = healthier)
  const lowRiskPct = employees.filter((e) => e.retentionRisk === "low").length / employees.length;
  factors.push(lowRiskPct * 100);

  // Keep/develop ratio (more "keep" recommendations = healthier)
  const keepPct = employees.filter(
    (e) => e.fireKeepRecommendation === "keep"
  ).length / employees.length;
  factors.push(keepPct * 100);

  // Department balance (more departments with good health = better)
  const deptCount = Object.keys(departments).length;
  if (deptCount > 0) {
    const healthyDepts = Object.values(departments).filter(
      (d) => d.avgPerformance >= 50 && d.riskDistribution.high / d.headcount < 0.3
    ).length;
    factors.push((healthyDepts / deptCount) * 100);
  }

  // Weighted average of all factors
  const score = factors.reduce((sum, f) => sum + f, 0) / factors.length;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function generateOrgRecommendations(
  employees: EmployeeAnalytics[],
  departments: Record<string, DepartmentBreakdown>,
  turnoverRisk: number,
  teamHealth: number
): string[] {
  const recommendations: string[] = [];

  // High turnover risk
  if (turnoverRisk > 30) {
    recommendations.push(
      `${Math.round(turnoverRisk)}% of employees are at high retention risk. Consider conducting stay interviews and reviewing compensation competitiveness.`
    );
  }

  // Low team health
  if (teamHealth < 50) {
    recommendations.push(
      "Overall team health score is below 50. Prioritize employee engagement initiatives and management training."
    );
  }

  // Department-specific issues
  for (const [dept, data] of Object.entries(departments)) {
    if (data.avgPerformance < 40) {
      recommendations.push(
        `${dept} department has low average performance (${Math.round(data.avgPerformance)}/100). Investigate root causes and consider targeted coaching.`
      );
    }
    if (data.riskDistribution.high / data.headcount > 0.4) {
      recommendations.push(
        `${dept} department has over 40% of employees at high retention risk. This may indicate management or culture issues.`
      );
    }
  }

  // ROI analysis
  const negativeROI = employees.filter((e) => e.netValue < 0);
  if (negativeROI.length > 0) {
    recommendations.push(
      `${negativeROI.length} employee(s) have negative estimated net value. Review role fit and performance improvement plans.`
    );
  }

  // Tenure distribution
  const shortTenure = employees.filter((e) => e.tenure < 6);
  if (shortTenure.length / employees.length > 0.3) {
    recommendations.push(
      "Over 30% of employees have been with the company less than 6 months. Ensure onboarding programs are effective and consider mentorship pairing."
    );
  }

  // Ensure we have at least one recommendation
  if (recommendations.length === 0) {
    recommendations.push(
      "Workforce metrics appear healthy. Continue monitoring engagement and performance trends quarterly."
    );
  }

  return recommendations.slice(0, 5);
}
