import { PublicHeader, PublicFooter, SHELL } from "@/components/public/chrome";
import type { Dict, Locale } from "@/lib/i18n";

/**
 * Shell for the public documents (Terms, Privacy, FAQ) that a payment
 * provider or a prospect reads before signing up.
 *
 * Same header, footer and ink-950 ground as the landing page, so following a
 * footer link never feels like arriving on a different site. The reading
 * column is narrower than the landing grid because this is long-form prose.
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
    <div className="min-h-screen bg-ink-950 text-white">
      <PublicHeader dict={dict} locale={locale} />

      <main className={`${SHELL} py-14 md:py-20`}>
        <div className="max-w-[68ch]">
          <h1 className="text-[30px] font-semibold tracking-tight text-white sm:text-[36px]">
            {title}
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-slate-300">{subtitle}</p>
          {meta ? <p className="mt-3 text-[13px] text-slate-400">{meta}</p> : null}

          <div className="mt-12">{children}</div>
        </div>
      </main>

      <PublicFooter dict={dict} />
    </div>
  );
}
