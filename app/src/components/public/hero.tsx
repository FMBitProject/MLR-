import Link from "next/link";
import { SHELL, CTA } from "./chrome";

/**
 * Asymmetric split hero: copy on the left, one photograph on the right.
 *
 * Replaces the previous centred-text-over-a-full-bleed-photo hero, which is
 * the most templated hero shape there is. The copy column is the wider one
 * (7 of 12) so the headline holds two lines at desktop; below `md` the two
 * columns stack and the photo follows the CTAs.
 *
 * TODO: stock photography, standing in for brand photography. Replace with a
 * real shot of a review team or of the product in use before launch.
 */
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1000&h=1250&q=80";

export function Hero({
  eyebrow,
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  imageAlt,
  image = PLACEHOLDER_IMAGE,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
  imageAlt: string;
  image?: string;
}) {
  return (
    <section className={`${SHELL} pb-16 pt-12 md:pb-24 md:pt-20`}>
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-7">
          {/* The one eyebrow on the page. No section below this uses another. */}
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand-300">
            {eyebrow}
          </p>

          <h1 className="mt-5 text-[32px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[36px] lg:text-[40px]">
            {title}
          </h1>

          <p className="mt-5 max-w-[54ch] text-[16px] leading-relaxed text-slate-300 lg:text-[17px]">
            {subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register" className={CTA.primary}>
              {primaryLabel}
            </Link>
            <Link href="/pricing" className={CTA.secondary}>
              {secondaryLabel}
            </Link>
          </div>
        </div>

        <div className="md:col-span-5">
          <div className="relative overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={imageAlt}
              width={1000}
              height={1250}
              fetchPriority="high"
              className="aspect-[4/5] w-full object-cover"
            />
            {/* Teal wash plus a downward scrim: keeps the photograph inside the
                page's single accent and hands it off to the ink ground rather
                than sitting on it as a bright rectangle. */}
            <div aria-hidden className="absolute inset-0 bg-brand-950/35" />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/10 to-transparent"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
