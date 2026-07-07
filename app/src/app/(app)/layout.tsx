import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { LogOut, ShieldCheck } from "lucide-react";
import { db, t } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { logout } from "@/lib/actions";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Avatar } from "@/components/ui";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { dict, locale } = await getDict();

  const tenant = db.select().from(t.tenants).where(eq(t.tenants.id, user.tenantId)).get();

  const queueCount = db
    .select()
    .from(t.contentSubmissions)
    .where(
      and(
        eq(t.contentSubmissions.tenantId, user.tenantId),
        eq(t.contentSubmissions.status, "in_review"),
        eq(t.contentSubmissions.currentStage, user.role),
      ),
    )
    .all().length;

  const items: NavItem[] = [
    { key: "dashboard", href: "/dashboard", label: dict.nav.dashboard },
    {
      key: "submissions",
      href: "/submissions",
      label: dict.nav.submissions,
      badge: queueCount || undefined,
    },
    { key: "claims", href: "/claims", label: dict.nav.claims },
  ];
  if (["compliance_admin", "super_admin"].includes(user.role)) {
    items.push({ key: "audit", href: "/audit", label: dict.nav.audit });
    items.push({ key: "settings", href: "/settings", label: dict.nav.settings });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col bg-gradient-to-b from-[#0b1220] via-[#0d1626] to-brand-950 px-4 py-6">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-500/15 ring-1 ring-brand-400/25">
            <ShieldCheck className="size-[18px] text-brand-300" />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-white">
              {dict.appName}
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {tenant?.name}
            </p>
          </div>
        </div>

        <SidebarNav items={items} />

        <div className="mt-auto">
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-2.5">
              <Avatar name={user.name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
                <p className="truncate text-[11px] text-slate-400">
                  {dict.roles[user.role as keyof typeof dict.roles]}
                </p>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  title={dict.nav.logout}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col pl-[248px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b border-slate-200/70 bg-[#f6f8fa]/80 px-8 backdrop-blur">
          <LocaleSwitcher locale={locale} />
        </header>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
