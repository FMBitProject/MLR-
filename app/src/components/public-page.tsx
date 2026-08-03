import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Dict, Locale } from "@/lib/i18n";

/**
 * Shell for the public, unauthenticated pages (Terms, Privacy, FAQ) —
 * the ones a payment provider or a prospect reads before signing up.
 */
export function PublicPage({
  dict,
  locale,
  title,
  subtitle,
  meta,
  children,
}: {
  dict: Dict;
  locale: Locale;
  title: string;
  subtitle: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <BrandLogo appName={dict.appName} tagline={dict.tagline} />
          <LocaleSwitcher locale={locale} />
        </div>

        <header className="mt-12">
          <h1 className="text-[30px] font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{subtitle}</p>
          {meta ? <p className="mt-3 text-[12.5px] text-slate-400">{meta}</p> : null}
        </header>

        <div className="mt-10">{children}</div>

        <nav className="mt-14 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 pt-6 text-[13px]">
          <Link href="/" className="font-medium text-slate-500 hover:text-brand-700">
            {dict.legal.backHome}
          </Link>
          <Link href="/pricing" className="font-medium text-slate-500 hover:text-brand-700">
            {dict.legal.pricing}
          </Link>
          <Link href="/terms" className="font-medium text-slate-500 hover:text-brand-700">
            {dict.legal.terms}
          </Link>
          <Link href="/privacy" className="font-medium text-slate-500 hover:text-brand-700">
            {dict.legal.privacy}
          </Link>
          <Link href="/faq" className="font-medium text-slate-500 hover:text-brand-700">
            {dict.legal.faq}
          </Link>
        </nav>
      </div>
    </div>
  );
}
