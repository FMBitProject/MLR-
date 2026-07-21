import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Download, FolderCheck, History, CopyPlus, FileText } from "lucide-react";
import { db, t } from "@/lib/db";
import { requireUser, SUBMITTER_ROLES } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { formatDate } from "@/lib/i18n";
import { reuseApprovedContent } from "@/lib/actions";
import { contentLifecycle } from "@/lib/content-expiry";
import { Card, EmptyState, PageHeader, Chip } from "@/components/ui";
import { LibraryLifecycle } from "@/components/library-lifecycle";

export default async function LibraryPage() {
  const user = await requireUser();
  const { dict, locale } = await getDict();

  // Withdrawn material stays listed (greyed, no reuse) — the library is the
  // audit-facing record of what has circulated, not just what may circulate.
  const subs = await db
    .select({ sub: t.contentSubmissions, product: t.products })
    .from(t.contentSubmissions)
    .innerJoin(t.products, eq(t.contentSubmissions.productId, t.products.id))
    .where(
      and(
        eq(t.contentSubmissions.tenantId, user.tenantId),
        inArray(t.contentSubmissions.status, ["approved", "withdrawn"]),
      ),
    )
    .orderBy(desc(t.contentSubmissions.decidedAt));

  const subIds = subs.map((s) => s.sub.id);
  const versions = subIds.length
    ? await db
        .select({
          id: t.contentVersions.id,
          submissionId: t.contentVersions.submissionId,
          versionNumber: t.contentVersions.versionNumber,
          fileName: t.contentVersions.fileName,
        })
        .from(t.contentVersions)
        .where(inArray(t.contentVersions.submissionId, subIds))
    : [];

  // The approved master is the highest (locked) version of each submission.
  const finalVersion = (subId: string) =>
    versions
      .filter((v) => v.submissionId === subId)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];

  const canSubmit = SUBMITTER_ROLES.includes(user.role as (typeof SUBMITTER_ROLES)[number]);
  const canManage = ["compliance_admin", "super_admin"].includes(user.role);

  return (
    <div className="animate-fade-up">
      <PageHeader title={dict.library.title} subtitle={dict.library.subtitle} />

      {canSubmit ? (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-[12.5px] text-brand-900 ring-1 ring-inset ring-brand-100">
          {dict.library.reuseNote}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        {subs.length ? (
          <div className="divide-y divide-slate-100">
            {subs.map(({ sub, product }) => {
              const v = finalVersion(sub.id);
              const lifecycle = contentLifecycle(sub);
              const withdrawn = lifecycle === "withdrawn";
              const expired = lifecycle === "expired";
              const expiringSoon = lifecycle === "expiring_soon";
              const inCirculation = !withdrawn && !expired;
              return (
                <div
                  key={sub.id}
                  data-testid={`library-row-${sub.id}`}
                  className={
                    "flex flex-wrap items-center gap-4 px-6 py-4" +
                    (inCirculation ? "" : " bg-slate-50/60")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        "truncate text-[14px] font-medium " +
                        (inCirculation ? "text-slate-900" : "text-slate-500 line-through")
                      }
                    >
                      {sub.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                      <Chip tone="brand">{product.name}</Chip>
                      <Chip>
                        {dict.channels[sub.channel as keyof typeof dict.channels] ??
                          sub.channel}
                      </Chip>
                      {withdrawn ? (
                        <Chip tone="red">{dict.status.withdrawn}</Chip>
                      ) : expired ? (
                        <Chip tone="red">{dict.status.expired}</Chip>
                      ) : expiringSoon ? (
                        <Chip tone="amber">
                          {dict.library.expiresOn} {formatDate(sub.expiresAt, locale)}
                        </Chip>
                      ) : sub.expiresAt ? (
                        <span>
                          {dict.library.expiresOn} {formatDate(sub.expiresAt, locale)}
                        </span>
                      ) : null}
                      <span>
                        {dict.library.finalVersion} v{v?.versionNumber ?? 1}
                      </span>
                      <span>·</span>
                      <span>
                        {dict.library.approvedOn} {formatDate(sub.decidedAt, locale)}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="size-3.5" />
                        {v?.fileName ?? dict.library.textOnly}
                      </span>
                    </div>
                    {withdrawn && sub.withdrawnReason ? (
                      <p className="mt-1.5 text-[12px] italic text-rose-700">
                        {dict.library.withdrawnReasonLabel}: “{sub.withdrawnReason}” ·{" "}
                        {formatDate(sub.withdrawnAt, locale)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {v?.fileName && inCirculation ? (
                      <a
                        href={`/api/files/${v.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[12.5px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
                      >
                        <Download className="size-3.5" />
                        {dict.library.download}
                      </a>
                    ) : null}
                    <Link
                      href={`/submissions/${sub.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[12.5px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
                    >
                      <History className="size-3.5" />
                      {dict.library.view}
                    </Link>
                    {canSubmit && inCirculation ? (
                      <form action={reuseApprovedContent}>
                        <input type="hidden" name="submissionId" value={sub.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99]"
                        >
                          <CopyPlus className="size-3.5" />
                          {dict.library.reuse}
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {canManage && !withdrawn ? (
                    <div className="w-full border-t border-slate-100 pt-3">
                      <LibraryLifecycle
                        submissionId={sub.id}
                        expiresAt={sub.expiresAt?.toISOString().slice(0, 10) ?? null}
                        dict={dict}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<FolderCheck className="size-8 text-slate-300" />}
            text={dict.library.empty}
          />
        )}
      </Card>
    </div>
  );
}
