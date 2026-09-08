import { test } from "node:test";
import assert from "node:assert/strict";
import { splitParagraphs, diffParagraphs } from "../src/lib/diff.ts";

const texts = (d: ReturnType<typeof diffParagraphs>, type: string) =>
  d.filter((l) => l.type === type).map((l) => l.text);

test("diff: splitParagraphs trims, splits on newlines, and drops blanks", () => {
  assert.deepEqual(splitParagraphs("  a  \n\n  b  \n c \n\n\n"), ["a", "b", "c"]);
  assert.deepEqual(splitParagraphs(""), []);
  assert.deepEqual(splitParagraphs("   \n\n  "), []);
});

test("diff: identical text produces only 'same' lines", () => {
  const d = diffParagraphs("a\n\nb\n\nc", "a\n\nb\n\nc");
  assert.deepEqual(d.map((l) => l.type), ["same", "same", "same"]);
});

test("diff: a pure insertion is reported as added", () => {
  const d = diffParagraphs("a\n\nc", "a\n\nb\n\nc");
  assert.deepEqual(texts(d, "added"), ["b"]);
  assert.deepEqual(texts(d, "removed"), []);
  assert.deepEqual(texts(d, "same"), ["a", "c"]);
});

test("diff: a pure deletion is reported as removed", () => {
  const d = diffParagraphs("a\n\nb\n\nc", "a\n\nc");
  assert.deepEqual(texts(d, "removed"), ["b"]);
  assert.deepEqual(texts(d, "added"), []);
});

test("diff: an edited paragraph shows as removed + added, context preserved", () => {
  const d = diffParagraphs("intro\n\nefikasi 40%\n\noutro", "intro\n\nefikasi 60%\n\noutro");
  assert.deepEqual(texts(d, "removed"), ["efikasi 40%"]);
  assert.deepEqual(texts(d, "added"), ["efikasi 60%"]);
  assert.deepEqual(texts(d, "same"), ["intro", "outro"]);
});

test("diff: everything is added when the old text is empty", () => {
  const d = diffParagraphs("", "a\n\nb");
  assert.deepEqual(texts(d, "added"), ["a", "b"]);
  assert.equal(d.length, 2);
});

test("diff: everything is removed when the new text is empty", () => {
  const d = diffParagraphs("a\n\nb", "");
  assert.deepEqual(texts(d, "removed"), ["a", "b"]);
});

test("diff: two empty texts produce no lines", () => {
  assert.deepEqual(diffParagraphs("", ""), []);
});

test("diff: kept paragraphs are the LCS - a reorder is not reported as unchanged", () => {
  const d = diffParagraphs("a\n\nb\n\nc", "c\n\nb\n\na");
  // Only one paragraph can be common to both orderings.
  assert.equal(texts(d, "same").length, 1);
});

test("diff: the result reconstructs both sides exactly", () => {
  const oldText = "satu\n\ndua\n\ntiga\n\nempat";
  const newText = "satu\n\ntiga\n\nlima\n\nempat";
  const d = diffParagraphs(oldText, newText);
  const rebuiltOld = d.filter((l) => l.type !== "added").map((l) => l.text);
  const rebuiltNew = d.filter((l) => l.type !== "removed").map((l) => l.text);
  assert.deepEqual(rebuiltOld, splitParagraphs(oldText));
  assert.deepEqual(rebuiltNew, splitParagraphs(newText));
});

test("diff: whitespace-only changes are not reported as edits", () => {
  const d = diffParagraphs("  klaim utama  ", "klaim utama");
  assert.deepEqual(d.map((l) => l.type), ["same"]);
});

test("diff: handles a realistically long document without blowing up", () => {
  const oldText = Array.from({ length: 300 }, (_, i) => `para ${i}`).join("\n\n");
  const newText = Array.from({ length: 300 }, (_, i) => (i === 150 ? "para EDITED" : `para ${i}`)).join("\n\n");
  const d = diffParagraphs(oldText, newText);
  assert.deepEqual(texts(d, "added"), ["para EDITED"]);
  assert.deepEqual(texts(d, "removed"), ["para 150"]);
});
