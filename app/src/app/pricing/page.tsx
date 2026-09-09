import Link from "next/link";
import { Check } from "lucide-react";
import { getDict } from "@/lib/i18n-server";
import { formatDate } from "@/lib/i18n";
import {
  PLANS,
  formatIdr,
  promoActive,
  effectivePriceIdr,
  isFreePlan,
  type PlanId,
} from "@/lib/plans";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";

// Public marketing page — no auth. Numbers come from the PLANS catalog so
// the page can never drift from what the app actually enforces.
export default async function PricingPage() {
  const { dict, locale } = await getDict();
  const p = dict.pricing;
  // Enterprise CTA: mailto when a sales inbox is configured, else register.
  const salesEmail = process.env.SALES_EMAIL;

  const order: PlanId[] = ["starter", "growth", "enterprise"];

  return (
    <div className="min-h-screen bg-brand-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <BrandLogo appName={dict.appName} tagline={dict.tagline} variant="dark" />
          <LocaleSwitcher locale={locale} />
        </div>

        <div className="mt-12 text-center">
          <h1 className="text-[32px] font-semibold tracking-tight text-white">
            {p.title}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-300">
            {p.subtitle}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {order.map((id) => {
            const plan = PLANS[id];
            const highlighted = id === "growth";
            const name = id.charAt(0).toUpperCase() + id.slice(1);
            const usage =
              id === "enterprise"
                ? [p.unlimitedUsage]
                : [
                    `${plan.limits.users} ${p.usersUnit}`,
                    `${plan.limits.products} ${p.productsUnit}`,
                    `${plan.limits.submissionsPerMonth} ${p.submissionsUnit}`,
                  ];
            return (
              <div
                key={id}
                className={
                  "relative flex flex-col rounded-2xl border bg-white/5 p-7 backdrop-blur-sm " +
                  (highlighted ? "border-brand-400 ring-4 ring-brand-400/10" : "border-white/10")
                }
              >
                {highlighted ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-300 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-950">
                    {p.recommended}
                  </span>
                ) : null}

                <h2 className="text-[15px] font-bold uppercase tracking-wider text-brand-300">
                  {name}
                </h2>
                <p className="mt-3">
                  {plan.monthlyPriceIdr === null ? (
                    <span className="text-[28px] font-semibold tracking-tight text-white">
                      {p.customPrice}
                    </span>
                  ) : isFreePlan(plan) ? (
                    <span className="text-[28px] font-semibold tracking-tight text-white">
                      {p.free}
                    </span>
                  ) : (
                    <>
                      {promoActive(plan) ? (
                        <span className="mr-2 text-[15px] font-medium text-slate-400 line-through">
                          {formatIdr(plan.monthlyPriceIdr)}
                        </span>
                      ) : null}
                      <span className="text-[28px] font-semibold tracking-tight text-white">
                        {formatIdr(effectivePriceIdr(plan) ?? plan.monthlyPriceIdr)}
                      </span>
                      <span className="text-[13px] text-slate-400">{p.perMonth}</span>
                    </>
                  )}
                </p>
                {promoActive(plan) && plan.promoEndsAt ? (
                  <p className="mt-1 inline-flex w-fit rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/30">
                    {/* Noon UTC so the calendar date survives formatting in any server TZ */}
                    {p.promoUntil} {formatDate(new Date(`${plan.promoEndsAt}T12:00:00Z`), locale)}
                  </p>
                ) : null}
                <p className="mt-2 min-h-10 text-[13px] leading-relaxed text-slate-300">
                  {p.taglines[id]}
                </p>

                <ul className="mt-5 space-y-2.5 border-t border-white/10 pt-5 text-[13.5px] text-slate-200">
                  {usage.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 font-semibold">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-300" />
                      {line}
                    </li>
                  ))}
                  {p.featureLists[id].map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-300" />
                      {line}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-7">
                  {/* Every plan is self-serve now: sign up free, then upgrade
                      from Settings whenever the team outgrows Starter. */}
                  <Link
                    href="/register"
                    className={
                      "block rounded-xl px-5 py-2.5 text-center text-sm font-semibold shadow-sm transition " +
                      (highlighted
                        ? "bg-brand-300 text-brand-950 hover:bg-brand-200"
                        : "border border-white/25 bg-white/5 text-white hover:bg-white/10")
                    }
                  >
                    {isFreePlan(plan) ? p.startFreeCta : p.startCta}
                  </Link>
                  {id === "enterprise" && salesEmail ? (
                    <a
                      href={`mailto:${salesEmail}`}
                      className="mt-2 block text-center text-[12.5px] font-medium text-slate-400 hover:text-brand-300 hover:underline"
                    >
                      {p.contactSales}
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[12.5px] text-slate-400">{p.footnote}</p>
        <p className="mt-3 text-center text-[13px] text-slate-300">
          {p.haveWorkspace}{" "}
          <Link href="/login" className="font-semibold text-brand-300 hover:underline">
            {p.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
