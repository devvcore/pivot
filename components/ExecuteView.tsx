import { Terminal, Check, X, Clock, PlayCircle } from "lucide-react";

export function ExecuteView() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-12 max-w-5xl">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-6">
        <div className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-widest">Phase 3 // Execute</div>
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-light tracking-tight text-zinc-900">Agent Orchestration</h1>
          <button className="px-4 py-2 bg-white border border-red-200 text-red-600 text-xs font-mono uppercase tracking-wider hover:bg-red-50 transition-colors">
            HALT ALL AGENTS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        {/* Left: Decision Queue */}
        <div>
          <div className="flex items-center justify-between mb-4 border-b border-zinc-200 pb-2">
            <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider">Authorization Queue</h2>
            <span className="text-xs font-mono bg-zinc-900 text-white px-1.5 py-0.5">2 PENDING</span>
          </div>

          <div className="space-y-6">
            <div className="border border-zinc-200 bg-white">
              <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex justify-between items-center">
                <div className="text-xs font-mono text-zinc-500">REQ_ID: 8942-A</div>
                <div className="text-xs font-mono text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3"/> 14m ago</div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900">Execute Pricing Update Campaign</h3>
                    <div className="text-xs font-mono text-zinc-500 mt-1">AGENT: SALES_MKTG</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-green-600">+$22,000</div>
                    <div className="text-[10px] font-mono text-zinc-400">EST. IMPACT</div>
                  </div>
                </div>
                <div className="text-sm text-zinc-600 mb-4 border-l-2 border-zinc-200 pl-3 py-1">
                  Drafted email to 14 legacy clients to update pricing to current tiers using approved "Grandfathered Transition" template. Confidence score: 94%.
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2">
                    <Check className="w-3 h-3" /> Authorize
                  </button>
                  <button className="flex-1 py-2 bg-white border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-colors">
                    Review Diff
                  </button>
                  <button className="px-3 py-2 bg-white border border-zinc-200 text-red-600 hover:bg-red-50 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-zinc-200 bg-white">
              <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex justify-between items-center">
                <div className="text-xs font-mono text-zinc-500">REQ_ID: 8943-B</div>
                <div className="text-xs font-mono text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3"/> 2h ago</div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900">Cancel Redundant SaaS</h3>
                    <div className="text-xs font-mono text-zinc-500 mt-1">AGENT: DEVELOPER</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-green-600">-$1,250/mo</div>
                    <div className="text-[10px] font-mono text-zinc-400">EST. SAVINGS</div>
                  </div>
                </div>
                <div className="text-sm text-zinc-600 mb-4 border-l-2 border-zinc-200 pl-3 py-1">
                  Identified 3 unused marketing tools (Hootsuite, Buffer, Sprout Social). Ready to initiate cancellation flows via API and email support.
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2">
                    <Check className="w-3 h-3" /> Authorize
                  </button>
                  <button className="flex-1 py-2 bg-white border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Master Task List */}
        <div>
          <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">Master Task List</h2>
          
          <div className="border border-zinc-200 bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 text-zinc-500 font-mono text-[10px] uppercase tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-2.5 font-normal">Task</th>
                  <th className="px-4 py-2.5 font-normal">Agent</th>
                  <th className="px-4 py-2.5 font-normal text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-900">Weekly Health Score Update</td>
                  <td className="px-4 py-3 text-xs font-mono text-zinc-500">ORCHESTRATOR</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-mono text-zinc-400">COMPLETED</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-900">Monitor Team Attrition Risk</td>
                  <td className="px-4 py-3 text-xs font-mono text-zinc-500">COACH</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-mono text-blue-600 flex items-center justify-end gap-1">
                      <PlayCircle className="w-3 h-3 animate-pulse" /> RUNNING
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-900">Competitor Pricing Scan</td>
                  <td className="px-4 py-3 text-xs font-mono text-zinc-500">SALES_MKTG</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-mono text-blue-600 flex items-center justify-end gap-1">
                      <PlayCircle className="w-3 h-3 animate-pulse" /> RUNNING
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-zinc-900">Generate Board Pack Q3</td>
                  <td className="px-4 py-3 text-xs font-mono text-zinc-500">ORCHESTRATOR</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-mono text-zinc-400">SCHEDULED</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Terminal Output Simulation */}
          <div className="mt-6 border border-zinc-200 bg-zinc-900 text-zinc-300 font-mono text-xs p-4 h-48 overflow-y-auto">
            <div className="text-zinc-500 mb-2">// ORCHESTRATOR LOG STREAM</div>
            <div>[10:42:01] INFO: Generated Q3 Board Pack. Confidence: 98%.</div>
            <div>[10:42:05] INFO: Dispatched to stakeholder review queue.</div>
            <div>[09:15:22] WARN: Competitor pricing shift detected (Acme vs Globex).</div>
            <div>[09:15:24] INFO: Analysis brief created. Routing to SALES_MKTG.</div>
            <div className="animate-pulse mt-2">_</div>
          </div>
        </div>
      </div>
    </div>
  )
}
