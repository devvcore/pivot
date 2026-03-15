/**
 * Permission Tier System for the Pivot Employee Value Engine
 *
 * Resolves user permissions from Supabase auth sessions and enforces
 * role-based access control across the employee scoring system.
 *
 * Tiers:
 *   owner   - Full access to everything
 *   csuite  - Full access to everything (same as owner for data access)
 *   employee - Self-only access, limited capabilities
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type PermissionTier = "owner" | "csuite" | "employee";

export interface UserPermissions {
  userId: string;
  employeeId: string | null;
  orgId: string;
  tier: PermissionTier;
  canViewAllEmployees: boolean;
  canEditScores: boolean;
  canManageGoals: boolean;
  canRunScoringCycle: boolean;
  canViewFinancials: boolean;
  canSubmitManagerInput: boolean;
  canAccessMissionControl: boolean;
}

// ── Permission matrix ─────────────────────────────────────────────────────────

const PERMISSION_MATRIX: Record<PermissionTier, Omit<UserPermissions, "userId" | "employeeId" | "orgId" | "tier">> = {
  owner: {
    canViewAllEmployees: true,
    canEditScores: true,
    canManageGoals: true,
    canRunScoringCycle: true,
    canViewFinancials: true,
    canSubmitManagerInput: true,
    canAccessMissionControl: true,
  },
  csuite: {
    canViewAllEmployees: true,
    canEditScores: true,
    canManageGoals: true,
    canRunScoringCycle: true,
    canViewFinancials: true,
    canSubmitManagerInput: true,
    canAccessMissionControl: true,
  },
  employee: {
    canViewAllEmployees: false,
    canEditScores: false,
    canManageGoals: true, // own goals only
    canRunScoringCycle: false,
    canViewFinancials: false,
    canSubmitManagerInput: false,
    canAccessMissionControl: false,
  },
};

/**
 * Resolve permissions from a Supabase auth user ID.
 *
 * Queries the `employees` table by `user_id` to find the employee record,
 * then builds a UserPermissions object based on their permission_tier.
 *
 * Returns null if no employee record is found for this user_id
 * (i.e. the user is not part of any organization).
 */
export async function resolvePermissions(userId: string): Promise<UserPermissions | null> {
  const supabase = createAdminClient();

  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, org_id, permission_tier")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error || !employee) {
    return null;
  }

  const tier = (employee.permission_tier as PermissionTier) || "employee";
  const matrix = PERMISSION_MATRIX[tier] ?? PERMISSION_MATRIX.employee;

  return {
    userId,
    employeeId: employee.id,
    orgId: employee.org_id,
    tier,
    ...matrix,
  };
}

/**
 * Check if a user can view a specific employee's data.
 *
 * - owner/csuite: can view any employee
 * - employee: can only view their own data
 */
export function canViewEmployee(
  permissions: UserPermissions,
  targetEmployeeId: string,
): boolean {
  if (permissions.canViewAllEmployees) {
    return true;
  }
  // Employee tier: can only view their own data
  return permissions.employeeId === targetEmployeeId;
}
