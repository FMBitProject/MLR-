import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { db, t } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { formatDate } from "@/lib/i18n";
import { PrintButton } from "@/components/print-button";

// Printable approval package: certificate summary + locked rendered pages.
// Open in a new tab, then Print → Save as PDF.
export default async function ApprovalPackagePage(
  props: PageProps<"/submissions/[id]/package">,
) {
  const user = await requireUser();
  const { dict, locale } = await getDict();
  const { id } = await props.params;

  const sub = db
    .select()
    .from(t.contentSubmissions)
    .where(
      and(eq(t.contentSubmissions.id, id), eq(t.contentSubmissions.tenantId, user.tenantId)),
    )
    .get();
  if (!sub) notFound();

  const versions = db
    .select()
    .from(t.contentVersions)
    .where(eq(t.contentVersions.submissionId, sub.id))
    .orderBy(asc(t.contentVersions.versionNumber))
    .all();
  const version = versions.findLast((v) => v.isLocked);
  // Package exists only for a locked (finally approved) version
  if (!version || sub.status !== "approved") redirect(`/submissions/${sub.id}`);

  const product = db.select().from(t.products).where(eq(t.products.id, sub.productId)).get();
  const tenant = db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)).get();
  const tenantUsers = db.select().from(t.users).where(eq(t.users.tenantId, user.tenantId)).all();
  const userName = (uid: string | null) => tenantUsers.find((u) => u.id === uid)?.name ?? "—";

  const stages = db
    .select()
    .from(t.reviewStages)
    .where(eq(t.reviewStages.submissionId, sub.id))
    .orderBy(asc(t.reviewStages.stageOrder))
    .all();
  const pages = db
    .select()
    .from(t.contentVersionPages)
    .where(eq(t.contentVersionPages.versionId, version.id))
    .orderBy(asc(t.contentVersionPages.pageNumber))
    .all();
  const flags = db
    .select()
    .from(t.claimFlags)
    .where(eq(t.claimFlags.versionId, version.id))
    .all();
  const flagClaimIds = flags.map((f) => f.matchedClaimId).filter((x): x is string => !!x);
  const flagClaims = flagClaimIds.length
    ? db.select().from(t.approvedClaims).where(inArray(t.approvedClaims.id, flagClaimIds)).all()
    : [];

  const roleLabel = (r: string) => dict.roles[r as keyof typeof dict.roles] ?? r;

  return (
    <div className="mx-auto max-w-[900px] bg-white px-10 py-10 text-slate-900 print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/submissions/${sub.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="size-3.5" />
          {sub.title}
        </Link>
        <PrintButton label={dict.pkg.print} />
      </div>

      {/* certificate header */}
      <header className="rounded-2xl bg-gradient-to-br from-brand-950 to-brand-800 p-8 text-white print:rounded-none">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-5 text-brand-300" />
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-brand-200">
            {dict.pkg.title} — {tenant?.name}
          </p>
        </div>
        <h1 className="mt-4 text-[28px] font-semibold leading-tight tracking-tight">
          {sub.title}
        </h1>
        <p className="mt-2 text-[14px] text-brand-100">
          {product?.name} · {product?.bpomRegistrationNo} ·{" "}
          {dict.channels[sub.channel as keyof typeof dict.channels] ?? sub.channel}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
          <p>
            <span className="text-brand-300">{dict.pkg.finalVersion}:</span>{" "}
            <strong>v{version.versionNumber}</strong>
          </p>
          <p>
            <span className="text-brand-300">{dict.pkg.approvedOn}:</span>{" "}
            <strong>{formatDate(sub.decidedAt, locale)}</strong>
          </p>
          <p>
            <span className="text-brand-300">{dict.detail.submittedBy}:</span>{" "}
            <strong>{userName(sub.submittedBy)}</strong>
          </p>
        </div>
      </header>

      {/* stage decisions */}
      <section className="mt-8">
        <h2 className="border-b-2 border-brand-700 pb-2 text-[15px] font-semibold uppercase tracking-wider text-slate-700">
          {dict.pkg.decisions}
        </h2>
        <table className="mt-3 w-full text-left text-[13.5px]">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-2">#</th>
              <th className="py-2">{dict.submissions.stage}</th>
              <th className="py-2">Reviewer</th>
              <th className="py-2">Status</th>
              <th className="py-2">{dict.audit.when}</th>
              <th className="py-2">{dict.audit.details}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stages.map((s) => (
              <tr key={s.id}>
                <td className="py-2.5 text-slate-400">{s.stageOrder}</td>
                <td className="py-2.5 font-medium">{roleLabel(s.reviewerRole)}</td>
                <td className="py-2.5">{userName(s.assignedTo)}</td>
                <td className="py-2.5">
                  <span className="font-semibold text-emerald-700">
                    {dict.status[s.status as keyof typeof dict.status] ?? s.status}
                  </span>
                </td>
                <td className="py-2.5 text-slate-500">{formatDate(s.decidedAt, locale)}</td>
                <td className="py-2.5 italic text-slate-500">{s.decisionNote ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* AI flag decisions */}
      {flags.length ? (
        <section className="mt-8">
          <h2 className="border-b-2 border-brand-700 pb-2 text-[15px] font-semibold uppercase tracking-wider text-slate-700">
            {dict.pkg.flags}
          </h2>
          <div className="mt-3 space-y-3">
            {flags.map((f) => (
              <div key={f.id} className="rounded-xl border border-slate-200 p-3.5 text-[13px]">
                <p className="font-medium text-slate-800">“{f.flaggedText}”</p>
                <p className="mt-1 text-slate-500">
                  {f.matchedClaimId
                    ? `${dict.detail.closestClaim}: ${
                        flagClaims.find((c) => c.id === f.matchedClaimId)?.claimText ?? "—"
                      } (${Math.round((f.similarityScore ?? 0) * 100)}%)`
                    : dict.detail.noMatch}
                </p>
                <p className="mt-1">
                  <span className="font-semibold capitalize text-slate-700">
                    {f.reviewerDecision ?? "—"}
                  </span>{" "}
                  <span className="text-slate-400">· {userName(f.decidedBy)}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* rendered pages */}
      <section className="mt-8">
        <h2 className="border-b-2 border-brand-700 pb-2 text-[15px] font-semibold uppercase tracking-wider text-slate-700">
          {dict.pkg.renderedPages}
        </h2>
        <div className="mt-4 space-y-6">
          {pages.map((p) => (
            <div key={p.id} className="break-inside-avoid">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {dict.detail.page} {p.pageNumber} · v{version.versionNumber}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/pages/${p.id}`}
                alt={`${dict.detail.page} ${p.pageNumber}`}
                className="w-full rounded-lg border border-slate-200"
              />
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-[11.5px] leading-relaxed text-slate-400">
        <p>{dict.pkg.disclaimer}</p>
        <p className="mt-1">
          {dict.pkg.generated}: {formatDate(new Date(), locale)} ·{" "}
          {userName(user.id)} · MLR Flow — {tenant?.name}
        </p>
      </footer>
    </div>
  );
}
