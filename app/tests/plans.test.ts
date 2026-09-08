import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLANS,
  planDef,
  planLimits,
  planHas,
  isFreePlan,
  isBillablePlan,
  upgradeOptionsFor,
  promoActive,
  effectivePriceIdr,
  formatIdr,
  UPGRADABLE_PLANS,
} from "../src/lib/plans.ts";

test("plans: planDef resolves known ids", () => {
  assert.equal(planDef("starter").id, "starter");
  assert.equal(planDef("growth").id, "growth");
  assert.equal(planDef("enterprise").id, "enterprise");
});

test("plans: unknown/empty plan falls back to starter (never throws)", () => {
  assert.equal(planDef(null).id, "starter");
  assert.equal(planDef(undefined).id, "starter");
  assert.equal(planDef("").id, "starter");
  assert.equal(planDef("nonexistent").id, "starter");
});

test("plans: limits grow monotonically starter -> growth -> enterprise", () => {
  const s = planLimits("starter");
  const g = planLimits("growth");
  const e = planLimits("enterprise");
  for (const k of ["users", "products", "submissionsPerMonth"] as const) {
    assert.ok(g[k] > s[k], `growth.${k} must exceed starter`);
    assert.ok(e[k] >= g[k], `enterprise.${k} must be at least growth`);
  }
  assert.equal(e.users, Infinity);
});

test("plans: feature gating matches the PRD tiers", () => {
  assert.equal(planHas("starter", "aiClaimsCheck"), true, "claims check is on every plan");
  assert.equal(planHas("growth", "aiClaimsCheck"), true);
  assert.equal(planHas("enterprise", "aiClaimsCheck"), true);

  assert.equal(planHas("starter", "journalSubstantiation"), false);
  assert.equal(planHas("growth", "journalSubstantiation"), true);

  assert.equal(planHas("starter", "customWorkflows"), false);
  assert.equal(planHas("growth", "customWorkflows"), true);

  assert.equal(planHas("growth", "dedicatedOnboarding"), false);
  assert.equal(planHas("enterprise", "dedicatedOnboarding"), true);
});

test("plans: features are never lost when moving up a tier", () => {
  const keys = Object.keys(PLANS.starter.features) as Array<
    keyof typeof PLANS.starter.features
  >;
  for (const k of keys) {
    assert.ok(!PLANS.starter.features[k] || PLANS.growth.features[k], `growth lost ${k}`);
    assert.ok(!PLANS.growth.features[k] || PLANS.enterprise.features[k], `enterprise lost ${k}`);
  }
});

test("plans: free vs billable classification", () => {
  assert.equal(isFreePlan(PLANS.starter), true);
  assert.equal(isBillablePlan(PLANS.starter), false, "free tier is never invoiced");
  assert.equal(isFreePlan(PLANS.growth), false);
  assert.equal(isBillablePlan(PLANS.growth), true);
  assert.equal(isBillablePlan(PLANS.enterprise), true);
});

test("plans: a custom-quote plan (null price) is neither free nor app-billable", () => {
  const custom = { ...PLANS.enterprise, monthlyPriceIdr: null };
  assert.equal(isFreePlan(custom), false);
  assert.equal(isBillablePlan(custom), false);
});

test("plans: upgrade options never offer a cheaper plan", () => {
  assert.deepEqual(upgradeOptionsFor("starter"), ["growth", "enterprise"]);
  assert.deepEqual(upgradeOptionsFor("growth"), ["growth", "enterprise"], "renew or move up");
  assert.deepEqual(upgradeOptionsFor("enterprise"), ["enterprise"], "no downgrade to growth");
  assert.deepEqual(upgradeOptionsFor(null), ["growth", "enterprise"]);
});

test("plans: every upgradable plan is actually billable", () => {
  for (const id of UPGRADABLE_PLANS) assert.ok(isBillablePlan(PLANS[id]), `${id} not billable`);
});

test("plans: promo is active before its end date and dead after", () => {
  const before = new Date("2026-06-01T00:00:00+07:00");
  const lastDay = new Date("2026-12-31T23:59:58+07:00");
  const after = new Date("2027-01-01T00:00:01+07:00");
  assert.equal(promoActive(PLANS.growth, before), true);
  assert.equal(promoActive(PLANS.growth, lastDay), true, "inclusive through end of day WIB");
  assert.equal(promoActive(PLANS.growth, after), false);
});

test("plans: starter has no promo", () => {
  assert.equal(promoActive(PLANS.starter, new Date("2026-06-01")), false);
});

test("plans: effective price switches from promo to list at expiry", () => {
  const during = new Date("2026-06-01T00:00:00+07:00");
  const after = new Date("2027-01-02T00:00:00+07:00");
  assert.equal(effectivePriceIdr(PLANS.growth, during), 799_000);
  assert.equal(effectivePriceIdr(PLANS.growth, after), 1_000_000);
  assert.equal(effectivePriceIdr(PLANS.enterprise, during), 1_500_000);
  assert.equal(effectivePriceIdr(PLANS.enterprise, after), 3_000_000);
  assert.equal(effectivePriceIdr(PLANS.starter, during), 0, "free stays free");
});

test("plans: a promo never costs more than the list price", () => {
  for (const def of Object.values(PLANS)) {
    if (def.promoPriceIdr != null && def.monthlyPriceIdr != null) {
      assert.ok(def.promoPriceIdr <= def.monthlyPriceIdr, `${def.id} promo exceeds list price`);
    }
  }
});

test("plans: formatIdr renders whole rupiah, no decimals", () => {
  const out = formatIdr(1_000_000);
  assert.match(out, /Rp/);
  assert.ok(!out.includes(","), `unexpected decimal separator in ${out}`);
  assert.equal(formatIdr(0).replace(/\s| /g, ""), "Rp0");
});
