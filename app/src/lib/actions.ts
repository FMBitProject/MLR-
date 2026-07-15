"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { db, t } from "./db";
import { storage } from "./storage";
import { mimeForFileName } from "./mime";
import {
  createSession,
  destroySession,
  requireUser,
  verifyPassword,
  hashPassword,
  REVIEWER_ROLES,
  CLAIM_MANAGER_ROLES,
  SUBMITTER_ROLES,
} from "./auth";
import { logAudit } from "./audit";
import { runClaimsCheck } from "./claims-check";
import { extractClaimCandidates } from "./claims-extract";
import { lookupPubmed } from "./pubmed";
import { llmComplete } from "./llm";
import { checkAgainstJournal } from "./journal-check";
import type { ClaimReference } from "./db/schema";
import { renderTextPages, renderSlidePages, renderFilePlaceholderPage } from "./svg";
import { extractPptxSlides, extractDocxParagraphs } from "./office";
import { consumeAttempt, clearThrottle } from "./throttle";
import { planLimits, planHas } from "./plans";
import { submissionQuota } from "./usage";
import { sendVerificationEmail, sendInviteEmail } from "./email";
import { createAccountToken, findAccountToken, consumeAccountToken } from "./account-tokens";
import { getDict } from "./i18n-server";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/* ----------------------------- session ----------------------------- */

export async function login(_prev: { error: string } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Brute-force protection: 5 attempts per account and 20 per source IP
  // within 15 minutes. Counted before verification so failures always cost.
  const WINDOW = 15 * 60_000;
  const [emailOk, ipOk] = await Promise.all([
    consumeAttempt(`login:${email}`, 5, WINDOW),
    consumeAttempt(`login-ip:${await clientIp()}`, 20, WINDOW),
  ]);
  if (!emailOk || !ipOk) return { error: "locked" };

  const user = (await db.select().from(t.users).where(eq(t.users.email, email)))[0];
  if (!user) return { error: "invalid" };
  // Checked before the password so an invited-but-not-yet-activated account
  // (which has no usable password yet) gets an actionable message instead
  // of a generic "wrong password".
  if (!user.emailVerifiedAt) return { error: "unverified" };
  if (!verifyPassword(password, user.passwordHash)) return { error: "invalid" };

  await clearThrottle(`login:${email}`);
  await createSession(user.id);
  await logAudit({
    tenantId: user.tenantId,
    entityType: "user",
    entityId: user.id,
    action: "logged_in",
    performedBy: user.id,
  });
  redirect("/dashboard");
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  );
}

export async function register(
  _prev: { error: string; sent?: undefined } | { sent: boolean; error?: undefined } | null,
  formData: FormData,
) {
  const companyName = String(formData.get("companyName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!companyName || !name || !email || password.length < 8) {
    return { error: "validation" };
  }
  // Throttle workspace creation per source IP: 5 per hour.
  if (!(await consumeAttempt(`register:${await clientIp()}`, 5, 60 * 60_000))) {
    return { error: "throttled" };
  }
  if ((await db.select().from(t.users).where(eq(t.users.email, email)))[0]) {
    return { error: "email_taken" };
  }

  const base = slugify(companyName);
  let slug = base;
  let n = 1;
  while ((await db.select().from(t.tenants).where(eq(t.tenants.slug, slug)))[0]) {
    n += 1;
    slug = `${base}-${n}`;
  }

  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  await db.insert(t.tenants)
    .values({ id: tenantId, name: companyName, slug, plan: "starter", createdAt: new Date() });
  await db.insert(t.users)
    .values({
      id: userId,
      tenantId,
      email,
      name,
      role: "super_admin",
      passwordHash: hashPassword(password),
      emailVerifiedAt: null,
      createdAt: new Date(),
    });

  await logAudit({
    tenantId,
    entityType: "tenant",
    entityId: tenantId,
    action: "workspace_registered",
    performedBy: userId,
    details: { companyName, slug },
  });

  const token = await createAccountToken(userId, "verify");
  await sendVerificationEmail(email, name, token);

  return { sent: true };
}

export async function resendVerificationEmail(
  _prev: { error?: string; sent?: boolean } | null,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!(await consumeAttempt(`resend-verify:${email}`, 3, 60 * 60_000))) {
    return { error: "throttled" };
  }
  const user = (await db.select().from(t.users).where(eq(t.users.email, email)))[0];
  // Same response whether the account exists or is already verified — avoids
  // confirming account existence to an unauthenticated caller.
  if (user && !user.emailVerifiedAt) {
    const token = await createAccountToken(user.id, "verify");
    await sendVerificationEmail(user.email, user.name, token);
  }
  return { sent: true };
}

/** Confirms a self-registration "verify" token. Called directly from the
 * /verify-email server component (not a form) — the click on the emailed
 * link is the user action, no extra submit needed. */
