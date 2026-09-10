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
import { TITLE, SUBTITLE } from "@/components/public/field";

function Shell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-950 px-6 py-12">
      <div className="absolute right-6 top-6">
        <LocaleSwitcher locale={locale} variant="dark" />
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
          <XCircle aria-hidden strokeWidth={1.5} className="mx-auto size-10 text-rose-300" />
          <h1 className={`mt-4 ${TITLE}`}>
            {dict.verifyEmail.invalidTitle}
          </h1>
          <p className={SUBTITLE}>{dict.verifyEmail.invalidBody}</p>
          <Link
            href="/login"
            className="mt-6 inline-block font-semibold text-brand-300 transition hover:text-brand-200"
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
        <AcceptInviteForm dict={dict} token={token} tenantName={tenant?.name ?? "Intellibase MLR Flow"} />
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
            <CheckCircle2 aria-hidden strokeWidth={1.5} className="mx-auto size-10 text-brand-300" />
            <h1 className={`mt-4 ${TITLE}`}>
              {dict.verifyEmail.verifiedTitle}
            </h1>
            <p className={SUBTITLE}>{dict.verifyEmail.verifiedBody}</p>
          </>
        ) : (
          <>
            <ShieldCheck aria-hidden strokeWidth={1.5} className="mx-auto size-10 text-slate-400" />
            <h1 className={`mt-4 ${TITLE}`}>
              {dict.verifyEmail.invalidTitle}
            </h1>
            <p className={SUBTITLE}>{dict.verifyEmail.invalidBody}</p>
          </>
        )}
        <Link
          href="/login"
          className="mt-6 inline-block font-semibold text-brand-300 transition hover:text-brand-200"
        >
          {dict.verifyEmail.goToLogin}
        </Link>
      </div>
    </Shell>
  );
}
