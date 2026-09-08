import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { storage } from "@/lib/storage";
import { db, t } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { diffParagraphs } from "@/lib/diff";
import { planHas } from "@/lib/plans";
import { ReviewWorkspace, type WorkspaceData } from "@/components/review-workspace";

export default async function SubmissionDetailPage(
  props: PageProps<"/submissions/[id]">,
) {
  const user = await requireUser();
  const { dict, locale } = await getDict();
  const { id } = await props.params;
  const sp = await props.searchParams;

  const sub = (await db
    .select()
    .from(t.contentSubmissions)
    .where(
      and(eq(t.contentSubmissions.id, id), eq(t.contentSubmissions.tenantId, user.tenantId)),
    )
    )[0];
  if (!sub) notFound();

  // Independent of each other — run together instead of one round-trip at a
  // time (each pays full network latency to the database separately).
  const [product, tenantUsers, versions, stages, tenant, productClaims] = await Promise.all([
    db.select().from(t.products).where(eq(t.products.id, sub.productId)).then((r) => r[0]),
    db.select().from(t.users).where(eq(t.users.tenantId, user.tenantId)),
    db
      // Everything but fileData — the bytes are served by /api/files/[id],
      // never by this page. textContent is needed for the version diff.
      .select({
        id: t.contentVersions.id,
        submissionId: t.contentVersions.submissionId,
        versionNumber: t.contentVersions.versionNumber,
        fileName: t.contentVersions.fileName,
        textContent: t.contentVersions.textContent,
        changeNote: t.contentVersions.changeNote,
        isLocked: t.contentVersions.isLocked,
        processingStatus: t.contentVersions.processingStatus,
        createdAt: t.contentVersions.createdAt,
      })
      .from(t.contentVersions)
      .where(eq(t.contentVersions.submissionId, sub.id))
      .orderBy(asc(t.contentVersions.versionNumber)),
    db
      .select()
      .from(t.reviewStages)
      .where(eq(t.reviewStages.submissionId, sub.id))
      .orderBy(asc(t.reviewStages.stageOrder)),
    db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)).then((r) => r[0]),
    // Does this product's library carry any journal (PMID)? Drives whether
    // the "check against journal" action is offered on flags.
    db
      .select({ references: t.approvedClaims.references })
      .from(t.approvedClaims)
      .where(
        and(
          eq(t.approvedClaims.tenantId, user.tenantId),
          eq(t.approvedClaims.productId, sub.productId),
          eq(t.approvedClaims.status, "active"),
        ),
      ),
  ]);
  const userName = (uid: string | null) =>
    tenantUsers.find((u) => u.id === uid)?.name ?? "—";
  const libraryHasJournals = productClaims.some((c) =>
    (c.references ?? []).some((r) => r.pmid || r.docId),
  );
  // Journal substantiation is plan-gated (Growth+, PRD §12) — Starter sees an
  // upgrade hint where the button would be.
  const journalCheckAllowed = planHas(tenant?.plan, "journalSubstantiation");

  const requestedV = typeof sp.v === "string" ? Number(sp.v) : NaN;
  const version =
    versions.find((v) => v.versionNumber === requestedV) ?? versions[versions.length - 1];
  const isLatest = version.id === versions[versions.length - 1].id;
  const versionIds = versions.map((v) => v.id);
  const versionIdx = versions.findIndex((v) => v.id === version.id);
  const prevVersion = versionIdx > 0 ? versions[versionIdx - 1] : null;
  const priorVersionIds = versions.slice(0, versionIdx).map((v) => v.id);

  // All scoped to the resolved version (or, for audit/prior comments, the
  // submission's version set) — independent of each other, so run together.
  const [pages, elements, flags, comments, hasOriginalFile, audit, priorComments] =
    await Promise.all([
      db
        // Not renderedSvg: the viewer loads each page from /api/pages/[id].
        .select({
          id: t.contentVersionPages.id,
          pageNumber: t.contentVersionPages.pageNumber,
          width: t.contentVersionPages.width,
          height: t.contentVersionPages.height,
        })
        .from(t.contentVersionPages)
        .where(eq(t.contentVersionPages.versionId, version.id))
        .orderBy(asc(t.contentVersionPages.pageNumber)),
      db.select().from(t.contentElements).where(eq(t.contentElements.versionId, version.id)),
      db.select().from(t.claimFlags).where(eq(t.claimFlags.versionId, version.id)),
      db
        .select()
        .from(t.reviewComments)
        .where(eq(t.reviewComments.versionId, version.id))
        .orderBy(asc(t.reviewComments.createdAt)),
      version.fileName ? storage.exists(version.id) : Promise.resolve(false),
      // Filtered and limited in SQL, not "fetch the tenant's whole audit
      // history and slice(0, 12) in JS" — that grows slower as the tenant
      // accumulates history, for no benefit since only 12 rows are shown.
      db
        .select()
        .from(t.auditLog)
        .where(
          and(
            eq(t.auditLog.tenantId, user.tenantId),
            inArray(t.auditLog.entityId, [sub.id, ...versionIds]),
          ),
        )
        .orderBy(desc(t.auditLog.createdAt))
        .limit(12),
      // Open comments from versions before the one being viewed.
      priorVersionIds.length
        ? db
            .select()
            .from(t.reviewComments)
            .where(inArray(t.reviewComments.versionId, priorVersionIds))
            .then((rows) => rows.filter((c) => !c.resolved))
        : Promise.resolve([]),
    ]);

  const diff =
    prevVersion && prevVersion.textContent && version.textContent
      ? diffParagraphs(prevVersion.textContent, version.textContent)
      : null;

  const claimIds = flags.map((f) => f.matchedClaimId).filter((x): x is string => !!x);
  // The elements prior-version comments are pinned to, batched into one
  // query instead of one round-trip per comment.
  const priorElementIds = priorComments
    .map((c) => c.elementId)
    .filter((x): x is string => !!x);
  const [claims, priorElements] = await Promise.all([
    claimIds.length
      ? db.select().from(t.approvedClaims).where(inArray(t.approvedClaims.id, claimIds))
      : Promise.resolve([]),
    priorElementIds.length
      ? db.select().from(t.contentElements).where(inArray(t.contentElements.id, priorElementIds))
      : Promise.resolve([]),
  ]);

  const prevOpenComments = priorComments.map((c) => {
    const el = c.elementId ? priorElements.find((e) => e.id === c.elementId) : null;
    const v = versions.find((x) => x.id === c.versionId);
    return {
      id: c.id,
      reviewerName: userName(c.reviewerId),
      comment: c.comment,
      createdAt: c.createdAt.getTime(),
      versionNumber: v?.versionNumber ?? 0,
      elementText: el?.extractedText ?? null,
    };
  });

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
      hasOriginalFile,
    },
    diff,
    libraryHasJournals,
    journalCheckAllowed,
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
        journalVerdict: f.journalVerdict,
        journalNote: f.journalNote,
        journalPmid: f.journalPmid,
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
