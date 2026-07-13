import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Building2, GitBranch, Users, Sparkles, ShieldAlert } from "lucide-react";
import { db, t } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { formatDate } from "@/lib/i18n";
import { saveWorkflow } from "@/lib/actions";
import { getLlmProvider } from "@/lib/llm";
import { Avatar, Card, CardHeader, Chip, PageHeader } from "@/components/ui";
import { TeammateForm } from "@/components/teammate-form";

const CHANNELS = ["print", "digital", "e-detail", "social"] as const;
const ROLES = ["medical_reviewer", "legal_reviewer", "regulatory_reviewer"] as const;

export default async function SettingsPage() {
  const user = await requireUser();
  if (!["compliance_admin", "super_admin"].includes(user.role)) redirect("/dashboard");
  const { dict, locale } = await getDict();

  const tenant = (await db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)))[0];
  const users = await db.select().from(t.users).where(eq(t.users.tenantId, user.tenantId));
  const templates = await db
    .select()
    .from(t.workflowTemplates)
    .where(eq(t.workflowTemplates.tenantId, user.tenantId));

  const aiProvider = getLlmProvider();

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
                <p className="mt-1 text-[12px] text-slate-400">
                  {formatDate(tenant?.createdAt ?? null, locale)}
                </p>
              </div>
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
                  <Users className="size-4 text-slate-400" />
                  {dict.settings.users} ({users.length})
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
