import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Photographic full-screen hero. The background is a plain CSS
 * `background-image` rather than next/image so any URL works without adding a
 * remote pattern to next.config.ts — swap `backgroundImage` for a local
 * `/hero.jpg` in public/ once there is brand photography to use.
 */
const DEFAULT_BACKGROUND =
  "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=2400&q=80";

export function AeroHero({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  eyebrow,
  backgroundImage = DEFAULT_BACKGROUND,
  className,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  eyebrow?: string;
  backgroundImage?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative flex min-h-[38rem] w-full items-center justify-center overflow-hidden pb-24 pt-32 md:h-screen md:py-0",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        {/* Brand-teal wash over the photo, then a vertical scrim: together they
            hold text contrast wherever the photo happens to be light. */}
        <div className="absolute inset-0 bg-brand-950/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/60 via-ink-950/25 to-ink-950/75" />
      </div>

      {/* Decorative column rules, echoing the page's 12-column grid. */}
      <div aria-hidden className="absolute inset-0 z-10 size-full">
        <div className="mx-auto grid h-full w-full max-w-6xl grid-cols-12 divide-x divide-white/10">
          <div className="col-span-1" />
          <div className="col-span-3" />
          <div className="col-span-4" />
          <div className="col-span-3" />
          <div className="col-span-1" />
        </div>
      </div>

      <div className="relative z-20 mx-auto max-w-5xl px-6 text-center text-white">
        {eyebrow ? (
          <p className="mx-auto mb-7 w-fit rounded-full bg-white/10 px-3.5 py-1 text-[12.5px] font-semibold text-brand-100 ring-1 ring-inset ring-white/25 backdrop-blur-sm">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="text-center text-[40px] font-semibold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
          {title}
        </h1>

        <p className="mx-auto mb-10 mt-6 max-w-2xl text-center text-[16px] font-light leading-relaxed text-white/85 md:text-lg">
          {subtitle}
        </p>

        <Button
          asChild
          className="group mx-auto flex h-auto w-fit cursor-pointer items-center justify-center gap-0 rounded-full border-none bg-transparent p-0 font-normal shadow-none hover:bg-transparent"
        >
          <Link href={ctaHref}>
            <span className="rounded-full bg-brand-300 px-6 py-3 text-[15px] font-semibold text-brand-950 transition-colors duration-500 ease-in-out group-hover:bg-brand-950 group-hover:text-brand-300">
              {ctaLabel}
            </span>
            {/* Two stacked arrows: the first exits to the right on hover while
                the second flies in from the left, reading as one arrow that
                loops rather than a single icon that merely slides. */}
            <div className="relative flex h-fit items-center overflow-hidden rounded-full bg-brand-300 p-5 text-brand-950 transition-colors duration-500 ease-in-out group-hover:bg-brand-950 group-hover:text-brand-300">
              <ArrowUpRight className="absolute size-5 -translate-x-1/2 transition-transform duration-500 ease-in-out group-hover:translate-x-10" />
              <ArrowUpRight className="absolute size-5 -translate-x-10 transition-transform duration-500 ease-in-out group-hover:-translate-x-1/2" />
            </div>
          </Link>
        </Button>
      </div>
    </section>
  );
}
