import path from "path";
import { readFile } from "fs/promises";

export interface ParsedFile {
  filename: string;
  filePath: string;
  text: string;
}

/** Extract text from each file individually; return per-file results. */
export async function parseFiles(runId: string, filePaths: string[]): Promise<ParsedFile[]> {
  const dir = path.join(process.cwd(), "uploads", runId);
  const results: ParsedFile[] = [];

  for (const rel of filePaths) {
    const filename = path.basename(rel);
    const filePath = path.join(dir, filename);
    try {
      const text = await extractText(filePath, filename);
      results.push({ filename, filePath, text: text?.trim() || "" });
    } catch (e) {
      console.warn("Parse skip", filePath, e);
      results.push({ filename, filePath, text: "" });
    }
  }

  return results;
}

/** Extract text from all job files; return concatenated context (legacy / fallback). */
export async function parseAll(runId: string, filePaths: string[]): Promise<string> {
  const files = await parseFiles(runId, filePaths);
  return files
    .filter((f) => f.text.trim())
    .map((f) => `--- FILE: ${f.filename} ---\n${f.text.trim()}\n`)
    .join("\n");
}

async function extractText(filePath: string, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase();
  const buffer = await readFile(filePath);

  switch (ext) {
    case ".csv": {
      const { parseCSV } = await import("./parse-csv");
      return parseCSV(buffer.toString("utf-8"));
    }
    case ".xls":
    case ".xlsx": {
      const { parseXLSX } = await import("./parse-xlsx");
      return parseXLSX(buffer);
    }
    case ".pdf": {
      const { parsePDF } = await import("./parse-pdf");
      return await parsePDF(buffer);
    }
    case ".doc":
    case ".docx": {
      const { parseDOCX } = await import("./parse-docx");
      return await parseDOCX(buffer);
    }
    case ".ppt":
    case ".pptx": {
      const { parsePPTX } = await import("./parse-pptx");
      return await parsePPTX(buffer);
    }
    default:
      return buffer.toString("utf-8");
  }
}
