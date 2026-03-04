import { NextRequest, NextResponse } from "next/server";
import { listEmployees, createEmployee } from "@/lib/employee-store";

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json(
      { error: "orgId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const employees = await listEmployees(orgId);
    return NextResponse.json(employees);
  } catch (err) {
    console.error("[api/employees] GET error:", err);
    return NextResponse.json(
      { error: "Failed to list employees" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, name, roleTitle, department, salary, startDate } = body;

    if (!orgId || !name) {
      return NextResponse.json(
        { error: "orgId and name are required" },
        { status: 400 },
      );
    }

    const employee = await createEmployee({
      orgId,
      name,
      roleTitle: roleTitle || undefined,
      department: department || undefined,
      salary: salary ?? undefined,
      startDate: startDate || undefined,
    });

    return NextResponse.json(employee);
  } catch (err) {
    console.error("[api/employees] POST error:", err);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 },
    );
  }
}
