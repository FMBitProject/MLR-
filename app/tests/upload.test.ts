import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_UPLOAD_MB, MAX_UPLOAD_BYTES } from "../src/lib/upload.ts";

test("upload: byte cap matches the MB cap", () => {
  assert.equal(MAX_UPLOAD_BYTES, MAX_UPLOAD_MB * 1024 * 1024);
});

test("upload: cap stays under Vercel's 4.5MB request-body ceiling", () => {
  // The comment in upload.ts is the contract: the file plus multipart overhead
  // must fit in 4.5MB, so the cap must leave real headroom.
  assert.ok(MAX_UPLOAD_BYTES < 4.5 * 1024 * 1024, "cap must be below the host ceiling");
  assert.ok(4.5 * 1024 * 1024 - MAX_UPLOAD_BYTES > 500 * 1024, "needs >500KB headroom");
});
