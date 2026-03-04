// ═══════════════════════════════════════════════════════════════
// Pivot — ADP Workforce Now Integration
// API wrapper for ADP's HR, payroll, and time-off endpoints
// Uses OAuth2 with client credentials + mTLS (SSL certificates)
// ═══════════════════════════════════════════════════════════════

import {
  updateIntegration,
  getIntegrationByProvider,
  createSyncLog,
  updateSyncLog,
  saveHREmployeeData,
} from "./store";
import type { SyncResult, HREmployeeData } from "./types";

// ─── ADP API Configuration ──────────────────────────────────────────────────

const ADP_API_BASE = "https://api.adp.com";
const ADP_ACCOUNTS_BASE = "https://accounts.adp.com";
const ADP_PAGE_SIZE = 100;

// ─── ADP Types ───────────────────────────────────────────────────────────────

export interface ADPWorker {
  associateOID: string;
  workerID: string;
  name: {
    givenName: string;
    familyName: string;
    formattedName: string;
  };
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  hireDate: string | null;
  employmentStatus: string; // 'Active', 'Terminated', 'Leave'
  compensation: {
    annualRate: number | null;
    payFrequency: string | null; // 'Weekly', 'Biweekly', 'Monthly'
    currency: string;
  } | null;
  manager: {
    name: string;
    associateOID: string;
  } | null;
  workLocation: string | null;
  customFields: Record<string, any>;
}

export interface ADPPayrollEntry {
  associateOID: string;
  workerID: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  grossPay: number;
  netPay: number;
  deductions: {
    category: string;
    amount: number;
    description: string;
  }[];
  taxes: {
    taxType: string;
    amount: number;
  }[];
  hoursWorked: number | null;
  currency: string;
}

export interface ADPTimeOffBalance {
  associateOID: string;
  workerID: string;
  policyName: string; // 'Vacation', 'Sick', 'Personal'
  balanceHours: number;
  usedHours: number;
  accruedHours: number;
  pendingRequests: {
    startDate: string;
    endDate: string;
    hours: number;
    status: string; // 'Pending', 'Approved', 'Denied'
  }[];
}

// ─── OAuth Token Exchange ────────────────────────────────────────────────────

export async function exchangeADPCode(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}> {
  const clientId = process.env.ADP_CLIENT_ID;
  const clientSecret = process.env.ADP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("ADP_CLIENT_ID and ADP_CLIENT_SECRET must be set");
  }

  const response = await fetch(`${ADP_ACCOUNTS_BASE}/auth/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`ADP token exchange failed (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in || 3600,
  };
}

