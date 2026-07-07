"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft,
  Sparkles,
  Eye,
  MessageSquare,
  Lock,
  CheckCircle2,
  History,
  ScanEye,
  RefreshCw,
  ListChecks,
  GitCompareArrows,
  StickyNote,
  FileDown,
  Download,
} from "lucide-react";
import {
  addComment,
  decideFlag,
  decideStage,
  resolveComment,
  resubmitVersion,
} from "@/lib/actions";
import type { Dict, Locale } from "@/lib/i18n";
import { formatDate, relativeDays } from "@/lib/i18n";
import { Avatar, Card, Chip, StatusBadge } from "@/components/ui";

type Bbox = { x: number; y: number; width: number; height: number } | null;

export type WorkspaceData = {
  submission: {
    id: string;
    title: string;
    status: string;
    channel: string;
    targetAudience: string | null;
    currentStage: string | null;
    submittedBy: string;
    createdAt: number;
    productName: string;
    bpomNo: string | null;
  };
  versions: Array<{
    id: string;
    versionNumber: number;
    isLocked: boolean;
    createdAt: number;
    fileName: string | null;
  }>;
  currentVersion: {
    id: string;
    versionNumber: number;
    isLocked: boolean;
    processingStatus: string;
    changeNote: string | null;
    fileName: string | null;
    hasOriginalFile: boolean;
  };
  diff: Array<{ type: "same" | "added" | "removed"; text: string }> | null;
  prevOpenComments: Array<{
    id: string;
    reviewerName: string;
    comment: string;
    createdAt: number;
    versionNumber: number;
    elementText: string | null;
  }>;
  pages: Array<{ id: string; pageNumber: number; width: number; height: number }>;
  elements: Array<{
    id: string;
    pageNumber: number;
    elementType: string;
    extractionMethod: string;
    extractedText: string | null;
    ocrConfidence: number | null;
    boundingBox: Bbox;
    requiresManualReview: boolean;
  }>;
  flags: Array<{
    id: string;
    elementId: string | null;
    flaggedText: string;
    matchedClaimText: string | null;
    similarityScore: number | null;
    flagType: string;
    reviewerDecision: string | null;
    decidedBy: string;
  }>;
  comments: Array<{
    id: string;
    elementId: string | null;
    reviewerName: string;
    comment: string;
    resolved: boolean;
    createdAt: number;
  }>;
  stages: Array<{
    id: string;
    stageOrder: number;
    reviewerRole: string;
    assignedTo: string;
    status: string;
    decidedAt: number | null;
    decisionNote: string | null;
  }>;
  audit: Array<{
    id: string;
    action: string;
    performedBy: string;
    createdAt: number;
    details: Record<string, unknown> | null;
  }>;
  activeStageId: string | null;
  canReview: boolean;
  canResubmit: boolean;
  isLatest: boolean;
};