export async function verifyEmailToken(
  token: string,
): Promise<{ status: "ok" | "invalid" }> {
  const found = await findAccountToken(token);
  if (!found || found.purpose !== "verify") return { status: "invalid" };

  await db
    .update(t.users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(t.users.id, found.userId));
  await consumeAccountToken(token);
  await logAudit({
    tenantId: found.user.tenantId,
    entityType: "user",
    entityId: found.userId,
    action: "email_verified",
    performedBy: found.userId,
  });
  return { status: "ok" };
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function setLocale(locale: "id" | "en") {
  const store = await cookies();
  store.set("NEXT_LOCALE", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

/* --------------------------- submissions --------------------------- */

const DEFAULT_STAGES = ["medical_reviewer", "legal_reviewer", "regulatory_reviewer"];

async function stagesForChannel(tenantId: string, channel: string): Promise<string[]> {
  const wf = (await db
    .select()
    .from(t.workflowTemplates)
    .where(
      and(
        eq(t.workflowTemplates.tenantId, tenantId),
        eq(t.workflowTemplates.channel, channel),
      ),
    )
    )[0];
  return wf?.stages ?? DEFAULT_STAGES;
}

async function defaultAssignee(tenantId: string, role: string): Promise<string | null> {
  const u = (await db
    .select()
    .from(t.users)
    .where(and(eq(t.users.tenantId, tenantId), eq(t.users.role, role)))
    )[0];
  return u?.id ?? null;
}

async function createVersionWithPipeline(opts: {
  tenantId: string;
  submissionId: string;
  productId: string;
  versionNumber: number;
  title: string;
  subtitle: string;
  text: string | null;
  fileName: string | null;
  fileData: Buffer | null;
}): Promise<{ versionId: string; flags: number }> {
  const versionId = crypto.randomUUID();
  await db.insert(t.contentVersions)
    .values({
      id: versionId,
      submissionId: opts.submissionId,
      versionNumber: opts.versionNumber,
      fileName: opts.fileName,
      textContent: opts.text,
      isLocked: false,
      // Pages/elements render synchronously below; the AI claims check runs
      // in the background (scheduleClaimsCheck) and flips this to "ready".
      processingStatus: "processing",
      createdAt: new Date(),
    });

  let insertedPages = 0;
  const insertRendered = async (
    pages: import("./svg").RenderedPage[],
    elements: import("./svg").RenderedElement[],
  ) => {
    const offset = insertedPages;
    for (const p of pages) {
      await db.insert(t.contentVersionPages)
        .values({
          id: crypto.randomUUID(),
          versionId,
          pageNumber: p.pageNumber + offset,
          renderedSvg: p.svg,
          width: p.width,
          height: p.height,
        });
    }
    for (const el of elements) {
      await db.insert(t.contentElements)
        .values({
          id: crypto.randomUUID(),
          versionId,
          pageNumber: el.pageNumber + offset,
          elementType: el.elementType,
          extractionMethod: el.elementType === "image" ? "manual" : "native_text",
          extractedText: el.text,
          boundingBox: el.bbox,
          requiresManualReview: el.elementType === "image",
        });
    }
    insertedPages += pages.length;
  };

  if (opts.text) {
    const paragraphs = opts.text
      .split(/\n{2,}|\r\n{2,}/)
      .flatMap((p) => p.split(/\n/))
      .map((p) => p.trim())
      .filter(Boolean);
    const { pages, elements } = renderTextPages({
      title: opts.title,
      subtitle: opts.subtitle,
      paragraphs,
    });
    await insertRendered(pages, elements);
  }

  if (opts.fileName) {
    // PPTX/DOCX are ZIPs of XML — extract every slide/paragraph so the whole
    // deck gets review pages and the claims check. PDFs (and unreadable
    // files) fall back to the placeholder + mandatory manual review.
    const lower = opts.fileName.toLowerCase();
    let rendered: {
      pages: import("./svg").RenderedPage[];
      elements: import("./svg").RenderedElement[];
    } | null = null;
    let extractedText: string | null = null;

    if (opts.fileData && lower.endsWith(".pptx")) {
      const slides = await extractPptxSlides(opts.fileData);
      if (slides) {
        rendered = renderSlidePages({ title: opts.title, slides });
        extractedText = slides.map((s) => s.paragraphs.join("\n")).join("\n\n");
      }
    } else if (opts.fileData && lower.endsWith(".docx")) {
      const paras = await extractDocxParagraphs(opts.fileData);
      if (paras) {
        rendered = renderTextPages({
          title: opts.title,
          subtitle: opts.subtitle,
          paragraphs: paras,
        });
        extractedText = paras.join("\n\n");
      }
    }

    if (rendered) {
      await insertRendered(rendered.pages, rendered.elements);
      // Store extracted text so version diffs work for deck revisions too
      if (!opts.text && extractedText) {
        await db.update(t.contentVersions)
          .set({ textContent: extractedText })
          .where(eq(t.contentVersions.id, versionId));
      }
    } else {
      const page = renderFilePlaceholderPage(opts.fileName, opts.title);
      const pageNumber = insertedPages + 1;
      await db.insert(t.contentVersionPages)
        .values({
          id: crypto.randomUUID(),
          versionId,
          pageNumber,
          renderedSvg: page.svg,
          width: page.width,
          height: page.height,
        });
      await db.insert(t.contentElements)
        .values({
          id: crypto.randomUUID(),
          versionId,
          pageNumber,
          elementType: "image",
          extractionMethod: "manual",
          extractedText: null,
          boundingBox: { x: 84, y: 200, width: 1072, height: 380 },
          requiresManualReview: true,
        });
      insertedPages = pageNumber;
    }
  }

  return { versionId, flags: 0 };
}

// Runs the AI claims check AFTER the response is sent (Vercel keeps the
// function alive via waitUntil), so a large deck can't push the submit
// request past the platform timeout. The version stays "processing" until
// the check finishes; the review UI polls while in that state.
function scheduleClaimsCheck(opts: {
  versionId: string;
  productId: string;
  tenantId: string;
  performedBy: string;
  versionLabel: string;
  auditAction?: "claims_check_completed" | "claims_check_rerun";
}) {
  after(async () => {
    try {
      const flags = await runClaimsCheck({
        versionId: opts.versionId,
        productId: opts.productId,
        tenantId: opts.tenantId,
      });
      await logAudit({
        tenantId: opts.tenantId,
        entityType: "version",
        entityId: opts.versionId,
        action: opts.auditAction ?? "claims_check_completed",
        performedBy: opts.performedBy,
        details: { version: opts.versionLabel, flags },
      });
    } catch (e) {
      // A failed check must never leave the version stuck in "processing" —
      // reviewers can re-run it manually from the workspace.
      console.error(`claims check failed for version ${opts.versionId}:`, e);
    } finally {
      await db
        .update(t.contentVersions)
        .set({ processingStatus: "ready" })
        .where(eq(t.contentVersions.id, opts.versionId));
    }
  });
}

export async function createSubmission(formData: FormData) {
  const user = await requireUser();
  if (!SUBMITTER_ROLES.includes(user.role as (typeof SUBMITTER_ROLES)[number])) {
    throw new Error("FORBIDDEN");
  }
  const title = String(formData.get("title") ?? "").trim();
  const productId = String(formData.get("productId") ?? "");
  const channel = String(formData.get("channel") ?? "print");
  const audience = String(formData.get("audience") ?? "hcp");
  const text = String(formData.get("text") ?? "").trim() || null;
  const file = formData.get("file");
  const fileName =
    file instanceof File && file.size > 0 ? file.name : null;
  const fileData =
    file instanceof File && file.size > 0
      ? Buffer.from(await file.arrayBuffer())
      : null;

  if (!title || !productId || (!text && !fileName)) {
    throw new Error("VALIDATION");
  }

  const product = (await db
    .select()
    .from(t.products)
    .where(and(eq(t.products.id, productId), eq(t.products.tenantId, user.tenantId)))
    )[0];
  if (!product) throw new Error("NOT_FOUND");

  // Plan quota (PRD §12): monthly submission cap. The form disables itself
  // when the quota is full; this closes the race for concurrent submitters.
  const tenant = (await db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)))[0];
  const quota = await submissionQuota(user.tenantId, tenant?.plan);
  if (quota.used >= quota.limit) throw new Error("PLAN_LIMIT");

  const submissionId = crypto.randomUUID();
  const stageRoles = await stagesForChannel(user.tenantId, channel);

  await db.insert(t.contentSubmissions)
    .values({
      id: submissionId,
      tenantId: user.tenantId,
      productId,
      title,
      channel,
      targetAudience: audience,
      submittedBy: user.id,
      status: "in_review",
      currentStage: stageRoles[0],
      createdAt: new Date(),
    });

  for (const [i, role] of stageRoles.entries()) {
    await db.insert(t.reviewStages)
      .values({
        id: crypto.randomUUID(),
        submissionId,
        stageOrder: i + 1,
        reviewerRole: role,
        assignedTo: await defaultAssignee(user.tenantId, role),
        status: i === 0 ? "in_progress" : "pending",
      });
  }

  const { versionId } = await createVersionWithPipeline({
    tenantId: user.tenantId,
    submissionId,
    productId,
    versionNumber: 1,
    title,
    subtitle: `${product.name} — ${channel}`,
    text,
    fileName,
    fileData,
  });

  // Persist the original upload (keyed by version id) so the approved master
  // can be downloaded later. Storage driver: local disk in dev, S3/R2 in prod.
  if (fileData) {
    await storage.put(versionId, fileData, mimeForFileName(fileName));
  }

  await logAudit({
    tenantId: user.tenantId,
    entityType: "submission",
    entityId: submissionId,
    action: "submitted",
    performedBy: user.id,
    details: { version: "v1", title },
  });

  scheduleClaimsCheck({
    versionId,
    productId,
    tenantId: user.tenantId,
    performedBy: user.id,
    versionLabel: "v1",
  });

  revalidatePath("/", "layout");
  redirect(`/submissions/${submissionId}`);
}

export async function resubmitVersion(formData: FormData) {
  const user = await requireUser();
  if (!SUBMITTER_ROLES.includes(user.role as (typeof SUBMITTER_ROLES)[number])) {
    throw new Error("FORBIDDEN");
  }
  const submissionId = String(formData.get("submissionId") ?? "");
  const text = String(formData.get("text") ?? "").trim() || null;
  const changeNote = String(formData.get("changeNote") ?? "").trim();
  const file = formData.get("file");
  const fileName = file instanceof File && file.size > 0 ? file.name : null;
  const fileData =
    file instanceof File && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : null;
  // Same rule as the initial submission: revised text or a revised file.
  if ((!text && !fileName) || !changeNote) throw new Error("VALIDATION");

  const sub = (await db
    .select()
    .from(t.contentSubmissions)
    .where(
      and(
        eq(t.contentSubmissions.id, submissionId),
        eq(t.contentSubmissions.tenantId, user.tenantId),
      ),
    )
    )[0];
  if (!sub) throw new Error("NOT_FOUND");
  if (sub.status === "approved") throw new Error("LOCKED");

  const versions = await db
    .select()
    .from(t.contentVersions)
    .where(eq(t.contentVersions.submissionId, submissionId));
  const nextVersion = Math.max(...versions.map((v) => v.versionNumber)) + 1;

  const product = (await db.select().from(t.products).where(eq(t.products.id, sub.productId)))[0];

  const { versionId } = await createVersionWithPipeline({
    tenantId: user.tenantId,
    submissionId,
    productId: sub.productId,
    versionNumber: nextVersion,
    title: sub.title,
    subtitle: `${product?.name ?? ""} — ${sub.channel ?? ""} — v${nextVersion}`,
    text,
    fileName,
    fileData,
  });
  await db.update(t.contentVersions)
    .set({ changeNote })
    .where(eq(t.contentVersions.id, versionId));

  // Persist the revised upload (keyed by version id), same as v1: the
  // approved master must always be downloadable for the audit package.
  if (fileData) {
    await storage.put(versionId, fileData, mimeForFileName(fileName));
  }

  // Reset the review workflow: fresh stages from the tenant template
  await db.delete(t.reviewStages).where(eq(t.reviewStages.submissionId, submissionId));
  const stageRoles = await stagesForChannel(user.tenantId, sub.channel ?? "print");
  for (const [i, role] of stageRoles.entries()) {
    await db.insert(t.reviewStages)
      .values({
        id: crypto.randomUUID(),
        submissionId,
        stageOrder: i + 1,
        reviewerRole: role,
        assignedTo: await defaultAssignee(user.tenantId, role),
        status: i === 0 ? "in_progress" : "pending",
      });
  }

  await db.update(t.contentSubmissions)
    .set({ status: "in_review", currentStage: stageRoles[0], decidedAt: null })
    .where(eq(t.contentSubmissions.id, submissionId));

  await logAudit({
    tenantId: user.tenantId,
    entityType: "submission",
    entityId: submissionId,
    action: "resubmitted",
    performedBy: user.id,
    details: { version: `v${nextVersion}`, changeNote },
  });

  scheduleClaimsCheck({
    versionId,
    productId: sub.productId,
    tenantId: user.tenantId,
    performedBy: user.id,
    versionLabel: `v${nextVersion}`,
  });

  revalidatePath("/", "layout");
}

// "Reuse" from the Approved Library: clones the locked master of an approved
// submission into a brand-new submission that runs the full review workflow
// again. The source submission (and its approval trail) is never touched —
// per MLR discipline every new use of a piece is a new reviewed submission.
export async function reuseApprovedContent(formData: FormData) {
  const user = await requireUser();
  if (!SUBMITTER_ROLES.includes(user.role as (typeof SUBMITTER_ROLES)[number])) {
    throw new Error("FORBIDDEN");
  }
  const sourceId = String(formData.get("submissionId") ?? "");

  const source = (await db
    .select()
    .from(t.contentSubmissions)
    .where(
      and(
        eq(t.contentSubmissions.id, sourceId),
        eq(t.contentSubmissions.tenantId, user.tenantId),
        eq(t.contentSubmissions.status, "approved"),
      ),
    )
    )[0];
  if (!source) throw new Error("NOT_FOUND");

  const versions = await db
    .select()
    .from(t.contentVersions)
    .where(eq(t.contentVersions.submissionId, sourceId))
    .orderBy(asc(t.contentVersions.versionNumber));
  const finalVersion = versions[versions.length - 1];
  if (!finalVersion) throw new Error("NOT_FOUND");

  const product = (await db
    .select()
    .from(t.products)
    .where(eq(t.products.id, source.productId))
    )[0];

  // Prefer the original master file; fall back to the extracted text if the
  // bytes are gone (e.g. local-disk driver wiped between deploys).
  const fileData = finalVersion.fileName ? await storage.get(finalVersion.id) : null;
  const fileName = fileData ? finalVersion.fileName : null;
  const text = fileName ? null : finalVersion.textContent;
  if (!fileName && !text) throw new Error("SOURCE_EMPTY");

  const { dict } = await getDict();
  const title = `${source.title} ${dict.library.reuseSuffix}`;
  const channel = source.channel ?? "print";

  const submissionId = crypto.randomUUID();
  const stageRoles = await stagesForChannel(user.tenantId, channel);

  await db.insert(t.contentSubmissions)
    .values({
      id: submissionId,
      tenantId: user.tenantId,
      productId: source.productId,
      title,
      channel,
      targetAudience: source.targetAudience,
      submittedBy: user.id,
      status: "in_review",
      currentStage: stageRoles[0],
      createdAt: new Date(),
    });

  for (const [i, role] of stageRoles.entries()) {
    await db.insert(t.reviewStages)
      .values({
        id: crypto.randomUUID(),
        submissionId,
        stageOrder: i + 1,
        reviewerRole: role,
        assignedTo: await defaultAssignee(user.tenantId, role),
        status: i === 0 ? "in_progress" : "pending",
      });
  }

  const { versionId } = await createVersionWithPipeline({
    tenantId: user.tenantId,
    submissionId,
    productId: source.productId,
    versionNumber: 1,
    title,
    subtitle: `${product?.name ?? ""} — ${channel}`,
    text,
    fileName,
    fileData,
  });
  if (fileData) {
    await storage.put(versionId, fileData, mimeForFileName(fileName));
  }

  await logAudit({
    tenantId: user.tenantId,
    entityType: "submission",
    entityId: submissionId,
    action: "reused_from_library",
    performedBy: user.id,
    details: {
      title,
      sourceSubmissionId: sourceId,
      sourceVersion: `v${finalVersion.versionNumber}`,
    },
  });

  scheduleClaimsCheck({
    versionId,
    productId: source.productId,
    tenantId: user.tenantId,
    performedBy: user.id,
    versionLabel: "v1",
  });

  revalidatePath("/", "layout");
  redirect(`/submissions/${submissionId}`);
}

/* ------------------------------ review ----------------------------- */

export async function decideStage(formData: FormData) {
  const user = await requireUser();
  const stageId = String(formData.get("stageId") ?? "");
  const decision = String(formData.get("decision") ?? ""); // approved | changes_requested | rejected
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!["approved", "changes_requested", "rejected"].includes(decision)) {
    throw new Error("VALIDATION");
  }
  if (decision !== "approved" && !note) throw new Error("NOTE_REQUIRED");

  const stage = (await db.select().from(t.reviewStages).where(eq(t.reviewStages.id, stageId)))[0];
  if (!stage) throw new Error("NOT_FOUND");

  const sub = (await db
    .select()
    .from(t.contentSubmissions)
    .where(
      and(
        eq(t.contentSubmissions.id, stage.submissionId),
        eq(t.contentSubmissions.tenantId, user.tenantId),
      ),
    )
    )[0];
  if (!sub) throw new Error("NOT_FOUND");

  const canDecide =
    user.role === stage.reviewerRole ||
    user.role === "super_admin" ||
    user.role === "compliance_admin";
  if (!canDecide || stage.status === "approved") throw new Error("FORBIDDEN");

  const versions = await db
    .select()
    .from(t.contentVersions)
    .where(eq(t.contentVersions.submissionId, sub.id))
    .orderBy(asc(t.contentVersions.versionNumber));
  const currentVersion = versions[versions.length - 1];

  // Follow-up enforcement: a stage cannot be approved while comments from
  // previous versions are still unresolved (the reviewer must verify each
  // piece of feedback was actually addressed).
  if (decision === "approved" && versions.length > 1) {
    const prevIds = versions.slice(0, -1).map((v) => v.id);
    const openPrev = (
      await db
        .select()
        .from(t.reviewComments)
        .where(inArray(t.reviewComments.versionId, prevIds))
    ).filter((c) => !c.resolved).length;
    if (openPrev > 0) throw new Error("PREV_COMMENTS_OPEN");
  }

  await db.update(t.reviewStages)
    .set({ status: decision, decidedAt: new Date(), decisionNote: note })
    .where(eq(t.reviewStages.id, stageId));

  if (decision === "approved") {
    const stages = await db
      .select()
      .from(t.reviewStages)
      .where(eq(t.reviewStages.submissionId, sub.id))
      .orderBy(asc(t.reviewStages.stageOrder));
    const next = stages.find((s) => s.status === "pending");
    if (next) {
      await db.update(t.reviewStages)
        .set({ status: "in_progress" })
        .where(eq(t.reviewStages.id, next.id));
      await db.update(t.contentSubmissions)
        .set({ currentStage: next.reviewerRole })
        .where(eq(t.contentSubmissions.id, sub.id));
    } else {
      // Final approval: lock the version (immutability NFR)
      await db.update(t.contentSubmissions)
        .set({ status: "approved", currentStage: null, decidedAt: new Date() })
        .where(eq(t.contentSubmissions.id, sub.id));
      await db.update(t.contentVersions)
        .set({ isLocked: true })
        .where(eq(t.contentVersions.id, currentVersion.id));
      await logAudit({
        tenantId: user.tenantId,
        entityType: "version",
        entityId: currentVersion.id,
        action: "version_locked",
        performedBy: user.id,
        details: { version: `v${currentVersion.versionNumber}` },
      });
    }
  } else if (decision === "changes_requested") {
    await db.update(t.contentSubmissions)
      .set({ status: "changes_requested" })
      .where(eq(t.contentSubmissions.id, sub.id));
  } else {
    await db.update(t.contentSubmissions)
      .set({ status: "rejected", currentStage: null, decidedAt: new Date() })
      .where(eq(t.contentSubmissions.id, sub.id));
  }

  await logAudit({
    tenantId: user.tenantId,
    entityType: "submission",
    entityId: sub.id,
    action: decision,
    performedBy: user.id,
    details: {
      version: `v${currentVersion.versionNumber}`,
      stage: stage.reviewerRole,
      note: note ?? undefined,
    },
  });

  revalidatePath("/", "layout");
}

