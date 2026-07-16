import { eq, inArray } from "drizzle-orm";
import { db, t } from "./db";
import {
  sendReviewReminderEmail,
  sendBottleneckDigestEmail,
  type ReminderItem,
} from "./email";
import type { Locale } from "./i18n";

// A stage counts as stale once it has been waiting at least this many days.
// review_stages has no startedAt column, so "waiting since" is derived: the
// stage went in_progress when the previous stage was decided, or — for the
// first stage — when the latest version was submitted.
const STALE_AFTER_DAYS = Math.max(1, Number(process.env.REMINDER_AFTER_DAYS ?? "2") || 2);

const DAY_MS = 24 * 60 * 60_000;

const asLocale = (l: string): Locale => (l === "en" ? "en" : "id");

export type ReminderStats = {
  staleAfterDays: number;
  staleItems: number;
  tenants: number;
  reviewersEmailed: number;
  adminsEmailed: number;
};

/**
 * Emails every reviewer a digest of the in-progress stages that have been
 * waiting on them for STALE_AFTER_DAYS+ days, and workspace admins an
 * overview of all stuck stages. Designed to run from a daily cron; sending
 * failures are logged per recipient and never abort the sweep.
 */
export async function sendStaleReviewReminders(now = new Date()): Promise<ReminderStats> {
  const stats: ReminderStats = {
    staleAfterDays: STALE_AFTER_DAYS,
    staleItems: 0,
    tenants: 0,
    reviewersEmailed: 0,
    adminsEmailed: 0,
  };

  const open = await db
    .select({ stage: t.reviewStages, sub: t.contentSubmissions, productName: t.products.name })
    .from(t.reviewStages)
    .innerJoin(t.contentSubmissions, eq(t.reviewStages.submissionId, t.contentSubmissions.id))
    .innerJoin(t.products, eq(t.contentSubmissions.productId, t.products.id))
    .where(eq(t.reviewStages.status, "in_progress"));
  const inReview = open.filter((r) => r.sub.status === "in_review");
  if (inReview.length === 0) return stats;

  const subIds = [...new Set(inReview.map((r) => r.sub.id))];
  const [allStages, allVersions] = await Promise.all([
    db.select().from(t.reviewStages).where(inArray(t.reviewStages.submissionId, subIds)),
    db
      .select({
        submissionId: t.contentVersions.submissionId,
        versionNumber: t.contentVersions.versionNumber,
        createdAt: t.contentVersions.createdAt,
      })
      .from(t.contentVersions)
      .where(inArray(t.contentVersions.submissionId, subIds)),
  ]);

  type StaleRow = (typeof inReview)[number] & { item: ReminderItem };
  const staleByTenant = new Map<string, StaleRow[]>();

  for (const row of inReview) {
    const versions = allVersions
      .filter((v) => v.submissionId === row.sub.id)
      .sort((a, b) => a.versionNumber - b.versionNumber);
    const latest = versions[versions.length - 1];
    if (!latest) continue;

    let waitingSince = latest.createdAt.getTime();
    for (const s of allStages) {
      if (
        s.submissionId === row.sub.id &&
        s.stageOrder < row.stage.stageOrder &&
        s.decidedAt &&
        s.decidedAt.getTime() > waitingSince
      ) {
        waitingSince = s.decidedAt.getTime();
      }
    }
    const daysWaiting = Math.floor((now.getTime() - waitingSince) / DAY_MS);
    if (daysWaiting < STALE_AFTER_DAYS) continue;

    const item: ReminderItem = {
      title: row.sub.title,
      productName: row.productName,
      versionLabel: `v${latest.versionNumber}`,
      stageRole: row.stage.reviewerRole,
      daysWaiting,
      submissionId: row.sub.id,
    };
    const list = staleByTenant.get(row.sub.tenantId) ?? [];
    list.push({ ...row, item });
    staleByTenant.set(row.sub.tenantId, list);
    stats.staleItems += 1;
  }
  if (stats.staleItems === 0) return stats;

  const tenantUsers = await db
    .select()
    .from(t.users)
    .where(inArray(t.users.tenantId, [...staleByTenant.keys()]));

  for (const [tenantId, rows] of staleByTenant) {
    stats.tenants += 1;
    const users = tenantUsers.filter((u) => u.tenantId === tenantId && u.emailVerifiedAt);

    // One digest per reviewer: the assigned reviewer when the stage has one,
    // otherwise every user holding the stage's role (same rule as notify.ts).
    const perReviewer = new Map<string, ReminderItem[]>();
    for (const row of rows) {
      const recipients = row.stage.assignedTo
        ? users.filter((u) => u.id === row.stage.assignedTo)
        : users.filter((u) => u.role === row.stage.reviewerRole);
      for (const u of recipients) {
        const items = perReviewer.get(u.id) ?? [];
        items.push(row.item);
        perReviewer.set(u.id, items);
      }
      row.item.reviewerName =
        users.find((u) => u.id === row.stage.assignedTo)?.name ?? null;
    }

    for (const [userId, items] of perReviewer) {
      const user = users.find((u) => u.id === userId);
      if (!user) continue;
      items.sort((a, b) => b.daysWaiting - a.daysWaiting);
      try {
        await sendReviewReminderEmail(user.email, { locale: asLocale(user.locale), items });
        stats.reviewersEmailed += 1;
      } catch (e) {
        console.error(`review reminder to ${user.email} failed:`, e);
      }
    }

    const tenantItems = rows.map((r) => r.item).sort((a, b) => b.daysWaiting - a.daysWaiting);
    for (const admin of users.filter((u) =>
      ["super_admin", "compliance_admin"].includes(u.role),
    )) {
      try {
        await sendBottleneckDigestEmail(admin.email, {
          locale: asLocale(admin.locale),
          items: tenantItems,
        });
        stats.adminsEmailed += 1;
      } catch (e) {
        console.error(`bottleneck digest to ${admin.email} failed:`, e);
      }
    }
  }

  return stats;
}
