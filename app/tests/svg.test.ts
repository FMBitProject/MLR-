import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeXml,
  wrapText,
  renderTextPages,
  renderSlidePages,
  renderFilePlaceholderPage,
  PAGE_W,
  PAGE_H,
} from "../src/lib/svg.ts";

test("svg: escapeXml neutralises every XML metacharacter", () => {
  assert.equal(escapeXml(`<script>&"'`), "&lt;script&gt;&amp;&quot;&apos;");
});

test("svg: escapeXml escapes ampersands first, so no double-escaping", () => {
  assert.equal(escapeXml("&lt;"), "&amp;lt;", "an already-escaped entity must be re-escaped once");
  assert.equal(escapeXml("a & b < c"), "a &amp; b &lt; c");
});

test("svg: escapeXml leaves safe text and unicode untouched", () => {
  assert.equal(escapeXml("Obat X — efikasi 40% ✓"), "Obat X — efikasi 40% ✓");
  assert.equal(escapeXml(""), "");
});

test("svg: injected markup cannot escape a rendered page", () => {
  const { pages } = renderTextPages({
    title: `</text><script>alert(1)</script>`,
    subtitle: "sub",
    paragraphs: [`</tspan><foreignObject onload="x"/>`],
  });
  const svg = pages[0].svg;
  assert.ok(!svg.includes("<script>"), "raw script tag leaked into the SVG");
  assert.ok(!svg.includes("<foreignObject"), "raw foreignObject leaked into the SVG");
  assert.ok(svg.includes("&lt;script&gt;"));
});

test("svg: wrapText keeps every line within the character budget", () => {
  const lines = wrapText("kata ".repeat(80).trim(), 40);
  for (const l of lines) assert.ok(l.length <= 40, `line too long (${l.length}): ${l}`);
  assert.ok(lines.length > 1);
});

test("svg: wrapText preserves all words in order", () => {
  const text = "Obat X menurunkan kadar kolesterol LDL pada pasien dewasa dislipidemia";
  assert.equal(wrapText(text, 20).join(" "), text);
});

test("svg: wrapText collapses runs of whitespace", () => {
  assert.deepEqual(wrapText("a   b\t\tc", 80), ["a b c"]);
});

test("svg: wrapText always returns at least one line", () => {
  assert.deepEqual(wrapText(""), [""]);
  assert.deepEqual(wrapText("   "), [""]);
});

test("svg: a word longer than the budget is not dropped", () => {
  const long = "x".repeat(120);
  assert.deepEqual(wrapText(long, 40), [long], "an over-long token stays on its own line");
});

test("svg: renderTextPages produces well-formed pages at the standard size", () => {
  const { pages } = renderTextPages({ title: "Judul", subtitle: "Sub", paragraphs: ["Satu.", "Dua."] });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].pageNumber, 1);
  assert.equal(pages[0].width, PAGE_W);
  assert.equal(pages[0].height, PAGE_H);
  assert.ok(pages[0].svg.startsWith("<svg"));
  assert.ok(pages[0].svg.trimEnd().endsWith("</svg>"));
});

test("svg: every paragraph gets exactly one element with a sane bbox", () => {
  const paragraphs = ["Satu.", "Dua.", "Tiga."];
  const { elements } = renderTextPages({ title: "T", subtitle: "S", paragraphs });
  assert.equal(elements.length, paragraphs.length);
  elements.forEach((el, i) => {
    assert.equal(el.text, paragraphs[i]);
    assert.equal(el.elementType, "text_block");
    assert.ok(el.bbox.width > 0 && el.bbox.height > 0);
    assert.ok(el.bbox.x >= 0);
    assert.ok(el.bbox.width <= PAGE_W, "bbox wider than the page");
  });
});

