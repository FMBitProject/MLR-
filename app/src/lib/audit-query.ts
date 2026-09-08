import { and, count, desc, eq, gte, inArray, lte, or, type SQL } from "drizzle-orm";
import { db, t } from "./db";

// Resolves audit rows with actor names, optionally scoped to one product's
// entities (submissions, their versions, and claims) and a date range —
// the shape needed for BPOM/internal inspection exports (PRD 9.5).
//
// Every filter runs in SQL. The audit log is the fastest-growing table in the
// schema (a row per action by every user), so reading it whole and narrowing
// in JS made the cheapest view — one filtered page — cost the same as the
// full export.
export async function queryAudit(opts: {
  tenantId: string;
  productId?: string | null;
  from?: Date | null;
  to?: Date | null;
  /** Rows to return. Omit for the CSV export, which needs the whole range. */
  limit?: number;
  offset?: number;
}) {
  const where = auditWhere(opts);

  let q = db
    .select({ log: t.auditLog, actor: t.users })
    .from(t.auditLog)
    .innerJoin(t.users, eq(t.auditLog.performedBy, t.users.id))
    .where(where)
    .orderBy(desc(t.auditLog.createdAt))
    .$dynamic();

  if (opts.limit != null) q = q.limit(opts.limit);
  if (opts.offset) q = q.offset(opts.offset);
  return q;
}

/** Total matching rows, for the pager. */
export async function countAudit(opts: {
  tenantId: string;
  productId?: string | null;
  from?: Date | null;
  to?: Date | null;
}): Promise<number> {
  return (
    await db.select({ n: count() }).from(t.auditLog).where(auditWhere(opts))
  )[0].n;
}

function auditWhere(opts: {
  tenantId: string;
  productId?: string | null;
  from?: Date | null;
  to?: Date | null;
}): SQL | undefined {
  const clauses: (SQL | undefined)[] = [eq(t.auditLog.tenantId, opts.tenantId)];
  if (opts.from) clauses.push(gte(t.auditLog.createdAt, opts.from));
  if (opts.to) clauses.push(lte(t.auditLog.createdAt, opts.to));

  if (opts.productId) {
    // entityId is a bare id with no type column to join on, so the product
    // filter matches it against each set of ids the product owns. These stay
    // subqueries rather than fetched id lists: a busy product's submissions
    // and versions would otherwise arrive as thousands of bind parameters.
    const productSubmissions = db
      .select({ id: t.contentSubmissions.id })
      .from(t.contentSubmissions)
      .where(eq(t.contentSubmissions.productId, opts.productId));

    clauses.push(
      or(
        inArray(t.auditLog.entityId, productSubmissions),
        inArray(
          t.auditLog.entityId,
          db
            .select({ id: t.contentVersions.id })
            .from(t.contentVersions)
            .where(inArray(t.contentVersions.submissionId, productSubmissions)),
        ),
        inArray(
          t.auditLog.entityId,
          db
            .select({ id: t.approvedClaims.id })
            .from(t.approvedClaims)
            .where(eq(t.approvedClaims.productId, opts.productId)),
        ),
      ),
    );
  }

  return and(...clauses);
}
