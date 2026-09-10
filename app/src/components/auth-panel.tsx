import { GitBranch, Sparkles, PenLine, ScrollText, Lock } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import { BrandLogo } from "./brand-logo";

/**
 * Brand panel shared by /login and /register.
 *
 * On desktop it is the left half of the split screen; below `lg` it collapses
 * into a compact band above the form, dropping the photograph and the badge
 * bodies rather than squeezing them.
 *
 * The div-built "pipeline" diagram that used to sit here is gone: it was a
 * fake product graphic assembled from styled spans. A photograph carries the
 * panel instead.
 *
 * TODO: stock stand-in. Replace with brand photography before launch.
 */
const PANEL_IMAGE =
  "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&h=1600&q=80";

export function AuthPanel({ dict, headline }: { dict: Dict; headline: string }) {
  const p = dict.authPanel;
  const badges = [
    { icon: GitBranch, ...p.badges.workflow },
    { icon: Sparkles, ...p.badges.claims },
    { icon: PenLine, ...p.badges.signature },
    { icon: ScrollText, ...p.badges.audit },
  ];

  return (
    <>
      {/* Compact band for phones and tablets: the same identity and the same
          headline, reduced to a chip row so nothing is clipped. */}
      <div className="border-b border-white/10 bg-ink-950 px-5 py-8 text-white sm:px-8 lg:hidden">
        <BrandLogo appName={dict.appName} variant="dark" />
        <p className="mt-5 max-w-lg text-[17px] font-medium leading-snug text-white sm:text-[19px]">
          {headline}
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {badges.map((b) => (
            <li
              key={b.title}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1.5 text-[12px] font-medium text-slate-200"
            >
              <b.icon aria-hidden strokeWidth={1.75} className="size-3.5 shrink-0 text-brand-300" />
              {b.title}
            </li>
          ))}
        </ul>
      </div>

      <aside className="relative hidden w-[46%] max-w-[720px] shrink-0 flex-col justify-between overflow-hidden bg-ink-950 px-12 py-11 text-white lg:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PANEL_IMAGE}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover"
        />
        {/* Brand wash then an ink scrim, the same treatment the landing hero
            gives its photograph, so the two pages read as one site. */}
        <div aria-hidden className="absolute inset-0 bg-brand-950/55" />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-ink-950/55"
        />

        <div className="relative">
          <BrandLogo appName={dict.appName} variant="dark" />

          <h2 className="mt-16 max-w-md text-[32px] font-semibold leading-[1.15] tracking-tight text-white xl:text-[36px]">
            {headline}
          </h2>

          <p className="mt-12 text-[14px] font-semibold text-white">{p.badgesLabel}</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-6">
            {badges.map((b) => (
              <li key={b.title}>
                <b.icon aria-hidden strokeWidth={1.75} className="size-[18px] text-brand-300" />
                <p className="mt-2.5 text-[14px] font-semibold leading-tight text-white">
                  {b.title}
                </p>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-300">{b.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10 border-t border-white/10 pt-5">
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-slate-300">
            <Lock aria-hidden strokeWidth={1.75} className="mt-0.5 size-3.5 shrink-0 text-brand-300" />
            <span>
              <span className="font-semibold text-white">{p.restrictedTitle}</span>{" "}
              {p.restrictedBody}
            </span>
          </p>
          <p className="mt-2.5 pl-[22px] text-[12px] text-slate-400">{dict.login.compliance}</p>
        </div>
      </aside>
    </>
  );
}
