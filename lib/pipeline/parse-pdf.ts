export async function parsePDF(buffer: Buffer): Promise<string> {
  // Primary path: pdf-parse v2.
  try {
    const mod = await import("pdf-parse");
    const PDFParseCtor =
      ((mod as { PDFParse?: new (args: { data: Uint8Array }) => { getText: () => Promise<{ text?: string }>; destroy: () => Promise<void> } }).PDFParse) ||
      ((mod as { default?: { PDFParse?: new (args: { data: Uint8Array }) => { getText: () => Promise<{ text?: string }>; destroy: () => Promise<void> } } }).default?.PDFParse);

    if (PDFParseCtor) {
      const parser = new PDFParseCtor({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return (result?.text ?? "").slice(0, 100000);
      } finally {
        await parser.destroy();
      }
    }
  } catch (e) {
    console.warn("[parsePDF] CJS parser load failed:", e);
  }

  // Fallback path: use pdfjs-dist directly.
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = (pdfjs as { getDocument: (args: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }> }> } }).getDocument({
      data: new Uint8Array(buffer),
    });
    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, 50);
    const pages: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => (typeof item.str === "string" ? item.str : ""))
        .join(" ");
      if (pageText.trim()) pages.push(pageText);
      if (pages.join("\n").length > 100000) break;
    }
    return pages.join("\n").slice(0, 100000);
  } catch (e) {
    console.warn("[parsePDF] pdfjs fallback failed:", e);
  }

  // Fallback: return empty so the pipeline keeps running for other files.
  return "";
}