export async function addComment(formData: FormData) {
  const user = await requireUser();
  const versionId = String(formData.get("versionId") ?? "");
  const elementId = String(formData.get("elementId") ?? "") || null;
  const comment = String(formData.get("comment") ?? "").trim();
  if (!comment) throw new Error("VALIDATION");

  const version = (await db
    .select({ sub: t.contentSubmissions })
    .from(t.contentVersions)
    .innerJoin(t.contentSubmissions, eq(t.contentVersions.submissionId, t.contentSubmissions.id))
    .where(
      and(eq(t.contentVersions.id, versionId), eq(t.contentSubmissions.tenantId, user.tenantId)),
    )
    )[0];
  if (!version) throw new Error("NOT_FOUND");

  const id = crypto.randomUUID();
  await db.insert(t.reviewComments)
    .values({
      id,
      versionId,
      elementId,
      reviewerId: user.id,
      comment,
      resolved: false,
      createdAt: new Date(),
    });

  await logAudit({
    tenantId: user.tenantId,
    entityType: "comment",
    entityId: id,
    action: "commented",
    performedBy: user.id,
    details: { versionId, elementId: elementId ?? undefined },
  });
  revalidatePath("/", "layout");
}

export async function resolveComment(formData: FormData) {
  const user = await requireUser();
  const commentId = String(formData.get("commentId") ?? "");

  const owned = (await db
    .select({ id: t.reviewComments.id })
    .from(t.reviewComments)
    .innerJoin(t.contentVersions, eq(t.reviewComments.versionId, t.contentVersions.id))
    .innerJoin(t.contentSubmissions, eq(t.contentVersions.submissionId, t.contentSubmissions.id))
    .where(
      and(eq(t.reviewComments.id, commentId), eq(t.contentSubmissions.tenantId, user.tenantId)),
    )
    )[0];
  if (!owned) throw new Error("NOT_FOUND");

  await db.update(t.reviewComments)
    .set({ resolved: true })
    .where(eq(t.reviewComments.id, commentId));
  await logAudit({
    tenantId: user.tenantId,
    entityType: "comment",
    entityId: commentId,
    action: "comment_resolved",
    performedBy: user.id,
  });
  revalidatePath("/", "layout");
}

