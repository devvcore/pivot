/**
 * Artifact Generator — converts agent output into downloadable files.
 *
 * Supported artifact types:
 *   csv      — markdown tables parsed into CSV
 *   markdown — raw markdown saved as .md
 *   json     — structured data as JSON
 *   html     — styled HTML report (inline CSS, email-friendly)
 */

export type ArtifactType = "csv" | "markdown" | "json" | "html";

export interface GeneratedArtifact {
  filename: string;
  mimeType: string;
  content: string;
  type: ArtifactType;
}

/* ── Public API ─────────────────────────────────────────────── */

/**
 * Generate a downloadable artifact from agent output content.
 */
export function generateArtifact(
  type: ArtifactType,
  title: string,
  content: string
): GeneratedArtifact {
  const slug = slugify(title);

  switch (type) {
    case "csv": {
      const csv = extractTablesFromMarkdown(content);
      return {
        filename: `${slug}.csv`,
        mimeType: "text/csv",
        content: csv || markdownToPlainCSV(content),
        type: "csv",
      };
    }
    case "markdown":
      return {
        filename: `${slug}.md`,
        mimeType: "text/markdown",
        content,
        type: "markdown",
      };
    case "json": {
      const json = extractJSONFromMarkdown(content);
      return {
        filename: `${slug}.json`,
        mimeType: "application/json",
        content: json,
        type: "json",
      };
    }
    case "html": {
      const html = generateHTMLReport(title, content);
      return {
        filename: `${slug}.html`,
        mimeType: "text/html",
        content: html,
        type: "html",
      };
    }
  }
}

/* ── Markdown Table → CSV ──────────────────────────────────── */

/**
 * Extract all markdown tables from content and convert to CSV.
 * Multiple tables are separated by a blank line.
 */
export function extractTablesFromMarkdown(markdown: string): string {
  const tableRegex = /(?:^|\n)((?:\|.*\|[ \t]*\n){2,})/g;
  const tables: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(markdown)) !== null) {
    const raw = match[1].trim();
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);

    // Filter out separator rows (|---|---|)
    const dataLines = lines.filter(
      (line) => !/^\|[\s\-:]+\|$/.test(line.trim())
    );

    const csvRows = dataLines.map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1) // remove leading/trailing empty splits
        .map((cell) => {
          const trimmed = cell.trim();
          // Wrap in quotes if it contains commas or quotes
          if (trimmed.includes(",") || trimmed.includes('"')) {
            return `"${trimmed.replace(/"/g, '""')}"`;
          }
          return trimmed;
        });
      return cells.join(",");
    });

    tables.push(csvRows.join("\n"));
  }

  return tables.join("\n\n");
}

/* ── Markdown → Styled HTML Report ─────────────────────────── */

/**
 * Convert markdown content to a styled, self-contained HTML document.
 * Uses inline styles for maximum compatibility (email clients, etc.).
 */
