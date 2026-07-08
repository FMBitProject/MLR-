// Text extraction for uploaded Office files. PPTX/DOCX are ZIP archives of
// XML, so every slide's text can be pulled without external services — enough
// for per-slide review pages and the AI claims check. Visual fidelity
// (layout, images, charts) still requires the production rendering pipeline
// (PRD 9.7); slides containing media are marked for mandatory manual review.

import JSZip from "jszip";

export type PptxSlide = {
  paragraphs: string[];
  /** slide contains pictures/charts the text extractor cannot read */
  hasMedia: boolean;
};

function decodeEntities(s: string): string {
  return s
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replaceAll("&amp;", "&");
}

function paragraphsFrom(xmlBlock: string, textTag: string): string {
  const re = new RegExp(`<${textTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${textTag}>`, "g");
  const runs = [...xmlBlock.matchAll(re)].map((m) => decodeEntities(m[1]));
  return runs.join("").replace(/\s+/g, " ").trim();
}

/** One entry per slide, in deck order. Returns null if the file is not a
 *  readable PPTX (corrupt, password-protected, legacy .ppt). */
export async function extractPptxSlides(buf: Buffer): Promise<PptxSlide[] | null> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const slideFiles = Object.keys(zip.files)
      .map((name) => {
        const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
        return m ? { name, order: Number(m[1]) } : null;
      })
      .filter((x): x is { name: string; order: number } => !!x)
      .sort((a, b) => a.order - b.order);
    if (!slideFiles.length) return null;

    const slides: PptxSlide[] = [];
    for (const f of slideFiles) {
      const xml = await zip.file(f.name)!.async("string");
      const paragraphs: string[] = [];
      for (const p of xml.matchAll(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g)) {
        const text = paragraphsFrom(p[0], "a:t");
        if (text) paragraphs.push(text);
      }
      const hasMedia = /<a:blip\b|<p:pic\b|<c:chart\b|<p:graphicFrame\b|<mc:AlternateContent\b/.test(xml);
      slides.push({ paragraphs, hasMedia });
    }
    return slides.some((s) => s.paragraphs.length || s.hasMedia) ? slides : null;
  } catch {
    return null;
  }
}

/** Flat paragraph list from a DOCX body. Null if unreadable. */
export async function extractDocxParagraphs(buf: Buffer): Promise<string[] | null> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) return null;
    const paragraphs: string[] = [];
    for (const p of xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)) {
      const text = paragraphsFrom(p[0], "w:t");
      if (text) paragraphs.push(text);
    }
    return paragraphs.length ? paragraphs : null;
  } catch {
    return null;
  }
}
