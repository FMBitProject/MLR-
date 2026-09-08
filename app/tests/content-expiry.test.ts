import "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { contentLifecycle } from "../src/lib/content-expiry.ts";

const DAY = 24 * 60 * 60_000;
const now = new Date("2026-06-01T12:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * DAY);

test("expiry: withdrawn wins over every date", () => {
  assert.equal(contentLifecycle({ status: "withdrawn", expiresAt: null }, now), "withdrawn");
  assert.equal(contentLifecycle({ status: "withdrawn", expiresAt: inDays(-100) }, now), "withdrawn");
  assert.equal(contentLifecycle({ status: "withdrawn", expiresAt: inDays(100) }, now), "withdrawn");
});

test("expiry: no expiry date means indefinitely active", () => {
  assert.equal(contentLifecycle({ status: "approved", expiresAt: null }, now), "active");
});

test("expiry: a past date is expired", () => {
  assert.equal(contentLifecycle({ status: "approved", expiresAt: inDays(-1) }, now), "expired");
  assert.equal(
    contentLifecycle({ status: "approved", expiresAt: new Date(now.getTime() - 1) }, now),
    "expired",
  );
});

test("expiry: within 30 days is expiring_soon", () => {
  assert.equal(contentLifecycle({ status: "approved", expiresAt: inDays(1) }, now), "expiring_soon");
  assert.equal(contentLifecycle({ status: "approved", expiresAt: inDays(29) }, now), "expiring_soon");
  assert.equal(
    contentLifecycle({ status: "approved", expiresAt: inDays(30) }, now),
    "expiring_soon",
    "the 30-day boundary is inclusive",
  );
});

test("expiry: beyond the 30-day warning window is plain active", () => {
  assert.equal(
    contentLifecycle({ status: "approved", expiresAt: new Date(inDays(30).getTime() + 1) }, now),
    "active",
  );
  assert.equal(contentLifecycle({ status: "approved", expiresAt: inDays(365) }, now), "active");
});

test("expiry: the exact expiry instant is not yet expired", () => {
  assert.equal(contentLifecycle({ status: "approved", expiresAt: now }, now), "expiring_soon");
});

test("expiry: non-withdrawn statuses are classified purely by date", () => {
  for (const status of ["approved", "in_review", "draft"]) {
    assert.equal(contentLifecycle({ status, expiresAt: inDays(-5) }, now), "expired");
    assert.equal(contentLifecycle({ status, expiresAt: inDays(500) }, now), "active");
  }
});

test("expiry: every input yields exactly one of the four known states", () => {
  const states = new Set(["withdrawn", "expired", "expiring_soon", "active"]);
  for (const status of ["approved", "withdrawn"])
    for (const d of [null, inDays(-1), inDays(10), inDays(90)])
      assert.ok(states.has(contentLifecycle({ status, expiresAt: d }, now)));
});
