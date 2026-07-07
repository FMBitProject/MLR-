import { db, t } from "./db";

// Append-only audit log (PRD 9.5, NFR). No update/delete path exists in the app.
export function logAudit(entry: {
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  details?: Record<string, unknown>;
}) {
  db.insert(t.auditLog)
    .values({
      id: crypto.randomUUID(),
      ...entry,
      details: entry.details ?? null,
      createdAt: new Date(),
    })
    .run();
}
