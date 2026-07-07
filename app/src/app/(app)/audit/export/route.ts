import { getSessionUser } from "@/lib/auth";
import { queryAudit } from "@/lib/audit-query";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !["compliance_admin", "super_admin"].includes(user.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const productId = url.searchParams.get("product") || null;
  const fromP = url.searchParams.get("from");
  const toP = url.searchParams.get("to");

  const rows = queryAudit({
    tenantId: user.tenantId,
    productId,
    from: fromP ? new Date(fromP) : null,
    to: toP ? new Date(new Date(toP).getTime() + 86_399_000) : null,
  });

  const header = "timestamp,performed_by,role,action,entity_type,entity_id,details";
  const lines = rows.map(({ log, actor }) =>
    [
      log.createdAt.toISOString(),
      actor.name,
      actor.role,
      log.action,
      log.entityType,
      log.entityId,
      log.details ? JSON.stringify(log.details) : "",
    ]
      .map(csvEscape)
      .join(","),
  );

  return new Response([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-trail-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
