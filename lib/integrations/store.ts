// ═══════════════════════════════════════════════════════════════
// Pivot — Integration Store
// Supabase CRUD operations for all integration tables
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '../supabase/admin';
import type {
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationSyncLog,
  CommunicationInsight,
  HREmployeeData,
} from './types';

// ─── Helper: snake_case DB row → camelCase TypeScript ─────────────────────────

function toIntegration(row: any): Integration {
  return {
    id: row.id,
    orgId: row.org_id,
    provider: row.provider,
    status: row.status,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiresAt: row.token_expires_at,
    composioConnectedAccountId: row.composio_connected_account_id ?? null,
    scopes: row.scopes ?? [],
    metadata: row.metadata ?? {},
    lastSyncAt: row.last_sync_at,
    syncFrequencyMinutes: row.sync_frequency_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSyncLog(row: any): IntegrationSyncLog {
  return {
    id: row.id,
    integrationId: row.integration_id,
    orgId: row.org_id,
    status: row.status,
    recordsProcessed: row.records_processed,
    insightsGenerated: row.insights_generated,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function toCommunicationInsight(row: any): CommunicationInsight {
  return {
    id: row.id,
    orgId: row.org_id,
    jobId: row.job_id,
    source: row.source,
    insightType: row.insight_type,
    subjectName: row.subject_name,
    data: row.data ?? {},
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
  };
}

function toHREmployeeData(row: any): HREmployeeData {
  return {
    id: row.id,
    orgId: row.org_id,
    source: row.source,
    externalId: row.external_id,
    employeeName: row.employee_name,
    email: row.email,
    department: row.department,
    jobTitle: row.job_title,
    hireDate: row.hire_date,
    salary: row.salary,
    payFrequency: row.pay_frequency,
    employmentStatus: row.employment_status,
    managerName: row.manager_name,
    performanceRating: row.performance_rating,
    lastReviewDate: row.last_review_date,
    benefits: row.benefits,
    timeOffBalance: row.time_off_balance,
    metadata: row.metadata ?? {},
    syncedAt: row.synced_at,
  };
}

// ═══════════════════════════════════════════════════════════════
// Integration CRUD
// ═══════════════════════════════════════════════════════════════

export async function createIntegration(data: {
  orgId: string;
  provider: IntegrationProvider;
  status?: IntegrationStatus;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  composioConnectedAccountId?: string | null;
  scopes?: string[];
  metadata?: Record<string, any>;
  syncFrequencyMinutes?: number;
}): Promise<Integration> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from('integrations')
    .insert({
      org_id: data.orgId,
      provider: data.provider,
      status: data.status ?? 'disconnected',
      access_token: data.accessToken ?? null,
      refresh_token: data.refreshToken ?? null,
      token_expires_at: data.tokenExpiresAt ?? null,
      composio_connected_account_id: data.composioConnectedAccountId ?? null,
      scopes: data.scopes ?? [],
      metadata: data.metadata ?? {},
      sync_frequency_minutes: data.syncFrequencyMinutes ?? 60,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create integration: ${error.message}`);
  return toIntegration(row);
}

/** Upsert: create or update integration on (org_id, provider) conflict */
export async function upsertIntegration(data: {
  orgId: string;
  provider: IntegrationProvider;
  status?: IntegrationStatus;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  composioConnectedAccountId?: string | null;
  scopes?: string[];
  metadata?: Record<string, any>;
  syncFrequencyMinutes?: number;
}): Promise<Integration> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from('integrations')
    .upsert(
      {
        org_id: data.orgId,
        provider: data.provider,
        status: data.status ?? 'connected',
        access_token: data.accessToken ?? null,
        refresh_token: data.refreshToken ?? null,
        token_expires_at: data.tokenExpiresAt ?? null,
        composio_connected_account_id: data.composioConnectedAccountId ?? null,
        scopes: data.scopes ?? [],
        metadata: data.metadata ?? {},
        sync_frequency_minutes: data.syncFrequencyMinutes ?? 60,
      },
      { onConflict: 'org_id,provider' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert integration: ${error.message}`);
  return toIntegration(row);
}

export async function getIntegration(id: string): Promise<Integration | null> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from('integrations')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Failed to get integration: ${error.message}`);
  }
  return toIntegration(row);
}

export async function getIntegrationByProvider(
  orgId: string,
  provider: IntegrationProvider
): Promise<Integration | null> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from('integrations')
    .select()
    .eq('org_id', orgId)
    .eq('provider', provider)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Failed to get integration by provider: ${error.message}`);
  }
  return toIntegration(row);
}

export async function listIntegrations(orgId: string): Promise<Integration[]> {
  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from('integrations')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to list integrations: ${error.message}`);
  return (rows ?? []).map(toIntegration);
}

export async function updateIntegration(
  id: string,
  updates: Partial<{
    status: IntegrationStatus;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: string | null;
    composioConnectedAccountId: string | null;
    scopes: string[];
    metadata: Record<string, any>;
    lastSyncAt: string | null;
    syncFrequencyMinutes: number;
  }>
): Promise<Integration> {
  const supabase = createAdminClient();

  // Map camelCase to snake_case
  const dbUpdates: Record<string, any> = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.accessToken !== undefined) dbUpdates.access_token = updates.accessToken;
  if (updates.refreshToken !== undefined) dbUpdates.refresh_token = updates.refreshToken;
  if (updates.tokenExpiresAt !== undefined) dbUpdates.token_expires_at = updates.tokenExpiresAt;
  if (updates.composioConnectedAccountId !== undefined) dbUpdates.composio_connected_account_id = updates.composioConnectedAccountId;
  if (updates.scopes !== undefined) dbUpdates.scopes = updates.scopes;
  if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;
  if (updates.lastSyncAt !== undefined) dbUpdates.last_sync_at = updates.lastSyncAt;
  if (updates.syncFrequencyMinutes !== undefined) dbUpdates.sync_frequency_minutes = updates.syncFrequencyMinutes;

  const { data: row, error } = await supabase
    .from('integrations')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update integration: ${error.message}`);
  return toIntegration(row);
}

