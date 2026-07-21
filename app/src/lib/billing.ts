import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db, t } from "./db";
import { planDef, effectivePriceIdr, type PlanDef } from "./plans";
import { createSnapTransaction } from "./midtrans";
import { appUrl, sendInvoiceEmail } from "./email";
import type { Locale } from "./i18n";

type Tenant = typeof t.tenants.$inferSelect;
export type Invoice = typeof t.invoices.$inferSelect;

// After the paid-through date lapses, the workspace keeps full access for
// this many days (with warnings), then drops to read-only until payment.
export const GRACE_DAYS = 7;
// New workspaces can evaluate the product this long before the first invoice.
export const TRIAL_DAYS = 14;
// A Snap payment link stays valid this long; the renewal sweep also starts
// generating the next invoice this many days before the paid-through date.
export const INVOICE_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60_000;

export type BillingStatus = "active" | "grace" | "delinquent";

export type BillingState = {
  status: BillingStatus;
  /** Paid-through date; null for manually billed (enterprise) tenants. */
  activeUntil: Date | null;
  graceUntil: Date | null;
  /** False for enterprise/manual tenants — no invoices, no gating. */
  managed: boolean;
};

export function billingState(
  tenant: Pick<Tenant, "plan" | "planActiveUntil"> | undefined,
  now = new Date(),
): BillingState {
  const def = planDef(tenant?.plan);
  const activeUntil = tenant?.planActiveUntil ?? null;
  // No list price (enterprise) or no managed paid-through date: billing is
  // handled outside the app; never lock these workspaces.
  if (def.monthlyPriceIdr === null || !activeUntil) {
    return { status: "active", activeUntil, graceUntil: null, managed: false };
  }
  const graceUntil = new Date(activeUntil.getTime() + GRACE_DAYS * DAY_MS);
  const status: BillingStatus =
    now <= activeUntil ? "active" : now <= graceUntil ? "grace" : "delinquent";
  return { status, activeUntil, graceUntil, managed: true };
}

/** Throws when the workspace is past its grace period (read-only mode). */
export function assertTenantWritable(
  tenant: Pick<Tenant, "plan" | "planActiveUntil"> | undefined,
) {
  if (billingState(tenant).status === "delinquent") throw new Error("BILLING_LOCKED");
}

function invoiceNumber(now: Date): string {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `INV-${ymd}-${rand}`;
}

/** now + 1 calendar month, clamped for short months (Jan 31 → Feb 28). */
export function addOneMonth(d: Date): Date {
  const out = new Date(d);
  const day = out.getDate();
  out.setMonth(out.getMonth() + 1);
  if (out.getDate() !== day) out.setDate(0);
  return out;
}

export async function latestInvoices(tenantId: string, limit = 12): Promise<Invoice[]> {
  return db
    .select()
    .from(t.invoices)
    .where(eq(t.invoices.tenantId, tenantId))
    .orderBy(desc(t.invoices.createdAt))
    .limit(limit);
}

export async function pendingInvoice(tenantId: string): Promise<Invoice | undefined> {
  return (
    await db
      .select()
      .from(t.invoices)
      .where(and(eq(t.invoices.tenantId, tenantId), eq(t.invoices.status, "pending")))
      .orderBy(desc(t.invoices.createdAt))
      .limit(1)
  )[0];
}

/**
 * Returns the tenant's open renewal invoice, creating one (and its Snap
 * payment link) if none exists. The projected period is anchored at
 * max(now, planActiveUntil) and finalized again at payment time.
 */
export async function ensureRenewalInvoice(
  tenant: Tenant,
  requestedBy: { name: string; email: string },
  now = new Date(),
): Promise<Invoice> {
  const existing = await pendingInvoice(tenant.id);
  if (existing) return existing;

  const def: PlanDef = planDef(tenant.plan);
  const amount = effectivePriceIdr(def, now);
  if (amount === null) throw new Error("BILLING_UNMANAGED");

  const start = tenant.planActiveUntil && tenant.planActiveUntil > now
    ? tenant.planActiveUntil
    : now;
  const id = crypto.randomUUID();
  const invoice: Invoice = {
    id,
    tenantId: tenant.id,
    number: invoiceNumber(now),
    plan: def.id,
    amountIdr: amount,
    periodStart: start,
    periodEnd: addOneMonth(start),
    status: "pending",
    dueAt: new Date(now.getTime() + INVOICE_WINDOW_DAYS * DAY_MS),
    snapToken: null,
    snapRedirectUrl: null,
    paidAt: null,
    paymentType: null,
    lastReminderAt: null,
    createdAt: now,
  };

  const snap = await createSnapTransaction({
    orderId: id,
    grossAmountIdr: amount,
    itemName: `MLR Flow ${def.id} — 1 bulan`,
    customerName: requestedBy.name,
    customerEmail: requestedBy.email,
    finishUrl: `${appUrl()}/settings`,
    expiryDays: INVOICE_WINDOW_DAYS,
  });
  if (snap) {
    invoice.snapToken = snap.token;
    invoice.snapRedirectUrl = snap.redirectUrl;
  }

  await db.insert(t.invoices).values(invoice);
  return invoice;
}

