import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/supabase/auth-api";

/**
 * GET /api/execution/costs?orgId=...&agentId=...&from=...&to=...&groupBy=...
 * Get cost data for an org. Supports filtering by agent and date range,
 * and grouping by agent or day.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = request.nextUrl;
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const agentId = searchParams.get("agentId");
    const from = searchParams.get("from"); // ISO date string
    const to = searchParams.get("to"); // ISO date string
    const groupBy = searchParams.get("groupBy"); // 'agent' | 'day' | 'model'

    const supabase = createAdminClient();

    // Build query for raw cost records
    let query = supabase
      .from("execution_costs")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }
    if (from) {
      query = query.gte("created_at", from);
    }
    if (to) {
      query = query.lte("created_at", to);
    }

    const { data: costs, error } = await query;

    if (error) {
      console.error("[GET /api/execution/costs]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const records = costs || [];

    // Calculate totals
    const totals = {
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRecords: records.length,
    };

    for (const record of records) {
      totals.totalCostUsd += record.cost_usd || 0;
      totals.totalInputTokens += record.input_tokens || 0;
      totals.totalOutputTokens += record.output_tokens || 0;
    }

    // Group data if requested
    let grouped: Record<string, {
      key: string;
      costUsd: number;
      inputTokens: number;
      outputTokens: number;
      count: number;
    }> | null = null;

    if (groupBy === "agent") {
      grouped = {};
      for (const record of records) {
        const key = record.agent_id;
        if (!grouped[key]) {
          grouped[key] = { key, costUsd: 0, inputTokens: 0, outputTokens: 0, count: 0 };
        }
        grouped[key].costUsd += record.cost_usd || 0;
        grouped[key].inputTokens += record.input_tokens || 0;
        grouped[key].outputTokens += record.output_tokens || 0;
        grouped[key].count++;
      }
    } else if (groupBy === "day") {
      grouped = {};
      for (const record of records) {
        const key = record.created_at
          ? new Date(record.created_at).toISOString().split("T")[0]
          : "unknown";
        if (!grouped[key]) {
          grouped[key] = { key, costUsd: 0, inputTokens: 0, outputTokens: 0, count: 0 };
        }
        grouped[key].costUsd += record.cost_usd || 0;
        grouped[key].inputTokens += record.input_tokens || 0;
        grouped[key].outputTokens += record.output_tokens || 0;
        grouped[key].count++;
      }
    } else if (groupBy === "model") {
      grouped = {};
      for (const record of records) {
        const key = record.model || "unknown";
        if (!grouped[key]) {
          grouped[key] = { key, costUsd: 0, inputTokens: 0, outputTokens: 0, count: 0 };
        }
        grouped[key].costUsd += record.cost_usd || 0;
        grouped[key].inputTokens += record.input_tokens || 0;
        grouped[key].outputTokens += record.output_tokens || 0;
        grouped[key].count++;
      }
    }

    return NextResponse.json({
      totals,
      grouped: grouped ? Object.values(grouped) : null,
      records: groupBy ? undefined : records, // Only return raw records if not grouping
    });
  } catch (err) {
    console.error("[GET /api/execution/costs]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch costs" },
      { status: 500 }
    );
  }
}
