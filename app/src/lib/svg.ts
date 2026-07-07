// Server-side SVG "rendering pipeline" for the demo.
// In production this is replaced by LibreOffice/unoconv + OCR async jobs (PRD 9.7);
// here we lay out submitted rich text onto slide-shaped SVG pages so the visual
// review UI (pinned comments/flags on the rendered page) works end-to-end.

export const PAGE_W = 1240;
export const PAGE_H = 877;

const MARGIN = 84;
const FONT_SIZE = 22;
const LINE_H = 34;
const BLOCK_GAP = 30;
const MAX_CHARS = 88;

export type Bbox = { x: number; y: number; width: number; height: number };

export type RenderedElement = {
  pageNumber: number;
  text: string;
  bbox: Bbox;
  elementType: "text_block" | "footnote";
};

export type RenderedPage = {
  pageNumber: number;
  svg: string;
  width: number;
  height: number;
};

export function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function wrapText(text: string, maxChars = MAX_CHARS): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.length ? lines : [""];
}

function pageShell(inner: string, footer: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" font-family="Georgia, 'Times New Roman', serif">
<rect width="${PAGE_W}" height="${PAGE_H}" fill="#fdfcf9"/>
<rect x="0" y="0" width="${PAGE_W}" height="10" fill="#0f766e"/>
${inner}
<text x="${MARGIN}" y="${PAGE_H - 34}" font-size="15" fill="#94a3b8" font-family="Arial, sans-serif">${footer}</text>
</svg>`;
}

/**
 * Lays out title + paragraphs across as many pages as needed.
 * Returns rendered pages plus per-paragraph elements with bounding boxes.
 */
export function renderTextPages(opts: {
  title: string;
  subtitle: string;
  paragraphs: string[];
}): { pages: RenderedPage[]; elements: RenderedElement[] } {
  const pages: RenderedPage[] = [];
  const elements: RenderedElement[] = [];

  let pageNumber = 1;
  let cursorY = 0;
  let inner = "";

  const startPage = (first: boolean) => {
    cursorY = MARGIN + 20;
    inner = "";
    if (first) {
      inner += `<text x="${MARGIN}" y="${cursorY + 26}" font-size="40" font-weight="bold" fill="#0f172a">${escapeXml(opts.title)}</text>\n`;
      cursorY += 66;
      inner += `<text x="${MARGIN}" y="${cursorY + 10}" font-size="19" fill="#0f766e" font-family="Arial, sans-serif">${escapeXml(opts.subtitle)}</text>\n`;
      cursorY += 30;
      inner += `<line x1="${MARGIN}" y1="${cursorY + 12}" x2="${PAGE_W - MARGIN}" y2="${cursorY + 12}" stroke="#e2e8f0" stroke-width="2"/>\n`;
      cursorY += 44;
    }
  };

  const flushPage = () => {
    pages.push({
      pageNumber,
      svg: pageShell(inner, `${escapeXml(opts.title)} — page ${pageNumber}`),
      width: PAGE_W,
      height: PAGE_H,
    });
  };

  startPage(true);

  for (const para of opts.paragraphs) {
    const lines = wrapText(para);
    const blockH = lines.length * LINE_H + 8;
    if (cursorY + blockH > PAGE_H - MARGIN - 20) {
      flushPage();
      pageNumber += 1;
      startPage(false);
    }
    const bbox: Bbox = {
      x: MARGIN - 12,
      y: cursorY - 24,
      width: PAGE_W - 2 * (MARGIN - 12),
      height: blockH + 12,
    };
    let tspan = "";
    lines.forEach((ln, i) => {
      tspan += `<tspan x="${MARGIN}" dy="${i === 0 ? 0 : LINE_H}">${escapeXml(ln)}</tspan>`;
    });
    inner += `<text x="${MARGIN}" y="${cursorY}" font-size="${FONT_SIZE}" fill="#1e293b">${tspan}</text>\n`;
    elements.push({ pageNumber, text: para, bbox, elementType: "text_block" });
    cursorY += blockH + BLOCK_GAP;
  }

  flushPage();
  return { pages, elements };
}

/** Placeholder page for uploaded binary files (PDF/PPTX/DOCX) whose real rendering
 *  would run in the async pipeline. Keeps the review UI honest about the limitation. */
export function renderFilePlaceholderPage(fileName: string, title: string): RenderedPage {
  const inner = `
<rect x="${MARGIN}" y="200" width="${PAGE_W - 2 * MARGIN}" height="380" rx="18" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="10 8"/>
<text x="${PAGE_W / 2}" y="330" font-size="30" text-anchor="middle" fill="#475569" font-family="Arial, sans-serif" font-weight="bold">${escapeXml(fileName)}</text>
<text x="${PAGE_W / 2}" y="386" font-size="20" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif">Rendering &amp; OCR pipeline placeholder</text>
<text x="${PAGE_W / 2}" y="422" font-size="18" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif">In production, every slide/page is converted to an image asynchronously.</text>
<text x="${PAGE_W / 2}" y="452" font-size="18" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif">Review the original file manually — automated extraction did not run in this demo.</text>`;
  return {
    pageNumber: 1,
    svg: pageShell(inner, `${escapeXml(title)} — uploaded file`),
    width: PAGE_W,
    height: PAGE_H,
  };
}
