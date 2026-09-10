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
import { PublicHeader, PublicFooter, SHELL, CTA } from "@/components/public/chrome";

export const metadata = { title: "Paket & Harga · Intellibase MLR Flow" };

/**
 * Public marketing page, no auth. Every number comes from the PLANS catalog
 * so the page can never drift from what the app actually enforces.
 *
 * The three plans sit in one hairline-divided panel rather than three floating
 * cards: it is a comparison, and a shared grid makes rows line up across
 * plans. The recommended plan is marked with a tint and a pill, not with a
 * second accent hue.
 */
export default async function PricingPage() {
  const { dict, locale } = await getDict();
  const p = dict.pricing;
  // Enterprise CTA: mailto when a sales inbox is configured, else register.
  const salesEmail = process.env.SALES_EMAIL;

  const order: PlanId[] = ["starter", "growth", "enterprise"];

  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <PublicHeader dict={dict} locale={locale} />

      <main className={`${SHELL} py-14 md:py-20`}>
        <div className="max-w-[46ch]">
          <h1 className="text-[30px] font-semibold tracking-tight text-white sm:text-[36px]">
            {p.title}
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-slate-300">{p.subtitle}</p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 lg:grid lg:grid-cols-3 lg:divide-x lg:divide-white/10">
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
                  "flex flex-col border-t border-white/10 p-7 first:border-t-0 lg:border-t-0 " +
                  (highlighted ? "bg-white/[0.05]" : "")
                }
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-[17px] font-semibold text-white">{name}</h2>
                  {highlighted ? (
                    <span className="rounded-full bg-brand-300 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-950">
                      {p.recommended}
                    </span>
                  ) : null}
                </div>

                <p className="mt-4">
                  {plan.monthlyPriceIdr === null ? (
                    <span className="text-[30px] font-semibold tracking-tight text-white">
                      {p.customPrice}
                    </span>
                  ) : isFreePlan(plan) ? (
                    <span className="text-[30px] font-semibold tracking-tight text-white">
                      {p.free}
                    </span>
                  ) : (
                    <>
                      {promoActive(plan) ? (
                        <span className="mr-2 text-[15px] font-medium text-slate-400 line-through">
                          {formatIdr(plan.monthlyPriceIdr)}
                        </span>
                      ) : null}
                      <span className="text-[30px] font-semibold tracking-tight text-white">
                        {formatIdr(effectivePriceIdr(plan) ?? plan.monthlyPriceIdr)}
                      </span>
                      <span className="text-[13px] text-slate-400">{p.perMonth}</span>
                    </>
                  )}
                </p>

                {/* Fixed-height row whether or not there is a promo, so the
                    feature lists start on the same baseline in all three
                    columns of the shared panel. */}
                <div className="mt-2 min-h-[26px]">
                  {promoActive(plan) && plan.promoEndsAt ? (
                    <p className="inline-flex w-fit rounded-full border border-brand-300/35 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-200">
                      {/* Noon UTC so the calendar date survives formatting in any server TZ */}
                      {p.promoUntil} {formatDate(new Date(`${plan.promoEndsAt}T12:00:00Z`), locale)}
                    </p>
                  ) : null}
                </div>

                <p className="mt-2 min-h-12 text-[13.5px] leading-relaxed text-slate-400">
                  {p.taglines[id]}
                </p>

                <ul className="mt-6 space-y-2.5 border-t border-white/10 pt-6 text-[13.5px] text-slate-300">
                  {usage.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 font-semibold text-white">
                      <Check
                        aria-hidden
                        strokeWidth={1.75}
                        className="mt-0.5 size-4 shrink-0 text-brand-300"
                      />
                      {line}
                    </li>
                  ))}
                  {p.featureLists[id].map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <Check
                        aria-hidden
                        strokeWidth={1.75}
                        className="mt-0.5 size-4 shrink-0 text-brand-300"
                      />
                      {line}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  {/* Every plan is self-serve: sign up free, then upgrade from
                      Settings whenever the team outgrows Starter. */}
                  <Link
                    href="/register"
                    className={`${highlighted ? CTA.primary : CTA.secondary} w-full`}
                  >
                    {isFreePlan(plan) ? p.startFreeCta : p.startCta}
                  </Link>
                  {id === "enterprise" && salesEmail ? (
                    <a
                      href={`mailto:${salesEmail}`}
                      className="mt-3 block text-center text-[13px] font-medium text-slate-400 transition hover:text-brand-300"
                    >
                      {p.contactSales}
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 max-w-[70ch] text-[13px] leading-relaxed text-slate-400">
          {p.footnote}
        </p>
        <p className="mt-4 text-[14px] text-slate-300">
          {p.haveWorkspace}{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-300 underline-offset-4 transition hover:text-brand-200 hover:underline"
          >
            {p.signIn}
          </Link>
        </p>
      </main>

      <PublicFooter dict={dict} />
    </div>
  );
}
