import { PDFParse } from "pdf-parse";

export async function parsePDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return (result?.text ?? "").slice(0, 100000);
  } finally {
    await parser.destroy();
  }
}
