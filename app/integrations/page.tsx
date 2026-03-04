import { cookies } from "next/headers";
import { IntegrationPageClient } from "./client";

export const metadata = {
  title: "Integrations | Pivot",
  description: "Connect your tools for live business analytics",
};

export default async function IntegrationsPage() {
  // Get orgId from session cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("pivot_session");

  let orgId = "";
  if (sessionCookie?.value) {
    try {
      const parsed = JSON.parse(sessionCookie.value);
      orgId = parsed.organizationId ?? parsed.orgId ?? "";
    } catch {
      // Fall through to client-side auth check
    }
  }

  return <IntegrationPageClient initialOrgId={orgId} />;
}