export async function decideFlag(formData: FormData) {
  const user = await requireUser();
  const flagId = String(formData.get("flagId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!["accepted", "dismissed", "escalated"].includes(decision)) {
    throw new Error("VALIDATION");
  }
  const allowed = [...REVIEWER_ROLES, "compliance_admin", "super_admin"];
  if (!allowed.includes(user.role as (typeof allowed)[number])) throw new Error("FORBIDDEN");

  const owned = (await db
    .select({ id: t.claimFlags.id })
    .from(t.claimFlags)
    .innerJoin(t.contentVersions, eq(t.claimFlags.versionId, t.contentVersions.id))
    .innerJoin(t.contentSubmissions, eq(t.contentVersions.submissionId, t.contentSubmissions.id))
    .where(and(eq(t.claimFlags.id, flagId), eq(t.contentSubmissions.tenantId, user.tenantId)))
    )[0];
  if (!owned) throw new Error("NOT_FOUND");

  await db.update(t.claimFlags)
    .set({ reviewerDecision: decision, decidedBy: user.id })
    .where(eq(t.claimFlags.id, flagId));
  await logAudit({
    tenantId: user.tenantId,
    entityType: "flag",
    entityId: flagId,
    action: "flag_decided",
    performedBy: user.id,
    details: { decision },
  });
  revalidatePath("/", "layout");
}

// Re-run the AI claims check for the latest version against the CURRENT
// Claims Library — flags are otherwise computed once at submission, so
// library fixes (better claim wording, new references) never reached
// existing submissions. Replaces all flags for the version; prior decisions
// stay in the audit log.
export async function rerunClaimsCheck(formData: FormData) {
  const user = await requireUser();
  const submissionId = String(formData.get("submissionId") ?? "");
  const allowed = [...REVIEWER_ROLES, "compliance_admin", "super_admin"];
  if (!allowed.includes(user.role as (typeof allowed)[number])) throw new Error("FORBIDDEN");

  const sub = (await db
    .select()
    .from(t.contentSubmissions)
    .where(
      and(
        eq(t.contentSubmissions.id, submissionId),
        eq(t.contentSubmissions.tenantId, user.tenantId),
      ),
    )
    )[0];
  if (!sub) throw new Error("NOT_FOUND");

  const versions = await db
    .select()
    .from(t.contentVersions)
    .where(eq(t.contentVersions.submissionId, submissionId));
  const latest = versions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
  if (!latest || latest.isLocked) throw new Error("LOCKED");

  await db.delete(t.claimFlags).where(eq(t.claimFlags.versionId, latest.id));
  await db
    .update(t.contentVersions)
    .set({ processingStatus: "processing" })
    .where(eq(t.contentVersions.id, latest.id));
  scheduleClaimsCheck({
    versionId: latest.id,
    productId: sub.productId,
    tenantId: user.tenantId,
    performedBy: user.id,
    versionLabel: `v${latest.versionNumber}`,
    auditAction: "claims_check_rerun",
  });
  revalidatePath("/", "layout");
}

// On-demand AI substantiation of a flag against the product's library
// journals: fetches PubMed abstracts (free) for the closest claims carrying a
// PMID and lets the configured LLM judge whether any supports the copy — works
// even when no claim lexically matched. Assistive only; the reviewer decides.
export async function verifyFlagJournal(formData: FormData) {
  const user = await requireUser();
  const flagId = String(formData.get("flagId") ?? "");
  const allowed = [...REVIEWER_ROLES, "compliance_admin", "super_admin"];
  if (!allowed.includes(user.role as (typeof allowed)[number])) throw new Error("FORBIDDEN");

  // Journal substantiation is a Growth+ feature (PRD §12). The button is
  // hidden on Starter; this guards direct invocations.
  const planTenant = (await db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)))[0];
  if (!planHas(planTenant?.plan, "journalSubstantiation")) throw new Error("PLAN_FEATURE");

  const flag = (await db.select().from(t.claimFlags).where(eq(t.claimFlags.id, flagId)))[0];
  if (!flag) throw new Error("NOT_FOUND");

  // Resolve the submission's product so we check against its claims library
  const version = (await db
    .select()
    .from(t.contentVersions)
    .where(eq(t.contentVersions.id, flag.versionId))
    )[0];
  const sub = version
    ? (await db
        .select()
        .from(t.contentSubmissions)
        .where(
          and(
            eq(t.contentSubmissions.id, version.submissionId),
            eq(t.contentSubmissions.tenantId, user.tenantId),
          ),
        )
        )[0]
    : null;
  if (!sub) throw new Error("NOT_FOUND");

  // Every active claim's PMID-bearing reference becomes a candidate journal.
  const claims = await db
    .select()
    .from(t.approvedClaims)
    .where(
      and(
        eq(t.approvedClaims.tenantId, user.tenantId),
        eq(t.approvedClaims.productId, sub.productId),
        eq(t.approvedClaims.status, "active"),
      ),
    );
  const candidates = claims.flatMap((c) =>
    (c.references ?? [])
      .filter((r) => r.pmid || r.docId)
      .map((r) => ({ ref: r, claimText: c.claimText })),
  );

  const result = await checkAgainstJournal({
    flaggedText: flag.flaggedText,
    tenantId: user.tenantId,
    candidates,
  });

  await db.update(t.claimFlags)
    .set(
      result
        ? { journalVerdict: result.verdict, journalNote: result.note, journalPmid: result.pmid }
        : { journalVerdict: "unavailable", journalNote: null, journalPmid: null },
    )
    .where(eq(t.claimFlags.id, flagId));
  await logAudit({
    tenantId: user.tenantId,
    entityType: "flag",
    entityId: flagId,
    action: "journal_check_completed",
    performedBy: user.id,
    details: { verdict: result?.verdict ?? "unavailable", pmid: result?.pmid },
  });
  revalidatePath("/", "layout");
}

