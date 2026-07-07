import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Download, ScrollText } from "lucide-react";
import { db, t } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { queryAudit } from "@/lib/audit-query";
import { Card, Chip, EmptyState, PageHeader } from "@/components/ui";

export default async function AuditPage(props: PageProps<"/audit">) {
  const user = await requireUser();
  if (!["compliance_admin", "super_admin"].includes(user.role)) redirect("/dashboard");
  const { dict, locale } = await getDict();
  const sp = await props.searchParams;

  const productId = typeof sp.product === "string" && sp.product ? sp.product : null;
  const from = typeof sp.from === "string" && sp.from ? new Date(sp.from) : null;
  const to =
    typeof sp.to === "string" && sp.to ? new Date(new Date(sp.to).getTime() + 86_399_000) : null;

  const products = db
    .select({ id: t.products.id, name: t.products.name })
    .from(t.products)
    .where(eq(t.products.tenantId, user.tenantId))
    .all();

  const rows = queryAudit({ tenantId: user.tenantId, productId, from, to }).slice(0, 200);

  const exportUrl = `/audit/export?product=${productId ?? ""}&from=${
    typeof sp.from === "string" ? sp.from : ""
  }&to=${typeof sp.to === "string" ? sp.to : ""}`;

  const dtf = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const inputCls =
    "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-500";

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={dict.audit.title}
        subtitle={dict.audit.subtitle}
        action={
          <a
            href={exportUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="size-4" />
            {dict.audit.export}
          </a>
        }
      />

      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <select name="product" defaultValue={productId ?? ""} className={inputCls}>
          <option value="">{dict.audit.filterProduct}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={typeof sp.from === "string" ? sp.from : ""}
          className={inputCls}
        />
        <span className="text-slate-400">—</span>
        <input
          type="date"
          name="to"
          defaultValue={typeof sp.to === "string" ? sp.to : ""}
          className={inputCls}
        />
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-700">
          →
        </button>
      </form>

      <Card className="overflow-hidden">
        {rows.length ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-3">{dict.audit.when}</th>
                <th className="px-4 py-3">{dict.audit.who}</th>
                <th className="px-4 py-3">{dict.audit.action}</th>
                <th className="px-4 py-3">{dict.audit.entity}</th>
                <th className="px-4 py-3">{dict.audit.details}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ log, actor }) => (
                <tr key={log.id} className="text-[13px] text-slate-700">
                  <td className="whitespace-nowrap px-6 py-3 font-mono text-[12px] text-slate-500">
                    {dtf.format(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{actor.name}</td>
                  <td className="px-4 py-3">
                    {dict.audit.actions[log.action as keyof typeof dict.audit.actions] ??
                      log.action}
                  </td>
                  <td className="px-4 py-3">
                    <Chip>{log.entityType}</Chip>
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 font-mono text-[11.5px] text-slate-400">
                    {log.details ? JSON.stringify(log.details) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={<ScrollText className="size-8 text-slate-300" />} text="—" />
        )}
      </Card>
    </div>
  );
}
