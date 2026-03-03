import db from "./db";
import { v4 as uuidv4 } from "uuid";

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

export function createEmployee(params: {
  orgId: string;
  name: string;
  roleTitle?: string;
  department?: string;
  salary?: number;
  startDate?: string;
}): Employee {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO employees (id, org_id, name, role_title, department, salary, start_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, params.orgId, params.name, params.roleTitle || null, params.department || null, params.salary ?? null, params.startDate || null);
  return getEmployee(id)!;
}

export function getEmployee(id: string): Employee | undefined {
  const row = db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
  return row ? mapRow(row) : undefined;
}

export function listEmployees(orgId: string): Employee[] {
  const rows = db.prepare("SELECT * FROM employees WHERE org_id = ? ORDER BY name").all(orgId);
  return rows.map(mapRow);
}

export function updateEmployee(id: string, updates: Partial<Omit<Employee, "id" | "orgId" | "createdAt" | "updatedAt">>): Employee | undefined {
  const sets: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined) { sets.push("name = ?"); params.push(updates.name); }
  if (updates.roleTitle !== undefined) { sets.push("role_title = ?"); params.push(updates.roleTitle); }
  if (updates.department !== undefined) { sets.push("department = ?"); params.push(updates.department); }
  if (updates.salary !== undefined) { sets.push("salary = ?"); params.push(updates.salary); }
  if (updates.startDate !== undefined) { sets.push("start_date = ?"); params.push(updates.startDate); }
  if (updates.netValueEstimate !== undefined) { sets.push("net_value_estimate = ?"); params.push(updates.netValueEstimate); }
  if (updates.roiScore !== undefined) { sets.push("roi_score = ?"); params.push(updates.roiScore); }
  if (updates.status !== undefined) { sets.push("status = ?"); params.push(updates.status); }

  if (sets.length === 0) return getEmployee(id);

  params.push(id);
  db.prepare(`UPDATE employees SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
  return getEmployee(id);
}

export function deleteEmployee(id: string): boolean {
  const result = db.prepare("DELETE FROM employees WHERE id = ?").run(id);
  return result.changes > 0;
}
