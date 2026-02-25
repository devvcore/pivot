import { useState, useRef, useCallback } from "react";
import { Check, ChevronRight, ChevronLeft, FileText, Loader2, UploadCloud, X } from "lucide-react";

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
const MAX_FILE_MB = 50;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

interface StagedFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

interface OnboardingConfig {
  organizationName: string;
  industry: string;
  revenueRange: string;
  primaryObjective: string;
}

interface OnboardingViewProps {
  onComplete: () => void;
}

export function OnboardingView({ onComplete }: OnboardingViewProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [config, setConfig] = useState<OnboardingConfig>({
    organizationName: "Acme Corporation",
    industry: "B2B SaaS",
    revenueRange: "$10M - $50M",
    primaryObjective: "Identify revenue leakage and optimize operational efficiency ahead of Series C.",
  });
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleNext = () => {
    if (step === 4) {
      onComplete();
    } else if (step === 3) {
      setStep(4);
      simulateProcessing();
    } else {
      setStep(step + 1);
    }
  };

  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const next: StagedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_BYTES) continue;
      const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ACCEPTED_TYPES.split(",").includes(ext)) continue;
      next.push({
        id: `${file.name}-${file.size}-${Date.now()}-${i}`,
        file,
        name: file.name,
        size: file.size,
      });
    }
    setStagedFiles((prev) => [...prev, ...next]);
  }, []);

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const simulateProcessing = () => {
    setIsProcessing(true);
    const sequence = [
      "INITIALIZING INGESTION AGENT...",
      "CONNECTING TO SALESFORCE CRM [OK]",
      "EXTRACTING 142,031 RECORDS [OK]",
      "CONNECTING TO XERO FINANCIALS [OK]",
      "PARSING 84,102 TRANSACTIONS [OK]",
      "VECTORIZING UNSTRUCTURED DOCUMENTS...",
      "BUILDING KNOWLEDGE GRAPH...",
      "MAPPING SCHEMA: TEAM STRUCTURE [98% CONFIDENCE]",
      "MAPPING SCHEMA: FINANCIAL POSITION [99% CONFIDENCE]",
      "PHASE 1 COMPLETE. READY FOR STRATEGIC DIAGNOSIS."
    ];

    let i = 0;
    const interval = setInterval(() => {
      setLogs(prev => [...prev, `[${new Date().toISOString().split('T')[1].substring(0, 8)}] ${sequence[i]}`]);
      i++;
      if (i === sequence.length) {
        clearInterval(interval);
        setIsProcessing(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-zinc-900 flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 p-6 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-zinc-900 flex items-center justify-center">
            <div className="w-2 h-2 bg-white" />
          </div>
          <div className="font-semibold tracking-widest text-sm uppercase text-zinc-900">
            Pivot // Setup
          </div>
        </div>
        <div className="text-xs font-mono text-zinc-500">
          STEP {step} OF 4
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          
          {/* Progress Bar */}
          <div className="mb-12">
            <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-2 uppercase tracking-wider">
              <span className={step >= 1 ? "text-zinc-900 font-bold" : ""}>1. Configuration</span>
              <span className={step >= 2 ? "text-zinc-900 font-bold" : ""}>2. Data Pipelines</span>
              <span className={step >= 3 ? "text-zinc-900 font-bold" : ""}>3. Unstructured</span>
              <span className={step >= 4 ? "text-zinc-900 font-bold" : ""}>4. Initialization</span>
            </div>
            <div className="h-1 w-full bg-zinc-100 flex">
              <div className="h-full bg-zinc-900 transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }}></div>
            </div>
          </div>

          {/* Step 1: Configuration */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h1 className="text-2xl font-light tracking-tight text-zinc-900 mb-2">System Configuration</h1>
                <p className="text-sm text-zinc-500">Define the core parameters for your enterprise environment.</p>
              </div>
              
              <div className="space-y-5 border border-zinc-200 bg-white p-6">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase">Organization Name</label>
                  <input
                    type="text"
                    value={config.organizationName}
                    onChange={(e) => setConfig((c) => ({ ...c, organizationName: e.target.value }))}
                    className="w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase">Industry</label>
                    <select
                      value={config.industry}
                      onChange={(e) => setConfig((c) => ({ ...c, industry: e.target.value }))}
                      className="w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
                    >
                      <option>B2B SaaS</option>
                      <option>Fintech</option>
                      <option>Healthcare</option>
                      <option>Manufacturing</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase">Revenue Range</label>
                    <select
                      value={config.revenueRange}
                      onChange={(e) => setConfig((c) => ({ ...c, revenueRange: e.target.value }))}
                      className="w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
                    >
                      <option>$10M - $50M</option>
                      <option>$50M - $100M</option>
                      <option>$100M - $500M</option>
                      <option>$500M+</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase">Primary Objective</label>
                  <textarea
                    rows={3}
                    value={config.primaryObjective}
                    onChange={(e) => setConfig((c) => ({ ...c, primaryObjective: e.target.value }))}
                    className="w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Connections */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h1 className="text-2xl font-light tracking-tight text-zinc-900 mb-2">Connect Data Pipelines</h1>
                <p className="text-sm text-zinc-500">Pivot requires read-only access to your core systems to build the knowledge graph.</p>
              </div>
              
              <div className="space-y-3">
                {[
                  { 
                    name: "Salesforce", 
                    type: "CRM", 
                    status: "CONNECTED", 
                    icon: <svg viewBox="0 0 24 24" fill="#00A1E0" className="w-5 h-5"><path d="M17.5 7.5C17.5 5.5 16 4 14 4C12.5 4 11.2 4.9 10.7 6.2C10.2 6 9.6 5.8 9 5.8C7.1 5.8 5.5 7.4 5.5 9.3C5.5 9.6 5.5 9.9 5.6 10.1C3.6 10.5 2 12.3 2 14.5C2 17 4 19 6.5 19H17.5C19.4 19 21 17.4 21 15.5C21 13.6 19.4 12 17.5 12C17.5 12 17.5 11.9 17.5 11.8C18.4 11.2 19 10.2 19 9C19 7.1 17.5 5.5 15.6 5.5C15.5 5.5 15.4 5.5 15.3 5.5C14.7 6.1 14.3 6.8 14.1 7.6C14 7.6 13.9 7.5 13.8 7.5H17.5Z"/></svg>
                  },
                  { 
                    name: "Xero", 
                    type: "FINANCE", 
                    status: "CONNECTED", 
                    icon: <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#13B5EA" strokeWidth="2"/><path d="M8 16L16 8M8 8L16 16" stroke="#13B5EA" strokeWidth="2" strokeLinecap="round"/></svg>
                  },
                  { 
                    name: "Slack", 
                    type: "COMMS", 
                    status: "CONNECTED", 
                    icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.166 0a2.528 2.528 0 0 1 2.522 2.522v6.312zM15.166 18.956a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.166 24a2.527 2.527 0 0 1-2.522-2.522v-2.522h2.522zm0-1.268a2.527 2.527 0 0 1-2.522-2.523 2.526 2.526 0 0 1 2.522-2.52h6.312A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.312z" fill="#E01E5A"/></svg>
                  },
                  { 
                    name: "Stripe", 
                    type: "PAYMENTS", 
                    status: "CONNECT", 
                    icon: <svg viewBox="0 0 24 24" fill="#635BFF" className="w-5 h-5"><path d="M13.976 9.15c-2.172-.806-3.356-1.143-3.356-2.077 0-.626.561-1.046 1.344-1.046 1.187 0 2.695.521 3.892 1.28l1.446-4.394C15.828 1.831 14.1 1.3 12.228 1.3 7.087 1.3 3.656 4.36 3.656 8.289c0 4.71 5.395 5.8 8.277 6.67 2.566.774 3.15 1.43 3.15 2.265 0 .875-.79 1.414-1.926 1.414-1.612 0-3.73-1.06-4.956-2.09l-1.47 4.336c1.462 1.156 3.81 1.814 6.098 1.814 5.34 0 8.897-2.92 8.897-6.87 0-4.81-5.35-5.98-8.75-6.68z"/></svg>
                  },
                ].map((source, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border border-zinc-200 bg-white">
                    <div className="flex items-center gap-4">
                      {source.icon}
                      <div>
                        <div className="font-medium text-zinc-900">{source.name}</div>
                        <div className="text-xs font-mono text-zinc-500">{source.type}</div>
                      </div>
                    </div>
                    {source.status === 'CONNECTED' ? (
                      <span className="text-[10px] font-mono text-zinc-900 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-zinc-900 rounded-full"></span> CONNECTED
                      </span>
                    ) : (
                      <button className="text-[10px] font-mono text-zinc-600 border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 transition-colors">
                        AUTHORIZE
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Unstructured Data */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h1 className="text-2xl font-light tracking-tight text-zinc-900 mb-2">Unstructured Knowledge</h1>
                <p className="text-sm text-zinc-500">Upload strategy documents, org charts, and historical reports.</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div
                className={`border border-dashed p-12 text-center flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  dragActive ? "border-zinc-900 bg-zinc-100" : "border-zinc-300 bg-zinc-50 hover:bg-zinc-100"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="w-8 h-8 text-zinc-400 mb-4" />
                <div className="text-sm font-medium text-zinc-900 mb-2">Drag and drop files to vault</div>
                <div className="text-xs text-zinc-500 font-mono mb-6">PDF, DOCX, XLSX, PPTX supported. Max {MAX_FILE_MB}MB per file.</div>
                <button
                  type="button"
                  className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse Files
                </button>
              </div>

              <div className="border border-zinc-200 bg-white">
                <div className="px-4 py-2 border-b border-zinc-200 bg-zinc-50 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  Staged for Ingestion
                </div>
                {stagedFiles.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500 font-mono">No files staged. Add files above to continue.</div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {stagedFiles.map((f) => (
                      <div key={f.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-zinc-900">{f.name}</div>
                            <div className="text-xs font-mono text-zinc-500">
                              {(f.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStagedFile(f.id)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors rounded"
                          aria-label="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Initialization */}
          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h1 className="text-2xl font-light tracking-tight text-zinc-900 mb-2">Phase 1: Ingest</h1>
                <p className="text-sm text-zinc-500">The Ingestion Agent is now processing all provided context to build the enterprise knowledge graph.</p>
              </div>
              
              <div className="border border-zinc-200 bg-zinc-900 p-4 h-64 overflow-y-auto font-mono text-xs text-zinc-300 flex flex-col">
                <div className="text-zinc-500 mb-4">// SYSTEM INITIALIZATION SEQUENCE</div>
                {logs.map((log, i) => (
                  <div key={i} className="mb-1">{log}</div>
                ))}
                {isProcessing && (
                  <div className="flex items-center gap-2 mt-2 text-zinc-500">
                    <Loader2 className="w-3 h-3 animate-spin" /> PROCESSING...
                  </div>
                )}
                {!isProcessing && (
                  <div className="mt-4 text-green-400">
                    &gt; SYSTEM READY.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="mt-12 flex justify-between border-t border-zinc-200 pt-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1 || (step === 4 && isProcessing)}
              className="px-4 py-2.5 border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={(step === 4 && isProcessing) || (step === 1 && !config.organizationName.trim())}
              className="px-6 py-2.5 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {step === 4 ? (isProcessing ? "Processing..." : "Enter Platform") : "Continue"}
              {!isProcessing && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