export function ReviewWorkspace({
  data,
  dict,
  locale,
}: {
  data: WorkspaceData;
  dict: Dict;
  locale: Locale;
}) {
  const { submission: sub, currentVersion } = data;
  const [pageNumber, setPageNumber] = useState(data.pages[0]?.pageNumber ?? 1);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showResubmit, setShowResubmit] = useState(false);
  const [pending, startTransition] = useTransition();

  const page = data.pages.find((p) => p.pageNumber === pageNumber) ?? data.pages[0];

  const flagsByElement = useMemo(() => {
    const m = new Map<string, WorkspaceData["flags"]>();
    for (const f of data.flags) {
      if (!f.elementId) continue;
      m.set(f.elementId, [...(m.get(f.elementId) ?? []), f]);
    }
    return m;
  }, [data.flags]);

  const commentsByElement = useMemo(() => {
    const m = new Map<string, WorkspaceData["comments"]>();
    for (const c of data.comments) {
      if (!c.elementId) continue;
      m.set(c.elementId, [...(m.get(c.elementId) ?? []), c]);
    }
    return m;
  }, [data.comments]);

  const selectedElement = data.elements.find((el) => el.id === selectedElementId) ?? null;
  const visibleFlags = selectedElement
    ? data.flags.filter((f) => f.elementId === selectedElement.id)
    : data.flags;
  const visibleComments = selectedElement
    ? data.comments.filter((c) => c.elementId === selectedElement.id)
    : data.comments;
  const manualElements = data.elements.filter((el) => el.requiresManualReview);

  const selectElement = (id: string) => {
    const el = data.elements.find((e) => e.id === id);
    if (el && el.pageNumber !== pageNumber) setPageNumber(el.pageNumber);
    setSelectedElementId((cur) => (cur === id ? null : id));
  };

  const roleLabel = (role: string) => dict.roles[role as keyof Dict["roles"]] ?? role;
  const statusLabel = (s: string) => dict.status[s as keyof Dict["status"]] ?? s;

  const inputCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

  return (
    <div className="animate-fade-up">
      {/* ------------------------------ header ------------------------------ */}
      <div className="mb-6">
        <Link
          href="/submissions"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition hover:text-brand-700"
        >
          <ArrowLeft className="size-3.5" />
          {dict.nav.submissions}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[21px] font-semibold tracking-tight text-slate-900">
                {sub.title}
              </h1>
              <StatusBadge status={sub.status} label={statusLabel(sub.status)} />
              {currentVersion.isLocked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-medium text-white">
                  <Lock className="size-3" /> {dict.detail.locked}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
              <Chip tone="brand">{sub.productName}</Chip>
              {sub.bpomNo ? <Chip>{sub.bpomNo}</Chip> : null}
              <Chip>{dict.channels[sub.channel as keyof Dict["channels"]] ?? sub.channel}</Chip>
              <span>
                {dict.detail.submittedBy} <strong className="text-slate-700">{sub.submittedBy}</strong>
              </span>
              <span>· {relativeDays(sub.createdAt, locale)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data.versions.length > 1 ? (
              <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {data.versions.map((v) => (
                  <Link
                    key={v.id}
                    href={`/submissions/${sub.id}?v=${v.versionNumber}`}
                    className={clsx(
                      "rounded-lg px-2.5 py-1 text-[12px] font-semibold transition",
                      v.versionNumber === currentVersion.versionNumber
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    v{v.versionNumber}
                  </Link>
                ))}
              </div>
            ) : null}
            {currentVersion.hasOriginalFile ? (
              <a
                href={`/api/files/${currentVersion.id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                title={currentVersion.fileName ?? undefined}
              >
                <Download className="size-4" />
                {dict.detail.downloadOriginal}
              </a>
            ) : null}
            {sub.status === "approved" && currentVersion.isLocked ? (
              <a
                href={`/submissions/${sub.id}/package`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                <FileDown className="size-4" />
                {dict.detail.downloadPackage}
              </a>
            ) : null}
            {data.canResubmit ? (
              <button
                type="button"
                onClick={() => setShowResubmit((s) => !s)}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-[13px] font-semibold text-brand-800 shadow-sm transition hover:bg-brand-100"
              >
                <RefreshCw className="size-4" />
                {dict.detail.resubmit}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {currentVersion.isLocked ? (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-[13px] text-slate-200">
          <Lock className="size-4 shrink-0 text-brand-300" />
          {dict.detail.lockedNote}
        </div>
      ) : null}

      {showResubmit && data.canResubmit ? (
        <Card className="mb-6 border-brand-200">
          <div className="px-6 py-5">
            <h3 className="text-[15px] font-semibold text-slate-900">
              {dict.detail.resubmitTitle}
            </h3>
            <p className="mt-1 text-[13px] text-slate-500">{dict.detail.resubmitDesc}</p>
            <form
              action={(fd) => startTransition(async () => {
                await resubmitVersion(fd);
                setShowResubmit(false);
              })}
              className="mt-4 space-y-3"
            >
              <input type="hidden" name="submissionId" value={sub.id} />
              <textarea
                name="text"
                rows={6}
                required
                placeholder={dict.detail.newText}
                className={inputCls + " resize-y leading-relaxed"}
              />
              <textarea
                name="changeNote"
                rows={2}
                required
                placeholder={dict.detail.changeNotePlaceholder}
                className={inputCls + " resize-y"}
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-60"
              >
                {dict.detail.resubmit}
              </button>
            </form>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,1fr)]">
        {/* ---------------------------- viewer ---------------------------- */}
        <div>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-1.5">
                {data.pages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPageNumber(p.pageNumber)}
                    className={clsx(
                      "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition",
                      p.pageNumber === pageNumber
                        ? "bg-brand-700 text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-100",
                    )}
                  >
                    {dict.detail.page} {p.pageNumber}
                  </button>
                ))}
              </div>
              <p className="hidden items-center gap-1.5 text-[11.5px] text-slate-400 md:flex">
                <ScanEye className="size-3.5" />
                {dict.detail.clickElement}
              </p>
            </div>

            {currentVersion.processingStatus !== "ready" ? (
              <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                {dict.detail.processing}
              </div>
            ) : page ? (
              <div className="bg-slate-100/70 p-4">
                <div
                  className="relative mx-auto w-full overflow-hidden rounded-lg shadow-pop ring-1 ring-slate-900/5"
                  style={{ aspectRatio: `${page.width} / ${page.height}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/pages/${page.id}`}
                    alt={`${dict.detail.page} ${page.pageNumber}`}
                    className="absolute inset-0 size-full select-none"
                    draggable={false}
                  />
                  {data.elements
                    .filter((el) => el.pageNumber === page.pageNumber && el.boundingBox)
                    .map((el) => {
                      const b = el.boundingBox!;
                      const hasFlag = flagsByElement.has(el.id);
                      const openFlag = (flagsByElement.get(el.id) ?? []).some(
                        (f) => !f.reviewerDecision,
                      );
                      const hasComment = commentsByElement.has(el.id);
                      const selected = el.id === selectedElementId;
                      return (
                        <button
                          key={el.id}
                          type="button"
                          onClick={() => selectElement(el.id)}
                          className={clsx(
                            "group absolute rounded-md transition-all duration-150",
                            selected
                              ? "z-20 ring-2 ring-brand-600 ring-offset-2 ring-offset-white/50"
                              : "z-10",
                            hasFlag
                              ? "border-2 border-amber-400/80 bg-amber-300/10 hover:bg-amber-300/20"
                              : el.requiresManualReview
                                ? "border-2 border-dashed border-violet-400/80 bg-violet-300/10 hover:bg-violet-300/20"
                                : hasComment
                                  ? "border-2 border-sky-400/70 bg-sky-300/10 hover:bg-sky-300/20"
                                  : "border border-transparent hover:border-slate-400/60 hover:bg-slate-400/10",
                          )}
                          style={{
                            left: `${(b.x / page.width) * 100}%`,
                            top: `${(b.y / page.height) * 100}%`,
                            width: `${(b.width / page.width) * 100}%`,
                            height: `${(b.height / page.height) * 100}%`,
                          }}
                        >
                          <span className="absolute -right-2 -top-2 flex gap-1">
                            {hasFlag ? (
                              <span
                                className={clsx(
                                  "flex size-5 items-center justify-center rounded-full bg-amber-500 text-white shadow",
                                  openFlag && "pulse-flag",
                                )}
                              >
                                <Sparkles className="size-3" />
                              </span>
                            ) : null}
                            {el.requiresManualReview ? (
                              <span className="flex size-5 items-center justify-center rounded-full bg-violet-500 text-white shadow">
                                <Eye className="size-3" />
                              </span>
                            ) : null}
                            {hasComment ? (
                              <span className="flex size-5 items-center justify-center rounded-full bg-sky-500 text-white shadow">
                                <MessageSquare className="size-3" />
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : null}
          </Card>

          {/* diff vs previous version */}
          {currentVersion.versionNumber > 1 ? (
            <Card className="mt-4">
              <div className="px-5 py-4">
                <div className="mb-1 flex items-center gap-2">
                  <GitCompareArrows className="size-4 text-brand-600" />
                  <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                    {dict.detail.diffTitle}
                  </h3>
                  {data.diff ? (
                    <span className="ml-auto text-[11px] text-slate-400">
                      {dict.detail.diffDesc}
                    </span>
                  ) : null}
                </div>
                {data.diff ? (
                  <div className="mt-3 space-y-1.5">
                    {data.diff.map((line, i) => (
                      <p
                        key={i}
                        className={clsx(
                          "rounded-lg px-3 py-1.5 text-[13px] leading-relaxed",
                          line.type === "added" &&
                            "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200",
                          line.type === "removed" &&
                            "bg-rose-50 text-rose-800 line-through decoration-rose-400/60 ring-1 ring-inset ring-rose-200",
                          line.type === "same" && "text-slate-500",
                        )}
                      >
                        {line.type === "added" ? "+ " : line.type === "removed" ? "− " : ""}
                        {line.text}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[12.5px] italic text-slate-400">
                    {dict.detail.diffUnavailable}
                  </p>
                )}
              </div>
            </Card>
          ) : null}

          {/* selected element detail */}
          {selectedElement ? (
            <Card className="mt-4">
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                    {dict.detail.elementDetail}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Chip>{selectedElement.elementType}</Chip>
                    <Chip>{selectedElement.extractionMethod}</Chip>
                    {selectedElement.ocrConfidence != null ? (
                      <Chip tone="amber">
                        {dict.detail.ocrConfidence}:{" "}
                        {Math.round(selectedElement.ocrConfidence * 100)}%
                      </Chip>
                    ) : null}
                  </div>
                </div>
                {selectedElement.extractedText ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-[13.5px] leading-relaxed text-slate-700 ring-1 ring-inset ring-slate-200">
                    “{selectedElement.extractedText}”
                  </p>
                ) : (
                  <p className="mt-3 text-[13px] italic text-slate-400">
                    {dict.detail.manualReviewDesc}
                  </p>
                )}
              </div>
            </Card>
          ) : null}
        </div>

        {/* --------------------------- right rail --------------------------- */}
        <div className="space-y-5">
          {/* revision note from marketing */}
          {currentVersion.changeNote ? (
            <Card className="border-brand-200 bg-brand-50/40">
              <div className="flex items-start gap-3 px-5 py-4">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <div>
                  <p className="text-[11.5px] font-semibold uppercase tracking-wider text-brand-800">
                    {dict.detail.revisionNote} · v{currentVersion.versionNumber}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                    {currentVersion.changeNote}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {/* follow-up checklist from previous versions */}
          {currentVersion.versionNumber > 1 && data.isLatest ? (
            <Card
              className={
                data.prevOpenComments.length
                  ? "border-amber-300 bg-gradient-to-b from-amber-50/70 to-white"
                  : "border-emerald-200"
              }
            >
              <div className="px-5 py-4">
                <div className="mb-1 flex items-center gap-2">
                  <ListChecks
                    className={clsx(
                      "size-4",
                      data.prevOpenComments.length ? "text-amber-600" : "text-emerald-500",
                    )}
                  />
                  <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">
                    {dict.detail.followUp}
                  </h3>
                  <span
                    className={clsx(
                      "ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold",
                      data.prevOpenComments.length
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-700",
                    )}
                  >
                    {data.prevOpenComments.length}
                  </span>
                </div>
                {data.prevOpenComments.length ? (
                  <>
                    <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
                      {dict.detail.followUpDesc}
                    </p>
                    <div className="space-y-2.5">
                      {data.prevOpenComments.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-amber-200 bg-white p-3"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={c.reviewerName} size={22} />
                            <p className="text-[12.5px] font-semibold text-slate-800">
                              {c.reviewerName}
                            </p>
                            <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500">
                              {dict.detail.fromVersion} v{c.versionNumber}
                            </span>
                          </div>
                          {c.elementText ? (
                            <p className="mt-2 border-l-2 border-slate-200 pl-2.5 text-[11.5px] italic leading-snug text-slate-400">
                              “{c.elementText}”
                            </p>
                          ) : null}
                          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-700">
                            {c.comment}
                          </p>
                          <form
                            action={(fd) => startTransition(() => resolveComment(fd))}
                            className="mt-2"
                          >
                            <input type="hidden" name="commentId" value={c.id} />
                            <button
                              disabled={pending}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              ✓ {dict.detail.resolve}
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[12.5px] font-medium text-emerald-700">
                    ✓ {dict.detail.allAddressed}
                  </p>
                )}
              </div>
            </Card>
          ) : null}

          {/* review progress */}
          <Card>
            <div className="px-5 py-4">
              <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                {dict.detail.reviewProgress}
              </h3>
              <ol>
                {data.stages.map((s, i) => (
                  <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < data.stages.length - 1 ? (
                      <span className="absolute left-[11px] top-6 h-full w-px bg-slate-200" />
                    ) : null}
                    <span
                      className={clsx(
                        "z-10 mt-0.5 flex size-[23px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1",
                        s.status === "approved"
                          ? "bg-emerald-500 text-white ring-emerald-500"
                          : s.status === "in_progress"
                            ? "bg-sky-500 text-white ring-sky-500"
                            : s.status === "changes_requested"
                              ? "bg-amber-500 text-white ring-amber-500"
                              : s.status === "rejected"
                                ? "bg-rose-500 text-white ring-rose-500"
                                : "bg-white text-slate-400 ring-slate-300",
                      )}
                    >
                      {s.status === "approved" ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        s.stageOrder
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13.5px] font-medium text-slate-800">
                          {roleLabel(s.reviewerRole)}
                        </p>
                        <StatusBadge status={s.status} label={statusLabel(s.status)} />
                      </div>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {s.assignedTo}
                        {s.decidedAt ? ` · ${formatDate(s.decidedAt, locale)}` : ""}
                      </p>
                      {s.decisionNote ? (
                        <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] italic leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-100">
                          “{s.decisionNote}”
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          {/* decision panel */}
          {data.canReview && data.activeStageId ? (
            <Card className="border-sky-200 bg-gradient-to-b from-sky-50/60 to-white">
              <div className="px-5 py-4">
                <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-sky-900">
                  <span className="size-2 animate-pulse rounded-full bg-sky-500" />
                  {dict.detail.yourTurn}
                </p>
                <form
                  action={(fd) => startTransition(() => decideStage(fd))}
                  className="space-y-3"
                >
                  <input type="hidden" name="stageId" value={data.activeStageId} />
                  <textarea
                    name="note"
                    rows={2}
                    placeholder={dict.detail.decisionNote}
                    className={inputCls + " resize-none"}
                  />
                  {data.prevOpenComments.length > 0 ? (
                    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-800 ring-1 ring-inset ring-amber-200">
                      <Lock className="mt-0.5 size-3.5 shrink-0" />
                      {dict.detail.approveBlocked}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      name="decision"
                      value="approved"
                      disabled={pending || data.prevOpenComments.length > 0}
                      title={
                        data.prevOpenComments.length > 0 ? dict.detail.approveBlocked : undefined
                      }
                      className="rounded-xl bg-emerald-600 px-2 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {dict.detail.approve}
                    </button>
                    <button
                      name="decision"
                      value="changes_requested"
                      disabled={pending}
                      className="rounded-xl bg-amber-500 px-2 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60"
                      formNoValidate
                    >
                      {dict.detail.requestChanges}
                    </button>
                    <button
                      name="decision"
                      value="rejected"
                      disabled={pending}
                      className="rounded-xl bg-rose-600 px-2 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                      formNoValidate
                    >
                      {dict.detail.reject}
                    </button>
                  </div>
                </form>
              </div>
            </Card>
          ) : !data.canReview && sub.status === "in_review" && data.isLatest ? (
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-[12.5px] text-slate-500">
              {dict.detail.notYourTurn}
            </p>
          ) : null}

          {/* AI flags */}
          <Card>
            <div className="px-5 py-4">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" />
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                  {dict.detail.aiFlags}
                </h3>
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  {visibleFlags.length}
                </span>
              </div>
              <p className="mb-4 text-[12px] leading-relaxed text-slate-400">
                {dict.detail.aiFlagsDesc}
              </p>
              <div className="space-y-3">
                {visibleFlags.map((f) => (
                  <div
                    key={f.id}
                    className={clsx(
                      "rounded-xl border p-3.5 transition",
                      f.reviewerDecision
                        ? "border-slate-200 bg-slate-50/60"
                        : "border-amber-200 bg-amber-50/50",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => f.elementId && selectElement(f.elementId)}
                      className="block w-full text-left"
                    >
                      <p className="text-[13px] font-medium leading-snug text-slate-800">
                        “{f.flaggedText}”
                      </p>
                    </button>
                    {f.matchedClaimText ? (
                      <div className="mt-2.5 rounded-lg bg-white px-3 py-2 ring-1 ring-inset ring-slate-200">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {dict.detail.closestClaim}
                        </p>
                        <p className="mt-1 text-[12.5px] leading-snug text-slate-600">
                          {f.matchedClaimText}
                        </p>
                        {f.similarityScore != null ? (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={clsx(
                                  "h-full rounded-full",
                                  f.similarityScore >= 0.6
                                    ? "bg-emerald-500"
                                    : f.similarityScore >= 0.35
                                      ? "bg-amber-500"
                                      : "bg-rose-500",
                                )}
                                style={{ width: `${Math.round(f.similarityScore * 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {Math.round(f.similarityScore * 100)}% {dict.detail.similarity}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2.5 rounded-lg bg-rose-50 px-3 py-2 ring-1 ring-inset ring-rose-200">
                        <p className="text-[12px] font-semibold text-rose-700">
                          {dict.detail.noMatch}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-rose-600/80">
                          {dict.detail.noMatchDesc}
                        </p>
                      </div>
                    )}
                    <div className="mt-2.5">
                      {f.reviewerDecision ? (
                        <p className="text-[11.5px] text-slate-500">
                          {dict.detail.flagDecided}:{" "}
                          <strong className="capitalize text-slate-700">
                            {f.reviewerDecision}
                          </strong>{" "}
                          · {f.decidedBy}
                        </p>
                      ) : data.canReview ? (
                        <form
                          action={(fd) => startTransition(() => decideFlag(fd))}
                          className="flex gap-1.5"
                        >
                          <input type="hidden" name="flagId" value={f.id} />
                          {(
                            [
                              ["accepted", dict.detail.accept, "bg-emerald-600 hover:bg-emerald-700"],
                              ["dismissed", dict.detail.dismiss, "bg-slate-500 hover:bg-slate-600"],
                              ["escalated", dict.detail.escalate, "bg-rose-600 hover:bg-rose-700"],
                            ] as const
                          ).map(([val, lbl, cls]) => (
                            <button
                              key={val}
                              name="decision"
                              value={val}
                              disabled={pending}
                              className={clsx(
                                "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-sm transition disabled:opacity-60",
                                cls,
                              )}
                            >
                              {lbl}
                            </button>
                          ))}
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!visibleFlags.length ? (
                  <p className="text-[12.5px] text-slate-400">—</p>
                ) : null}
              </div>

              {manualElements.length ? (
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-3.5">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-violet-800">
                    <Eye className="size-3.5" />
                    {dict.detail.manualReview} ({manualElements.length})
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-violet-700/80">
                    {dict.detail.manualReviewDesc}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {manualElements.map((el) => (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => selectElement(el.id)}
                        className="rounded-lg bg-white px-2.5 py-1 text-[11.5px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition hover:bg-violet-100"
                      >
                        {dict.detail.page} {el.pageNumber} · {el.elementType}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          {/* comments */}
          <Card>
            <div className="px-5 py-4">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="size-4 text-sky-500" />
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                  {dict.detail.comments}
                </h3>
                <span className="ml-auto rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                  {visibleComments.length}
                </span>
              </div>
              <div className="space-y-3">
                {visibleComments.map((c) => (
                  <div
                    key={c.id}
                    className={clsx(
                      "rounded-xl border p-3",
                      c.resolved ? "border-slate-100 bg-slate-50/50 opacity-70" : "border-slate-200 bg-white",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={c.reviewerName} size={24} />
                      <p className="text-[12.5px] font-semibold text-slate-800">{c.reviewerName}</p>
                      <span className="text-[11px] text-slate-400">
                        {relativeDays(c.createdAt, locale)}
                      </span>
                      {c.elementId ? (
                        <button
                          type="button"
                          onClick={() => selectElement(c.elementId!)}
                          className="ml-auto rounded-md bg-sky-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200"
                        >
                          📌
                        </button>
                      ) : (
                        <span className="ml-auto text-[10.5px] text-slate-400">
                          {dict.common.general}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-700">{c.comment}</p>
                    {!c.resolved ? (
                      <form
                        action={(fd) => startTransition(() => resolveComment(fd))}
                        className="mt-2"
                      >
                        <input type="hidden" name="commentId" value={c.id} />
                        <button
                          disabled={pending}
                          className="text-[11.5px] font-semibold text-emerald-700 transition hover:text-emerald-800 disabled:opacity-60"
                        >
                          ✓ {dict.detail.resolve}
                        </button>
                      </form>
                    ) : (
                      <p className="mt-1.5 text-[11px] font-medium text-emerald-600">
                        ✓ {dict.detail.resolved}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <form
                action={(fd) =>
                  startTransition(async () => {
                    await addComment(fd);
                  })
                }
                className="mt-4 space-y-2"
              >
                <input type="hidden" name="versionId" value={currentVersion.id} />
                <input type="hidden" name="elementId" value={selectedElementId ?? ""} />
                <p className="text-[11px] font-medium text-slate-400">
                  {selectedElementId
                    ? `📌 ${dict.detail.commentOnElement}`
                    : dict.detail.generalComment}
                </p>
                <div className="flex gap-2">
                  <input
                    name="comment"
                    required
                    placeholder={dict.detail.addComment}
                    className={inputCls}
                  />
                  <button
                    disabled={pending}
                    className="shrink-0 rounded-xl bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60"
                  >
                    {dict.detail.send}
                  </button>
                </div>
              </form>
            </div>
          </Card>

          {/* mini audit trail */}
          <Card>
            <div className="px-5 py-4">
              <div className="mb-3 flex items-center gap-2">
                <History className="size-4 text-slate-400" />
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
                  {dict.detail.auditTrailFor}
                </h3>
              </div>
              <ul className="space-y-2.5">
                {data.audit.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-2 text-[12.5px]">
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">
                      {formatDate(a.createdAt, locale)}
                    </span>
                    <span className="text-slate-600">
                      <strong className="text-slate-800">{a.performedBy}</strong>{" "}
                      {dict.audit.actions[a.action as keyof Dict["audit"]["actions"]] ?? a.action}
                      {a.details && "version" in a.details ? (
                        <span className="text-slate-400"> · {String(a.details.version)}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
