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
  text: string | null;
  bbox: Bbox;
  // "image" marks unreadable media (charts/pictures) needing manual review
  elementType: "text_block" | "footnote" | "image";
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

function pageShell(inner: string, footer: string, height: number = PAGE_H): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${height}" viewBox="0 0 ${PAGE_W} ${height}" font-family="Georgia, 'Times New Roman', serif">
<rect width="${PAGE_W}" height="${height}" fill="#fdfcf9"/>
<rect x="0" y="0" width="${PAGE_W}" height="10" fill="#0f766e"/>
${inner}
<text x="${MARGIN}" y="${height - 34}" font-size="15" fill="#94a3b8" font-family="Arial, sans-serif">${footer}</text>
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

/**
 * Exactly one page per deck slide — the page grows vertically to fit dense
 * slides (the viewer scales by each page's own aspect ratio), so page N is
 * always slide N. First paragraph renders as the slide title; slides
 * containing media get a dashed manual-review strip since the text
 * extractor cannot read pictures/charts.
 */
export function renderSlidePages(opts: {
  title: string;
  slides: Array<{ paragraphs: string[]; hasMedia: boolean }>;
}): { pages: RenderedPage[]; elements: RenderedElement[] } {
  const pages: RenderedPage[] = [];
  const elements: RenderedElement[] = [];
  const BADGE_H = 64;
  // Denser metrics than the prose renderer: real decks carry many short bullets
  const BODY_FONT = 18;
  const BODY_LINE = 26;
  const BODY_GAP = 14;

  for (let s = 0; s < opts.slides.length; s++) {
    const slide = opts.slides[s];
    const pageNumber = s + 1;
    let cursorY = MARGIN + 8;
    let inner = `<text x="${MARGIN}" y="${cursorY}" font-size="16" letter-spacing="3" fill="#0f766e" font-family="Arial, sans-serif" font-weight="bold">SLIDE ${pageNumber}</text>\n`;
    cursorY += 18;
    inner += `<line x1="${MARGIN}" y1="${cursorY}" x2="${PAGE_W - MARGIN}" y2="${cursorY}" stroke="#e2e8f0" stroke-width="2"/>\n`;
    cursorY += 52;

    for (let i = 0; i < slide.paragraphs.length; i++) {
      const para = slide.paragraphs[i];
      const isTitle = i === 0;
      const fontSize = isTitle ? 27 : BODY_FONT;
      const lineH = isTitle ? 38 : BODY_LINE;
      const lines = wrapText(para, isTitle ? 68 : 104);
      const blockH = lines.length * lineH + 6;
      const bbox: Bbox = {
        x: MARGIN - 12,
        y: cursorY - 22,
        width: PAGE_W - 2 * (MARGIN - 12),
        height: blockH + 12,
      };
      let tspan = "";
      lines.forEach((ln, j) => {
        tspan += `<tspan x="${MARGIN}" dy="${j === 0 ? 0 : lineH}">${escapeXml(ln)}</tspan>`;
      });
      inner += `<text x="${MARGIN}" y="${cursorY}" font-size="${fontSize}"${isTitle ? ' font-weight="bold" fill="#0f172a"' : ' fill="#1e293b"'}>${tspan}</text>\n`;
      elements.push({ pageNumber, text: para, bbox, elementType: "text_block" });
      cursorY += blockH + (isTitle ? BODY_GAP + 10 : BODY_GAP);
    }

    // Page height adapts to content; short slides keep the standard canvas
    const pageH = Math.max(
      PAGE_H,
      cursorY + (slide.hasMedia ? BADGE_H + 24 : 0) + MARGIN,
    );

    if (slide.hasMedia) {
      const by = pageH - MARGIN - BADGE_H;
      inner += `<rect x="${MARGIN - 12}" y="${by}" width="620" height="${BADGE_H}" rx="12" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="2" stroke-dasharray="8 6"/>
<text x="${MARGIN + 8}" y="${by + 27}" font-size="17" fill="#6d28d9" font-family="Arial, sans-serif" font-weight="bold">Contains images/charts not readable by text extraction</text>
<text x="${MARGIN + 8}" y="${by + 50}" font-size="15" fill="#7c3aed" font-family="Arial, sans-serif">Review this slide manually in the original file.</text>\n`;
      elements.push({
        pageNumber,
        text: null,
        bbox: { x: MARGIN - 12, y: by, width: 620, height: BADGE_H },
        elementType: "image",
      });
    }

    pages.push({
      pageNumber,
      svg: pageShell(inner, `${escapeXml(opts.title)} — slide ${pageNumber}`, pageH),
      width: PAGE_W,
      height: pageH,
    });
  }

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