/* ------------------------------ claims ----------------------------- */

// Ingest an uploaded journal PDF (the tenant's licensed copy) into the RAG
// corpus so the AI can read the article's full text, tables included. The
// citation line is derived by the LLM from the first page when available.
export async function uploadJournalPdf(
  formData: FormData,
): Promise<{ docId: string; citation: string } | { error: string }> {
  const user = await requireUser();
  if (!CLAIM_MANAGER_ROLES.includes(user.role as (typeof CLAIM_MANAGER_ROLES)[number]))
    throw new Error("FORBIDDEN");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "NO_FILE" };
  if (file.size > 15 * 1024 * 1024) return { error: "TOO_LARGE" };

  let content = "";
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
    const result = await parser.getText();
    await parser.destroy();
    content = String(result.text ?? "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return { error: "PARSE_FAILED" };
  }
  if (content.length < 500) return { error: "PARSE_FAILED" };

  // Ask the LLM for a proper citation line; fall back to the file name
  let citation = file.name.replace(/\.pdf$/i, "");
  const derived = await llmComplete({
    maxTokens: 150,
    system:
      "Extract the bibliographic citation of this journal article from the beginning of its text. Reply with ONLY the citation in the form: Authors. Title. Journal. Year;Volume(Issue):Pages. If you cannot identify it, reply UNKNOWN.",
    user: content.slice(0, 2500),
  });
  if (derived && !/UNKNOWN/i.test(derived) && derived.trim().length > 20) {
    citation = derived.trim().replace(/\s+/g, " ").slice(0, 300);
  }

  const docId = crypto.randomUUID();
  await db.insert(t.journalDocuments)
    .values({
      id: docId,
      tenantId: user.tenantId,
      pmid: null,
      citation,
      source: "pdf_upload",
      content,
      createdAt: new Date(),
    });
  await logAudit({
    tenantId: user.tenantId,
    entityType: "claim",
    entityId: docId,
    action: "journal_pdf_ingested",
    performedBy: user.id,
    details: { fileName: file.name, chars: content.length },
  });
  return { docId, citation };
}

