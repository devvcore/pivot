/**
 * PPTX parser — extracts text from PowerPoint files.
 * PPTX is a zip of XML slides. We read ppt/slides/slideN.xml and extract text nodes.
 */
import JSZip from "jszip";

export async function parsePPTX(buffer: Buffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles: string[] = [];

    // Collect all slide XML files
    zip.forEach((relativePath) => {
      if (/^ppt\/slides\/slide\d+\.xml$/i.test(relativePath)) {
        slideFiles.push(relativePath);
      }
    });

    // Sort by slide number
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0");
      return numA - numB;
    });

    if (slideFiles.length === 0) return "[PPTX: no slides found]";

    const slides: string[] = [];

    for (const slidePath of slideFiles.slice(0, 50)) {
      const file = zip.file(slidePath);
      if (!file) continue;

      const xml = await file.async("text");
      // Extract text from <a:t> tags (PowerPoint text elements)
      const texts: string[] = [];
      const regex = /<a:t>([\s\S]*?)<\/a:t>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        const text = match[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim();
        if (text) texts.push(text);
      }

      if (texts.length > 0) {
        const slideNum = slidePath.match(/slide(\d+)/)?.[1] ?? "?";
        slides.push(`[Slide ${slideNum}]\n${texts.join("\n")}`);
      }
    }

    if (slides.length === 0) return "[PPTX: no text content found in slides]";

    return slides.join("\n\n");
  } catch (e) {
    console.warn("[PPTX Parser] Failed:", e);
    return "[PPTX: extraction failed]";
  }
}
