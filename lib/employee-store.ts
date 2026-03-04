/**
 * Pivot Employee Store — Supabase PostgreSQL backend
 *
 * All functions are async (return Promises) since Supabase uses HTTP.
 * Callers MUST await these functions.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { v4 as uuidv4 } from "uuid";

const supabase = createAdminClient();

export interface Employee {
  id: string;
  orgId: string;
  name: string;
  roleTitle?: string;
  department?: string;
  salary?: number;
  startDate?: string;
  netValueEstimate?: number;
  roiScore?: number;
  status: "active" | "on_notice" | "departed";
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: any): Employee {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    roleTitle: row.role_title || undefined,
    department: row.department || undefined,
    salary: row.salary ?? undefined,
    startDate: row.start_date || undefined,
    netValueEstimate: row.net_value_estimate ?? undefined,
    roiScore: row.roi_score ?? undefined,
    status: row.status || "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createEmployee(params: {
  orgId: string;
  name: string;
  roleTitle?: string;
  department?: string;
  salary?: number;
  startDate?: string;
}): Promise<Employee> {
  const id = uuidv4();

  const { error } = await supabase.from("employees").insert({
    id,
    org_id: params.orgId,
    name: params.name,
    role_title: params.roleTitle || null,
    department: params.department || null,
    salary: params.salary ?? null,
    start_date: params.startDate || null,
  });

  if (error) {
    console.error("[employee-store] createEmployee error:", error);
    throw new Error(`Failed to create employee: ${error.message}`);
  }

  const emp = await getEmployee(id);
  if (!emp) throw new Error("Failed to retrieve created employee");
  return emp;
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;
  return mapRow(data);
}

export async function listEmployees(orgId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data.map(mapRow);
}

export async function updateEmployee(
  id: string,
  updates: Partial<Omit<Employee, "id" | "orgId" | "createdAt" | "updatedAt">>
): Promise<Employee | undefined> {
  const updateData: Record<string, any> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.roleTitle !== undefined) updateData.role_title = updates.roleTitle;
  if (updates.department !== undefined) updateData.department = updates.department;
  if (updates.salary !== undefined) updateData.salary = updates.salary;
  if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
  if (updates.netValueEstimate !== undefined) updateData.net_value_estimate = updates.netValueEstimate;
  if (updates.roiScore !== undefined) updateData.roi_score = updates.roiScore;
  if (updates.status !== undefined) updateData.status = updates.status;

  if (Object.keys(updateData).length === 0) return getEmployee(id);

  const { error } = await supabase
    .from("employees")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("[employee-store] updateEmployee error:", error);
  }

  return getEmployee(id);
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[employee-store] deleteEmployee error:", error);
    return false;
  }

  const check = await getEmployee(id);
  return !check;
}