export async function deleteIntegration(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete integration: ${error.message}`);
}

// ═══════════════════════════════════════════════════════════════
// Sync Log CRUD
// ═══════════════════════════════════════════════════════════════

export async function createSyncLog(data: {
  integrationId: string;
  orgId: string;
  status?: 'running' | 'completed' | 'failed';
}): Promise<IntegrationSyncLog> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from('integration_sync_logs')
    .insert({
      integration_id: data.integrationId,
      org_id: data.orgId,
      status: data.status ?? 'running',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create sync log: ${error.message}`);
  return toSyncLog(row);
}

export async function updateSyncLog(
  id: string,
  updates: Partial<{
    status: 'running' | 'completed' | 'failed';
    recordsProcessed: number;
    insightsGenerated: number;
    errorMessage: string | null;
    completedAt: string | null;
  }>
): Promise<IntegrationSyncLog> {
  const supabase = createAdminClient();

  const dbUpdates: Record<string, any> = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.recordsProcessed !== undefined) dbUpdates.records_processed = updates.recordsProcessed;
  if (updates.insightsGenerated !== undefined) dbUpdates.insights_generated = updates.insightsGenerated;
  if (updates.errorMessage !== undefined) dbUpdates.error_message = updates.errorMessage;
  if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;

  const { data: row, error } = await supabase
    .from('integration_sync_logs')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update sync log: ${error.message}`);
  return toSyncLog(row);
}

export async function listSyncLogs(integrationId: string): Promise<IntegrationSyncLog[]> {
  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from('integration_sync_logs')
    .select()
    .eq('integration_id', integrationId)
    .order('started_at', { ascending: false });

  if (error) throw new Error(`Failed to list sync logs: ${error.message}`);
  return (rows ?? []).map(toSyncLog);
}

// ═══════════════════════════════════════════════════════════════
// Communication Insights CRUD
// ═══════════════════════════════════════════════════════════════

export async function saveCommunicationInsight(data: {
  orgId: string;
  jobId?: string | null;
  source: 'slack' | 'gmail';
  insightType: CommunicationInsight['insightType'];
  subjectName?: string | null;
  data: Record<string, any>;
  periodStart?: string | null;
  periodEnd?: string | null;
}): Promise<CommunicationInsight> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from('communication_insights')
    .insert({
      org_id: data.orgId,
      job_id: data.jobId ?? null,
      source: data.source,
      insight_type: data.insightType,
      subject_name: data.subjectName ?? null,
      data: data.data,
      period_start: data.periodStart ?? null,
      period_end: data.periodEnd ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save communication insight: ${error.message}`);
  return toCommunicationInsight(row);
}

