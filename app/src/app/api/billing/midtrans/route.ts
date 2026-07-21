import { asc, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  verifyNotificationSignature,
  isPaidStatus,
  isFailedStatus,
  type MidtransNotification,
} from "@/lib/midtrans";
import { applyInvoicePaid } from "@/lib/billing";

// Midtrans payment notification webhook. Set this URL in the Midtrans
// dashboard (Settings → Configuration → Payment Notification URL):
//   https://<host>/api/billing/midtrans
// Authenticity comes from the sha512 signature_key in the payload, computed
// with the server key — no session or bearer token involved.
export async function POST(req: Request) {
  let n: MidtransNotification;
  try {
    n = (await req.json()) as MidtransNotification;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!n.order_id || !n.signature_key || !verifyNotificationSignature(n)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const invoice = (
    await db.select().from(t.invoices).where(eq(t.invoices.id, n.order_id))
  )[0];
  if (!invoice) return new Response("Unknown order", { status: 404 });

  // Guard against tampering: the signature covers gross_amount, but verify
  // it matches what we actually billed before treating the invoice as paid.
  if (isPaidStatus(n) && Math.round(Number(n.gross_amount)) !== invoice.amountIdr) {
    console.error(
      `midtrans notification amount mismatch for ${invoice.id}: ` +
        `got ${n.gross_amount}, expected ${invoice.amountIdr}`,
    );
    return new Response("Amount mismatch", { status: 400 });
  }

  // Audit entries need a user id; attribute webhook-driven events to the
  // workspace's first super admin, marked as system-performed in details.
  const actor = (
    await db
      .select()
      .from(t.users)
      .where(eq(t.users.tenantId, invoice.tenantId))
      .orderBy(asc(t.users.createdAt))
  ).find((u) => u.role === "super_admin");

  if (isPaidStatus(n)) {
    const result = await applyInvoicePaid(invoice, n.payment_type ?? null);
    if (result && actor) {
      await logAudit({
        tenantId: invoice.tenantId,
        entityType: "invoice",
        entityId: invoice.id,
        action: "invoice_paid",
        performedBy: actor.id,
        details: {
          via: "midtrans_webhook",
          number: invoice.number,
          amountIdr: invoice.amountIdr,
          paymentType: n.payment_type ?? null,
          planActiveUntil: result.newActiveUntil.toISOString(),
        },
      });
    }
  } else if (isFailedStatus(n) && invoice.status === "pending") {
    await db
      .update(t.invoices)
      .set({ status: n.transaction_status === "expire" ? "expired" : "canceled" })
      .where(eq(t.invoices.id, invoice.id));
  }
  // pending / other intermediate states: acknowledge and wait for settlement.

  return Response.json({ ok: true });
}
