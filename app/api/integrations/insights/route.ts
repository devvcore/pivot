// ═══════════════════════════════════════════════════════════════
// GET /api/integrations/insights
// Returns communication insights and HR analytics,
// aggregated and ready for UI display.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  listCommunicationInsights,
  listHREmployeeData,
} from '@/lib/integrations/store';
import type { CommunicationInsight } from '@/lib/integrations/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const source = searchParams.get('source') as 'slack' | 'gmail' | null;
    const insightType = searchParams.get('type') as CommunicationInsight['insightType'] | null;
    const daysParam = searchParams.get('days');
    const category = searchParams.get('category'); // 'communication' | 'hr' | null

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId query parameter is required' },
        { status: 400 }
      );
    }

    const days = daysParam ? parseInt(daysParam, 10) : 30;
    const periodStart = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    ).toISOString();

    // ─── Communication insights ─────────────────────────────────────────────
    if (!category || category === 'communication') {
      const insights = await listCommunicationInsights(orgId, {
        source: source ?? undefined,
        insightType: insightType ?? undefined,
        periodStart,
        limit: 200,
      });

      // Aggregate by type
      const byType: Record<string, CommunicationInsight[]> = {};
      for (const insight of insights) {
        const key = insight.insightType;
        if (!byType[key]) byType[key] = [];
        byType[key].push(insight);
      }

      // Aggregate by source
      const bySource: Record<string, number> = {};
      for (const insight of insights) {
        bySource[insight.source] = (bySource[insight.source] ?? 0) + 1;
      }

      // Build summary stats
      const summary = {
        totalInsights: insights.length,
        byType: Object.fromEntries(
          Object.entries(byType).map(([type, items]) => [
            type,
            {
              count: items.length,
              latest: items[0]?.createdAt ?? null,
            },
          ])
        ),
        bySource,
        periodStart,
        periodEnd: new Date().toISOString(),
      };

      if (category === 'communication') {
        return NextResponse.json({
          category: 'communication',
          summary,
          insights: insights.map((i) => ({
            id: i.id,
            source: i.source,
            insightType: i.insightType,
            subjectName: i.subjectName,
            data: i.data,
            periodStart: i.periodStart,
            periodEnd: i.periodEnd,
            createdAt: i.createdAt,
          })),
        });
      }

      // If no category filter, include both communication and HR
      const hrData = await listHREmployeeData(orgId);
      const hrSummary = buildHRSummary(hrData);

      return NextResponse.json({
        communication: {
          summary,
          insights: insights.map((i) => ({
            id: i.id,
            source: i.source,
            insightType: i.insightType,
            subjectName: i.subjectName,
            data: i.data,
            periodStart: i.periodStart,
            periodEnd: i.periodEnd,
            createdAt: i.createdAt,
          })),
        },
        hr: hrSummary,
      });
    }

    // ─── HR analytics only ──────────────────────────────────────────────────
    if (category === 'hr') {
      const hrSource = source as 'adp' | 'workday' | undefined;
      const hrData = await listHREmployeeData(orgId, hrSource ?? undefined);
      const hrSummary = buildHRSummary(hrData);

      return NextResponse.json({
        category: 'hr',
        ...hrSummary,
      });
    }

    return NextResponse.json(
      { error: `Invalid category: ${category}. Use 'communication' or 'hr'.` },
      { status: 400 }
    );
  } catch (err) {
    console.error('[integrations/insights] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

// ─── HR Summary Builder ──────────────────────────────────────────────────────

function buildHRSummary(employees: any[]) {
  if (employees.length === 0) {
    return {
      totalEmployees: 0,
      departments: [],
      statusBreakdown: {},
      avgTenureDays: null,
      avgPerformanceRating: null,
      employees: [],
    };
  }

  // Department breakdown
  const deptCounts: Record<string, number> = {};
  for (const emp of employees) {
    const dept = emp.department ?? 'Unknown';
    deptCounts[dept] = (deptCounts[dept] ?? 0) + 1;
  }

  // Employment status breakdown
  const statusCounts: Record<string, number> = {};
  for (const emp of employees) {
    const status = emp.employmentStatus ?? 'Unknown';
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }

  // Average tenure
  const now = Date.now();
  const tenures = employees
    .filter((e) => e.hireDate)
    .map((e) => (now - new Date(e.hireDate!).getTime()) / (1000 * 60 * 60 * 24));
  const avgTenureDays =
    tenures.length > 0
      ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length)
      : null;

  // Average performance rating
  const ratings = employees
    .filter((e) => e.performanceRating != null)
    .map((e) => e.performanceRating!);
  const avgPerformanceRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  return {
    totalEmployees: employees.length,
    departments: Object.entries(deptCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    statusBreakdown: statusCounts,
    avgTenureDays,
    avgPerformanceRating,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.employeeName,
      email: e.email,
      department: e.department,
      jobTitle: e.jobTitle,
      employmentStatus: e.employmentStatus,
      hireDate: e.hireDate,
      performanceRating: e.performanceRating,
      source: e.source,
      syncedAt: e.syncedAt,
    })),
  };
}
