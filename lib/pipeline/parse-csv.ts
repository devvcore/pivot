/** Simple CSV to text: header + rows for context. */
export function parseCSV(raw: string): string {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return "";
  const header = lines[0];
  const rows = lines.slice(1, 101);
  return `CSV Data (${lines.length - 1} rows, showing up to 100):\nHeader: ${header}\nRows:\n${rows.join("\n")}`;
}