// PubMed E-utilities lookup for the claim form: paste a PMID/DOI, get a
// formatted citation back. Free NCBI service — no API key involved.
export async function lookupReference(idRaw: string): Promise<ClaimReference | null> {
  const user = await requireUser();
  if (!CLAIM_MANAGER_ROLES.includes(user.role as (typeof CLAIM_MANAGER_ROLES)[number]))
    throw new Error("FORBIDDEN");
  return lookupPubmed(idRaw);
}

function parseReferences(formData: FormData): ClaimReference[] {
  try {
    const parsed = JSON.parse(String(formData.get("referencesJson") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is ClaimReference =>
          !!r && typeof r.citation === "string" && !!r.citation.trim(),
      )
      .map((r) => ({
        citation: r.citation.trim().slice(0, 600),
        pmid: typeof r.pmid === "string" && r.pmid ? r.pmid.slice(0, 20) : null,
        doi: typeof r.doi === "string" && r.doi ? r.doi.slice(0, 120) : null,
        url: typeof r.url === "string" && r.url ? r.url.slice(0, 500) : null,
        docId: typeof r.docId === "string" && r.docId ? r.docId.slice(0, 40) : null,
      }))
      .slice(0, 10);
  } catch {
    return [];
  }
}

export async function saveClaim(formData: FormData) {
  const user = await requireUser();
  if (!CLAIM_MANAGER_ROLES.includes(user.role as (typeof CLAIM_MANAGER_ROLES)[number]))
    throw new Error("FORBIDDEN");

  const id = String(formData.get("id") ?? "") || null;
  const productId = String(formData.get("productId") ?? "");
  const claimText = String(formData.get("claimText") ?? "").trim();
  const expiresAt = String(formData.get("expiresAt") ?? "");
  const channels = formData.getAll("channels").map(String);
  const references = parseReferences(formData);
  if (!productId || !claimText || !expiresAt) throw new Error("VALIDATION");

  if (id) {
    await db.update(t.approvedClaims)
      .set({
        productId,
        claimText,
        references,
        channelScope: channels,
        expiresAt: new Date(expiresAt),
      })
      .where(and(eq(t.approvedClaims.id, id), eq(t.approvedClaims.tenantId, user.tenantId)));
    await logAudit({
      tenantId: user.tenantId,
      entityType: "claim",
      entityId: id,
      action: "claim_updated",
      performedBy: user.id,
    });
  } else {
    const newId = crypto.randomUUID();
    await db.insert(t.approvedClaims)
      .values({
        id: newId,
        tenantId: user.tenantId,
        productId,
        claimText,
        references,
        channelScope: channels,
        approvedBy: user.id,
        approvedAt: new Date(),
        expiresAt: new Date(expiresAt),
        status: "active",
      });
    await logAudit({
      tenantId: user.tenantId,
      entityType: "claim",
      entityId: newId,
      action: "claim_created",
      performedBy: user.id,
    });
  }
  revalidatePath("/claims");
}

export async function expireClaim(formData: FormData) {
  const user = await requireUser();
  if (!CLAIM_MANAGER_ROLES.includes(user.role as (typeof CLAIM_MANAGER_ROLES)[number]))
    throw new Error("FORBIDDEN");
  const id = String(formData.get("id") ?? "");
  await db.update(t.approvedClaims)
    .set({ status: "expired", expiresAt: new Date() })
    .where(and(eq(t.approvedClaims.id, id), eq(t.approvedClaims.tenantId, user.tenantId)));
  await logAudit({
    tenantId: user.tenantId,
    entityType: "claim",
    entityId: id,
    action: "claim_expired",
    performedBy: user.id,
  });
  revalidatePath("/claims");
}

export type ExtractState = {
  candidates: string[];
  engine: "claude" | "heuristic";
  source: string;
} | null;

export async function extractClaimsFromDoc(
  _prev: ExtractState,
  formData: FormData,
): Promise<ExtractState> {
  const user = await requireUser();
  if (!CLAIM_MANAGER_ROLES.includes(user.role as (typeof CLAIM_MANAGER_ROLES)[number]))
    throw new Error("FORBIDDEN");

  let text = String(formData.get("docText") ?? "").trim();
  let source = "SOP (teks tempel)";
  const file = formData.get("docFile");
  if (file instanceof File && file.size > 0) {
    text = `${text}\n${Buffer.from(await file.arrayBuffer()).toString("utf-8")}`.trim();
    source = file.name;
  }
  if (!text) return null;

  const { candidates, engine } = await extractClaimCandidates(text);
  return { candidates, engine, source };
}

export async function importClaims(formData: FormData) {
  const user = await requireUser();
  if (!CLAIM_MANAGER_ROLES.includes(user.role as (typeof CLAIM_MANAGER_ROLES)[number]))
    throw new Error("FORBIDDEN");

  const productId = String(formData.get("productId") ?? "");
  const expiresAt = String(formData.get("expiresAt") ?? "");
  const source = String(formData.get("source") ?? "") || null;
  const channels = formData.getAll("channels").map(String);
  const claims = formData.getAll("claims").map(String).filter(Boolean);
  if (!productId || !expiresAt || !claims.length) throw new Error("VALIDATION");

  for (const claimText of claims) {
    const id = crypto.randomUUID();
    await db.insert(t.approvedClaims)
      .values({
        id,
        tenantId: user.tenantId,
        productId,
        claimText,
        source,
        channelScope: channels,
        approvedBy: user.id,
        approvedAt: new Date(),
        expiresAt: new Date(expiresAt),
        status: "active",
      });
    await logAudit({
      tenantId: user.tenantId,
      entityType: "claim",
      entityId: id,
      action: "claim_created",
      performedBy: user.id,
      details: { source: source ?? undefined },
    });
  }
  revalidatePath("/claims");
}

/* ----------------------------- settings ---------------------------- */

export async function saveWorkflow(formData: FormData) {
  const user = await requireUser();
  if (!["compliance_admin", "super_admin"].includes(user.role)) throw new Error("FORBIDDEN");

  const channel = String(formData.get("channel") ?? "");
  const stages = formData.getAll("stages").map(String).filter(Boolean);
  if (!channel || !stages.length) throw new Error("VALIDATION");

  // Per-channel workflow configuration is a Growth+ feature (PRD §12);
  // Starter tenants run the default 3-stage sequential workflow.
  const wfTenant = (await db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)))[0];
  if (!planHas(wfTenant?.plan, "customWorkflows")) throw new Error("PLAN_FEATURE");

  const existing = (await db
    .select()
    .from(t.workflowTemplates)
    .where(
      and(
        eq(t.workflowTemplates.tenantId, user.tenantId),
        eq(t.workflowTemplates.channel, channel),
      ),
    )
    )[0];

  if (existing) {
    await db.update(t.workflowTemplates)
      .set({ stages })
      .where(eq(t.workflowTemplates.id, existing.id));
  } else {
    await db.insert(t.workflowTemplates)
      .values({
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        channel,
        stages,
        mode: "sequential",
      });
  }

  await logAudit({
    tenantId: user.tenantId,
    entityType: "workflow",
    entityId: channel,
    action: "workflow_updated",
    performedBy: user.id,
    details: { stages },
  });
  revalidatePath("/settings");
}

