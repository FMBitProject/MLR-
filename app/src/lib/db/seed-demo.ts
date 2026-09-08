import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { seed } from "./seed";

/**
 * Seeds a self-contained demo workspace: one account per review role,
 * mirroring the `tn-nusantara` seed's cast, so the full MLR workflow
 * (submit → medical → legal → regulatory → approved) can be walked through
 * by logging in as each role in turn. Separate from the `tn-nusantara` seed
 * and from any real workspace, so it can be reset freely between demos.
 *
 *   npm run db:demo            # create (no-op if it already exists)
 *   npm run db:demo -- --reset # delete and recreate
 */

const TENANT_ID = "tn-demo";
const PREFIX = "demo-";

// This file is committed to a public repo, so the default password is only a
// convenience for a throwaway tenant of fake data. Set DEMO_PASSWORD (and
// re-run with --reset) to give every demo account a credential that isn't public.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "DemoMLR2026!";
const DEMO_DOMAIN = "mlrflow-demo.id";

export const DEMO_USERS = [
  { id: "u-demo-dewi", email: `dewi@${DEMO_DOMAIN}`, name: "Dewi Lestari", role: "marketing" },
  {
    id: "u-demo-budi",
    email: `budi@${DEMO_DOMAIN}`,
    name: "dr. Budi Santoso, Sp.JP",
    role: "medical_reviewer",
  },
  {
    id: "u-demo-ratna",
    email: `ratna@${DEMO_DOMAIN}`,
    name: "Ratna Wijaya, S.H.",
    role: "legal_reviewer",
  },
  {
    id: "u-demo-agus",
    email: `agus@${DEMO_DOMAIN}`,
    name: "Agus Prasetyo, Apt.",
    role: "regulatory_reviewer",
  },
  {
    id: "u-demo-sari",
    email: `sari@${DEMO_DOMAIN}`,
    name: "Sari Handayani",
    role: "compliance_admin",
  },
  { id: "u-demo-rudi", email: `rudi@${DEMO_DOMAIN}`, name: "Rudi Hartono", role: "super_admin" },
] as const;

// Enterprise so no plan limit or feature gate can interrupt a demo, paid
// through far enough out that billing never shows a grace/locked state.
const PLAN_ACTIVE_UNTIL = new Date(Date.now() + 5 * 365 * 86_400_000);

// Child rows first — every table below references the ones after it.
const TABLES_IN_DELETE_ORDER = [
  "content_distributions",
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
    content_distributions: "delete from content_distributions where tenant_id = $1",
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
  // users.email is UNIQUE across every tenant, so a demo email that belongs
  // to a real account would otherwise fail deep in the seed with a raw
  // "duplicate key value violates unique constraint" and no explanation.
  // Checked before the reset below — bailing out afterwards would destroy the
  // existing demo workspace on the way to reporting the clash. The demo
  // tenant's own accounts don't count: the reset is about to remove them.
  for (const u of DEMO_USERS) {
    const clash = (
      await db.select().from(schema.users).where(eq(schema.users.email, u.email))
    )[0];
    if (clash && clash.tenantId !== TENANT_ID) {
      await pool.end();
      throw new Error(
        `${u.email} already belongs to workspace ${clash.tenantId}. ` +
          `Remove that account first, or change DEMO_DOMAIN in seed-demo.ts.`,
      );
    }
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
      password: DEMO_PASSWORD,
      users: DEMO_USERS.map((u) => ({ ...u })),
    });
  });

  await pool.end();
  console.log(
    `Demo workspace ready. Password for every account: ${DEMO_PASSWORD}\n` +
      DEMO_USERS.map((u) => `  ${u.role.padEnd(20)} ${u.email}`).join("\n") +
      `\n  Plan: enterprise (through ${PLAN_ACTIVE_UNTIL.toISOString().slice(0, 10)})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
