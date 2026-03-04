import { getShareLinkByToken } from "@/lib/share-store";
import { getJob } from "@/lib/job-store";
import { filterDeliverablesForRole } from "@/lib/role-filter";
import SharedResultsView from "@/components/SharedResultsView";

interface SharedPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedPage({ params }: SharedPageProps) {
  const { token } = await params;

  // Validate the share link
  const shareLink = await getShareLinkByToken(token);

  if (!shareLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-2xl font-light text-zinc-900 mb-2">Link Expired or Invalid</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            This shared link is no longer valid. It may have expired or been revoked by the owner.
            Please request a new link from the report owner.
          </p>
        </div>
      </div>
    );
  }

  // Fetch the job data
  const job = await getJob(shareLink.jobId);

  if (!job || !job.deliverables) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-light text-zinc-900 mb-2">Report Not Ready</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            The analysis for this report is still in progress or the data is no longer available.
            Please check back later or contact the report owner.
          </p>
        </div>
      </div>
    );
  }

  // Apply role-based filtering
  const filteredDeliverables = filterDeliverablesForRole(
    job.deliverables,
    shareLink.role,
    shareLink.employeeName,
  );

  const orgName = job.questionnaire.organizationName || "Your Organization";

  return (
    <SharedResultsView
      deliverables={filteredDeliverables as Record<string, unknown>}
      role={shareLink.role}
      employeeName={shareLink.employeeName}
      orgName={orgName}
      runId={shareLink.jobId}
    />
  );
}