const TEAMMATE_ROLES = [
  "marketing",
  "medical_reviewer",
  "legal_reviewer",
  "regulatory_reviewer",
  "compliance_admin",
  "super_admin",
] as const;

// Invited teammates get no usable password at creation time — they set one
// via the invite link, so a shared/typo'd admin-set password can never be
// the actual credential in use (closes the account-identity gap: every
// login is provably tied to whoever clicked the link sent to that inbox).
export async function createTeammate(formData: FormData) {
  const user = await requireUser();
  if (!["compliance_admin", "super_admin"].includes(user.role)) throw new Error("FORBIDDEN");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");

  // Thrown errors are masked by Next.js in production, so expected failures
  // are returned as codes for the form to translate.
  if (!name || !email || !TEAMMATE_ROLES.includes(role as (typeof TEAMMATE_ROLES)[number])) {
    return { error: "VALIDATION" };
  }
  if ((await db.select().from(t.users).where(eq(t.users.email, email)))[0]) {
    return { error: "EMAIL_TAKEN" };
  }

  // Plan quota (PRD §12): starter 15 users, growth 50.
  const [tenant, existingUsers] = await Promise.all([
    db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)),
    db.select({ id: t.users.id }).from(t.users).where(eq(t.users.tenantId, user.tenantId)),
  ]);
  if (existingUsers.length >= planLimits(tenant[0]?.plan).users) {
    return { error: "PLAN_LIMIT" };
  }

  const teammateId = crypto.randomUUID();
  await db.insert(t.users)
    .values({
      id: teammateId,
      tenantId: user.tenantId,
      email,
      name,
      role,
      // Unguessable placeholder — nobody is ever told this value. Login is
      // blocked anyway until emailVerifiedAt is set via the invite link.
      passwordHash: hashPassword(crypto.randomUUID()),
      emailVerifiedAt: null,
      createdAt: new Date(),
    });

  await logAudit({
    tenantId: user.tenantId,
    entityType: "user",
    entityId: teammateId,
    action: "teammate_invited",
    performedBy: user.id,
    details: { email, role },
  });

  const token = await createAccountToken(teammateId, "invite");
  await sendInviteEmail(email, name, tenant[0]?.name ?? "MLR Flow", token);

  revalidatePath("/settings");
  return {};
}

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "VALIDATION" };

  const found = await findAccountToken(token);
  if (!found || found.purpose !== "invite") return { error: "INVALID_TOKEN" };

  await db
    .update(t.users)
    .set({ passwordHash: hashPassword(password), emailVerifiedAt: new Date() })
    .where(eq(t.users.id, found.userId));
  await consumeAccountToken(token);
  await logAudit({
    tenantId: found.user.tenantId,
    entityType: "user",
    entityId: found.userId,
    action: "invite_accepted",
    performedBy: found.userId,
  });

  await createSession(found.userId);
  redirect("/dashboard");
}