export async function listCommunicationInsights(
  orgId: string,
  filters?: {
    source?: 'slack' | 'gmail';
    insightType?: CommunicationInsight['insightType'];
    jobId?: string;
    periodStart?: string;
    periodEnd?: string;
    limit?: number;
  }
): Promise<CommunicationInsight[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from('communication_insights')
    .select()
    .eq('org_id', orgId);

  if (filters?.source) query = query.eq('source', filters.source);
  if (filters?.insightType) query = query.eq('insight_type', filters.insightType);
  if (filters?.jobId) query = query.eq('job_id', filters.jobId);
  if (filters?.periodStart) query = query.gte('period_start', filters.periodStart);
  if (filters?.periodEnd) query = query.lte('period_end', filters.periodEnd);

  query = query.order('created_at', { ascending: false });

  if (filters?.limit) query = query.limit(filters.limit);

  const { data: rows, error } = await query;

  if (error) throw new Error(`Failed to list communication insights: ${error.message}`);
  return (rows ?? []).map(toCommunicationInsight);
}

// ═══════════════════════════════════════════════════════════════
// HR Employee Data CRUD
// ═══════════════════════════════════════════════════════════════

export async function saveHREmployeeData(data: {
  orgId: string;
  source: 'adp' | 'workday' | 'manual';
  externalId?: string | null;
  employeeName: string;
  email?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  hireDate?: string | null;
  salary?: number | null;
  payFrequency?: string | null;
  employmentStatus?: string | null;
  managerName?: string | null;
  performanceRating?: number | null;
  lastReviewDate?: string | null;
  benefits?: Record<string, any> | null;
  timeOffBalance?: Record<string, any> | null;
  metadata?: Record<string, any>;
}): Promise<HREmployeeData> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from('hr_employee_data')
    .upsert(
      {
        org_id: data.orgId,
        source: data.source,
        external_id: data.externalId ?? null,
        employee_name: data.employeeName,
        email: data.email ?? null,
        department: data.department ?? null,
        job_title: data.jobTitle ?? null,
        hire_date: data.hireDate ?? null,
        salary: data.salary ?? null,
        pay_frequency: data.payFrequency ?? null,
        employment_status: data.employmentStatus ?? null,
        manager_name: data.managerName ?? null,
        performance_rating: data.performanceRating ?? null,
        last_review_date: data.lastReviewDate ?? null,
        benefits: data.benefits ?? null,
        time_off_balance: data.timeOffBalance ?? null,
        metadata: data.metadata ?? {},
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,source,external_id' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to save HR employee data: ${error.message}`);
  return toHREmployeeData(row);
}

export async function listHREmployeeData(
  orgId: string,
  source?: 'adp' | 'workday' | 'manual'
): Promise<HREmployeeData[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from('hr_employee_data')
    .select()
    .eq('org_id', orgId);

  if (source) query = query.eq('source', source);

  query = query.order('employee_name', { ascending: true });

  const { data: rows, error } = await query;

  if (error) throw new Error(`Failed to list HR employee data: ${error.message}`);
  return (rows ?? []).map(toHREmployeeData);
}
