import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { csvEscape } from "../src/lib/csv.ts";
import { validateAuthSecret } from "../src/lib/session-store.ts";
import { requireDemoPassword } from "../src/lib/db/demo-safety.ts";
import { extractDocxParagraphs, extractPptxSlides, OFFICE_LIMITS } from "../src/lib/office.ts";
import { withEnv } from "./helpers.ts";

test("security: production rejects missing, short and published signing secrets", () => {
  for (const value of [undefined, "short", "mlr-demo-secret-change-in-production", "build-time-placeholder-not-used-at-runtime"]) assert.throws(() => validateAuthSecret(value, true));
  assert.equal(validateAuthSecret("a-private-test-secret-at-least-32-characters", true), "a-private-test-secret-at-least-32-characters");
  assert.notEqual(validateAuthSecret(undefined, false), validateAuthSecret(undefined, false));
});

test("security: demo seeding requires private credentials and rejects production", async () => {
  await withEnv({ NODE_ENV: "development", DEMO_PASSWORD: undefined }, () => {
    for (const password of [undefined, "demo123", "DemoMLR2026!"]) assert.throws(() => requireDemoPassword(password));
    assert.equal(requireDemoPassword("private-demo-test-password"), "private-demo-test-password");
  });
  await withEnv({ NODE_ENV: "production" }, () => assert.throws(() => requireDemoPassword("private-demo-test-password")));
});

test("security: CSV formulas and disguised prefixes become text", () => {
  for (const value of ["=1+1", "+1", "-1", "@SUM(A1)", " \t=1+1", "\u0000=1+1", "\ttext"]) assert.equal(csvEscape(value), `'${value}`);
  assert.equal(csvEscape('a,"b"\r\nc'), '"a,""b""\r\nc"');
  assert.equal(csvEscape("\r=1+1"), '"\'\r=1+1"');
  assert.equal(csvEscape("Normal name"), "Normal name");
  assert.equal(csvEscape(null), "");
});

async function zipFile(name: string, content: string) {
  const zip = new JSZip(); zip.file(name, content);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

test("security: a tiny DOCX cannot expand past XML budget", async () => {
  const bytes = await zipFile("word/document.xml", "<w:document>" + " ".repeat(OFFICE_LIMITS.xmlBytes + 1) + "</w:document>");
  assert.ok(bytes.length < 10_000);
  await assert.rejects(extractDocxParagraphs(bytes), /OFFICE_LIMIT/);
});

test("security: DOCX text budget rejects the audited 1 MiB expansion", async () => {
  const bytes = await zipFile("word/document.xml", "<w:p><w:r><w:t>" + "A".repeat(1024 * 1024) + "</w:t></w:r></w:p>");
  await assert.rejects(extractDocxParagraphs(bytes), /OFFICE_LIMIT/);
});

test("security: PPTX slide count is bounded before rendering", async () => {
  const zip = new JSZip();
  for (let i = 1; i <= OFFICE_LIMITS.slides + 1; i++) zip.file(`ppt/slides/slide${i}.xml`, "<a:p><a:t>Valid text</a:t></a:p>");
  await assert.rejects(extractPptxSlides(await zip.generateAsync({ type: "nodebuffer" })), /OFFICE_LIMIT/);
});

test("security: many small paragraphs cannot amplify database writes", async () => {
  const bytes = await zipFile("word/document.xml", "<w:p><w:t>test</w:t></w:p>".repeat(OFFICE_LIMITS.paragraphs + 1));
  await assert.rejects(extractDocxParagraphs(bytes), /OFFICE_LIMIT/);
});

test("security: malformed XML cannot bypass the parser deadline with regex backtracking", async () => {
  for (const [name, tag, extract] of [
    ["word/document.xml", "w:p", extractDocxParagraphs],
    ["ppt/slides/slide1.xml", "a:p", extractPptxSlides],
    ["word/document.xml", "w:t", extractDocxParagraphs],
  ] as const) {
    const xml = tag === "w:t" ? `<w:p>${"<w:t>".repeat(100000)}</w:p>` : `<${tag}>`.repeat(100000);
    const bytes = await zipFile(name, xml);
    const start = Date.now();
    assert.equal(await extract(bytes), null);
    assert.ok(Date.now() - start < OFFICE_LIMITS.milliseconds, "malformed tags must finish within the parser budget");
  }
});
