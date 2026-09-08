import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { extractPptxSlides, extractDocxParagraphs } from "../src/lib/office.ts";

/** Builds a real PPTX-shaped zip so the extractor is exercised end to end. */
async function pptx(slides: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  slides.forEach((xml, i) => zip.file(`ppt/slides/slide${i + 1}.xml`, xml));
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

const slideXml = (paragraphs: string[], extra = "") =>
  `<p:sld xmlns:a="x"><p:cSld>${paragraphs
    .map((p) => `<a:p><a:r><a:t>${p}</a:t></a:r></a:p>`)
    .join("")}${extra}</p:cSld></p:sld>`;

async function docx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<w:document><w:body>${paragraphs
      .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
      .join("")}</w:body></w:document>`,
  );
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

test("office: pptx text is extracted slide by slide", async () => {
  const out = await extractPptxSlides(await pptx([slideXml(["Judul A", "Poin satu"]), slideXml(["Judul B"])]));
  assert.deepEqual(out, [
    { paragraphs: ["Judul A", "Poin satu"], hasMedia: false },
    { paragraphs: ["Judul B"], hasMedia: false },
  ]);
});

test("office: slides are ordered numerically, not lexicographically", async () => {
  const zip = new JSZip();
  // Deliberately added out of order and spanning the 9/10 boundary where a
  // string sort would put slide10 before slide2.
  for (const n of [10, 2, 1]) zip.file(`ppt/slides/slide${n}.xml`, slideXml([`Slide ${n}`]));
  const buf = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
  const out = await extractPptxSlides(buf);
  assert.deepEqual(out!.map((s) => s.paragraphs[0]), ["Slide 1", "Slide 2", "Slide 10"]);
});

test("office: multiple runs in one paragraph are joined into one string", async () => {
  const xml = `<p:sld><a:p><a:r><a:t>Obat X </a:t></a:r><a:r><a:t>menurunkan LDL</a:t></a:r></a:p></p:sld>`;
  const out = await extractPptxSlides(await pptx([xml]));
  assert.deepEqual(out![0].paragraphs, ["Obat X menurunkan LDL"]);
});

test("office: XML entities in slide text are decoded", async () => {
  const xml = `<p:sld><a:p><a:r><a:t>R&amp;D &lt;40%&gt; &quot;aman&quot; &#8212; &#x2713;</a:t></a:r></a:p></p:sld>`;
  const out = await extractPptxSlides(await pptx([xml]));
  assert.equal(out![0].paragraphs[0], 'R&D <40%> "aman" — ✓');
});

test("office: &amp; is decoded last, so &amp;lt; does not become a tag", async () => {
  const xml = `<p:sld><a:p><a:r><a:t>&amp;lt;script&amp;gt;</a:t></a:r></a:p></p:sld>`;
  const out = await extractPptxSlides(await pptx([xml]));
  assert.equal(out![0].paragraphs[0], "&lt;script&gt;", "must not decode into real markup");
});

test("office: layout noise (slide numbers, lone symbols) is dropped", async () => {
  const out = await extractPptxSlides(await pptx([slideXml(["Judul nyata", "12", "•", "", "2026"])]));
  assert.deepEqual(out![0].paragraphs, ["Judul nyata"]);
});

test("office: pictures, charts and graphic frames all mark a slide for manual review", async () => {
  for (const media of ["<a:blip r:embed='1'/>", "<p:pic/>", "<c:chart/>", "<p:graphicFrame/>", "<mc:AlternateContent/>"]) {
    const out = await extractPptxSlides(await pptx([slideXml(["Judul"], media)]));
    assert.equal(out![0].hasMedia, true, `media marker not detected: ${media}`);
  }
});

test("office: a picture-only slide is still returned so it can be reviewed", async () => {
  const out = await extractPptxSlides(await pptx([slideXml([], "<p:pic/>")]));
  assert.equal(out!.length, 1);
  assert.deepEqual(out![0], { paragraphs: [], hasMedia: true });
});

test("office: a deck with no readable content at all returns null", async () => {
  assert.equal(await extractPptxSlides(await pptx([slideXml([])])), null);
});

test("office: a zip with no slides returns null", async () => {
  const zip = new JSZip();
  zip.file("word/document.xml", "<w:document/>");
  assert.equal(await extractPptxSlides(Buffer.from(await zip.generateAsync({ type: "nodebuffer" }))), null);
});

test("office: a corrupt or non-zip buffer returns null instead of throwing", async () => {
  assert.equal(await extractPptxSlides(Buffer.from("not a zip at all")), null);
  assert.equal(await extractPptxSlides(Buffer.alloc(0)), null);
  assert.equal(await extractDocxParagraphs(Buffer.from("%PDF-1.7 definitely not a docx")), null);
});

test("office: docx paragraphs are extracted in document order", async () => {
  const out = await extractDocxParagraphs(await docx(["Pendahuluan", "Klaim utama", "Referensi"]));
  assert.deepEqual(out, ["Pendahuluan", "Klaim utama", "Referensi"]);
});

test("office: empty docx paragraphs are skipped", async () => {
  const out = await extractDocxParagraphs(await docx(["Isi", "", "Lanjutan"]));
  assert.deepEqual(out, ["Isi", "Lanjutan"]);
});

test("office: a docx with no body text returns null", async () => {
  assert.equal(await extractDocxParagraphs(await docx([])), null);
  assert.equal(await extractDocxParagraphs(await docx(["", "  "])), null);
});

test("office: a zip missing word/document.xml returns null", async () => {
  const zip = new JSZip();
  zip.file("ppt/slides/slide1.xml", slideXml(["x"]));
  assert.equal(await extractDocxParagraphs(Buffer.from(await zip.generateAsync({ type: "nodebuffer" }))), null);
});

test("office: docx run splitting (spell-check artefacts) rejoins into one paragraph", async () => {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<w:document><w:body><w:p><w:r><w:t xml:space="preserve">Efikasi </w:t></w:r><w:r><w:t>40%</w:t></w:r></w:p></w:body></w:document>`,
  );
  const out = await extractDocxParagraphs(Buffer.from(await zip.generateAsync({ type: "nodebuffer" })));
  assert.deepEqual(out, ["Efikasi 40%"]);
});
