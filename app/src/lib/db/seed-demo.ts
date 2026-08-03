import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { seed } from "./seed";

/**
 * Seeds a self-contained demo workspace: one super_admin account that owns a
 * fully populated tenant (products, claims library, three submissions in
 * different review states, audit trail). Separate from the `tn-nusantara`
 * seed and from any real workspace, so it can be reset freely between demos.
 *
 * A single super_admin can drive the whole demo alone — that role may submit
 * content *and* decide any review stage (see canDecide in lib/actions.ts).
 *
 *   npm run db:demo            # create (no-op if it already exists)
 *   npm run db:demo -- --reset # delete and recreate
 */

const TENANT_ID = "tn-demo";
const PREFIX = "demo-";
const USER_ID = "u-demo";

// This file is committed to a public repo, so the default password is only a
// convenience for a throwaway tenant of fake data. Set DEMO_PASSWORD (and
// re-run with --reset) to give the demo account a credential that isn't public.
export const DEMO_ACCOUNT = {
  email: process.env.DEMO_EMAIL ?? "demo@mlrflow.id",
  name: "Ferel — Demo",
  password: process.env.DEMO_PASSWORD ?? "DemoMLR2026!",
};

// Enterprise so no plan limit or feature gate can interrupt a demo, paid
// through far enough out that billing never shows a grace/locked state.
const PLAN_ACTIVE_UNTIL = new Date(Date.now() + 5 * 365 * 86_400_000);

// Child rows first — every table below references the ones after it.
const TABLES_IN_DELETE_ORDER = [
  "claim_flags",
  "review_comments",
  "review_stages",
  "content_elements",
  "content_version_pages",
  "content_versions",
  "content_submissions",
  "approved_claims",
  "journal_documents",
  "products",
  "workflow_templates",
  "audit_log",
  "invoices",
  "account_tokens",
  "users",
] as const;

async function reset(pool: Pool) {
  // Tables without a tenant_id are reached through their parent's tenant.
  const scoped: Record<string, string> = {
    claim_flags:
      "delete from claim_flags where version_id in (select cv.id from content_versions cv join content_submissions cs on cs.id = cv.submission_id where cs.tenant_id = $1)",
    review_comments:
      "delete from review_comments where version_id in (select cv.id from content_versions cv join content_submissions cs on cs.id = cv.submission_id where cs.tenant_id = $1)",
    review_stages:
      "delete from review_stages where submission_id in (select id from content_submissions where tenant_id = $1)",
    content_elements:
      "delete from content_elements where version_id in (select cv.id from content_versions cv join content_submissions cs on cs.id = cv.submission_id where cs.tenant_id = $1)",
    content_version_pages:
      "delete from content_version_pages where version_id in (select cv.id from content_versions cv join content_submissions cs on cs.id = cv.submission_id where cs.tenant_id = $1)",
    content_versions:
      "delete from content_versions where submission_id in (select id from content_submissions where tenant_id = $1)",
    account_tokens:
      "delete from account_tokens where user_id in (select id from users where tenant_id = $1)",
  };
  // One transaction: a reset that dies halfway would otherwise leave the
  // workspace stripped of its content but still holding a tenants row.
  await pool.query("begin");
  try {
    for (const table of TABLES_IN_DELETE_ORDER) {
      await pool.query(scoped[table] ?? `delete from ${table} where tenant_id = $1`, [TENANT_ID]);
    }
    await pool.query("delete from tenants where id = $1", [TENANT_ID]);
    await pool.query("commit");
  } catch (e) {
    await pool.query("rollback");
    throw e;
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  const existing = (
    await db.select().from(schema.tenants).where(eq(schema.tenants.id, TENANT_ID))
  )[0];

  if (existing && !process.argv.includes("--reset")) {
    console.log(
      `Demo workspace "${existing.name}" already exists — nothing to do.\n` +
        `Re-run with --reset to wipe and recreate it.`,
    );
    await pool.end();
    return;
  }
  // users.email is UNIQUE across every tenant, so a DEMO_EMAIL that belongs
  // to a real account would otherwise fail deep in the seed with a raw
  // "duplicate key value violates unique constraint" and no explanation.
  // Checked before the reset below — bailing out afterwards would destroy the
  // existing demo workspace on the way to reporting the clash. The demo
  // tenant's own account doesn't count: the reset is about to remove it.
  const clash = (
    await db.select().from(schema.users).where(eq(schema.users.email, DEMO_ACCOUNT.email))
  )[0];
  if (clash && clash.tenantId !== TENANT_ID) {
    await pool.end();
    throw new Error(
      `${DEMO_ACCOUNT.email} already belongs to workspace ${clash.tenantId}. ` +
        `Set DEMO_EMAIL to a different address, or remove that account first.`,
    );
  }

  if (existing) {
    console.log("Resetting the existing demo workspace…");
    await reset(pool);
  }

  // All-or-nothing: without this, a failure partway through leaves a tenants
  // row behind and the next run reports the broken workspace as complete.
  await db.transaction(async (tx) => {
    await seed(tx, {
      tenantId: TENANT_ID,
      tenantName: "PT Demo Pharma Indonesia",
      slug: "demo",
      plan: "enterprise",
      planActiveUntil: PLAN_ACTIVE_UNTIL,
      prefix: PREFIX,
      password: DEMO_ACCOUNT.password,
      // One account, wearing every hat: it authors the submissions and signs
      // each review stage, so the whole workflow is demoable from one login.
      users: [
        {
          id: USER_ID,
          email: DEMO_ACCOUNT.email,
          name: DEMO_ACCOUNT.name,
          role: "super_admin",
        },
      ],
    });
  });

  await pool.end();
  console.log(
    `Demo workspace ready.\n` +
      `  Email:    ${DEMO_ACCOUNT.email}\n` +
      `  Password: ${DEMO_ACCOUNT.password}\n` +
      `  Plan:     enterprise (through ${PLAN_ACTIVE_UNTIL.toISOString().slice(0, 10)})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
