import { and, eq, gte } from "drizzle-orm";
import { db, t } from "./db";
import { planLimits } from "./plans";

// Submissions the tenant created in the current calendar month vs the plan's
// monthly cap (PRD §12). Server-only — lives outside actions.ts so it never
// becomes a client-callable "use server" export.
export async function submissionQuota(
  tenantId: string,
  plan: string | null | undefined,
) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const rows = await db
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
