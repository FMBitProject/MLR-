import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { db, t } from "./db";
import { sendContentExpiryEmail, type ExpiryItem } from "./email";
import type { Locale } from "./i18n";

// Warn this many days before approved material expires.
const WARN_BEFORE_DAYS = 30;
// Re-send the digest for a given material at most this often.
const REMIND_EVERY_DAYS = 7;

const DAY_MS = 24 * 60 * 60_000;

const asLocale = (l: string): Locale => (l === "en" ? "en" : "id");

export type ContentLifecycle = "withdrawn" | "expired" | "expiring_soon" | "active";

/** Market-lifecycle state of an approved/withdrawn library item. */
export function contentLifecycle(
  sub: { status: string; expiresAt: Date | null },
  now = new Date(),
): ContentLifecycle {
  if (sub.status === "withdrawn") return "withdrawn";
  if (!sub.expiresAt) return "active";
  if (sub.expiresAt.getTime() < now.getTime()) return "expired";
  if (sub.expiresAt.getTime() - now.getTime() <= WARN_BEFORE_DAYS * DAY_MS)
    return "expiring_soon";
  return "active";
}

export type ExpiryStats = {
  expiringItems: number;
  tenants: number;
  adminsEmailed: number;
};

/**
 * Daily digest to compliance/QA and workspace admins: approved material
 * that expires within 30 days or has already expired (and should be pulled
 * from circulation or re-reviewed). Runs from the same daily cron as the
 * review reminders; per-recipient failures never abort the sweep.
 */
export async function sendContentExpiryReminders(now = new Date()): Promise<ExpiryStats> {
  const stats: ExpiryStats = { expiringItems: 0, tenants: 0, adminsEmailed: 0 };
  const cutoff = new Date(now.getTime() + WARN_BEFORE_DAYS * DAY_MS);

  const rows = await db
    .select({ sub: t.contentSubmissions, product: t.products })
    .from(t.contentSubmissions)
    .innerJoin(t.products, eq(t.contentSubmissions.productId, t.products.id))
    .where(
      and(
        eq(t.contentSubmissions.status, "approved"),
        isNotNull(t.contentSubmissions.expiresAt),
        lte(t.contentSubmissions.expiresAt, cutoff),
      ),
    );

  const due = rows.filter(
    ({ sub }) =>
      !sub.expiryRemindedAt ||
      now.getTime() - sub.expiryRemindedAt.getTime() >= REMIND_EVERY_DAYS * DAY_MS,
  );
  stats.expiringItems = due.length;
  if (due.length === 0) return stats;

  const byTenant = new Map<string, typeof due>();
  for (const row of due) {
    const list = byTenant.get(row.sub.tenantId) ?? [];
    list.push(row);
    byTenant.set(row.sub.tenantId, list);
  }

  for (const [tenantId, items] of byTenant) {
    stats.tenants += 1;
    const admins = (
      await db
        .select()
        .from(t.users)
        .where(
          and(
            eq(t.users.tenantId, tenantId),
            inArray(t.users.role, ["compliance_admin", "super_admin"]),
          ),
        )
    ).filter((u) => u.emailVerifiedAt);

    const expiryItems: ExpiryItem[] = items
      .map(({ sub, product }) => ({
        title: sub.title,
        productName: product.name,
        expiresAt: sub.expiresAt!,
        daysLeft: Math.ceil((sub.expiresAt!.getTime() - now.getTime()) / DAY_MS),
        submissionId: sub.id,
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    for (const admin of admins) {
      try {
        await sendContentExpiryEmail(admin.email, {
          locale: asLocale(admin.locale),
          items: expiryItems,
        });
        stats.adminsEmailed += 1;
      } catch (err) {
        console.error(`expiry digest to ${admin.email} failed:`, err);
      }
    }

    await db
      .update(t.contentSubmissions)
      .set({ expiryRemindedAt: now })
      .where(
        inArray(
          t.contentSubmissions.id,
          items.map(({ sub }) => sub.id),
        ),
      );
  }

  return stats;
}
