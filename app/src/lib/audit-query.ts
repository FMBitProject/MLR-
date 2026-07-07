import { desc, eq, inArray } from "drizzle-orm";
import { db, t } from "./db";

// Resolves audit rows with actor names, optionally scoped to one product's
// entities (submissions, their versions, and claims) and a date range —
// the shape needed for BPOM/internal inspection exports (PRD 9.5).
export function queryAudit(opts: {
  tenantId: string;
  productId?: string | null;
  from?: Date | null;
  to?: Date | null;
}) {
  const rows = db
    .select({ log: t.auditLog, actor: t.users })
    .from(t.auditLog)
    .innerJoin(t.users, eq(t.auditLog.performedBy, t.users.id))
    .where(eq(t.auditLog.tenantId, opts.tenantId))
    .orderBy(desc(t.auditLog.createdAt))
    .all();

  let entityFilter: Set<string> | null = null;
  if (opts.productId) {
    const subs = db
      .select({ id: t.contentSubmissions.id })
      .from(t.contentSubmissions)
      .where(eq(t.contentSubmissions.productId, opts.productId))
      .all()
      .map((s) => s.id);
    const versions = subs.length
      ? db
          .select({ id: t.contentVersions.id })
          .from(t.contentVersions)
          .where(inArray(t.contentVersions.submissionId, subs))
          .all()
          .map((v) => v.id)
      : [];
    const claims = db
      .select({ id: t.approvedClaims.id })
      .from(t.approvedClaims)
      .where(eq(t.approvedClaims.productId, opts.productId))
      .all()
      .map((c) => c.id);
    entityFilter = new Set([...subs, ...versions, ...claims]);
  }

  return rows.filter(({ log }) => {
    if (entityFilter && !entityFilter.has(log.entityId)) return false;
    if (opts.from && log.createdAt < opts.from) return false;
    if (opts.to && log.createdAt > opts.to) return false;
    return true;
  });
}