export function generateHTMLReport(
  title: string,
  markdownContent: string
): string {
  const bodyHTML = markdownToHTML(markdownContent);
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; background: #f8f9fa; padding: 2rem; line-height: 1.6; }
    .report { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .report-header { background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; padding: 2rem 2.5rem; }
    .report-header h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
    .report-header .date { font-size: 0.8rem; opacity: 0.8; }
    .report-header .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 0.15rem 0.6rem; border-radius: 999px; font-size: 0.7rem; margin-top: 0.5rem; }
    .report-body { padding: 2rem 2.5rem; }
    .report-body h2 { font-size: 1.15rem; font-weight: 600; color: #1e1b4b; margin-top: 1.5rem; margin-bottom: 0.5rem; padding-bottom: 0.35rem; border-bottom: 2px solid #e5e7eb; }
    .report-body h3 { font-size: 1rem; font-weight: 600; color: #374151; margin-top: 1.25rem; margin-bottom: 0.4rem; }
    .report-body p { margin-bottom: 0.75rem; color: #374151; font-size: 0.9rem; }
    .report-body ul, .report-body ol { margin: 0.5rem 0 0.75rem 1.5rem; }
    .report-body li { margin-bottom: 0.35rem; color: #374151; font-size: 0.9rem; }
    .report-body strong { color: #111827; }
    .report-body blockquote { border-left: 3px solid #6366f1; background: #f0f0ff; padding: 0.75rem 1rem; border-radius: 0 8px 8px 0; margin: 0.75rem 0; font-size: 0.9rem; color: #374151; }
    .report-body code { background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.82rem; color: #4f46e5; }
    .report-body pre { background: #1e1b4b; color: #e0e7ff; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 0.75rem 0; font-size: 0.82rem; line-height: 1.5; }
    .report-body pre code { background: none; color: inherit; padding: 0; }
    .report-body table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.85rem; }
    .report-body th { text-align: left; padding: 0.5rem 0.75rem; background: #f9fafb; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .report-body td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f3f4f6; color: #374151; }
    .report-body tr:hover td { background: #f9fafb; }
    .report-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
    .report-footer { padding: 1rem 2.5rem; border-top: 1px solid #f3f4f6; text-align: center; }
    .report-footer p { font-size: 0.75rem; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="report">
    <div class="report-header">
      <h1>${escapeHTML(title)}</h1>
      <div class="date">${date}</div>
      <div class="badge">Pivot AI Report</div>
    </div>
    <div class="report-body">
      ${bodyHTML}
    </div>
    <div class="report-footer">
      <p>Generated by Pivot AI</p>
    </div>
  </div>
</body>
</html>`;
}

/* ── Content Detection ──────────────────────────────────────── */

export interface DetectedArtifacts {
  hasTable: boolean;
  hasCodeBlock: boolean;
  hasStructuredData: boolean;
  /** True if the output looks like a report/analysis (headings + paragraphs). */
  isReport: boolean;
}

/**
 * Analyze markdown content and detect what downloadable artifacts
 * can be generated from it.
 */
export function detectArtifacts(content: string): DetectedArtifacts {
  const hasTable = /\|.*\|.*\n\|[\s\-:]+\|/.test(content);
  const hasCodeBlock = /```[\s\S]*?```/.test(content);
  const headingCount = (content.match(/^#{1,3}\s/gm) || []).length;
  const paragraphCount = (content.match(/\n\n[^#\-|`>\s]/g) || []).length;
  const isReport = headingCount >= 2 && paragraphCount >= 2;
  const hasStructuredData =
    hasCodeBlock &&
    (content.includes("```json") || content.includes("```csv"));

  return { hasTable, hasCodeBlock, hasStructuredData, isReport };
}

/* ── Internal Helpers ──────────────────────────────────────── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Lightweight markdown → HTML converter (no external deps).
 * Handles headings, bold, italic, lists, tables, code, blockquotes, and hr.
 */
function markdownToHTML(md: string): string {
  let html = md;

  // Fenced code blocks (before other transforms)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${escapeHTML(code.trimEnd())}</code></pre>`;
  });

  // Inline code (before bold/italic)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Tables
  html = html.replace(
    /(?:^|\n)((?:\|.*\|[ \t]*\n){2,})/g,
    (_match, tableBlock: string) => {
      const lines = tableBlock
        .trim()
        .split("\n")
        .filter((l: string) => l.trim());
      const headerLine = lines[0];
      const dataLines = lines.filter(
        (l: string) => !/^\|[\s\-:]+\|$/.test(l.trim())
      );

      const toRow = (line: string, tag: string) =>
        "<tr>" +
        line
          .split("|")
          .slice(1, -1)
          .map((c: string) => `<${tag}>${c.trim()}</${tag}>`)
          .join("") +
        "</tr>";

      const thead = `<thead>${toRow(headerLine, "th")}</thead>`;
      const tbody = dataLines
        .slice(1)
        .map((l: string) => toRow(l, "td"))
        .join("");

      return `\n<table>${thead}<tbody>${tbody}</tbody></table>\n`;
    }
  );

  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rule
  html = html.replace(/^---+$/gm, "<hr>");

  // Blockquotes
  html = html.replace(
    /(?:^> .+\n?)+/gm,
    (block) =>
      `<blockquote>${block.replace(/^> /gm, "").trim()}</blockquote>`
  );

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/(?:^- .+\n?)+/gm, (block) => {
    const items = block
      .split("\n")
      .filter((l) => l.startsWith("- "))
      .map((l) => `<li>${l.slice(2)}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/(?:^\d+\. .+\n?)+/gm, (block) => {
    const items = block
      .split("\n")
      .filter((l) => /^\d+\. /.test(l))
      .map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // Paragraphs: wrap remaining bare text lines
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|table|pre|blockquote|hr)/.test(trimmed))
        return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}

/**
 * Extract JSON from fenced code blocks, or try to parse the whole content as JSON.
 */
function extractJSONFromMarkdown(md: string): string {
  // Try fenced json blocks first
  const jsonBlockMatch = md.match(/```json\s*\n([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonBlockMatch[1].trim();
    }
  }

  // Try parsing entire content
  try {
    const parsed = JSON.parse(md.trim());
    return JSON.stringify(parsed, null, 2);
  } catch {
    // Fallback: wrap as a plain object
    return JSON.stringify({ content: md }, null, 2);
  }
}

/**
 * Fallback for content without markdown tables:
 * convert lines into a single-column CSV.
 */
function markdownToPlainCSV(md: string): string {
  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && l !== "---");

  return lines
    .map((line) => {
      // Strip leading bullet/number
      const clean = line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
      if (clean.includes(",") || clean.includes('"')) {
        return `"${clean.replace(/"/g, '""')}"`;
      }
      return clean;
    })
    .join("\n");
}
