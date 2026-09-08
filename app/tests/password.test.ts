import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";

test("password: a hash verifies against its own password", () => {
  const stored = hashPassword("correct horse battery staple");
  assert.ok(verifyPassword("correct horse battery staple", stored));
});

test("password: wrong password is rejected", () => {
  const stored = hashPassword("s3cret");
  assert.equal(verifyPassword("s3cre", stored), false);
  assert.equal(verifyPassword("S3cret", stored), false);
  assert.equal(verifyPassword("", stored), false);
});

test("password: salt is random, so equal passwords hash differently", () => {
  assert.notEqual(hashPassword("same"), hashPassword("same"));
});

test("password: an explicit salt is deterministic", () => {
  assert.equal(hashPassword("pw", "abc123"), hashPassword("pw", "abc123"));
  assert.ok(hashPassword("pw", "abc123").startsWith("abc123:"));
});

test("password: malformed stored values are rejected, never thrown on", () => {
  assert.equal(verifyPassword("pw", ""), false);
  assert.equal(verifyPassword("pw", "nosalt"), false);
  assert.equal(verifyPassword("pw", ":onlyhash"), false);
  assert.equal(verifyPassword("pw", "salt:"), false);
});

test("password: a truncated hash of the right password still fails", () => {
  const stored = hashPassword("pw", "salt");
  const [salt, hash] = stored.split(":");
  assert.equal(verifyPassword("pw", `${salt}:${hash.slice(0, 32)}`), false);
});

test("password: unicode and long passwords round-trip", () => {
  const pw = "kata-sandi-😀-" + "x".repeat(500);
  assert.ok(verifyPassword(pw, hashPassword(pw)));
});