test("svg: long content overflows onto additional numbered pages", () => {
  const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraf panjang nomor ${i}.`);
  const { pages, elements } = renderTextPages({ title: "T", subtitle: "S", paragraphs });
  assert.ok(pages.length > 1, "expected pagination");
  assert.deepEqual(pages.map((p) => p.pageNumber), pages.map((_, i) => i + 1));
  assert.equal(elements.length, paragraphs.length, "no paragraph lost across the page break");
  assert.ok(elements.some((e) => e.pageNumber > 1));
});

test("svg: an element never claims a page that was not rendered", () => {
  const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraf ${i}.`);
  const { pages, elements } = renderTextPages({ title: "T", subtitle: "S", paragraphs });
  const rendered = new Set(pages.map((p) => p.pageNumber));
  for (const el of elements) assert.ok(rendered.has(el.pageNumber), `orphan page ${el.pageNumber}`);
});

test("svg: an empty deck still renders one page", () => {
  const { pages, elements } = renderTextPages({ title: "T", subtitle: "S", paragraphs: [] });
  assert.equal(pages.length, 1);
  assert.equal(elements.length, 0);
});

test("svg: renderSlidePages emits exactly one page per slide, in order", () => {
  const slides = [
    { paragraphs: ["Judul A", "Poin 1"], hasMedia: false },
    { paragraphs: ["Judul B"], hasMedia: false },
    { paragraphs: ["Judul C", "Poin"], hasMedia: false },
  ];
  const { pages } = renderSlidePages({ title: "Deck", slides });
  assert.equal(pages.length, 3, "page N must always be slide N");
  assert.deepEqual(pages.map((p) => p.pageNumber), [1, 2, 3]);
  assert.ok(pages[1].svg.includes("SLIDE 2"));
});

test("svg: a slide with media gets a manual-review element and badge", () => {
  const { pages, elements } = renderSlidePages({
    title: "Deck",
    slides: [{ paragraphs: ["Judul"], hasMedia: true }],
  });
  const image = elements.filter((e) => e.elementType === "image");
  assert.equal(image.length, 1);
  assert.equal(image[0].text, null, "an unreadable image has no extracted text");
  assert.ok(pages[0].svg.includes("Review this slide manually"));
});

test("svg: a slide without media gets no image element", () => {
  const { elements } = renderSlidePages({
    title: "Deck",
    slides: [{ paragraphs: ["Judul", "Poin"], hasMedia: false }],
  });
  assert.equal(elements.filter((e) => e.elementType === "image").length, 0);
  assert.equal(elements.length, 2);
});

test("svg: a dense slide grows taller rather than dropping content", () => {
  const dense = { paragraphs: Array.from({ length: 30 }, (_, i) => `Bullet nomor ${i}`), hasMedia: false };
  const { pages, elements } = renderSlidePages({ title: "Deck", slides: [dense] });
  assert.equal(pages.length, 1, "one slide is always one page");
  assert.ok(pages[0].height > PAGE_H, "page must grow to fit");
  assert.equal(elements.length, 30, "no bullet dropped");
});

test("svg: a short slide keeps the standard canvas height", () => {
  const { pages } = renderSlidePages({
    title: "Deck",
    slides: [{ paragraphs: ["Judul"], hasMedia: false }],
  });
  assert.equal(pages[0].height, PAGE_H);
});

test("svg: an empty slide list renders nothing", () => {
  const { pages, elements } = renderSlidePages({ title: "Deck", slides: [] });
  assert.deepEqual(pages, []);
  assert.deepEqual(elements, []);
});

test("svg: the file placeholder is honest about the missing pipeline", () => {
  const page = renderFilePlaceholderPage("deck & notes<1>.pptx", "Judul");
  assert.equal(page.pageNumber, 1);
  assert.equal(page.width, PAGE_W);
  assert.equal(page.height, PAGE_H);
  assert.ok(page.svg.includes("Review the original file manually"));
  assert.ok(page.svg.includes("deck &amp; notes&lt;1&gt;.pptx"), "file name must be escaped");
  assert.ok(!page.svg.includes("notes<1>"), "raw angle brackets leaked");
});
