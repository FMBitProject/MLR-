import Link from "next/link";
import { XCircle } from "lucide-react";
import { getDict } from "@/lib/i18n-server";
import { findAccountToken } from "@/lib/account-tokens";
import { RequestResetForm, SetNewPasswordForm } from "@/components/reset-password-forms";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/i18n";

function Shell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-950 px-6 py-12">
      <div className="absolute right-6 top-6">
        <LocaleSwitcher locale={locale} variant="dark" />
      </div>
      {children}
    </div>
  );
}

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { dict, locale } = await getDict();
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  if (!token) {
    return (
      <Shell locale={locale}>
        <RequestResetForm dict={dict} />
      </Shell>
    );
  }

  const found = await findAccountToken(token);
  if (!found || found.purpose !== "reset") {
    return (
      <Shell locale={locale}>
        <div className="w-full max-w-md animate-fade-up text-center">
          <XCircle className="mx-auto size-10 text-rose-500" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            {dict.verifyEmail.invalidTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{dict.resetPassword.invalid}</p>
          <Link
            href="/reset-password"
            className="mt-6 inline-block font-medium text-brand-300 transition hover:text-brand-200"
          >
            {dict.resetPassword.requestTitle}
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell locale={locale}>
      <SetNewPasswordForm dict={dict} token={token} email={found.user.email} />
    </Shell>
  );
}
