"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import fs from "node:fs";
import path from "node:path";
import { db, t } from "./db";
import {
  createSession,
  destroySession,
  requireUser,
  verifyPassword,
  REVIEWER_ROLES,
  CLAIM_MANAGER_ROLES,
} from "./auth";
import { logAudit } from "./audit";
import { runClaimsCheck } from "./claims-check";
import { extractClaimCandidates } from "./claims-extract";
import { renderTextPages, renderFilePlaceholderPage } from "./svg";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

/* ----------------------------- session ----------------------------- */

export async function login(_prev: { error: string } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = db.select().from(t.users).where(eq(t.users.email, email)).get();
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "invalid" };
  }
  await createSession(user.id);
  logAudit({
    tenantId: user.tenantId,
    entityType: "user",
    entityId: user.id,
    action: "logged_in",
    performedBy: user.id,
  });
  redirect("/dashboard");
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

function stagesForChannel(tenantId: string, channel: string): string[] {
  const wf = db
    .select()
    .from(t.workflowTemplates)
    .where(
      and(
        eq(t.workflowTemplates.tenantId, tenantId),
        eq(t.workflowTemplates.channel, channel),
      ),
    )
    .get();
  return wf?.stages ?? DEFAULT_STAGES;
}

function defaultAssignee(tenantId: string, role: string): string | null {
  const u = db
    .select()
    .from(t.users)
    .where(and(eq(t.users.tenantId, tenantId), eq(t.users.role, role)))
    .get();
  return u?.id ?? null;
}

function createVersionWithPipeline(opts: {
  tenantId: string;
  submissionId: string;
  productId: string;
  versionNumber: number;
  title: string;
  subtitle: string;
  text: string | null;
  fileName: string | null;
}): { versionId: string; flags: number } {
  const versionId = crypto.randomUUID();
  db.insert(t.contentVersions)
    .values({
      id: versionId,
      submissionId: opts.submissionId,
      versionNumber: opts.versionNumber,
      fileName: opts.fileName,
      textContent: opts.text,
      isLocked: false,
      processingStatus: "ready",
      createdAt: new Date(),
    })
    .run();

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
    for (const p of pages) {
      db.insert(t.contentVersionPages)
        .values({
          id: crypto.randomUUID(),
          versionId,
          pageNumber: p.pageNumber,
          renderedSvg: p.svg,
          width: p.width,
          height: p.height,
        })
        .run();
    }
    for (const el of elements) {
      db.insert(t.contentElements)
        .values({
          id: crypto.randomUUID(),
          versionId,
          pageNumber: el.pageNumber,
          elementType: el.elementType,
          extractionMethod: "native_text",
          extractedText: el.text,
          boundingBox: el.bbox,
        })
        .run();
    }
  }

  if (opts.fileName) {
    const page = renderFilePlaceholderPage(opts.fileName, opts.title);
    const pageNumber = opts.text
      ? (db.select().from(t.contentVersionPages).where(eq(t.contentVersionPages.versionId, versionId)).all().length + 1)
      : 1;
    db.insert(t.contentVersionPages)
      .values({
        id: crypto.randomUUID(),
        versionId,
        pageNumber,
        renderedSvg: page.svg,
        width: page.width,
        height: page.height,
      })
      .run();
    db.insert(t.contentElements)
      .values({
        id: crypto.randomUUID(),
        versionId,
        pageNumber,
        elementType: "image",
        extractionMethod: "manual",
        extractedText: null,
        boundingBox: { x: 84, y: 200, width: 1072, height: 380 },
        requiresManualReview: true,
      })
      .run();
  }

  return { versionId, flags: 0 };
}

