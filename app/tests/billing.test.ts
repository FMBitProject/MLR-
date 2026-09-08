import "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  billingState,
  assertTenantWritable,
  addOneMonth,
  GRACE_DAYS,
  INVOICE_WINDOW_DAYS,
} from "../src/lib/billing.ts";

const DAY = 24 * 60 * 60_000;
const at = (iso: string) => new Date(iso);

test("billing: free tier is never invoiced or locked", () => {
  const s = billingState({ plan: "starter", planActiveUntil: null });
  assert.equal(s.status, "active");
  assert.equal(s.managed, false);
  assert.equal(s.graceUntil, null);
});

test("billing: a free tenant with a stale paid-through date is still unmanaged", () => {
  const s = billingState({ plan: "starter", planActiveUntil: at("2020-01-01") });
  assert.equal(s.managed, false, "the plan, not the date, decides");
  assert.equal(s.status, "active");
});

test("billing: a paid plan with no paid-through date is unmanaged (manual billing)", () => {
  const s = billingState({ plan: "growth", planActiveUntil: null });
  assert.equal(s.managed, false);
  assert.equal(s.status, "active");
});

test("billing: active -> grace -> delinquent across the grace window", () => {
  const until = at("2026-06-01T00:00:00Z");
  const tenant = { plan: "growth", planActiveUntil: until };

  assert.equal(billingState(tenant, new Date(until.getTime() - DAY)).status, "active");
  assert.equal(billingState(tenant, until).status, "active", "the paid-through day is inclusive");
  assert.equal(billingState(tenant, new Date(until.getTime() + DAY)).status, "grace");

  const graceEnd = new Date(until.getTime() + GRACE_DAYS * DAY);
  assert.equal(billingState(tenant, graceEnd).status, "grace", "last grace moment");
  assert.equal(
    billingState(tenant, new Date(graceEnd.getTime() + 1)).status,
    "delinquent",
  );
});

test("billing: graceUntil is exactly GRACE_DAYS past the paid-through date", () => {
  const until = at("2026-06-01T00:00:00Z");
  const s = billingState({ plan: "growth", planActiveUntil: until }, until);
  assert.equal(s.graceUntil!.getTime() - until.getTime(), GRACE_DAYS * DAY);
});

test("billing: an undefined tenant is treated as unmanaged, not as an error", () => {
  const s = billingState(undefined);
  assert.equal(s.managed, false);
  assert.equal(s.status, "active");
});

test("billing: assertTenantWritable only throws for delinquent workspaces", () => {
  const past = new Date(Date.now() - (GRACE_DAYS + 2) * DAY);
  assert.throws(
    () => assertTenantWritable({ plan: "growth", planActiveUntil: past }),
    /BILLING_LOCKED/,
  );
  assert.doesNotThrow(() =>
    assertTenantWritable({ plan: "growth", planActiveUntil: new Date(Date.now() - DAY) }),
  );
  assert.doesNotThrow(() => assertTenantWritable({ plan: "starter", planActiveUntil: null }));
  assert.doesNotThrow(() => assertTenantWritable(undefined));
});

test("billing: addOneMonth advances a normal date", () => {
  assert.equal(addOneMonth(at("2026-03-15T10:00:00Z")).toISOString().slice(0, 10), "2026-04-15");
});

test("billing: addOneMonth clamps into short months instead of overflowing", () => {
  // Jan 31 + 1 month must be Feb 28/29, never Mar 2/3.
  assert.equal(addOneMonth(new Date(2026, 0, 31)).getMonth(), 1);
  assert.equal(addOneMonth(new Date(2026, 0, 31)).getDate(), 28);
  assert.equal(addOneMonth(new Date(2024, 0, 31)).getDate(), 29, "leap year");
  assert.equal(addOneMonth(new Date(2026, 2, 31)).getDate(), 30, "Mar 31 -> Apr 30");
});

test("billing: addOneMonth rolls the year over in December", () => {
  const out = addOneMonth(new Date(2026, 11, 15));
  assert.equal(out.getFullYear(), 2027);
  assert.equal(out.getMonth(), 0);
});

test("billing: addOneMonth preserves the time of day and does not mutate its input", () => {
  const input = new Date(2026, 4, 10, 13, 45, 30);
  const snapshot = input.getTime();
  const out = addOneMonth(input);
  assert.equal(input.getTime(), snapshot, "input must not be mutated");
  assert.equal(out.getHours(), 13);
  assert.equal(out.getMinutes(), 45);
});

test("billing: twelve chained additions land on the same day next year", () => {
  let d = new Date(2026, 0, 15);
  for (let i = 0; i < 12; i++) d = addOneMonth(d);
  assert.equal(d.getFullYear(), 2027);
  assert.equal(d.getMonth(), 0);
  assert.equal(d.getDate(), 15);
});

test("billing: the invoice window opens before the grace period ends", () => {
  // A renewal invoice must exist before the workspace can go read-only.
  assert.ok(INVOICE_WINDOW_DAYS > 0);
  assert.ok(GRACE_DAYS > 0);
});
