"use client";

import { useState } from "react";
import {
  Download,
  Copy,
  Check,
  FileText,
  Code,
  Table,
  Globe,
  Braces,
  ChevronDown,
} from "lucide-react";

/* ── Artifact types ── */
export type ArtifactType = "markdown" | "html" | "csv" | "code" | "json";

export interface Artifact {
  id: string;
  title: string;
  type: ArtifactType;
  content: string;
  language?: string; // for code artifacts
  createdAt: number;
  agentName?: string;
}

export interface ArtifactViewerProps {
  artifacts: Artifact[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

/* ── Type config ── */
const TYPE_CONFIG: Record<
  ArtifactType,
  { icon: typeof FileText; label: string; iconClass: string }
> = {
  markdown: {
    icon: FileText,
    label: "Document",
    iconClass: "text-blue-500",
  },
  html: { icon: Globe, label: "HTML", iconClass: "text-orange-500" },
  csv: { icon: Table, label: "Data", iconClass: "text-emerald-500" },
  code: { icon: Code, label: "Code", iconClass: "text-violet-500" },
  json: { icon: Braces, label: "JSON", iconClass: "text-amber-500" },
};

/* ── CSV parser ── */
function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.trim().split("\n");
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) =>
    line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
  );

  return { headers, rows };
}

/* ── Renderers ── */
function MarkdownRenderer({ content }: { content: string }) {
  // Simple markdown to formatted text rendering
  const lines = content.split("\n");

  return (
    <div className="prose prose-sm prose-zinc max-w-none">
      {lines.map((line, i) => {
        // Headings
        if (line.startsWith("### "))
          return (
            <h4 key={i} className="text-sm font-bold text-zinc-900 mt-4 mb-1">
              {line.slice(4)}
            </h4>
          );
        if (line.startsWith("## "))
          return (
            <h3
              key={i}
              className="text-base font-bold text-zinc-900 mt-5 mb-2"
            >
              {line.slice(3)}
            </h3>
          );
        if (line.startsWith("# "))
          return (
            <h2 key={i} className="text-lg font-bold text-zinc-900 mt-6 mb-2">
              {line.slice(2)}
            </h2>
          );

        // List items
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <div key={i} className="flex gap-2 text-xs text-zinc-700 py-0.5">
              <span className="text-zinc-400 shrink-0">-</span>
              <span>{line.slice(2)}</span>
            </div>
          );

        // Numbered list items
        const numberedMatch = line.match(/^(\d+)\.\s(.+)/);
        if (numberedMatch)
          return (
            <div key={i} className="flex gap-2 text-xs text-zinc-700 py-0.5">
              <span className="text-zinc-400 shrink-0 tabular-nums w-4 text-right">
                {numberedMatch[1]}.
              </span>
              <span>{numberedMatch[2]}</span>
            </div>
          );

        // Bold text
        if (line.startsWith("**") && line.endsWith("**"))
          return (
            <p key={i} className="text-xs font-bold text-zinc-900 mt-2">
              {line.slice(2, -2)}
            </p>
          );

        // Empty line
        if (line.trim() === "") return <div key={i} className="h-2" />;

        // Normal text
        return (
          <p key={i} className="text-xs text-zinc-700 leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function HTMLRenderer({ content }: { content: string }) {
  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden">
      <iframe
        srcDoc={content}
        sandbox="allow-same-origin"
        className="w-full h-80 bg-white"
        title="HTML Preview"
      />
    </div>
  );
}

function CSVRenderer({ content }: { content: string }) {
  const { headers, rows } = parseCSV(content);

  return (
    <div className="border border-zinc-200 rounded-lg overflow-auto max-h-96">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors"
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2 text-zinc-700 whitespace-nowrap"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeRenderer({
  content,
  language,
}: {
  content: string;
  language?: string;
}) {
  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden">
      {language && (
        <div className="bg-zinc-800 px-3 py-1.5 flex items-center gap-2 border-b border-zinc-700">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
          </div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider ml-2">
            {language}
          </span>
        </div>
      )}
      <pre className="bg-zinc-900 p-4 overflow-auto max-h-96">
        <code className="text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre">
          {content}
        </code>
      </pre>
    </div>
  );
}

function JSONRenderer({ content }: { content: string }) {
  let formatted = content;
  try {
    formatted = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // use raw content if parsing fails
  }

  return <CodeRenderer content={formatted} language="json" />;
}

/* ── Content renderer switcher ── */
function ArtifactContent({ artifact }: { artifact: Artifact }) {
  switch (artifact.type) {
    case "markdown":
      return <MarkdownRenderer content={artifact.content} />;
    case "html":
      return <HTMLRenderer content={artifact.content} />;
    case "csv":
      return <CSVRenderer content={artifact.content} />;
    case "code":
      return (
        <CodeRenderer content={artifact.content} language={artifact.language} />
      );
    case "json":
      return <JSONRenderer content={artifact.content} />;
    default:
      return (
        <pre className="text-xs text-zinc-600 font-mono whitespace-pre-wrap">
          {artifact.content}
        </pre>
      );
  }
}

/* ── Main component ── */
export function ArtifactViewer({
  artifacts,
  selectedId,
  onSelect,
}: ArtifactViewerProps) {
  const [copied, setCopied] = useState(false);

  const selected =
    artifacts.find((a) => a.id === selectedId) ?? artifacts[0] ?? null;

  const handleCopy = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  };

  const handleDownload = () => {
    if (!selected) return;
    const ext =
      selected.type === "markdown"
        ? "md"
        : selected.type === "html"
        ? "html"
        : selected.type === "csv"
        ? "csv"
        : selected.type === "json"
        ? "json"
        : selected.language ?? "txt";

    const blob = new Blob([selected.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.title.replace(/\s+/g, "_").toLowerCase()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (artifacts.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-zinc-50 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-5 h-5 text-zinc-200" />
        </div>
        <p className="text-sm text-zinc-400">No artifacts yet</p>
        <p className="text-[10px] font-mono text-zinc-300 mt-1 uppercase tracking-wider">
          Artifacts will appear here as agents produce outputs
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* Artifact selector + actions */}
      <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {artifacts.length === 1 ? (
            <div className="flex items-center gap-2">
              {selected && (() => {
                const cfg = TYPE_CONFIG[selected.type];
                const Icon = cfg.icon;
                return (
                  <>
                    <Icon className={`w-4 h-4 ${cfg.iconClass} shrink-0`} />
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {selected.title}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                      {cfg.label}
                    </span>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="relative">
              <select
                value={selected?.id}
                onChange={(e) => onSelect?.(e.target.value)}
                className="appearance-none pr-7 pl-2 py-1 text-sm font-medium text-zinc-900 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {artifacts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copy
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            <Download className="w-3 h-3" /> Download
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[70vh] overflow-y-auto">
        {selected && <ArtifactContent artifact={selected} />}
      </div>

      {/* Footer metadata */}
      {selected && (
        <div className="px-4 py-2 border-t border-zinc-100 bg-zinc-50/50 flex items-center gap-3 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
          {selected.agentName && <span>By {selected.agentName}</span>}
          <span>
            {new Date(selected.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span>
            {selected.content.length.toLocaleString()} chars
          </span>
        </div>
      )}
    </div>
  );
}