// Products are the anchor for claims and submissions; without one a fresh
// tenant can't submit anything, so admins manage them from Settings.
export async function createProduct(formData: FormData) {
  const user = await requireUser();
  if (!["compliance_admin", "super_admin"].includes(user.role)) throw new Error("FORBIDDEN");

  const name = String(formData.get("name") ?? "").trim();
  const bpomRegistrationNo = String(formData.get("bpomRegistrationNo") ?? "").trim() || null;
  if (!name) return { error: "VALIDATION" };

  // Plan quota (PRD §12): starter 3 products, growth 15.
  const [tenant, existing] = await Promise.all([
    db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)),
    db.select({ id: t.products.id }).from(t.products).where(eq(t.products.tenantId, user.tenantId)),
  ]);
  if (existing.length >= planLimits(tenant[0]?.plan).products) {
    return { error: "PLAN_LIMIT" };
  }

  const productId = crypto.randomUUID();
  await db.insert(t.products).values({
    id: productId,
    tenantId: user.tenantId,
    name,
    bpomRegistrationNo,
    createdAt: new Date(),
  });

  await logAudit({
    tenantId: user.tenantId,
    entityType: "product",
    entityId: productId,
    action: "product_added",
    performedBy: user.id,
    details: { name, bpomRegistrationNo: bpomRegistrationNo ?? undefined },
  });
  revalidatePath("/", "layout");
  return {};
}