export async function createSubmission(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const productId = String(formData.get("productId") ?? "");
  const channel = String(formData.get("channel") ?? "print");
  const audience = String(formData.get("audience") ?? "hcp");
  const text = String(formData.get("text") ?? "").trim() || null;
  const file = formData.get("file");
  const fileName =
    file instanceof File && file.size > 0 ? file.name : null;

  if (!title || !productId || (!text && !fileName)) {
    throw new Error("VALIDATION");
  }

  const product = db
    .select()
    .from(t.products)
    .where(and(eq(t.products.id, productId), eq(t.products.tenantId, user.tenantId)))
    .get();
  if (!product) throw new Error("NOT_FOUND");

  const submissionId = crypto.randomUUID();
  const stageRoles = stagesForChannel(user.tenantId, channel);

  db.insert(t.contentSubmissions)
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
    })
    .run();

  stageRoles.forEach((role, i) => {
    db.insert(t.reviewStages)
      .values({
        id: crypto.randomUUID(),
        submissionId,
        stageOrder: i + 1,
        reviewerRole: role,
        assignedTo: defaultAssignee(user.tenantId, role),
        status: i === 0 ? "in_progress" : "pending",
      })
      .run();
  });

  const { versionId } = createVersionWithPipeline({
    tenantId: user.tenantId,
    submissionId,
    productId,
    versionNumber: 1,
    title,
    subtitle: `${product.name} — ${channel}`,
    text,
    fileName,
  });

  // Persist the original upload so the approved master can be downloaded later
  // (production: S3/R2 with versioned object keys)
  if (file instanceof File && file.size > 0) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(UPLOAD_DIR, versionId),
      Buffer.from(await file.arrayBuffer()),
    );
  }

  logAudit({
    tenantId: user.tenantId,
    entityType: "submission",
    entityId: submissionId,
    action: "submitted",
    performedBy: user.id,
    details: { version: "v1", title },
  });

  const flags = await runClaimsCheck({ versionId, productId, tenantId: user.tenantId });
  logAudit({
    tenantId: user.tenantId,
    entityType: "version",
    entityId: versionId,
    action: "claims_check_completed",
    performedBy: user.id,
    details: { version: "v1", flags },
  });

  revalidatePath("/", "layout");
  redirect(`/submissions/${submissionId}`);
}

