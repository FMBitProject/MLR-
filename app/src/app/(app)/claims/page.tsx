import { desc, eq } from "drizzle-orm";
import { BookCheck, BookMarked, TimerReset } from "lucide-react";
import { db, t } from "@/lib/db";
import { requireUser, CLAIM_MANAGER_ROLES } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { formatDate } from "@/lib/i18n";
import { expireClaim } from "@/lib/actions";
import { Card, Chip, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { ClaimFormButton, ClaimEditButton } from "@/components/claim-form";
import { ImportSopButton } from "@/components/claim-import";

export default async function ClaimsPage(props: PageProps<"/claims">) {
  const user = await requireUser();
  const { dict, locale } = await getDict();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.toLowerCase() : "";
  const productFilter = typeof sp.product === "string" ? sp.product : "";

  const canManage = CLAIM_MANAGER_ROLES.includes(
    user.role as (typeof CLAIM_MANAGER_ROLES)[number],
  );

  const products = db
    .select({ id: t.products.id, name: t.products.name })
    .from(t.products)
    .where(eq(t.products.tenantId, user.tenantId))
    .all();

  const claims = db
    .select({ claim: t.approvedClaims, approver: t.users })
    .from(t.approvedClaims)
    .leftJoin(t.users, eq(t.approvedClaims.approvedBy, t.users.id))
    .where(eq(t.approvedClaims.tenantId, user.tenantId))
    .orderBy(desc(t.approvedClaims.approvedAt))
    .all()
    .filter(
      ({ claim }) =>
        (!q || claim.claimText.toLowerCase().includes(q)) &&
        (!productFilter || claim.productId === productFilter),
    );

  const now = Date.now();
  const soonMs = 30 * 86_400_000;
  const isExpiringSoon = (d: Date | null) =>
    !!d && d.getTime() > now && d.getTime() - now < soonMs;

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={dict.claims.title}
        subtitle={dict.claims.subtitle}
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <ImportSopButton dict={dict} products={products} />
              <ClaimFormButton dict={dict} products={products} />
            </div>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder={dict.claims.searchPlaceholder}
          className="w-64 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
        />
        <select
          name="product"
          defaultValue={productFilter}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500"
        >
          <option value="">{dict.audit.filterProduct}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-700">
          →
        </button>
      </form>

      <Card className="overflow-hidden">
        {claims.length ? (
          <div className="divide-y divide-slate-100">
            {claims.map(({ claim, approver }) => {
              const expSoon = claim.status === "active" && isExpiringSoon(claim.expiresAt);
              return (
                <div key={claim.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="max-w-[640px] flex-1 text-[14px] leading-relaxed text-slate-800">
                      {claim.claimText}
                    </p>
                    <div className="flex items-center gap-2">
                      {expSoon ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/25">
                          <TimerReset className="size-3" />
                          {dict.claims.expiringSoon}
                        </span>
                      ) : null}
                      <StatusBadge
                        status={claim.status}
                        label={dict.status[claim.status as keyof typeof dict.status] ?? claim.status}
                      />
                    </div>
                  </div>
                  {(claim.references ?? []).length ? (
                    <ul className="mt-2 space-y-1">
                      {(claim.references ?? []).map((r, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-[12px] leading-snug text-slate-500"
                        >
                          <BookMarked className="mt-0.5 size-3 shrink-0 text-brand-600/70" />
                          <span>
                            {r.citation}
                            {r.pmid ? (
                              <a
                                href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1.5 font-semibold text-brand-700 hover:underline"
                              >
                                PMID {r.pmid}
                              </a>
                            ) : r.doi ? (
                              <a
                                href={`https://doi.org/${r.doi}`}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1.5 font-semibold text-brand-700 hover:underline"
                              >
                                DOI
                              </a>
                            ) : r.url ? (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1.5 font-semibold text-brand-700 hover:underline"
                              >
                                ↗
                              </a>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                    <Chip tone="brand">{productName(claim.productId)}</Chip>
                    {claim.source ? (
                      <Chip tone="amber">
                        {dict.claims.source}: {claim.source}
                      </Chip>
                    ) : null}
                    {(claim.channelScope ?? []).map((c) => (
                      <Chip key={c}>
                        {dict.channels[c as keyof typeof dict.channels] ?? c}
                      </Chip>
                    ))}
                    <span>
                      {dict.claims.approvedBy}{" "}
                      <strong className="text-slate-700">{approver?.name ?? "—"}</strong>
                    </span>
                    <span>
                      · {dict.claims.expires}{" "}
                      <strong className={expSoon ? "text-amber-700" : "text-slate-700"}>
                        {formatDate(claim.expiresAt, locale)}
                      </strong>
                    </span>
                    {canManage ? (
                      <span className="ml-auto flex items-center gap-1">
                        <ClaimEditButton
                          dict={dict}
                          products={products}
                          label="Edit"
                          draft={{
                            id: claim.id,
                            productId: claim.productId,
                            claimText: claim.claimText,
                            channelScope: claim.channelScope ?? [],
                            expiresAt: claim.expiresAt
                              ? claim.expiresAt.toISOString().slice(0, 10)
                              : "",
                            references: claim.references ?? [],
                          }}
                        />
                        {claim.status === "active" ? (
                          <form action={expireClaim}>
                            <input type="hidden" name="id" value={claim.id} />
                            <button className="rounded-lg px-2 py-1 text-[12px] font-semibold text-rose-500 transition hover:bg-rose-50 hover:text-rose-700">
                              {dict.claims.expireAction}
                            </button>
                          </form>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<BookCheck className="size-8 text-slate-300" />}
            text={dict.claims.empty}
          />
        )}
      </Card>
    </div>
  );
}
