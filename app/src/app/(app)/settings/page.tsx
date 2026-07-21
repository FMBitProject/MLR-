import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  Building2,
  GitBranch,
  Users,
  Sparkles,
  ShieldAlert,
  Package,
  Lock,
  CreditCard,
} from "lucide-react";
import { db, t } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { formatDate } from "@/lib/i18n";
import { saveWorkflow, payRenewalInvoice } from "@/lib/actions";
import { billingState, latestInvoices } from "@/lib/billing";
import { midtransConfigured } from "@/lib/midtrans";
import { getLlmProvider } from "@/lib/llm";
import { planDef, formatIdr, effectivePriceIdr } from "@/lib/plans";
import { submissionQuota } from "@/lib/usage";
import { Avatar, Card, CardHeader, Chip, PageHeader } from "@/components/ui";
import { TeammateForm } from "@/components/teammate-form";
import { ProductForm } from "@/components/product-form";

const CHANNELS = ["print", "digital", "e-detail", "social"] as const;
const ROLES = ["medical_reviewer", "legal_reviewer", "regulatory_reviewer"] as const;

export default async function SettingsPage() {
  const user = await requireUser();
  if (!["compliance_admin", "super_admin"].includes(user.role)) redirect("/dashboard");
  const { dict, locale } = await getDict();

  const tenant = (await db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)))[0];
  const users = await db.select().from(t.users).where(eq(t.users.tenantId, user.tenantId));
  const products = await db
    .select()
    .from(t.products)
    .where(eq(t.products.tenantId, user.tenantId));
  const templates = await db
    .select()
    .from(t.workflowTemplates)
    .where(eq(t.workflowTemplates.tenantId, user.tenantId));

  const aiProvider = getLlmProvider();
  const plan = planDef(tenant?.plan);
  const limits = plan.limits;
  const quota = await submissionQuota(user.tenantId, tenant?.plan);
  const billing = billingState(tenant);
  const invoices = await latestInvoices(user.tenantId);
  const pending = invoices.find((i) => i.status === "pending");
  const billingTone = { active: "brand", grace: "amber", delinquent: "red" } as const;
  const invoiceTone = {
    pending: "amber",
    paid: "brand",
    expired: "slate",
    canceled: "slate",
  } as const;

  return (
    <div className="animate-fade-up">
      <PageHeader title={dict.settings.title} subtitle={dict.settings.subtitle} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Building2 className="size-4 text-slate-400" />
                  {dict.settings.workspace}
                </span>
              }
            />
            <div className="grid grid-cols-2 gap-4 px-6 py-5 text-[13.5px]">
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                  Workspace
                </p>
                <p className="mt-1 font-medium text-slate-800">{tenant?.name}</p>
                <p className="text-[12px] text-slate-400">/{tenant?.slug}</p>
              </div>
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                  {dict.settings.plan}
                </p>
                <p className="mt-1">
                  <Chip tone="brand">{tenant?.plan?.toUpperCase()}</Chip>
                </p>
                <p className="mt-1.5 text-[12.5px] font-medium text-slate-600">
                  {plan.monthlyPriceIdr !== null
                    ? `${formatIdr(effectivePriceIdr(plan) ?? plan.monthlyPriceIdr)}${dict.settings.planPerMonth}`
                    : dict.settings.planCustomPrice}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-400">
                  {formatDate(tenant?.createdAt ?? null, locale)}
                </p>
              </div>
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                  {dict.settings.submissionsThisMonth}
                </p>
                <p className="mt-1 font-medium text-slate-800">
                  {quota.used}
                  {Number.isFinite(quota.limit) ? `/${quota.limit}` : ""}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Package className="size-4 text-slate-400" />
                  {dict.settings.products} ({products.length}
                  {Number.isFinite(limits.products) ? `/${limits.products}` : ""})
                </span>
              }
              desc={dict.settings.productsDesc}
            />
            <div className="divide-y divide-slate-100">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-slate-800">{p.name}</p>
                    {p.bpomRegistrationNo ? (
                      <p className="truncate text-[12px] text-slate-400">
                        {p.bpomRegistrationNo}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100">
              <ProductForm dict={dict} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <GitBranch className="size-4 text-slate-400" />
                  {dict.settings.workflow}
                </span>
              }
              desc={dict.settings.workflowDesc}
            />
            {!plan.features.customWorkflows ? (
              <div className="flex items-start gap-3 px-6 py-5">
                <Lock className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <p className="text-[12.5px] leading-relaxed text-slate-500">
                  {dict.settings.workflowLocked}
                </p>
              </div>
            ) : (
            <div className="divide-y divide-slate-100">
              {CHANNELS.map((channel) => {
                const wf = templates.find((w) => w.channel === channel);
                const active = wf?.stages ?? [...ROLES];
                return (
                  <form
                    key={channel}
                    action={saveWorkflow}
                    className="flex flex-wrap items-center gap-3 px-6 py-4"
                  >
                    <input type="hidden" name="channel" value={channel} />
                    <span className="w-24 text-[13px] font-semibold text-slate-700">
                      {dict.channels[channel]}
                    </span>
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      {ROLES.map((role, i) => (
                        <label
                          key={role}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm transition has-checked:border-brand-300 has-checked:bg-brand-50 has-checked:text-brand-800"
                        >
                          <input
                            type="checkbox"
                            name="stages"
                            value={role}
                            defaultChecked={active.includes(role)}
                            className="size-3.5 accent-teal-700"
                          />
                          {i + 1}. {dict.roles[role]}
                        </label>
                      ))}
                    </div>
                    <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-700">
                      {dict.settings.save}
                    </button>
                  </form>
                );
              })}
            </div>
            )}
          </Card>

          <Card className={aiProvider ? "border-emerald-200" : "border-amber-200"}>
            <div className="flex items-start gap-3 px-6 py-4">
              <Sparkles
                className={
                  "mt-0.5 size-4 shrink-0 " + (aiProvider ? "text-emerald-500" : "text-amber-500")
                }
              />
              <div>
                <p className="text-[13.5px] font-semibold text-slate-800">
                  {dict.settings.aiProvider}
                </p>
                <p className="mt-0.5 text-[12.5px] text-slate-500">
                  {aiProvider
                    ? `${dict.settings.aiActive}: ${aiProvider.label} · ${aiProvider.model}`
                    : dict.settings.aiLocal}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <CreditCard className="size-4 text-slate-400" />
                  {dict.settings.billing}
                </span>
              }
              desc={dict.settings.billingDesc}
            />
            <div className="px-6 py-5">
              {!billing.managed ? (
                <p className="text-[12.5px] leading-relaxed text-slate-500">
                  {dict.settings.billingUnmanaged}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <Chip tone={billingTone[billing.status]}>
                      {dict.settings.billingStatus[billing.status]}
                    </Chip>
                    <p className="text-[13px] text-slate-600">
                      {dict.settings.billingActiveUntil}{" "}
                      <span className="font-semibold text-slate-800">
                        {formatDate(billing.activeUntil, locale)}
                      </span>
                    </p>
                    <form action={payRenewalInvoice} className="ml-auto">
                      <button className="rounded-lg bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-slate-700">
                        {pending?.snapRedirectUrl
                          ? dict.settings.billingPayPending
                          : dict.settings.billingPay}
                      </button>
                    </form>
                  </div>
                  {pending && !pending.snapRedirectUrl && !midtransConfigured() ? (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 ring-1 ring-inset ring-amber-200">
                      {dict.settings.billingDevHint}
                    </p>
                  ) : null}
                  <p className="mt-5 text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                    {dict.settings.billingInvoices}
                  </p>
                  {invoices.length === 0 ? (
                    <p className="mt-2 text-[12.5px] text-slate-500">
                      {dict.settings.billingNoInvoices}
                    </p>
                  ) : (
                    <div className="mt-2 divide-y divide-slate-100">
                      {invoices.map((inv) => (
                        <div key={inv.id} className="flex items-center gap-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-slate-800">
                              {inv.number}
                            </p>
                            <p className="text-[12px] text-slate-400">
                              {formatDate(inv.createdAt, locale)} · {inv.plan}
                            </p>
                          </div>
                          <p className="text-[13px] font-semibold text-slate-700">
                            {formatIdr(inv.amountIdr)}
                          </p>
                          <Chip
                            tone={
                              invoiceTone[inv.status as keyof typeof invoiceTone] ?? "slate"
                            }
                          >
                            {dict.settings.billingInvoiceStatus[
                              inv.status as keyof typeof dict.settings.billingInvoiceStatus
                            ] ?? inv.status}
                          </Chip>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-slate-400" />
                  {dict.settings.users} ({users.length}
                  {Number.isFinite(limits.users) ? `/${limits.users}` : ""})
                </span>
              }
            />
            <div className="divide-y divide-slate-100">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-6 py-3">
                  <Avatar name={u.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-slate-800">{u.name}</p>
                    <p className="truncate text-[12px] text-slate-400">{u.email}</p>
                  </div>
                  {!u.emailVerifiedAt ? (
                    <Chip tone="slate">{dict.settings.pendingVerification}</Chip>
                  ) : null}
                  <Chip tone={u.role === "super_admin" ? "brand" : "slate"}>
                    {dict.roles[u.role as keyof typeof dict.roles] ?? u.role}
                  </Chip>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100">
              <p className="px-6 pt-4 text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                {dict.settings.addTeammate}
              </p>
              <TeammateForm dict={dict} />
            </div>
          </Card>

          <Card className="border-slate-300 bg-slate-50/60">
            <div className="flex items-start gap-3 px-6 py-5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-slate-500" />
              <div>
                <p className="text-[13.5px] font-semibold text-slate-800">
                  {dict.settings.complianceNote}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
                  {dict.settings.complianceBody}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
