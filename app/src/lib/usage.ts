import { and, eq, gte } from "drizzle-orm";
import { db, t, type DbExecutor } from "./db";
import { planLimits } from "./plans";
import { assertTenantWritable } from "./billing";

// Submissions the tenant created in the current calendar month vs the plan's
// monthly cap (PRD §12). Server-only — lives outside actions.ts so it never
// becomes a client-callable "use server" export.
export async function submissionQuota(
  tenantId: string,
  plan: string | null | undefined,
  executor: DbExecutor = db,
) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const rows = await executor
    .select({ id: t.contentSubmissions.id })
    .from(t.contentSubmissions)
    .where(
      and(
        eq(t.contentSubmissions.tenantId, tenantId),
        gte(t.contentSubmissions.createdAt, monthStart),
      ),
    );
  return { used: rows.length, limit: planLimits(plan).submissionsPerMonth };
}

/** Reserve a submission by inserting it under a tenant row lock. All creation
 * paths use this so simultaneous create/reuse requests cannot overspend quota. */
type SubmissionInsert = typeof t.contentSubmissions.$inferInsert;
export function insertSubmissionWithinQuota<T>(values: SubmissionInsert, complete: (tx: DbExecutor) => Promise<T>): Promise<T>;
export function insertSubmissionWithinQuota(values: SubmissionInsert): Promise<void>;
export async function insertSubmissionWithinQuota<T>(values: SubmissionInsert, complete?: (tx: DbExecutor) => Promise<T>) {
  return db.transaction(async (tx) => {
    const [tenant] = await tx.select().from(t.tenants).where(eq(t.tenants.id, values.tenantId)).for("update");
    if (!tenant) throw new Error("NOT_FOUND");
    assertTenantWritable(tenant);
    const quota = await submissionQuota(tenant.id, tenant.plan, tx);
    if (quota.used >= quota.limit) throw new Error("PLAN_LIMIT");
    await tx.insert(t.contentSubmissions).values({ ...values, createdAt: new Date() });
    // Roll back the quota reservation along with stages, content and audit.
    return complete ? await complete(tx) : undefined;
  });
}