export async function resubmitVersion(formData: FormData) {
  const user = await requireUser();
  const submissionId = String(formData.get("submissionId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const changeNote = String(formData.get("changeNote") ?? "").trim();
  if (!text || !changeNote) throw new Error("VALIDATION");

  const sub = db
    .select()
    .from(t.contentSubmissions)
    .where(
      and(
        eq(t.contentSubmissions.id, submissionId),
        eq(t.contentSubmissions.tenantId, user.tenantId),
      ),
    )
    .get();
  if (!sub) throw new Error("NOT_FOUND");
  if (sub.status === "approved") throw new Error("LOCKED");

  const versions = db
    .select()
    .from(t.contentVersions)
    .where(eq(t.contentVersions.submissionId, submissionId))
    .all();
  const nextVersion = Math.max(...versions.map((v) => v.versionNumber)) + 1;

  const product = db.select().from(t.products).where(eq(t.products.id, sub.productId)).get();

  const { versionId } = createVersionWithPipeline({
    tenantId: user.tenantId,
    submissionId,
    productId: sub.productId,
    versionNumber: nextVersion,
    title: sub.title,
    subtitle: `${product?.name ?? ""} — ${sub.channel ?? ""} — v${nextVersion}`,
    text,
    fileName: null,
  });
  db.update(t.contentVersions)
    .set({ changeNote })
    .where(eq(t.contentVersions.id, versionId))
    .run();

  // Reset the review workflow: fresh stages from the tenant template
  db.delete(t.reviewStages).where(eq(t.reviewStages.submissionId, submissionId)).run();
  const stageRoles = stagesForChannel(user.tenantId, sub.channel ?? "print");
  stageRoles.forEach((role, i) => {
    db.insert(t.reviewStages)
      .values({
        id: crypto.randomUUID(),
        submissionId,
        stageOrder: i + 1,
        reviewerRole: role,
        assignedTo: defaultAssignee(user.tenantId, role),
        status: i === 0 ? "in_progress" : "pending",
      })
      .run();
  });

  db.update(t.contentSubmissions)
    .set({ status: "in_review", currentStage: stageRoles[0], decidedAt: null })
    .where(eq(t.contentSubmissions.id, submissionId))
    .run();

  logAudit({
    tenantId: user.tenantId,
    entityType: "submission",
    entityId: submissionId,
    action: "resubmitted",
    performedBy: user.id,
    details: { version: `v${nextVersion}`, changeNote },
  });

  const flags = await runClaimsCheck({
    versionId,
    productId: sub.productId,
    tenantId: user.tenantId,
  });
  logAudit({
    tenantId: user.tenantId,
    entityType: "version",
    entityId: versionId,
    action: "claims_check_completed",
    performedBy: user.id,
    details: { version: `v${nextVersion}`, flags },
  });

  revalidatePath("/", "layout");
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

  const stage = db.select().from(t.reviewStages).where(eq(t.reviewStages.id, stageId)).get();
  if (!stage) throw new Error("NOT_FOUND");

  const sub = db
    .select()
    .from(t.contentSubmissions)
    .where(
      and(
        eq(t.contentSubmissions.id, stage.submissionId),
        eq(t.contentSubmissions.tenantId, user.tenantId),
      ),
    )
    .get();
  if (!sub) throw new Error("NOT_FOUND");

  const canDecide =
    user.role === stage.reviewerRole ||
    user.role === "super_admin" ||
    user.role === "compliance_admin";
  if (!canDecide || stage.status === "approved") throw new Error("FORBIDDEN");

  const versions = db
    .select()
    .from(t.contentVersions)
    .where(eq(t.contentVersions.submissionId, sub.id))
    .orderBy(asc(t.contentVersions.versionNumber))
    .all();
  const currentVersion = versions[versions.length - 1];

  // Follow-up enforcement: a stage cannot be approved while comments from
  // previous versions are still unresolved (the reviewer must verify each
  // piece of feedback was actually addressed).
  if (decision === "approved" && versions.length > 1) {
    const prevIds = versions.slice(0, -1).map((v) => v.id);
    const openPrev = db
      .select()
      .from(t.reviewComments)
      .where(inArray(t.reviewComments.versionId, prevIds))
      .all()
      .filter((c) => !c.resolved).length;
    if (openPrev > 0) throw new Error("PREV_COMMENTS_OPEN");
  }

  db.update(t.reviewStages)
    .set({ status: decision, decidedAt: new Date(), decisionNote: note })
    .where(eq(t.reviewStages.id, stageId))
    .run();

  if (decision === "approved") {
    const stages = db
      .select()
      .from(t.reviewStages)
      .where(eq(t.reviewStages.submissionId, sub.id))
      .orderBy(asc(t.reviewStages.stageOrder))
      .all();
    const next = stages.find((s) => s.status === "pending");
    if (next) {
      db.update(t.reviewStages)
        .set({ status: "in_progress" })
        .where(eq(t.reviewStages.id, next.id))
        .run();
      db.update(t.contentSubmissions)
        .set({ currentStage: next.reviewerRole })
        .where(eq(t.contentSubmissions.id, sub.id))
        .run();
    } else {
      // Final approval: lock the version (immutability NFR)
      db.update(t.contentSubmissions)
        .set({ status: "approved", currentStage: null, decidedAt: new Date() })
        .where(eq(t.contentSubmissions.id, sub.id))
        .run();
      db.update(t.contentVersions)
        .set({ isLocked: true })
        .where(eq(t.contentVersions.id, currentVersion.id))
        .run();
      logAudit({
        tenantId: user.tenantId,
        entityType: "version",
        entityId: currentVersion.id,
        action: "version_locked",
        performedBy: user.id,
        details: { version: `v${currentVersion.versionNumber}` },
      });
    }
  } else if (decision === "changes_requested") {
    db.update(t.contentSubmissions)
      .set({ status: "changes_requested" })
      .where(eq(t.contentSubmissions.id, sub.id))
      .run();
  } else {
    db.update(t.contentSubmissions)
      .set({ status: "rejected", currentStage: null, decidedAt: new Date() })
      .where(eq(t.contentSubmissions.id, sub.id))
      .run();
  }

  logAudit({
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

  const id = crypto.randomUUID();
  db.insert(t.reviewComments)
    .values({
      id,
      versionId,
      elementId,
      reviewerId: user.id,
      comment,
      resolved: false,
      createdAt: new Date(),
    })
    .run();

  logAudit({
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
  db.update(t.reviewComments)
    .set({ resolved: true })
    .where(eq(t.reviewComments.id, commentId))
    .run();
  logAudit({
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

  db.update(t.claimFlags)
    .set({ reviewerDecision: decision, decidedBy: user.id })
    .where(eq(t.claimFlags.id, flagId))
    .run();
  logAudit({
    tenantId: user.tenantId,
    entityType: "flag",
    entityId: flagId,
    action: "flag_decided",
    performedBy: user.id,
    details: { decision },
  });
  revalidatePath("/", "layout");
}

/* ------------------------------ claims ----------------------------- */

export async function saveClaim(formData: FormData) {
  const user = await requireUser();
  if (!CLAIM_MANAGER_ROLES.includes(user.role as (typeof CLAIM_MANAGER_ROLES)[number]))
    throw new Error("FORBIDDEN");

  const id = String(formData.get("id") ?? "") || null;
  const productId = String(formData.get("productId") ?? "");
  const claimText = String(formData.get("claimText") ?? "").trim();
  const expiresAt = String(formData.get("expiresAt") ?? "");
  const channels = formData.getAll("channels").map(String);
  if (!productId || !claimText || !expiresAt) throw new Error("VALIDATION");

  if (id) {
    db.update(t.approvedClaims)
      .set({
        productId,
        claimText,
        channelScope: channels,
        expiresAt: new Date(expiresAt),
      })
      .where(and(eq(t.approvedClaims.id, id), eq(t.approvedClaims.tenantId, user.tenantId)))
      .run();
    logAudit({
      tenantId: user.tenantId,
      entityType: "claim",
      entityId: id,
      action: "claim_updated",
      performedBy: user.id,
    });
  } else {
    const newId = crypto.randomUUID();
    db.insert(t.approvedClaims)
      .values({
        id: newId,
        tenantId: user.tenantId,
        productId,
        claimText,
        channelScope: channels,
        approvedBy: user.id,
        approvedAt: new Date(),
        expiresAt: new Date(expiresAt),
        status: "active",
      })
      .run();
    logAudit({
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
  db.update(t.approvedClaims)
    .set({ status: "expired", expiresAt: new Date() })
    .where(and(eq(t.approvedClaims.id, id), eq(t.approvedClaims.tenantId, user.tenantId)))
    .run();
  logAudit({
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
    db.insert(t.approvedClaims)
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
      })
      .run();
    logAudit({
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

  const existing = db
    .select()
    .from(t.workflowTemplates)
    .where(
      and(
        eq(t.workflowTemplates.tenantId, user.tenantId),
        eq(t.workflowTemplates.channel, channel),
      ),
    )
    .get();

  if (existing) {
    db.update(t.workflowTemplates)
      .set({ stages })
      .where(eq(t.workflowTemplates.id, existing.id))
      .run();
  } else {
    db.insert(t.workflowTemplates)
      .values({
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        channel,
        stages,
        mode: "sequential",
      })
      .run();
  }

  logAudit({
    tenantId: user.tenantId,
    entityType: "workflow",
    entityId: channel,
    action: "workflow_updated",
    performedBy: user.id,
    details: { stages },
  });
  revalidatePath("/settings");
}
