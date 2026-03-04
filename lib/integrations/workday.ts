// ═══════════════════════════════════════════════════════════════
// Pivot — Workday Integration
// REST API wrapper for Workday's HR, compensation, and absence
// endpoints. Uses Workday REST API v1 (not SOAP/XML).
// Auth: OAuth2 with authorization code flow
// ═══════════════════════════════════════════════════════════════

import {
  updateIntegration,
  getIntegrationByProvider,
  createSyncLog,
  updateSyncLog,
  saveHREmployeeData,
} from "./store";
import type { SyncResult, HREmployeeData } from "./types";

// ─── Workday API Configuration ───────────────────────────────────────────────

const WORKDAY_PAGE_SIZE = 100;

function workdayApiBase(tenant: string): string {
  return `https://${tenant}.workday.com/api`;
}

function workdayTokenUrl(tenant: string): string {
  return `https://${tenant}.workday.com/ccx/oauth2/${tenant}/token`;
}

function workdayAuthUrl(tenant: string): string {
  return `https://${tenant}.workday.com/authorize`;
}

// ─── Workday Types ───────────────────────────────────────────────────────────

export interface WorkdayWorker {
  id: string;
  descriptor: string;
  primaryWorkEmail: string | null;
  businessTitle: string | null;
  supervisoryOrganization: string | null;
  hireDate: string | null;
  employeeStatus: string; // 'Active', 'Terminated', 'Leave of Absence'
  compensation: {
    totalBasePayAnnualized: number | null;
    currency: string;
    payGroup: string | null;
  } | null;
  manager: {
    id: string;
    descriptor: string;
  } | null;
  location: {
    descriptor: string;
  } | null;
  jobProfile: {
    descriptor: string;
  } | null;
}

export interface WorkdayCompensation {
  workerId: string;
  totalBasePayAnnualized: number | null;
  totalBasePayAmount: number | null;
  currency: string;
  payGroup: string | null;
  compensationPlans: {
    planName: string;
    amount: number;
    currency: string;
    frequency: string;
  }[];
  effectiveDate: string | null;
}

export interface WorkdayTimeOffEntry {
  workerId: string;
  workerDescriptor: string;
  timeOffType: string; // 'Vacation', 'Sick', 'Personal'
  startDate: string;
  endDate: string;
  totalHours: number;
  status: string; // 'Approved', 'Submitted', 'Denied', 'Cancelled'
  requestedDate: string | null;
}

export interface WorkdayTimeOffBalance {
  workerId: string;
  planName: string;
  balanceHours: number;
  usedHours: number;
}

// ─── OAuth Token Exchange ────────────────────────────────────────────────────

export async function exchangeWorkdayCode(
  code: string,
  tenant: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}> {
  const clientId = process.env.WORKDAY_CLIENT_ID;
  const clientSecret = process.env.WORKDAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("WORKDAY_CLIENT_ID and WORKDAY_CLIENT_SECRET must be set");
  }

  const response = await fetch(workdayTokenUrl(tenant), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Workday token exchange failed (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in || 3600,
  };
}

export async function refreshWorkdayToken(
  refreshToken: string,
  tenant: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}> {
  const clientId = process.env.WORKDAY_CLIENT_ID;
  const clientSecret = process.env.WORKDAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("WORKDAY_CLIENT_ID and WORKDAY_CLIENT_SECRET must be set");
  }

  const response = await fetch(workdayTokenUrl(tenant), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Workday token refresh failed (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 3600,
  };
}

// ─── Worker Data Fetching ────────────────────────────────────────────────────

/**
 * Fetch all workers from Workday REST API.
 * GET /staffing/v6/workers with ?limit=100&offset=0 pagination
 * Workday response: { data: [...], total: N }
 */
