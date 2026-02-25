import * as XLSX from "xlsx";

export function parseXLSX(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const text = XLSX.utils.sheet_to_txt(sheet, { FS: "\t", RS: "\n" });
    if (text.trim()) {
      parts.push(`Sheet: ${sheetName}\n${text.slice(0, 50000)}`);
    }
  }
  return parts.join("\n\n");
}
