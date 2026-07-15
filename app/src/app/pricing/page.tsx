import Link from "next/link";
import { Check } from "lucide-react";
import { getDict } from "@/lib/i18n-server";
import { formatDate } from "@/lib/i18n";
import { PLANS, formatIdr, promoActive, effectivePriceIdr, type PlanId } from "@/lib/plans";
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
    <div className="min-h-screen bg-[#f6f8fa] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <BrandLogo appName={dict.appName} tagline={dict.tagline} />
          <LocaleSwitcher locale={locale} />
        </div>

        <div className="mt-12 text-center">
          <h1 className="text-[32px] font-semibold tracking-tight text-slate-900">
            {p.title}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-500">
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
                  "relative flex flex-col rounded-2xl border bg-white p-7 shadow-card " +
                  (highlighted ? "border-brand-500 ring-4 ring-brand-500/10" : "border-slate-200")
                }
              >
                {highlighted ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-700 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                    {p.recommended}
                  </span>
                ) : null}

                <h2 className="text-[15px] font-bold uppercase tracking-wider text-slate-500">
                  {name}
                </h2>
                <p className="mt-3">
                  {plan.monthlyPriceIdr !== null ? (
                    <>
                      {promoActive(plan) ? (
                        <span className="mr-2 text-[15px] font-medium text-slate-400 line-through">
                          {formatIdr(plan.monthlyPriceIdr)}
                        </span>
                      ) : null}
                      <span className="text-[28px] font-semibold tracking-tight text-slate-900">
                        {formatIdr(effectivePriceIdr(plan) ?? plan.monthlyPriceIdr)}
                      </span>
                      <span className="text-[13px] text-slate-400">{p.perMonth}</span>
                    </>
                  ) : (
                    <span className="text-[28px] font-semibold tracking-tight text-slate-900">
                      {p.customPrice}
                    </span>
                  )}
                </p>
                {promoActive(plan) && plan.promoEndsAt ? (
                  <p className="mt-1 inline-flex w-fit rounded-full bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                    {/* Noon UTC so the calendar date survives formatting in any server TZ */}
                    {p.promoUntil} {formatDate(new Date(`${plan.promoEndsAt}T12:00:00Z`), locale)}
                  </p>
                ) : null}
                <p className="mt-2 min-h-10 text-[13px] leading-relaxed text-slate-500">
                  {p.taglines[id]}
                </p>

                <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-5 text-[13.5px] text-slate-700">
                  {usage.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 font-semibold">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />
                      {line}
                    </li>
                  ))}
                  {p.featureLists[id].map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />
                      {line}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-7">
                  {id === "enterprise" ? (
                    <a
                      href={salesEmail ? `mailto:${salesEmail}` : "/register"}
                      className="block rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      {p.contactSales}
                    </a>
                  ) : (
                    <Link
                      href="/register"
                      className={
                        "block rounded-xl px-5 py-2.5 text-center text-sm font-semibold shadow-sm transition " +
                        (highlighted
                          ? "bg-brand-700 text-white hover:bg-brand-800"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50")
                      }
                    >
                      {p.startCta}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[12.5px] text-slate-400">{p.footnote}</p>
        <p className="mt-3 text-center text-[13px] text-slate-500">
          {p.haveWorkspace}{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">
            {p.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
