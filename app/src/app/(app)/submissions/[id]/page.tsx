import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db, t } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { diffParagraphs } from "@/lib/diff";
import { ReviewWorkspace, type WorkspaceData } from "@/components/review-workspace";

export default async function SubmissionDetailPage(
  props: PageProps<"/submissions/[id]">,
) {
  const user = await requireUser();
  const { dict, locale } = await getDict();
  const { id } = await props.params;
  const sp = await props.searchParams;

  const sub = db
    .select()
    .from(t.contentSubmissions)
    .where(
      and(eq(t.contentSubmissions.id, id), eq(t.contentSubmissions.tenantId, user.tenantId)),
    )
    .get();
  if (!sub) notFound();

  const product = db.select().from(t.products).where(eq(t.products.id, sub.productId)).get();
  const tenantUsers = db
    .select()
    .from(t.users)
    .where(eq(t.users.tenantId, user.tenantId))
    .all();
  const userName = (uid: string | null) =>
    tenantUsers.find((u) => u.id === uid)?.name ?? "—";

  const versions = db
    .select()
    .from(t.contentVersions)
    .where(eq(t.contentVersions.submissionId, sub.id))
    .orderBy(asc(t.contentVersions.versionNumber))
    .all();
  const requestedV = typeof sp.v === "string" ? Number(sp.v) : NaN;
  const version =
    versions.find((v) => v.versionNumber === requestedV) ?? versions[versions.length - 1];
  const isLatest = version.id === versions[versions.length - 1].id;

  const pages = db
    .select()
    .from(t.contentVersionPages)
    .where(eq(t.contentVersionPages.versionId, version.id))
    .orderBy(asc(t.contentVersionPages.pageNumber))
    .all();
  const elements = db
    .select()
    .from(t.contentElements)
    .where(eq(t.contentElements.versionId, version.id))
    .all();
  const flags = db
    .select()
    .from(t.claimFlags)
    .where(eq(t.claimFlags.versionId, version.id))
    .all();
  const comments = db
    .select()
    .from(t.reviewComments)
    .where(eq(t.reviewComments.versionId, version.id))
    .orderBy(asc(t.reviewComments.createdAt))
    .all();
  const stages = db
    .select()
    .from(t.reviewStages)
    .where(eq(t.reviewStages.submissionId, sub.id))
    .orderBy(asc(t.reviewStages.stageOrder))
    .all();

  const claimIds = flags.map((f) => f.matchedClaimId).filter((x): x is string => !!x);
  const claims = claimIds.length
    ? db.select().from(t.approvedClaims).where(inArray(t.approvedClaims.id, claimIds)).all()
    : [];

  const versionIds = versions.map((v) => v.id);
  const audit = db
    .select()
    .from(t.auditLog)
    .where(eq(t.auditLog.tenantId, user.tenantId))
    .orderBy(desc(t.auditLog.createdAt))
    .all()
    .filter((a) => a.entityId === sub.id || versionIds.includes(a.entityId))
    .slice(0, 12);

  // Diff vs the immediately preceding version (text-based versions only)
  const versionIdx = versions.findIndex((v) => v.id === version.id);
  const prevVersion = versionIdx > 0 ? versions[versionIdx - 1] : null;
  const diff =
    prevVersion && prevVersion.textContent && version.textContent
      ? diffParagraphs(prevVersion.textContent, version.textContent)
      : null;

  // Open comments from all versions before the one being viewed, with the
  // element text they were pinned to (elements belong to their own version).
  const priorVersionIds = versions.slice(0, versionIdx).map((v) => v.id);
  const prevOpenComments = priorVersionIds.length
    ? db
        .select()
        .from(t.reviewComments)
        .where(inArray(t.reviewComments.versionId, priorVersionIds))
        .all()
        .filter((c) => !c.resolved)
        .map((c) => {
          const el = c.elementId
            ? db
                .select()
                .from(t.contentElements)
                .where(eq(t.contentElements.id, c.elementId))
                .get()
            : null;
          const v = versions.find((x) => x.id === c.versionId);
          return {
            id: c.id,
            reviewerName: userName(c.reviewerId),
            comment: c.comment,
            createdAt: c.createdAt.getTime(),
            versionNumber: v?.versionNumber ?? 0,
            elementText: el?.extractedText ?? null,
          };
        })
    : [];

  const activeStage = stages.find((s) => s.status === "in_progress");
  const canReview =
    isLatest &&
    sub.status === "in_review" &&
    !!activeStage &&
    (user.role === activeStage.reviewerRole ||
      ["super_admin", "compliance_admin"].includes(user.role));
  const canResubmit =
    isLatest &&
    sub.status !== "approved" &&
    ["marketing", "super_admin"].includes(user.role);

  const data: WorkspaceData = {
    submission: {
      id: sub.id,
      title: sub.title,
      status: sub.status,
      channel: sub.channel ?? "print",
      targetAudience: sub.targetAudience,
      currentStage: sub.currentStage,
      submittedBy: userName(sub.submittedBy),
      createdAt: sub.createdAt.getTime(),
      productName: product?.name ?? "—",
      bpomNo: product?.bpomRegistrationNo ?? null,
    },
    versions: versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      isLocked: v.isLocked,
      createdAt: v.createdAt.getTime(),
      fileName: v.fileName,
    })),
    currentVersion: {
      id: version.id,
      versionNumber: version.versionNumber,
      isLocked: version.isLocked,
      processingStatus: version.processingStatus,
      changeNote: version.changeNote,
      fileName: version.fileName,
      hasOriginalFile:
        !!version.fileName &&
        fs.existsSync(path.join(process.cwd(), ".data", "uploads", version.id)),
    },
    diff,
    prevOpenComments,
    pages: pages.map((p) => ({
      id: p.id,
      pageNumber: p.pageNumber,
      width: p.width,
      height: p.height,
    })),
    elements: elements.map((el) => ({
      id: el.id,
      pageNumber: el.pageNumber,
      elementType: el.elementType,
      extractionMethod: el.extractionMethod,
      extractedText: el.extractedText,
      ocrConfidence: el.ocrConfidence,
      boundingBox: el.boundingBox,
      requiresManualReview: el.requiresManualReview,
    })),
    flags: flags.map((f) => {
      const matched = claims.find((c) => c.id === f.matchedClaimId);
      return {
        id: f.id,
        elementId: f.elementId,
        flaggedText: f.flaggedText,
        matchedClaimText: matched?.claimText ?? null,
        matchedClaimRefs: matched?.references ?? [],
        similarityScore: f.similarityScore,
        flagType: f.flagType,
        reviewerDecision: f.reviewerDecision,
        decidedBy: userName(f.decidedBy),
      };
    }),
    comments: comments.map((c) => ({
      id: c.id,
      elementId: c.elementId,
      reviewerName: userName(c.reviewerId),
      comment: c.comment,
      resolved: c.resolved,
      createdAt: c.createdAt.getTime(),
    })),
    stages: stages.map((s) => ({
      id: s.id,
      stageOrder: s.stageOrder,
      reviewerRole: s.reviewerRole,
      assignedTo: userName(s.assignedTo),
      status: s.status,
      decidedAt: s.decidedAt?.getTime() ?? null,
      decisionNote: s.decisionNote,
    })),
    audit: audit.map((a) => ({
      id: a.id,
      action: a.action,
      performedBy: userName(a.performedBy),
      createdAt: a.createdAt.getTime(),
      details: a.details,
    })),
    activeStageId: activeStage?.id ?? null,
    canReview,
    canResubmit,
    isLatest,
  };

  return <ReviewWorkspace data={data} dict={dict} locale={locale} />;
}
