import { and, asc, eq } from "drizzle-orm";
import { db, t } from "./db";
import {
  sendReviewRequestEmail,
  sendDecisionEmail,
  type ReviewRequestKind,
} from "./email";
import type { Locale } from "./i18n";

// Workflow notification fan-out. Every function here is fire-and-forget:
// called from `after()` in the server actions, and never throws — a mail
// provider outage must not fail (or roll back) the workflow action itself.

type UserRow = typeof t.users.$inferSelect;

const asLocale = (l: string): Locale => (l === "en" ? "en" : "id");

// Only verified accounts can log in, so only they get workflow email; the
// actor is excluded — no one needs a notification about their own action.
const deliverable = (u: UserRow, actorId: string) =>
  u.emailVerifiedAt !== null && u.id !== actorId;

async function submissionContext(tenantId: string, submissionId: string) {
  const row = (
    await db
      .select({
        sub: t.contentSubmissions,
        productName: t.products.name,
        submitter: t.users,
      })
      .from(t.contentSubmissions)
      .innerJoin(t.products, eq(t.contentSubmissions.productId, t.products.id))
      .innerJoin(t.users, eq(t.contentSubmissions.submittedBy, t.users.id))
      .where(
        and(
          eq(t.contentSubmissions.id, submissionId),
          eq(t.contentSubmissions.tenantId, tenantId),
        ),
      )
  )[0];
  return row ?? null;
}

/**
 * Emails the reviewer(s) of the stage that is currently `in_progress`:
 * the assigned reviewer when the stage has one, otherwise every tenant
 * user holding the stage's role.
 */
export async function notifyCurrentStageReviewers(opts: {
  tenantId: string;
  submissionId: string;
  kind: ReviewRequestKind;
  versionLabel: string;
  actorId: string;
}) {
  try {
    const ctx = await submissionContext(opts.tenantId, opts.submissionId);
    if (!ctx) return;

    const stage = (
      await db
        .select()
        .from(t.reviewStages)
        .where(
          and(
            eq(t.reviewStages.submissionId, opts.submissionId),
            eq(t.reviewStages.status, "in_progress"),
          ),
        )
        .orderBy(asc(t.reviewStages.stageOrder))
    )[0];
    if (!stage) return;

    const recipients = stage.assignedTo
      ? await db
          .select()
          .from(t.users)
          .where(and(eq(t.users.id, stage.assignedTo), eq(t.users.tenantId, opts.tenantId)))
      : await db
          .select()
          .from(t.users)
          .where(
            and(eq(t.users.tenantId, opts.tenantId), eq(t.users.role, stage.reviewerRole)),
          );

    await Promise.all(
      recipients.filter((u) => deliverable(u, opts.actorId)).map(async (u) => {
        try {
          await sendReviewRequestEmail(u.email, {
            locale: asLocale(u.locale),
            kind: opts.kind,
            title: ctx.sub.title,
            productName: ctx.productName,
            versionLabel: opts.versionLabel,
            stageRole: stage.reviewerRole,
            submitterName: ctx.submitter.name,
            submissionId: opts.submissionId,
          });
        } catch (e) {
          console.error(`review-request email to ${u.email} failed:`, e);
        }
      }),
    );
  } catch (e) {
    console.error(`notifyCurrentStageReviewers(${opts.submissionId}) failed:`, e);
  }
}

/**
 * Emails the submitter about a decision on their material: final approval,
 * changes requested, or rejection.
 */
export async function notifySubmitterDecision(opts: {
  tenantId: string;
  submissionId: string;
  decision: "approved" | "changes_requested" | "rejected";
  stageRole: string;
  note: string | null;
  versionLabel: string;
  actorId: string;
}) {
  try {
    const ctx = await submissionContext(opts.tenantId, opts.submissionId);
    if (!ctx || !deliverable(ctx.submitter, opts.actorId)) return;

    await sendDecisionEmail(ctx.submitter.email, {
      locale: asLocale(ctx.submitter.locale),
      decision: opts.decision,
      title: ctx.sub.title,
      versionLabel: opts.versionLabel,
      stageRole: opts.stageRole,
      note: opts.note,
      submissionId: opts.submissionId,
    });
  } catch (e) {
    console.error(`notifySubmitterDecision(${opts.submissionId}) failed:`, e);
  }
}