/**
 * Marks an invoice paid and extends the tenant's paid-through date by one
 * month anchored at max(now, current planActiveUntil). Idempotent — Midtrans
 * retries notifications, and settlement can follow a pending notification.
 */
export async function applyInvoicePaid(
  invoice: Invoice,
  paymentType: string | null,
  now = new Date(),
): Promise<{ newActiveUntil: Date } | null> {
  if (invoice.status === "paid") return null;

  const tenant = (
    await db.select().from(t.tenants).where(eq(t.tenants.id, invoice.tenantId))
  )[0];
  if (!tenant) return null;

  const start =
    tenant.planActiveUntil && tenant.planActiveUntil > now ? tenant.planActiveUntil : now;
  const newActiveUntil = addOneMonth(start);

  await db
    .update(t.invoices)
    .set({
      status: "paid",
      paidAt: now,
      paymentType,
      periodStart: start,
      periodEnd: newActiveUntil,
    })
    .where(eq(t.invoices.id, invoice.id));
  await db
    .update(t.tenants)
    .set({ planActiveUntil: newActiveUntil })
    .where(eq(t.tenants.id, tenant.id));

  return { newActiveUntil };
}

export type BillingSweepStats = {
  invoicesExpired: number;
  invoicesCreated: number;
  remindersSent: number;
};

const asLocale = (l: string): Locale => (l === "en" ? "en" : "id");

// Re-nudge admins about an unpaid invoice at most every 3 days.
const REMINDER_EVERY_MS = 3 * DAY_MS;

async function billingAdmins(tenantId: string) {
  const admins = await db
    .select()
    .from(t.users)
    .where(
      and(
        eq(t.users.tenantId, tenantId),
        inArray(t.users.role, ["super_admin", "compliance_admin"]),
      ),
    );
  return admins.filter((a) => a.emailVerifiedAt);
}

/**
 * Daily billing sweep: expire dead invoices, raise renewal invoices for
 * tenants approaching (or past) their paid-through date, and remind admins
 * about unpaid ones. Per-tenant failures are logged and never abort the run.
 */
export async function runBillingSweep(now = new Date()): Promise<BillingSweepStats> {
  const stats: BillingSweepStats = {
    invoicesExpired: 0,
    invoicesCreated: 0,
    remindersSent: 0,
  };

  // The Snap link died with dueAt; mark the invoice so the sweep below can
  // raise a fresh one (new link, re-anchored period).
  const expired = await db
    .update(t.invoices)
    .set({ status: "expired" })
    .where(and(eq(t.invoices.status, "pending"), lt(t.invoices.dueAt, now)))
    .returning({ id: t.invoices.id });
  stats.invoicesExpired = expired.length;

  const tenants = await db.select().from(t.tenants);
  for (const tenant of tenants) {
    try {
      const state = billingState(tenant, now);
      if (!state.managed || !state.activeUntil) continue;

      const renewalDue =
        state.activeUntil.getTime() - now.getTime() <= INVOICE_WINDOW_DAYS * DAY_MS;
      if (!renewalDue) continue;

      const admins = await billingAdmins(tenant.id);
      if (admins.length === 0) continue;

      let invoice = await pendingInvoice(tenant.id);
      if (!invoice) {
        invoice = await ensureRenewalInvoice(tenant, admins[0], now);
        stats.invoicesCreated += 1;
      }

      const lastNudge = invoice.lastReminderAt ?? null;
      if (lastNudge && now.getTime() - lastNudge.getTime() < REMINDER_EVERY_MS) continue;

      for (const admin of admins) {
        try {
          await sendInvoiceEmail(admin.email, {
            locale: asLocale(admin.locale),
            status: state.status,
            tenantName: tenant.name,
            invoiceNumber: invoice.number,
            plan: invoice.plan,
            amountIdr: invoice.amountIdr,
            activeUntil: state.activeUntil,
            payUrl: invoice.snapRedirectUrl,
          });
          stats.remindersSent += 1;
        } catch (err) {
          console.error(`billing reminder to ${admin.email} failed:`, err);
        }
      }
      await db
        .update(t.invoices)
        .set({ lastReminderAt: now })
        .where(eq(t.invoices.id, invoice.id));
    } catch (err) {
      console.error(`billing sweep for tenant ${tenant.id} failed:`, err);
    }
  }

  return stats;
}