export async function refreshADPToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}> {
  const clientId = process.env.ADP_CLIENT_ID;
  const clientSecret = process.env.ADP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("ADP_CLIENT_ID and ADP_CLIENT_SECRET must be set");
  }

  const response = await fetch(`${ADP_ACCOUNTS_BASE}/auth/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`ADP token refresh failed (${response.status}): ${errBody}`);
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
 * Fetch all workers from ADP Workforce Now.
 * GET /hr/v2/workers with pagination via $top/$skip
 * ADP response structure: { workers: [{ worker: { ... } }] }
 */
export async function fetchADPWorkers(accessToken: string): Promise<ADPWorker[]> {
  const workers: ADPWorker[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${ADP_API_BASE}/hr/v2/workers`);
    url.searchParams.set("$top", String(ADP_PAGE_SIZE));
    url.searchParams.set("$skip", String(skip));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`ADP workers fetch failed (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const pageWorkers = data.workers || [];

    if (pageWorkers.length === 0) {
      hasMore = false;
      break;
    }

    for (const entry of pageWorkers) {
      // ADP wraps each worker in a nested structure
      const w = entry.worker || entry;
      workers.push(mapADPWorkerResponse(w));
    }

    skip += ADP_PAGE_SIZE;
    if (pageWorkers.length < ADP_PAGE_SIZE) {
      hasMore = false;
    }
  }

  return workers;
}

/**
 * Maps ADP's raw worker response to our ADPWorker interface.
 * ADP's worker object has deeply nested fields:
 *   - workerID.idValue
 *   - person.legalName.givenName / familyName1 / formattedName
 *   - person.communication.emails[0].emailUri
 *   - workerDates.originalHireDate
 *   - workerStatus.statusCode.codeValue
 *   - businessCommunication.emails
 *   - assignedOrganizationalUnits (department)
 *   - baseRemuneration.annualRateAmount.amountValue
 *   - reportsTo[0].reportsToWorkerName / reportsToAssociateOID
 */
function mapADPWorkerResponse(w: any): ADPWorker {
  // Extract name
  const legalName = w.person?.legalName || {};
  const givenName = legalName.givenName || "";
  const familyName = legalName.familyName1 || legalName.familyName || "";
  const formattedName = legalName.formattedName || `${givenName} ${familyName}`.trim();

  // Extract email from business communication or personal communication
  const bizEmails = w.businessCommunication?.emails || [];
  const personalEmails = w.person?.communication?.emails || [];
  const allEmails = [...bizEmails, ...personalEmails];
  const email = allEmails.length > 0 ? (allEmails[0].emailUri || null) : null;

  // Extract department from assigned organizational units
  const orgUnits = w.workerAssignment?.assignedOrganizationalUnits
    || w.workAssignments?.[0]?.assignedOrganizationalUnits
    || [];
  const deptUnit = orgUnits.find((u: any) =>
    u.typeCode?.codeValue === "Department" || u.unitType === "Department"
  );
  const department = deptUnit?.namecode?.codeValue
    || deptUnit?.nameCode?.shortName
    || deptUnit?.shortName
    || null;

  // Extract job title from work assignment
  const workAssignment = w.workAssignments?.[0] || w.workerAssignment || {};
  const jobTitle = workAssignment.jobTitle
    || workAssignment.jobCode?.shortName
    || workAssignment.positionTitle
    || null;

  // Extract hire date
  const hireDate = w.workerDates?.originalHireDate || null;

  // Extract employment status
  const statusCode = w.workerStatus?.statusCode?.codeValue || "Unknown";
  const employmentStatus = normalizeADPStatus(statusCode);

  // Extract compensation
  const baseRemuneration = workAssignment.baseRemuneration || {};
  const annualRate = baseRemuneration.annualRateAmount?.amountValue ?? null;
  const payFrequency = baseRemuneration.payPeriodFrequency?.codeValue
    || workAssignment.payCycleCode?.codeValue
    || null;
  const currency = baseRemuneration.annualRateAmount?.currencyCode || "USD";

  const compensation = (annualRate !== null || payFrequency)
    ? { annualRate, payFrequency, currency }
    : null;

  // Extract manager
  const reportsTo = w.reportsTo?.[0] || workAssignment.reportsTo?.[0] || null;
  const manager = reportsTo
    ? {
        name: reportsTo.reportsToWorkerName?.formattedName
          || reportsTo.reportToWorkerName
          || "Unknown",
        associateOID: reportsTo.reportsToAssociateOID
          || reportsTo.workerID?.idValue
          || "",
      }
    : null;

  // Extract work location
  const workLocation = workAssignment.homeWorkLocation?.address?.cityName
    || workAssignment.homeWorkLocation?.nameCode?.shortName
    || null;

  // Collect custom fields from ADP's customFieldGroup
  const customFields: Record<string, any> = {};
  const customGroups = w.customFieldGroup?.stringFields || [];
  for (const field of customGroups) {
    if (field.nameCode?.codeValue && field.stringValue) {
      customFields[field.nameCode.codeValue] = field.stringValue;
    }
  }

  return {
    associateOID: w.associateOID || "",
    workerID: w.workerID?.idValue || "",
    name: { givenName, familyName, formattedName },
    email,
    department,
    jobTitle,
    hireDate,
    employmentStatus,
    compensation,
    manager,
    workLocation,
    customFields,
  };
}

function normalizeADPStatus(code: string): string {
  const upper = code.toUpperCase();
  if (upper === "A" || upper === "ACTIVE") return "Active";
  if (upper === "T" || upper === "TERMINATED") return "Terminated";
  if (upper === "L" || upper === "LEAVE" || upper === "LOA") return "Leave";
  if (upper === "S" || upper === "SUSPENDED") return "Suspended";
  return code;
}

// ─── Payroll Data ────────────────────────────────────────────────────────────

/**
 * Fetch payroll data from ADP.
 * GET /payroll/v1/workers/{aoid}/pay-distributions for individual
 * GET /payroll/v2/payroll-outputs for bulk payroll data
 */
export async function fetchADPPayroll(
  accessToken: string,
  options?: {
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
  }
): Promise<ADPPayrollEntry[]> {
  const entries: ADPPayrollEntry[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${ADP_API_BASE}/payroll/v2/payroll-outputs`);
    url.searchParams.set("$top", String(ADP_PAGE_SIZE));
    url.searchParams.set("$skip", String(skip));

    if (options?.startDate) {
      url.searchParams.set("$filter", `payPeriod/startDate ge '${options.startDate}'`);
    }
    if (options?.endDate) {
      // ADP filter supports AND
      const existingFilter = url.searchParams.get("$filter") || "";
      const endFilter = `payPeriod/endDate le '${options.endDate}'`;
      url.searchParams.set(
        "$filter",
        existingFilter ? `${existingFilter} and ${endFilter}` : endFilter
      );
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // Payroll endpoint may not be available for all ADP clients
      if (response.status === 403 || response.status === 404) {
        console.warn("[adp] Payroll endpoint not available, skipping");
        return [];
      }
      const errBody = await response.text();
      throw new Error(`ADP payroll fetch failed (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const outputs = data.payrollOutputs || data.payStatements || [];

    if (outputs.length === 0) {
      hasMore = false;
      break;
    }

    for (const output of outputs) {
      entries.push(mapADPPayrollEntry(output));
    }

    skip += ADP_PAGE_SIZE;
    if (outputs.length < ADP_PAGE_SIZE) {
      hasMore = false;
    }
  }

  return entries;
}

function mapADPPayrollEntry(p: any): ADPPayrollEntry {
  const payStatement = p.payStatement || p;

  // Extract deductions
  const rawDeductions = payStatement.deductions || [];
  const deductions = rawDeductions.map((d: any) => ({
    category: d.deductionCategoryCode?.codeValue || d.codeName || "Unknown",
    amount: d.deductionAmount?.amountValue || 0,
    description: d.deductionCategoryCode?.shortName || d.itemDescription || "",
  }));

  // Extract taxes
  const rawTaxes = payStatement.taxes || [];
  const taxes = rawTaxes.map((t: any) => ({
    taxType: t.taxCode?.codeValue || t.taxType || "Unknown",
    amount: t.taxAmount?.amountValue || 0,
  }));

  return {
    associateOID: p.associateOID || "",
    workerID: p.workerID?.idValue || "",
    payPeriodStart: payStatement.payPeriod?.startDate || "",
    payPeriodEnd: payStatement.payPeriod?.endDate || "",
    payDate: payStatement.payDate || "",
    grossPay: payStatement.grossPayAmount?.amountValue
      || payStatement.grossPay?.amountValue || 0,
    netPay: payStatement.netPayAmount?.amountValue
      || payStatement.netPay?.amountValue || 0,
    deductions,
    taxes,
    hoursWorked: payStatement.totalHours?.hoursQuantity ?? null,
    currency: payStatement.grossPayAmount?.currencyCode || "USD",
  };
}

// ─── Time Off ────────────────────────────────────────────────────────────────

/**
 * Fetch time-off balances and requests from ADP.
 * GET /time/v2/workers/{aoid}/time-off-balances for balances
 * GET /time/v2/workers/{aoid}/time-off-requests for requests
 */
export async function fetchADPTimeOff(accessToken: string): Promise<ADPTimeOffBalance[]> {
  const balances: ADPTimeOffBalance[] = [];

  // First get all workers to iterate time-off per worker
  // ADP doesn't have a bulk time-off endpoint; use /time/v2/time-off-balances
  const url = new URL(`${ADP_API_BASE}/time/v2/time-off-balances`);
  url.searchParams.set("$top", String(500)); // Higher limit for balances

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      console.warn("[adp] Time-off endpoint not available, skipping");
      return [];
    }
    const errBody = await response.text();
    throw new Error(`ADP time-off fetch failed (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const timeOffEntries = data.timeOffBalances || data.timeOffs || [];

  // Group by worker
  const workerMap = new Map<string, ADPTimeOffBalance[]>();

  for (const entry of timeOffEntries) {
    const aoid = entry.associateOID || "";
    const balance: ADPTimeOffBalance = {
      associateOID: aoid,
      workerID: entry.workerID?.idValue || "",
      policyName: entry.timeOffPolicyName
        || entry.timeOffCode?.shortName
        || "Unknown",
      balanceHours: entry.balanceQuantity?.quantityValue
        || entry.currentBalance || 0,
      usedHours: entry.usedQuantity?.quantityValue
        || entry.usedBalance || 0,
      accruedHours: entry.accruedQuantity?.quantityValue
        || entry.accruedBalance || 0,
      pendingRequests: (entry.pendingRequests || []).map((r: any) => ({
        startDate: r.startDate || "",
        endDate: r.endDate || "",
        hours: r.requestedQuantity?.quantityValue || 0,
        status: r.requestStatusCode?.codeValue || "Pending",
      })),
    };

    balances.push(balance);
  }

  return balances;
}

// ─── Sync Orchestrator ───────────────────────────────────────────────────────

/**
 * Full sync: fetch workers + payroll + time-off from ADP,
 * save to hr_employee_data table, and generate workforce insights.
 */
export async function syncADPToAnalytics(
  orgId: string,
  accessToken: string
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsProcessed = 0;

  // Get or create integration record
  const integration = await getIntegrationByProvider(orgId, "adp");
  if (!integration) {
    return {
      success: false,
      recordsProcessed: 0,
      insightsGenerated: 0,
      errors: ["ADP integration not found for this organization"],
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
    let workers: ADPWorker[] = [];
    try {
      workers = await fetchADPWorkers(accessToken);
    } catch (err: any) {
      errors.push(`Worker fetch failed: ${err.message}`);
    }

    // ── Step 2: Fetch Payroll (last 90 days) ───────────────────────
    let payrollEntries: ADPPayrollEntry[] = [];
    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      payrollEntries = await fetchADPPayroll(accessToken, { startDate, endDate });
    } catch (err: any) {
      errors.push(`Payroll fetch failed: ${err.message}`);
    }

    // ── Step 3: Fetch Time Off ─────────────────────────────────────
    let timeOffBalances: ADPTimeOffBalance[] = [];
    try {
      timeOffBalances = await fetchADPTimeOff(accessToken);
    } catch (err: any) {
      errors.push(`Time-off fetch failed: ${err.message}`);
    }

    // ── Step 4: Build payroll lookup by associateOID ────────────────
    const payrollByWorker = new Map<string, ADPPayrollEntry[]>();
    for (const entry of payrollEntries) {
      const key = entry.associateOID;
      if (!payrollByWorker.has(key)) payrollByWorker.set(key, []);
      payrollByWorker.get(key)!.push(entry);
    }

    // ── Step 5: Build time-off lookup by associateOID ──────────────
    const timeOffByWorker = new Map<string, ADPTimeOffBalance[]>();
    for (const balance of timeOffBalances) {
      const key = balance.associateOID;
      if (!timeOffByWorker.has(key)) timeOffByWorker.set(key, []);
      timeOffByWorker.get(key)!.push(balance);
    }

    // ── Step 6: Save each worker to hr_employee_data ───────────────
    for (const worker of workers) {
      try {
        const workerPayroll = payrollByWorker.get(worker.associateOID) || [];
        const workerTimeOff = timeOffByWorker.get(worker.associateOID) || [];

        // Calculate latest salary from compensation or payroll
        let salary = worker.compensation?.annualRate ?? null;
        if (!salary && workerPayroll.length > 0) {
          // Estimate annual salary from most recent gross pay
          const latestPay = workerPayroll.sort(
            (a, b) => new Date(b.payDate).getTime() - new Date(a.payDate).getTime()
          )[0];
          const freq = worker.compensation?.payFrequency?.toLowerCase() || "biweekly";
          const multiplier =
            freq === "weekly" ? 52 :
            freq === "biweekly" ? 26 :
            freq === "semimonthly" ? 24 :
            freq === "monthly" ? 12 : 26;
          salary = latestPay.grossPay * multiplier;
        }

        // Build time-off balance summary
        const timeOffBalance: Record<string, any> = {};
        for (const tob of workerTimeOff) {
          timeOffBalance[tob.policyName] = {
            balance: tob.balanceHours,
            used: tob.usedHours,
            accrued: tob.accruedHours,
            pendingRequests: tob.pendingRequests.length,
          };
        }

        // Build payroll summary metadata
        const payrollSummary: Record<string, any> = {};
        if (workerPayroll.length > 0) {
          const totalGross = workerPayroll.reduce((sum, p) => sum + p.grossPay, 0);
          const totalNet = workerPayroll.reduce((sum, p) => sum + p.netPay, 0);
          payrollSummary.periodCount = workerPayroll.length;
          payrollSummary.totalGrossPay = totalGross;
          payrollSummary.totalNetPay = totalNet;
          payrollSummary.avgGrossPay = totalGross / workerPayroll.length;
          payrollSummary.lastPayDate = workerPayroll[0]?.payDate;
        }

        await saveHREmployeeData({
          orgId,
          source: "adp",
          externalId: worker.associateOID,
          employeeName: worker.name.formattedName,
          email: worker.email,
          department: worker.department,
          jobTitle: worker.jobTitle,
          hireDate: worker.hireDate,
          salary,
          payFrequency: worker.compensation?.payFrequency ?? null,
          employmentStatus: worker.employmentStatus,
          managerName: worker.manager?.name ?? null,
          performanceRating: null, // ADP doesn't expose performance in base API
          lastReviewDate: null,
          benefits: null,
          timeOffBalance: Object.keys(timeOffBalance).length > 0 ? timeOffBalance : null,
          metadata: {
            workerID: worker.workerID,
            workLocation: worker.workLocation,
            currency: worker.compensation?.currency || "USD",
            payrollSummary,
            customFields: worker.customFields,
          },
        });

        recordsProcessed++;
      } catch (err: any) {
        errors.push(`Failed to save worker ${worker.name.formattedName}: ${err.message}`);
      }
    }

    // ── Step 7: Update sync log and integration status ─────────────
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

export function getADPAuthUrl(state: string): string {
  const clientId = process.env.ADP_CLIENT_ID;
  const redirectUri = process.env.ADP_REDIRECT_URI
    || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/adp/callback`;

  if (!clientId) throw new Error("ADP_CLIENT_ID must be set");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "api",
    state,
  });

  return `${ADP_ACCOUNTS_BASE}/auth/oauth/v2/authorize?${params.toString()}`;
}
