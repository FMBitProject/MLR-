// Text extraction for uploaded Office files. PPTX/DOCX are ZIP archives of
// XML, so every slide's text can be pulled without external services — enough
// for per-slide review pages and the AI claims check. Visual fidelity
// (layout, images, charts) still requires the production rendering pipeline
// (PRD 9.7); slides containing media are marked for mandatory manual review.

import JSZip from "jszip";
import type { Readable } from "node:stream";
import { MAX_UPLOAD_BYTES } from "./upload";

export const OFFICE_LIMITS = {
  entries: 2048, slides: 300, xmlBytes: 2 * 1024 * 1024,
  totalXmlBytes: 8 * 1024 * 1024, textChars: 512 * 1024,
  paragraphs: 5000, milliseconds: 5000,
};

class OfficeLimitError extends Error {
  constructor() { super("OFFICE_LIMIT"); }
}

type Budget = { bytes: number; chars: number; paragraphs: number; deadline: number };
const budget = (): Budget => ({ bytes: 0, chars: 0, paragraphs: 0, deadline: Date.now() + OFFICE_LIMITS.milliseconds });

async function openArchive(buf: Buffer) {
  if (buf.length > MAX_UPLOAD_BYTES) throw new OfficeLimitError();
  const zip = await JSZip.loadAsync(buf);
  if (Object.keys(zip.files).length > OFFICE_LIMITS.entries) throw new OfficeLimitError();
  return zip;
}

/** Stream actual output; ZIP metadata is attacker-controlled and is not a
 * trustworthy decompression limit. Destroy/pause the stream on limit/timeout. */
async function boundedXml(file: JSZip.JSZipObject, remaining: Budget): Promise<string> {
  // JSZip uses readable-stream v2, which has no async iterator. Consume its
  // data events and pause the producer before destroying on rejection.
  return new Promise((resolve, reject) => {
    const stream = file.nodeStream() as Readable;
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stream.pause();
      stream.destroy?.();
      reject(error);
    };
    const timer = setTimeout(() => fail(new OfficeLimitError()), Math.max(1, remaining.deadline - Date.now()));
    stream.on("data", (data: Buffer) => {
      if (settled) return;
      const chunk = Buffer.from(data);
      bytes += chunk.length;
      remaining.bytes += chunk.length;
      if (bytes > OFFICE_LIMITS.xmlBytes || remaining.bytes > OFFICE_LIMITS.totalXmlBytes || Date.now() > remaining.deadline) {
        fail(new OfficeLimitError());
        return;
      }
      chunks.push(chunk);
    });
    stream.on("error", fail);
    stream.on("end", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(chunks, bytes).toString("utf8"));
    });
  });
}

function countParagraph(text: string, remaining: Budget) {
  remaining.chars += text.length;
  remaining.paragraphs += 1;
  if (remaining.chars > OFFICE_LIMITS.textChars || remaining.paragraphs > OFFICE_LIMITS.paragraphs || Date.now() > remaining.deadline) {
    throw new OfficeLimitError();
  }
}

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

/** Forward-only scanner: a missing closing tag must not repeatedly scan the
 * remaining document (quadratic regex backtracking). Paragraph and text tags
 * in Office XML cannot nest within another instance of the same tag. */
function* tagContents(xml: string, tag: string, remaining: Budget): Generator<string> {
  let cursor = 0;
  let start: number | null = null;
  while (cursor < xml.length) {
    if (Date.now() > remaining.deadline) throw new OfficeLimitError();
    const opening = xml.indexOf("<", cursor);
    if (opening < 0) break;
    if (xml.startsWith("<!--", opening) || xml.startsWith("<![CDATA[", opening)) {
      const comment = xml.startsWith("<!--", opening);
      const end = xml.indexOf(comment ? "-->" : "]]>", opening + (comment ? 4 : 9));
      if (end < 0) throw new Error("Malformed XML");
      cursor = end + 3;
      continue;
    }
    const end = xml.indexOf(">", opening + 1);
    if (end < 0) throw new Error("Malformed XML");
    const token = xml.slice(opening + 1, end);
    const closing = token.startsWith("/");
    const name = closing ? token.slice(1) : token;
    if (name.startsWith(tag) && (name.length === tag.length || /[\s/]/.test(name[tag.length]))) {
      if (closing) {
        if (start === null) throw new Error("Malformed XML");
        yield xml.slice(start, opening);
        start = null;
      } else if (!token.endsWith("/")) {
        if (start !== null) throw new Error("Malformed XML");
        start = end + 1;
      }
    }
    cursor = end + 1;
  }
  if (start !== null) throw new Error("Malformed XML");
  if (Date.now() > remaining.deadline) throw new OfficeLimitError();
}

function paragraphsFrom(xmlBlock: string, textTag: string, remaining: Budget): string {
  const runs = [...tagContents(xmlBlock, textTag, remaining)].map(decodeEntities);
  return runs.join("").replace(/\s+/g, " ").trim();
}

/** One entry per slide, in deck order. Returns null if the file is not a
 *  readable PPTX (corrupt, password-protected, legacy .ppt). */
export async function extractPptxSlides(buf: Buffer): Promise<PptxSlide[] | null> {
  try {
    const remaining = budget();
    const zip = await openArchive(buf);
    const slideFiles = Object.keys(zip.files)
      .map((name) => {
        const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
        return m ? { name, order: Number(m[1]) } : null;
      })
      .filter((x): x is { name: string; order: number } => !!x)
      .sort((a, b) => a.order - b.order);
    if (!slideFiles.length) return null;
    if (slideFiles.length > OFFICE_LIMITS.slides) throw new OfficeLimitError();

    const slides: PptxSlide[] = [];
    for (const f of slideFiles) {
      const xml = await boundedXml(zip.file(f.name)!, remaining);
      const paragraphs: string[] = [];
      for (const p of tagContents(xml, "a:p", remaining)) {
        const text = paragraphsFrom(p, "a:t", remaining);
        countParagraph(text, remaining);
        // Drop layout noise (slide numbers, lone symbols) that would bloat
        // the rendered pages without being reviewable content
        if (text && text.length > 1 && !/^\d{1,4}$/.test(text)) {
          paragraphs.push(text);
        }
      }
      const hasMedia = /<a:blip\b|<p:pic\b|<c:chart\b|<p:graphicFrame\b|<mc:AlternateContent\b/.test(xml);
      slides.push({ paragraphs, hasMedia });
    }
    return slides.some((s) => s.paragraphs.length || s.hasMedia) ? slides : null;
  } catch (error) {
    if (error instanceof OfficeLimitError) throw error;
    return null;
  }
}

/** Flat paragraph list from a DOCX body. Null if unreadable. */
export async function extractDocxParagraphs(buf: Buffer): Promise<string[] | null> {
  try {
    const remaining = budget();
    const zip = await openArchive(buf);
    const file = zip.file("word/document.xml");
    const xml = file ? await boundedXml(file, remaining) : null;
    if (!xml) return null;
    const paragraphs: string[] = [];
    for (const p of tagContents(xml, "w:p", remaining)) {
      const text = paragraphsFrom(p, "w:t", remaining);
      countParagraph(text, remaining);
      if (text) {
        paragraphs.push(text);
      }
    }
    return paragraphs.length ? paragraphs : null;
  } catch (error) {
    if (error instanceof OfficeLimitError) throw error;
    return null;
  }
}
