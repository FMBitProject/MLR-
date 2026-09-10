import Link from "next/link";
import { redirect } from "next/navigation";
import { GitBranch, Sparkles, FileSearch, ShieldCheck } from "lucide-react";
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
import { PublicHeader, PublicFooter, SHELL, CTA } from "@/components/public/chrome";
import { Hero } from "@/components/public/hero";

const FEATURE_ICONS = [GitBranch, Sparkles, FileSearch, ShieldCheck];

/**
 * Landing page. Six sections, six different layout families: split hero,
 * hairline assurance row, asymmetric bento, sticky rail, divided plan panel,
 * closing band. Nothing here repeats another section's shape, and the hero
 * eyebrow is the only uppercase micro-label on the page.
 *
 */
/**
 * One photograph per feature cell, in feature order. Each URL was checked to
 * resolve before being used here: a 404 on Unsplash renders as bare alt text,
 * which is how the previous placeholder shipped broken.
 *
 * TODO: stock stand-ins. Replace with brand photography before launch.
 */
const BENTO_IMAGES = [
  // Multi-stage workflow: a pharmaceutical lab.
  "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=900&h=760&q=80",
  // AI claims check: a screen of data being read.
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=760&h=760&q=80",
  // Page-by-page review: a document being marked up by hand.
  "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=760&h=620&q=80",
  // Audit trail: an archive, kept in full.
  "https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=900&h=620&q=80",
];

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const { dict, locale } = await getDict();
  const l = dict.landing;
  const p = dict.pricing;
  const order: PlanId[] = ["starter", "growth", "enterprise"];

  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <PublicHeader dict={dict} locale={locale} />

      <main>
        <Hero
          eyebrow={l.heroBadge}
          title={l.heroTitle}
          subtitle={l.heroSubtitle}
          primaryLabel={l.ctaPrimary}
          secondaryLabel={l.ctaSecondary}
          imageAlt={l.heroImageAlt}
        />

        {/* Assurances. Grouped by hairlines rather than boxed in cards, and
            kept out of the hero so the hero stays a single moment. */}
        <section className={`${SHELL} border-t border-white/10 py-10`}>
          <dl className="grid grid-cols-1 gap-y-8 sm:grid-cols-3 sm:gap-x-10 sm:divide-x sm:divide-white/10">
            {l.assurances.map((item, i) => (
              <div key={item.title} className={i > 0 ? "sm:pl-10" : undefined}>
                <dt className="text-[15px] font-semibold text-white">{item.title}</dt>
                <dd className="mt-1.5 text-[14px] leading-relaxed text-slate-400">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Features. Four items, exactly four cells, rows of 7+5 then 5+7 so
            the grid is asymmetric rather than a row of identical cards. Every
            cell carries its own photograph under a scrim, and the AI cell adds
            a brand wash on top so the two cells in a row are never the same
            tone. */}
        <section className={`${SHELL} py-20 md:py-28`}>
          <h2 className="max-w-[32ch] text-[26px] font-semibold tracking-tight text-white sm:text-[32px]">
            {l.featuresTitle}
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-12">
            {l.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? ShieldCheck;
              // 0 and 3 take 7 columns, 1 and 2 take 5, giving 7+5 / 5+7.
              const wide = i === 0 || i === 3;
              // The AI cell keeps a brand wash over its photograph, so the two
              // cells in each row never read as the same tone.
              const hasWash = i === 1;
              return (
                <article
                  key={f.title}
                  className={
                    "relative flex min-h-[17rem] flex-col justify-end overflow-hidden rounded-2xl border border-white/10 p-7 " +
                    (wide ? "md:col-span-7 " : "md:col-span-5 ") +
                    // Row 1 runs taller than row 2, which is what keeps the
                    // grid from reading as four equal tiles.
                    (i < 2 ? "md:min-h-[21rem] " : "md:min-h-[18rem] ")
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={BENTO_IMAGES[i]}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover"
                  />
                  {/* Scrim, then the ink ground rising from the bottom, so the
                      copy sits on solid colour rather than on the photograph. */}
                  <div aria-hidden className="absolute inset-0 bg-brand-950/50" />
                  {hasWash ? (
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-br from-brand-700/55 via-brand-900/45 to-ink-950/70"
                    />
                  ) : null}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/75 to-ink-950/15"
                  />

                  <div className="relative">
                    <Icon
                      aria-hidden
                      strokeWidth={1.75}
                      className="size-5 text-brand-300"
                    />
                    <h3 className="mt-4 text-[16.5px] font-semibold text-white">{f.title}</h3>
                    <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-slate-300">
                      {f.desc}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* How it works. A rail, not numbered circles: the step's own verb is
            the label, so there is no "Stage 1 / Stage 2" scaffolding. */}
        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className={`${SHELL} grid grid-cols-1 gap-10 py-20 md:grid-cols-12 md:py-24`}>
            <h2 className="text-[26px] font-semibold tracking-tight text-white sm:text-[32px] md:col-span-4 md:self-start">
              {l.howTitle}
            </h2>
            <ol className="md:col-span-8">
              {l.how.map((step) => (
                <li
                  key={step.title}
                  className="border-t border-white/10 py-6 first:border-t-0 first:pt-0"
                >
                  <h3 className="text-[17px] font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-slate-300">
                    {step.desc}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Plans. One panel split by hairlines, so it reads as a comparison
            rather than as three more cards. Numbers come from the PLANS
            catalog, never from prose. */}
        <section className={`${SHELL} py-20 md:py-28`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-[26px] font-semibold tracking-tight text-white sm:text-[32px]">
              {l.pricingTitle}
            </h2>
            <Link
              href="/pricing"
              className="text-[14.5px] font-semibold text-brand-300 underline-offset-4 transition hover:text-brand-200 hover:underline"
            >
              {l.ctaSecondary}
            </Link>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-white/10">
            {order.map((id) => {
              const plan = PLANS[id];
              const price = effectivePriceIdr(plan);
              return (
                <Link
                  key={id}
                  href="/pricing"
                  className="block border-t border-white/10 p-7 transition first:border-t-0 hover:bg-white/[0.04] sm:border-t-0"
                >
                  <p className="text-[15px] font-semibold text-brand-300">
                    {id.charAt(0).toUpperCase() + id.slice(1)}
                  </p>
                  <p className="mt-3">
                    {price === null ? (
                      <span className="text-[24px] font-semibold tracking-tight text-white">
                        {p.customPrice}
                      </span>
                    ) : isFreePlan(plan) ? (
                      <span className="text-[24px] font-semibold tracking-tight text-white">
                        {p.free}
                      </span>
                    ) : (
                      <>
                        {promoActive(plan) && plan.monthlyPriceIdr !== null ? (
                          <span className="mr-2 text-[13.5px] font-medium text-slate-400 line-through">
                            {formatIdr(plan.monthlyPriceIdr)}
                          </span>
                        ) : null}
                        <span className="text-[24px] font-semibold tracking-tight text-white">
                          {formatIdr(price)}
                        </span>
                        <span className="text-[13px] text-slate-400">{p.perMonth}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400">
                    {p.taglines[id]}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Closing band. One CTA, the same signup label used in the header and
            the hero. */}
        <section className="border-t border-white/10 bg-white/[0.02]">
          <div className={`${SHELL} flex flex-col items-start gap-6 py-16 sm:flex-row sm:items-center sm:justify-between`}>
            <h2 className="max-w-[34ch] text-[24px] font-semibold tracking-tight text-white sm:text-[28px]">
              {l.closingTitle}
            </h2>
            <Link href="/register" className={CTA.primary}>
              {l.ctaPrimary}
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter dict={dict} />
    </div>
  );
}
