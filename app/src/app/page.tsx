import Link from "next/link";
import { redirect } from "next/navigation";
import { GitBranch, Sparkles, FileSearch, ShieldCheck, ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { PLANS, formatIdr, promoActive, effectivePriceIdr, type PlanId } from "@/lib/plans";
import { BrandLogo } from "@/components/brand-logo";
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
    <div className="min-h-screen bg-[#f6f8fa]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <BrandLogo appName={dict.appName} tagline={dict.tagline} />
        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200/60"
          >
            {l.signIn}
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
          >
            {l.register}
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-brand-500/10 blur-3xl"
        />
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center">
          <p className="mx-auto w-fit rounded-full bg-brand-50 px-3.5 py-1 text-[12.5px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
            {l.heroBadge}
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-[40px] font-semibold leading-[1.12] tracking-tight text-slate-900 sm:text-[48px]">
            {l.heroTitle}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-slate-500">
            {l.heroSubtitle}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-[15px] font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99]"
            >
              {l.ctaPrimary}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {l.ctaSecondary}
            </Link>
          </div>
          <p className="mt-6 text-[12.5px] text-slate-400">{l.footerCompliance}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-center text-[26px] font-semibold tracking-tight text-slate-900">
          {l.featuresTitle}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {l.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? ShieldCheck;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-inset ring-brand-200">
                  <Icon className="size-5 text-brand-700" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-[26px] font-semibold tracking-tight text-slate-900">
            {l.howTitle}
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {l.how.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-700 text-[14px] font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[15.5px] font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-[26px] font-semibold tracking-tight text-slate-900">
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
                  "rounded-2xl border bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg " +
                  (id === "growth" ? "border-brand-500" : "border-slate-200")
                }
              >
                <p className="text-[13px] font-bold uppercase tracking-wider text-slate-500">
                  {name}
                </p>
                <p className="mt-2">
                  {price !== null ? (
                    <>
                      {promoActive(plan) && plan.monthlyPriceIdr !== null ? (
                        <span className="mr-2 text-[13px] font-medium text-slate-400 line-through">
                          {formatIdr(plan.monthlyPriceIdr)}
                        </span>
                      ) : null}
                      <span className="text-[22px] font-semibold tracking-tight text-slate-900">
                        {formatIdr(price)}
                      </span>
                      <span className="text-[12.5px] text-slate-400">{p.perMonth}</span>
                    </>
                  ) : (
                    <span className="text-[22px] font-semibold tracking-tight text-slate-900">
                      {p.customPrice}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                  {p.taglines[id]}
                </p>
              </Link>
            );
          })}
        </div>
        <p className="mt-8 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-700 hover:text-brand-800"
          >
            {l.pricingCta}
            <ArrowRight className="size-4" />
          </Link>
        </p>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <BrandLogo appName={dict.appName} tagline={dict.tagline} />
          <p className="text-[12.5px] text-slate-400">{l.footerCompliance}</p>
        </div>
      </footer>
    </div>
  );
}
