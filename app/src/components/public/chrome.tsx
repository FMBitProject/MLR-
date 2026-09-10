import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Dict, Locale } from "@/lib/i18n";

/** Shared max width + gutters for every public page. */
export const SHELL = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/**
 * One CTA label per intent, used identically in the header, the hero and the
 * closing band: `landing.ctaPrimary` for signup, `landing.ctaSecondary` for
 * pricing, `landing.signIn` for sign-in. Nothing on the public surface should
 * introduce a second wording for any of the three.
 */
export const CTA = {
  primary:
    "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-xl bg-brand-300 px-5 text-[15px] font-semibold text-brand-950 transition hover:bg-brand-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300",
  secondary:
    "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-xl border border-white/20 px-5 text-[15px] font-semibold text-white transition hover:border-white/35 hover:bg-white/[0.06] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300",
};

/**
 * Public header. Fixed at 64px, one line at every breakpoint: the two nav
 * links drop below `md` rather than wrapping, and both buttons keep their
 * labels on one line via `whitespace-nowrap`.
 */
export function PublicHeader({ dict, locale }: { dict: Dict; locale: Locale }) {
  const l = dict.landing;
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur-md">
      <div className={`${SHELL} flex h-16 items-center justify-between gap-4`}>
        <BrandLogo appName={dict.appName} variant="dark" />

        <nav className="hidden items-center gap-7 text-[14px] font-medium text-slate-300 md:flex">
          <Link href="/pricing" className="transition hover:text-white">
            {dict.legal.pricing}
          </Link>
          <Link href="/faq" className="transition hover:text-white">
            {dict.legal.faq}
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher locale={locale} variant="dark" />
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-xl px-2 text-[14px] font-semibold text-slate-200 transition hover:text-white sm:px-3 sm:text-[15px]"
          >
            {l.signIn}
          </Link>
          <Link href="/register" className={`${CTA.primary} h-10 px-3.5 text-[13.5px] sm:px-4 sm:text-[14px]`}>
            {l.ctaPrimary}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ dict }: { dict: Dict }) {
  const links = [
    { href: "/pricing", label: dict.legal.pricing },
    { href: "/faq", label: dict.legal.faq },
    { href: "/terms", label: dict.legal.terms },
    { href: "/privacy", label: dict.legal.privacy },
  ];
  return (
    <footer className="border-t border-white/10">
      <div
        className={`${SHELL} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div>
          <BrandLogo appName={dict.appName} variant="dark" />
          <p className="mt-3 text-[13px] text-slate-400">{dict.landing.footerCompliance}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px]">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-slate-400 transition hover:text-brand-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
