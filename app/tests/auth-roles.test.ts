import "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { REVIEWER_ROLES, SUBMITTER_ROLES, CLAIM_MANAGER_ROLES, type Role } from "../src/lib/auth.ts";

const ALL_ROLES: Role[] = [
  "super_admin",
  "marketing",
  "medical_reviewer",
  "legal_reviewer",
  "regulatory_reviewer",
  "compliance_admin",
];

test("auth: the three MLR reviewer roles are exactly medical, legal, regulatory", () => {
  assert.deepEqual([...REVIEWER_ROLES].sort(), ["legal_reviewer", "medical_reviewer", "regulatory_reviewer"]);
});

test("auth: reviewers may not author or upload content (separation of duties)", () => {
  for (const r of REVIEWER_ROLES) {
    assert.ok(
      !SUBMITTER_ROLES.includes(r),
      `${r} must not be able to submit the content it reviews`,
    );
  }
});

test("auth: only marketing and super_admin submit content", () => {
  assert.deepEqual([...SUBMITTER_ROLES].sort(), ["marketing", "super_admin"]);
});

test("auth: the claims library is owned by compliance, admin and medical affairs", () => {
  assert.deepEqual(
    [...CLAIM_MANAGER_ROLES].sort(),
    ["compliance_admin", "medical_reviewer", "super_admin"],
  );
});

test("auth: marketing cannot manage the approved claims library it must comply with", () => {
  assert.ok(!CLAIM_MANAGER_ROLES.includes("marketing"));
});

test("auth: legal and regulatory reviewers cannot edit the claims library", () => {
  assert.ok(!CLAIM_MANAGER_ROLES.includes("legal_reviewer"));
  assert.ok(!CLAIM_MANAGER_ROLES.includes("regulatory_reviewer"));
});

test("auth: every listed role is a real role, with no duplicates", () => {
  for (const list of [REVIEWER_ROLES, SUBMITTER_ROLES, CLAIM_MANAGER_ROLES]) {
    assert.equal(new Set(list).size, list.length, "duplicate entry in a role list");
    for (const r of list) assert.ok(ALL_ROLES.includes(r), `unknown role ${r}`);
  }
});

test("auth: no role is left with no capability at all", () => {
  const covered = new Set([...REVIEWER_ROLES, ...SUBMITTER_ROLES, ...CLAIM_MANAGER_ROLES]);
  for (const r of ALL_ROLES) assert.ok(covered.has(r), `${r} appears in no capability list`);
});
