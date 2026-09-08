import { test } from "node:test";
import assert from "node:assert/strict";
import { mimeForFileName } from "../src/lib/mime.ts";

test("mime: known extensions", () => {
  assert.equal(mimeForFileName("deck.pdf"), "application/pdf");
  assert.equal(
    mimeForFileName("deck.pptx"),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
  assert.equal(
    mimeForFileName("brief.docx"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
});

test("mime: case-insensitive and multi-dot names", () => {
  assert.equal(mimeForFileName("DECK.PDF"), "application/pdf");
  assert.equal(mimeForFileName("v1.2.final.pdf"), "application/pdf");
});

test("mime: unknown, missing, and empty inputs fall back to octet-stream", () => {
  assert.equal(mimeForFileName("notes.txt"), "application/octet-stream");
  assert.equal(mimeForFileName("README"), "application/octet-stream");
  assert.equal(mimeForFileName(null), "application/octet-stream");
  assert.equal(mimeForFileName(undefined), "application/octet-stream");
  assert.equal(mimeForFileName(""), "application/octet-stream");
});

test("mime: a bare dotfile has no extension we accept", () => {
  assert.equal(mimeForFileName(".pdf"), "application/pdf");
  assert.equal(mimeForFileName("archive.pdf.zip"), "application/octet-stream");
});
