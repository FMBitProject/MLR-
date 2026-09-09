import Link from "next/link";
import { redirect } from "next/navigation";
import { GitBranch, Sparkles, FileSearch, ShieldCheck, ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import {
  PLANS,
  formatIdr,
  promoActive,
  effectivePriceIdr,
  isFreePlan,
  type PlanId,
} from "@/lib/plans";
import { BrandLogo } from "@/components/brand-logo";
import { AeroHero } from "@/components/ui/aero-hero-3";
import { LocaleSwitcher } from "@/components/locale-switcher";

const FEATURE_ICONS = [GitBranch, Sparkles, FileSearch, ShieldCheck];

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const { dict, locale } = await getDict();
  const l = dict.landing;
  const p = dict.pricing;
  const order: PlanId[] = ["starter", "growth", "enterprise"];

  return (
    <div className="relative min-h-screen bg-brand-950 text-white">
      <header className="absolute inset-x-0 top-0 z-30 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <BrandLogo appName={dict.appName} tagline={dict.tagline} variant="dark" />
        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            {l.signIn}
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-brand-300 px-4 py-2 text-sm font-semibold text-brand-950 shadow-sm transition hover:bg-brand-200"
          >
            {l.register}
          </Link>
        </div>
      </header>

      <AeroHero
        eyebrow={l.heroBadge}
        title={l.heroTitle}
        subtitle={l.heroSubtitle}
        ctaLabel={l.ctaPrimary}
        ctaHref="/register"
      />

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6 pb-16 pt-10 text-center">
        <Link
          href="/pricing"
          className="rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-[15px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
        >
          {l.ctaSecondary}
        </Link>
        <p className="text-[12.5px] text-slate-400">{l.footerCompliance}</p>
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-center text-[26px] font-semibold tracking-tight text-white">
          {l.featuresTitle}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {l.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? ShieldCheck;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand-400/15 ring-1 ring-inset ring-brand-400/30">
                  <Icon className="size-5 text-brand-300" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-300">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-[26px] font-semibold tracking-tight text-white">
            {l.howTitle}
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {l.how.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-400 text-[14px] font-bold text-brand-950">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[15.5px] font-semibold text-white">{step.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-300">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-[26px] font-semibold tracking-tight text-white">
          {l.pricingTitle}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {order.map((id) => {
            const plan = PLANS[id];
            const name = id.charAt(0).toUpperCase() + id.slice(1);
            const price = effectivePriceIdr(plan);
            return (
              <Link
                key={id}
                href="/pricing"
                className={
                  "rounded-2xl border bg-white/5 p-6 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/10 " +
                  (id === "growth" ? "border-brand-400" : "border-white/10")
                }
              >
                <p className="text-[13px] font-bold uppercase tracking-wider text-brand-300">
                  {name}
                </p>
                <p className="mt-2">
                  {price === null ? (
                    <span className="text-[22px] font-semibold tracking-tight text-white">
                      {p.customPrice}
                    </span>
                  ) : isFreePlan(plan) ? (
                    <span className="text-[22px] font-semibold tracking-tight text-white">
                      {p.free}
                    </span>
                  ) : (
                    <>
                      {promoActive(plan) && plan.monthlyPriceIdr !== null ? (
                        <span className="mr-2 text-[13px] font-medium text-slate-400 line-through">
                          {formatIdr(plan.monthlyPriceIdr)}
                        </span>
                      ) : null}
                      <span className="text-[22px] font-semibold tracking-tight text-white">
                        {formatIdr(price)}
                      </span>
                      <span className="text-[12.5px] text-slate-400">{p.perMonth}</span>
                    </>
                  )}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
                  {p.taglines[id]}
                </p>
              </Link>
            );
          })}
        </div>
        <p className="mt-8 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-300 hover:text-brand-200"
          >
            {l.pricingCta}
            <ArrowRight className="size-4" />
          </Link>
        </p>
      </section>

      <footer className="border-t border-white/10 bg-white/[0.03]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <BrandLogo appName={dict.appName} tagline={dict.tagline} variant="dark" />
          <div className="flex flex-col items-center gap-3 sm:items-end">
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12.5px]">
              <Link href="/pricing" className="text-slate-400 hover:text-brand-300">
                {dict.legal.pricing}
              </Link>
              <Link href="/faq" className="text-slate-400 hover:text-brand-300">
                {dict.legal.faq}
              </Link>
              <Link href="/terms" className="text-slate-400 hover:text-brand-300">
                {dict.legal.terms}
              </Link>
              <Link href="/privacy" className="text-slate-400 hover:text-brand-300">
                {dict.legal.privacy}
              </Link>
            </nav>
            <p className="text-[12.5px] text-slate-400">{l.footerCompliance}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
