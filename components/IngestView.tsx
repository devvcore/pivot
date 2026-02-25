import { Database, FileText, Check, RefreshCw, UploadCloud } from "lucide-react";

export function IngestView() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-12 max-w-5xl">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-6">
        <div className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-widest">Phase 1 // Ingest</div>
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-light tracking-tight text-zinc-900">Knowledge Graph Construction</h1>
          <div className="text-xs font-mono text-zinc-500 text-right">
            <div>ENTITIES EXTRACTED: 14,203</div>
            <div>LAST SYNC: 2 MINS AGO</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left: Data Pipelines */}
        <div>
          <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">Active Data Pipelines</h2>
          
          <div className="border border-zinc-200 bg-white overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-zinc-50 text-zinc-500 font-mono text-[10px] uppercase tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-2.5 font-normal">Source</th>
                  <th className="px-4 py-2.5 font-normal">Type</th>
                  <th className="px-4 py-2.5 font-normal">Records</th>
                  <th className="px-4 py-2.5 font-normal text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {[
                  { 
                    name: "Salesforce", 
                    type: "CRM", 
                    status: "SYNCED", 
                    records: "142k", 
                    icon: <svg viewBox="0 0 24 24" fill="#00A1E0" className="w-4 h-4"><path d="M17.5 7.5C17.5 5.5 16 4 14 4C12.5 4 11.2 4.9 10.7 6.2C10.2 6 9.6 5.8 9 5.8C7.1 5.8 5.5 7.4 5.5 9.3C5.5 9.6 5.5 9.9 5.6 10.1C3.6 10.5 2 12.3 2 14.5C2 17 4 19 6.5 19H17.5C19.4 19 21 17.4 21 15.5C21 13.6 19.4 12 17.5 12C17.5 12 17.5 11.9 17.5 11.8C18.4 11.2 19 10.2 19 9C19 7.1 17.5 5.5 15.6 5.5C15.5 5.5 15.4 5.5 15.3 5.5C14.7 6.1 14.3 6.8 14.1 7.6C14 7.6 13.9 7.5 13.8 7.5H17.5Z"/></svg>
                  },
                  { 
                    name: "Xero", 
                    type: "FINANCE", 
                    status: "SYNCED", 
                    records: "84k", 
                    icon: <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#13B5EA" strokeWidth="2"/><path d="M8 16L16 8M8 8L16 16" stroke="#13B5EA" strokeWidth="2" strokeLinecap="round"/></svg>
                  },
                  { 
                    name: "Slack", 
                    type: "COMMS", 
                    status: "SYNCING", 
                    records: "1.2M", 
                    icon: <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.166 0a2.528 2.528 0 0 1 2.522 2.522v6.312zM15.166 18.956a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.166 24a2.527 2.527 0 0 1-2.522-2.522v-2.522h2.522zm0-1.268a2.527 2.527 0 0 1-2.522-2.523 2.526 2.526 0 0 1 2.522-2.52h6.312A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.312z" fill="#E01E5A"/></svg>
                  },
                  { 
                    name: "Stripe", 
                    type: "PAYMENTS", 
                    status: "AUTH_REQ", 
                    records: "-", 
                    icon: <svg viewBox="0 0 24 24" fill="#635BFF" className="w-4 h-4"><path d="M13.976 9.15c-2.172-.806-3.356-1.143-3.356-2.077 0-.626.561-1.046 1.344-1.046 1.187 0 2.695.521 3.892 1.28l1.446-4.394C15.828 1.831 14.1 1.3 12.228 1.3 7.087 1.3 3.656 4.36 3.656 8.289c0 4.71 5.395 5.8 8.277 6.67 2.566.774 3.15 1.43 3.15 2.265 0 .875-.79 1.414-1.926 1.414-1.612 0-3.73-1.06-4.956-2.09l-1.47 4.336c1.462 1.156 3.81 1.814 6.098 1.814 5.34 0 8.897-2.92 8.897-6.87 0-4.81-5.35-5.98-8.75-6.68z"/></svg>
                  },
                ].map((source, i) => (
                  <tr key={i} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {source.icon}
                        <span className="font-medium text-zinc-900">{source.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-zinc-500">{source.type}</td>
                    <td className="px-4 py-3 text-xs font-mono text-zinc-500">{source.records}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {source.status === 'SYNCED' && <span className="w-1.5 h-1.5 bg-zinc-900 rounded-full"></span>}
                        {source.status === 'SYNCING' && <RefreshCw className="w-3 h-3 text-zinc-900 animate-spin" />}
                        {source.status === 'AUTH_REQ' && <span className="w-1.5 h-1.5 bg-transparent border border-zinc-400 rounded-full"></span>}
                        <span className="text-[10px] font-mono text-zinc-900">{source.status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Schema Categorization */}
        <div>
          <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">Schema Categorization Status</h2>
          
          <div className="border border-zinc-200 bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 text-zinc-500 font-mono text-[10px] uppercase tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-2.5 font-normal">Dimension</th>
                  <th className="px-4 py-2.5 font-normal">Confidence</th>
                  <th className="px-4 py-2.5 font-normal text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {[
                  { dim: "Team Structure", conf: "0.98", status: "COMPLETE" },
                  { dim: "Compensation & HR", conf: "0.95", status: "COMPLETE" },
                  { dim: "Financial Position", conf: "0.99", status: "COMPLETE" },
                  { dim: "Revenue Model", conf: "0.92", status: "COMPLETE" },
                  { dim: "Customer Portfolio", conf: "0.88", status: "PROCESSING" },
                  { dim: "Operations", conf: "0.76", status: "PROCESSING" },
                  { dim: "Market & Competition", conf: "0.00", status: "PENDING" },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-zinc-900">{row.dim}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{row.conf}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.status === 'COMPLETE' && <span className="w-1.5 h-1.5 bg-zinc-900 rounded-full"></span>}
                        {row.status === 'PROCESSING' && <RefreshCw className="w-3 h-3 text-zinc-900 animate-spin" />}
                        {row.status === 'PENDING' && <span className="w-1.5 h-1.5 bg-transparent border border-zinc-400 rounded-full"></span>}
                        <span className="text-[10px] font-mono text-zinc-900">{row.status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Document Upload Area */}
      <div>
        <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">Manual Document Ingestion</h2>
        <div className="border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center hover:bg-zinc-100 transition-colors cursor-pointer flex flex-col items-center justify-center">
          <UploadCloud className="w-5 h-5 text-zinc-400 mb-3" />
          <div className="text-sm font-medium text-zinc-900 mb-1">Drop unstructured documents here</div>
          <div className="text-xs text-zinc-500 font-mono">PDF, DOCX, XLSX, PPTX supported. Max 50MB per file.</div>
        </div>
      </div>
    </div>
  )
}
