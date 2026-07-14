import Link from "next/link";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { getDict } from "@/lib/i18n-server";
import { findAccountToken } from "@/lib/account-tokens";
import { verifyEmailToken } from "@/lib/actions";
import { AcceptInviteForm } from "@/components/accept-invite-form";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/i18n";

function Shell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f6f8fa] px-6 py-12">
      <div className="absolute right-6 top-6">
        <LocaleSwitcher locale={locale} />
      </div>
      {children}
    </div>
  );
}

export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const { dict, locale } = await getDict();
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  const found = token ? await findAccountToken(token) : null;

  if (!found) {
    return (
      <Shell locale={locale}>
        <div className="w-full max-w-md animate-fade-up text-center">
          <XCircle className="mx-auto size-10 text-rose-500" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            {dict.verifyEmail.invalidTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{dict.verifyEmail.invalidBody}</p>
          <Link
            href="/login"
            className="mt-6 inline-block font-medium text-brand-700 hover:text-brand-800"
          >
            {dict.verifyEmail.goToLogin}
          </Link>
        </div>
      </Shell>
    );
  }

  if (found.purpose === "invite") {
    const tenant = (
      await db.select().from(t.tenants).where(eq(t.tenants.id, found.user.tenantId))
    )[0];
    return (
      <Shell locale={locale}>
        <AcceptInviteForm dict={dict} token={token} tenantName={tenant?.name ?? "MLR Flow"} />
      </Shell>
    );
  }

  // purpose === "verify": confirming the click IS the action, no extra submit.
  const result = await verifyEmailToken(token);

  return (
    <Shell locale={locale}>
      <div className="w-full max-w-md animate-fade-up text-center">
        {result.status === "ok" ? (
          <>
            <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
              {dict.verifyEmail.verifiedTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{dict.verifyEmail.verifiedBody}</p>
          </>
        ) : (
          <>
            <ShieldCheck className="mx-auto size-10 text-slate-300" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
              {dict.verifyEmail.invalidTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{dict.verifyEmail.invalidBody}</p>
          </>
        )}
        <Link
          href="/login"
          className="mt-6 inline-block font-medium text-brand-700 hover:text-brand-800"
        >
          {dict.verifyEmail.goToLogin}
        </Link>
      </div>
    </Shell>
  );
}