export async function fetchWorkdayWorkers(
  accessToken: string,
  tenant: string
): Promise<WorkdayWorker[]> {
  const workers: WorkdayWorker[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = new URL(`${workdayApiBase(tenant)}/staffing/v6/workers`);
    url.searchParams.set("limit", String(WORKDAY_PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Workday workers fetch failed (${response.status}): ${errBody}`);
    }

    const result = await response.json();
    total = result.total || 0;
    const pageData = result.data || [];

    if (pageData.length === 0) break;

    for (const entry of pageData) {
      workers.push(mapWorkdayWorkerResponse(entry));
    }

    offset += WORKDAY_PAGE_SIZE;
  }

  return workers;
}

/**
 * Maps Workday's raw worker response to our WorkdayWorker interface.
 * Workday REST API v6 worker structure:
 *   - id: WID (Workday ID)
 *   - descriptor: Display name
 *   - primaryWorkEmail
 *   - businessTitle
 *   - supervisoryOrganization.descriptor
 *   - hireDate
 *   - currentEmploymentStatus.descriptor
 *   - primarySupervisor (manager)
 *   - primaryWorkLocation
 *   - primaryJobProfile
 */
function mapWorkdayWorkerResponse(w: any): WorkdayWorker {
  // Workday REST uses a flatter structure than SOAP
  const id = w.id || w.workdayID || "";
  const descriptor = w.descriptor || w.workerDescriptor || "";

  // Email
  const primaryWorkEmail = w.primaryWorkEmail
    || w.emailAddresses?.[0]?.emailAddress
    || null;

  // Business title from primary job
  const businessTitle = w.businessTitle
    || w.primaryJob?.businessTitle
    || null;

  // Supervisory organization (department equivalent)
  const supervisoryOrganization = w.supervisoryOrganization?.descriptor
    || w.primaryJob?.supervisoryOrganization?.descriptor
    || null;

  // Hire date
  const hireDate = w.hireDate
    || w.primaryJob?.startDate
    || null;

  // Employment status
  const employeeStatus = w.currentEmploymentStatus?.descriptor
    || w.workerStatus?.descriptor
    || "Active";

  // Compensation - may need separate API call for full details
  let compensation: WorkdayWorker["compensation"] = null;
  if (w.compensation || w.primaryJob?.compensation) {
    const comp = w.compensation || w.primaryJob?.compensation || {};
    compensation = {
      totalBasePayAnnualized: comp.totalBasePayAnnualized?.amount
        || comp.totalBasePayAnnualizedAmount
        || null,
      currency: comp.totalBasePayAnnualized?.currency
        || comp.currency
        || "USD",
      payGroup: comp.payGroup?.descriptor || null,
    };
  }

  // Manager
  let manager: WorkdayWorker["manager"] = null;
  const supervisor = w.primarySupervisor || w.manager;
  if (supervisor) {
    manager = {
      id: supervisor.id || supervisor.workdayID || "",
      descriptor: supervisor.descriptor || "",
    };
  }

  // Location
  let location: WorkdayWorker["location"] = null;
  if (w.primaryWorkLocation || w.location) {
    location = {
      descriptor: (w.primaryWorkLocation || w.location)?.descriptor || "",
    };
  }

  // Job profile
  let jobProfile: WorkdayWorker["jobProfile"] = null;
  if (w.primaryJobProfile || w.jobProfile) {
    jobProfile = {
      descriptor: (w.primaryJobProfile || w.jobProfile)?.descriptor || "",
    };
  }

  return {
    id,
    descriptor,
    primaryWorkEmail,
    businessTitle,
    supervisoryOrganization,
    hireDate,
    employeeStatus,
    compensation,
    manager,
    location,
    jobProfile,
  };
}

// ─── Compensation Data ───────────────────────────────────────────────────────

/**
 * Fetch compensation details for a specific worker.
 * GET /staffing/v6/workers/{id}?expand=compensation
 * This gives full comp plan data beyond the worker summary.
 */
export async function fetchWorkdayCompensation(
  accessToken: string,
  tenant: string,
  workerId: string
): Promise<WorkdayCompensation> {
  const url = new URL(
    `${workdayApiBase(tenant)}/staffing/v6/workers/${workerId}`
  );
  // Workday uses subresource expansion
  url.searchParams.set("expand", "compensation");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `Workday compensation fetch failed for worker ${workerId} (${response.status}): ${errBody}`
    );
  }

  const data = await response.json();
  const comp = data.compensation || data.compensationSummary || {};
  const plans = comp.compensationPlans || comp.plans || [];

  return {
    workerId,
    totalBasePayAnnualized: comp.totalBasePayAnnualized?.amount
      || comp.totalBasePayAnnualizedAmount
      || null,
    totalBasePayAmount: comp.totalBasePay?.amount
      || comp.totalBasePayAmount
      || null,
    currency: comp.totalBasePayAnnualized?.currency
      || comp.currency
      || "USD",
    payGroup: comp.payGroup?.descriptor || null,
    compensationPlans: plans.map((p: any) => ({
      planName: p.compensationPlan?.descriptor || p.planName || "Unknown",
      amount: p.amount?.amount || p.compensationAmount || 0,
      currency: p.amount?.currency || p.currency || "USD",
      frequency: p.frequency?.descriptor || p.payFrequency || "Annual",
    })),
    effectiveDate: comp.effectiveDate || null,
  };
}

// ─── Time Off Data ───────────────────────────────────────────────────────────

/**
 * Fetch time-off requests from Workday.
 * GET /absenceManagement/v1/workers/{id}/requestedTimeOffs
 * Iterates across all workers if no specific ID is given.
 */
export async function fetchWorkdayTimeOff(
  accessToken: string,
  tenant: string,
  workerId?: string
): Promise<WorkdayTimeOffEntry[]> {
  const entries: WorkdayTimeOffEntry[] = [];

  if (workerId) {
    // Fetch time-off for a specific worker
    const workerEntries = await fetchWorkdayTimeOffForWorker(
      accessToken,
      tenant,
      workerId,
      ""
    );
    entries.push(...workerEntries);
  } else {
    // Fetch time-off via bulk endpoint
    const url = new URL(
      `${workdayApiBase(tenant)}/absenceManagement/v1/timeOffEntries`
    );
    url.searchParams.set("limit", String(WORKDAY_PAGE_SIZE));

    let offset = 0;
    let total = Infinity;

    while (offset < total) {
      url.searchParams.set("offset", String(offset));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        // Absence management may require additional authorization
        if (response.status === 403 || response.status === 404) {
          console.warn("[workday] Absence management endpoint not available, skipping");
          return [];
        }
        const errBody = await response.text();
        throw new Error(`Workday time-off fetch failed (${response.status}): ${errBody}`);
      }

      const result = await response.json();
      total = result.total || 0;
      const pageData = result.data || [];

      if (pageData.length === 0) break;

      for (const entry of pageData) {
        entries.push(mapWorkdayTimeOffEntry(entry));
      }

      offset += WORKDAY_PAGE_SIZE;
    }
  }

  return entries;
}

async function fetchWorkdayTimeOffForWorker(
  accessToken: string,
  tenant: string,
  workerId: string,
  workerDescriptor: string
): Promise<WorkdayTimeOffEntry[]> {
  const entries: WorkdayTimeOffEntry[] = [];
  const url = new URL(
    `${workdayApiBase(tenant)}/absenceManagement/v1/workers/${workerId}/requestedTimeOffs`
  );
  url.searchParams.set("limit", String(WORKDAY_PAGE_SIZE));

  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 403 || response.status === 404) return [];
      const errBody = await response.text();
      throw new Error(
        `Workday time-off fetch failed for worker ${workerId} (${response.status}): ${errBody}`
      );
    }

    const result = await response.json();
    total = result.total || 0;
    const pageData = result.data || [];

    if (pageData.length === 0) break;

    for (const entry of pageData) {
      const mapped = mapWorkdayTimeOffEntry(entry);
      mapped.workerId = workerId;
      mapped.workerDescriptor = workerDescriptor || mapped.workerDescriptor;
      entries.push(mapped);
    }

    offset += WORKDAY_PAGE_SIZE;
  }

  return entries;
}

function mapWorkdayTimeOffEntry(entry: any): WorkdayTimeOffEntry {
  return {
    workerId: entry.worker?.id || entry.workerId || "",
    workerDescriptor: entry.worker?.descriptor || entry.workerDescriptor || "",
    timeOffType: entry.timeOffType?.descriptor
      || entry.timeOffPlan?.descriptor
      || entry.type
      || "Unknown",
    startDate: entry.startDate || entry.date || "",
    endDate: entry.endDate || entry.date || "",
    totalHours: entry.totalHours || entry.units || 0,
    status: entry.status?.descriptor || entry.statusDescriptor || "Submitted",
    requestedDate: entry.requestedDate || entry.initiatedDate || null,
  };
}

// ─── Sync Orchestrator ───────────────────────────────────────────────────────

/**
 * Full sync: fetch workers + compensation + time-off from Workday,
 * save to hr_employee_data table, and generate workforce insights.
 */
export async function syncWorkdayToAnalytics(
  orgId: string,
  accessToken: string,
  tenant: string
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  // Get or create integration record
  const integration = await getIntegrationByProvider(orgId, "workday");
  if (!integration) {
    return {
      success: false,
      recordsProcessed: 0,
      insightsGenerated: 0,
      errors: ["Workday integration not found for this organization"],
    };
  }

  // Create sync log
  const syncLog = await createSyncLog({
    integrationId: integration.id,
    orgId,
  });

  // Update integration status to syncing
  await updateIntegration(integration.id, { status: "syncing" });

  try {
    // ── Step 1: Fetch Workers ──────────────────────────────────────
    let workers: WorkdayWorker[] = [];
    try {
      workers = await fetchWorkdayWorkers(accessToken, tenant);
    } catch (err: any) {
      errors.push(`Worker fetch failed: ${err.message}`);
    }

    // ── Step 2: Fetch Time Off (bulk) ──────────────────────────────
    let timeOffEntries: WorkdayTimeOffEntry[] = [];
    try {
      timeOffEntries = await fetchWorkdayTimeOff(accessToken, tenant);
    } catch (err: any) {
      errors.push(`Time-off fetch failed: ${err.message}`);
    }

    // ── Step 3: Build time-off lookup by worker ID ─────────────────
    const timeOffByWorker = new Map<string, WorkdayTimeOffEntry[]>();
    for (const entry of timeOffEntries) {
      const key = entry.workerId;
      if (!timeOffByWorker.has(key)) timeOffByWorker.set(key, []);
      timeOffByWorker.get(key)!.push(entry);
    }

    // ── Step 4: Fetch compensation details per worker ──────────────
    // Only fetch for workers without inline compensation data
    const compensationMap = new Map<string, WorkdayCompensation>();
    const workersNeedingComp = workers.filter(
      (w) => !w.compensation?.totalBasePayAnnualized
    );

    // Batch compensation lookups (max 10 concurrent)
    const COMP_BATCH_SIZE = 10;
    for (let i = 0; i < workersNeedingComp.length; i += COMP_BATCH_SIZE) {
      const batch = workersNeedingComp.slice(i, i + COMP_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((w) =>
          fetchWorkdayCompensation(accessToken, tenant, w.id)
        )
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          compensationMap.set(batch[j].id, result.value);
        }
        // Compensation fetch failures are not critical
      }
    }

    // ── Step 5: Save each worker to hr_employee_data ───────────────
    for (const worker of workers) {
      try {
        const workerTimeOff = timeOffByWorker.get(worker.id) || [];
        const workerComp = compensationMap.get(worker.id);

        // Determine salary: use inline compensation or fetched compensation
        let salary = worker.compensation?.totalBasePayAnnualized ?? null;
        if (!salary && workerComp) {
          salary = workerComp.totalBasePayAnnualized ?? null;
        }

        const currency = worker.compensation?.currency
          || workerComp?.currency
          || "USD";

        // Build time-off balance summary
        const timeOffBalance: Record<string, any> = {};
        const timeOffByType = new Map<string, WorkdayTimeOffEntry[]>();
        for (const entry of workerTimeOff) {
          const type = entry.timeOffType;
          if (!timeOffByType.has(type)) timeOffByType.set(type, []);
          timeOffByType.get(type)!.push(entry);
        }
        for (const [type, entries] of Array.from(timeOffByType.entries())) {
          const approvedEntries = entries.filter((e) => e.status === "Approved");
          timeOffBalance[type] = {
            totalRequests: entries.length,
            approvedRequests: approvedEntries.length,
            totalHoursRequested: entries.reduce((sum, e) => sum + e.totalHours, 0),
            totalHoursApproved: approvedEntries.reduce((sum, e) => sum + e.totalHours, 0),
          };
        }

        // Build compensation metadata
        const compensationMeta: Record<string, any> = {};
        if (workerComp) {
          compensationMeta.payGroup = workerComp.payGroup;
          compensationMeta.effectiveDate = workerComp.effectiveDate;
          compensationMeta.plans = workerComp.compensationPlans;
        }

        // Determine pay frequency from pay group
        let payFrequency: string | null = null;
        const payGroup = (worker.compensation?.payGroup || workerComp?.payGroup || "")
          .toLowerCase();
        if (payGroup.includes("weekly") && !payGroup.includes("bi")) {
          payFrequency = "Weekly";
        } else if (payGroup.includes("biweekly") || payGroup.includes("bi-weekly")) {
          payFrequency = "Biweekly";
        } else if (payGroup.includes("semi")) {
          payFrequency = "Semimonthly";
        } else if (payGroup.includes("monthly")) {
          payFrequency = "Monthly";
        }

        await saveHREmployeeData({
          orgId,
          source: "workday",
          externalId: worker.id,
          employeeName: worker.descriptor,
          email: worker.primaryWorkEmail,
          department: worker.supervisoryOrganization,
          jobTitle: worker.businessTitle || worker.jobProfile?.descriptor || null,
          hireDate: worker.hireDate,
          salary,
          payFrequency,
          employmentStatus: worker.employeeStatus,
          managerName: worker.manager?.descriptor ?? null,
          performanceRating: null, // Workday talent management requires separate API
          lastReviewDate: null,
          benefits: null,
          timeOffBalance: Object.keys(timeOffBalance).length > 0 ? timeOffBalance : null,
          metadata: {
            workdayId: worker.id,
            location: worker.location?.descriptor || null,
            jobProfile: worker.jobProfile?.descriptor || null,
            currency,
            compensation: compensationMeta,
          },
        });

        recordsProcessed++;
      } catch (err: any) {
        errors.push(`Failed to save worker ${worker.descriptor}: ${err.message}`);
      }
    }

    // ── Step 6: Update sync log and integration status ─────────────
    const success = errors.length === 0;
    const now = new Date().toISOString();

    await updateSyncLog(syncLog.id, {
      status: success ? "completed" : "failed",
      recordsProcessed,
      insightsGenerated: 0,
      errorMessage: errors.length > 0 ? errors.join("; ") : null,
    });

    await updateIntegration(integration.id, {
      status: success ? "connected" : "error",
      lastSyncAt: now,
    });

    return {
      success,
      recordsProcessed,
      insightsGenerated: 0,
      errors,
      nextSyncAt: new Date(
        Date.now() + integration.syncFrequencyMinutes * 60 * 1000
      ).toISOString(),
    };
  } catch (err: any) {
    // Catastrophic failure
    await updateSyncLog(syncLog.id, {
      status: "failed",
      recordsProcessed,
      errorMessage: err.message,
    });

    await updateIntegration(integration.id, { status: "error" });

    return {
      success: false,
      recordsProcessed,
      insightsGenerated: 0,
      errors: [err.message],
    };
  }
}

// ─── OAuth URL Builder ───────────────────────────────────────────────────────

export function getWorkdayAuthUrl(tenant: string, state: string): string {
  const clientId = process.env.WORKDAY_CLIENT_ID;
  const redirectUri = process.env.WORKDAY_REDIRECT_URI
    || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/workday/callback`;

  if (!clientId) throw new Error("WORKDAY_CLIENT_ID must be set");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "wd:workers wd:compensation wd:organizations",
    state,
  });

  return `${workdayAuthUrl(tenant)}?${params.toString()}`;
}
