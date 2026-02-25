import { ArrowRight, FileText, Download } from "lucide-react";

export function PlanView() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-12 max-w-5xl">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-6">
        <div className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-widest">Phase 2 // Plan</div>
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-light tracking-tight text-zinc-900">Strategic Diagnosis & Roadmap</h1>
          <button className="px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-colors">
            Approve Plan & Deploy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Generated Deliverables */}
        <div className="lg:col-span-1">
          <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">Generated Intelligence</h2>
          <div className="space-y-3">
            {[
              { id: "DOC-01", name: "Hard Truths Report", type: "PDF" },
              { id: "DOC-02", name: "Cash Survival Model", type: "XLSX" },
              { id: "DOC-03", name: "Revenue Leak Analysis", type: "PDF" },
              { id: "DOC-04", name: "Competitive Blind Spots", type: "PDF" },
            ].map((doc, i) => (
              <div key={i} className="group flex items-center justify-between p-3 border border-zinc-200 bg-white hover:border-zinc-400 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                  <div>
                    <div className="text-xs font-mono text-zinc-400">{doc.id}</div>
                    <div className="text-sm font-medium text-zinc-900">{doc.name}</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Day-by-Day Action Plan */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">Execution Roadmap</h2>
          
          <div className="border-l border-zinc-200 ml-2 space-y-8 pb-4">
            
            <div className="relative pl-6">
              <div className="absolute w-2 h-2 bg-zinc-900 -left-[4.5px] top-1.5 ring-4 ring-[#FDFDFD]"></div>
              <div className="text-xs font-mono text-zinc-900 mb-1 uppercase tracking-wider">Days 1-14 // Immediate Impact</div>
              <div className="border border-zinc-200 bg-white p-4 mt-2">
                <h3 className="text-sm font-medium text-zinc-900 mb-2">Cash Preservation & Retention</h3>
                <p className="text-sm text-zinc-600 mb-4">
                  Deploy Sales & Marketing agent to execute pricing corrections on 14 legacy accounts. Deploy Coach agent to initiate retention protocols for top 3 at-risk enterprise clients.
                </p>
                <div className="flex gap-4 border-t border-zinc-100 pt-3">
                  <div className="text-xs font-mono text-zinc-500"><span className="text-zinc-400">AGENTS:</span> SALES_MKTG, COACH</div>
                  <div className="text-xs font-mono text-zinc-500"><span className="text-zinc-400">TARGET:</span> +$97k ARR</div>
                </div>
              </div>
            </div>

            <div className="relative pl-6">
              <div className="absolute w-2 h-2 bg-zinc-400 -left-[4.5px] top-1.5 ring-4 ring-[#FDFDFD]"></div>
              <div className="text-xs font-mono text-zinc-500 mb-1 uppercase tracking-wider">Days 15-30 // Operational Fixes</div>
              <div className="border border-zinc-200 bg-white p-4 mt-2">
                <h3 className="text-sm font-medium text-zinc-900 mb-2">Process Automation & Tooling</h3>
                <p className="text-sm text-zinc-600 mb-4">
                  Deploy Developer agent to build automated invoice reconciliation between Stripe and Xero. Eliminate redundant marketing SaaS subscriptions identified in audit.
                </p>
                <div className="flex gap-4 border-t border-zinc-100 pt-3">
                  <div className="text-xs font-mono text-zinc-500"><span className="text-zinc-400">AGENTS:</span> DEVELOPER</div>
                  <div className="text-xs font-mono text-zinc-500"><span className="text-zinc-400">TARGET:</span> 15 hrs/wk saved</div>
                </div>
              </div>
            </div>

            <div className="relative pl-6">
              <div className="absolute w-2 h-2 bg-zinc-200 -left-[4.5px] top-1.5 ring-4 ring-[#FDFDFD]"></div>
              <div className="text-xs font-mono text-zinc-400 mb-1 uppercase tracking-wider">Days 31-90 // Strategic Growth</div>
              <div className="border border-zinc-200 bg-zinc-50 p-4 mt-2">
                <h3 className="text-sm font-medium text-zinc-500 mb-2">Market Expansion</h3>
                <p className="text-sm text-zinc-400 mb-4">
                  Deploy Transformation agent to redesign sales workflows. Orchestrator begins continuous competitive intelligence scanning and dynamic pricing adjustments.
                </p>
                <div className="flex gap-4 border-t border-zinc-200 pt-3">
                  <div className="text-xs font-mono text-zinc-400"><span className="text-zinc-300">AGENTS:</span> TRANSFORMATION, ORCHESTRATOR</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
