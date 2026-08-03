import { GitBranch, Sparkles, PenLine, ScrollText, Lock } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import { BrandLogo } from "./brand-logo";

/**
 * Brand panel shared by /login and /register.
 *
 * On desktop it is the left half of the split screen; below `lg` it collapses
 * into a compact header band above the form (the badge grid and hero visual
 * are dropped there rather than squeezed, so nothing is clipped on mobile).
 */
export function AuthPanel({
  dict,
  headline,
}: {
  dict: Dict;
  headline: string;
}) {
  const p = dict.authPanel;
  const badges = [
    { icon: GitBranch, ...p.badges.workflow },
    { icon: Sparkles, ...p.badges.claims },
    { icon: PenLine, ...p.badges.signature },
    { icon: ScrollText, ...p.badges.audit },
  ];

  return (
    <>
      {/* Compact band for phones/tablets: the same identity and trust signals
          as the desktop panel, reduced to a headline and chip row so nothing
          has to be squeezed or clipped. */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 px-6 py-8 text-white lg:hidden">
        {/* .auth-mesh must sit on its own layer, never on this element: it
            sets background-image (which would drop the gradient) and a
            mask-image (which would fade the text and chips along with it). */}
        <div aria-hidden className="auth-mesh pointer-events-none absolute inset-0" />
        <div className="relative">
          <BrandLogo appName={dict.appName} tagline={dict.tagline} variant="dark" />
          <p className="mt-5 max-w-lg text-[17px] font-medium leading-snug text-white sm:text-[19px]">
            {headline}
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {badges.map((b) => (
              <li
                key={b.title}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-2.5 py-1.5 text-[12px] font-medium text-brand-50"
              >
                <b.icon aria-hidden className="size-3.5 shrink-0 text-brand-300" />
                {b.title}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <aside className="relative hidden w-[46%] max-w-[720px] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 px-12 py-11 text-white lg:flex">
        {/* Hero visual: fine clinical grid, two soft brand glows, and the
            review pipeline rendered as a data mesh. Decorative only. */}
        <div aria-hidden className="auth-mesh pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-[480px] rounded-full bg-brand-500/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[420px] rounded-full bg-teal-400/10 blur-3xl"
        />

        <div className="relative">
          <BrandLogo appName={dict.appName} tagline={dict.tagline} variant="dark" />

          <p className="mt-14 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-300">
            {p.eyebrow}
          </p>
          <h2 className="mt-3 max-w-md text-[32px] font-semibold leading-[1.15] tracking-tight text-white xl:text-[36px]">
            {headline}
          </h2>

          <PipelineMesh dict={dict} />

          <p className="mt-9 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
            {p.badgesLabel}
          </p>
          <ul className="mt-3.5 grid grid-cols-2 gap-2.5">
            {badges.map((b) => (
              <li key={b.title}>
                <div className="group h-full rounded-2xl border border-white/12 bg-white/6 p-3.5 backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-300/45 hover:bg-white/11 hover:shadow-[0_12px_28px_-14px_rgb(45_212_191/0.55)]">
                  <b.icon className="size-[17px] text-brand-300 transition group-hover:scale-110" />
                  <p className="mt-2.5 text-[13.5px] font-semibold leading-tight text-white">
                    {b.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-brand-100/85">{b.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10 border-t border-white/12 pt-5">
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-brand-100/85">
            <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-300" />
            <span>
              <span className="font-semibold text-white">{p.restrictedTitle}</span>{" "}
              {p.restrictedBody}
            </span>
          </p>
          <p className="mt-2.5 pl-[22px] text-[11.5px] tracking-wide text-brand-200/75">
            {dict.login.compliance}
          </p>
        </div>
      </aside>
    </>
  );
}

/** The three review stages as connected nodes — a product-specific hero
 *  visual rather than generic stock artwork. */
function PipelineMesh({ dict }: { dict: Dict }) {
  const stages = [
    dict.authPanel.pipeline.medical,
    dict.authPanel.pipeline.legal,
    dict.authPanel.pipeline.regulatory,
  ];
  return (
    <div className="mt-9" aria-hidden>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
        {dict.authPanel.pipelineLabel}
      </p>
      <div className="mt-3.5 flex items-center gap-2.5">
        {stages.map((s, i) => (
          <div key={s} className="flex items-center gap-2.5">
            <span className="rounded-full border border-brand-300/35 bg-brand-400/12 px-3 py-1.5 text-[12px] font-medium text-brand-50">
              {s}
            </span>
            <span
              className={
                "h-px w-5 " +
                (i < stages.length - 1
                  ? "bg-gradient-to-r from-brand-300/60 to-brand-300/25"
                  : "bg-gradient-to-r from-brand-300/25 to-emerald-300/60")
              }
            />
          </div>
        ))}
        <span className="rounded-full border border-emerald-300/40 bg-emerald-400/12 px-3 py-1.5 text-[12px] font-semibold text-emerald-100">
          {dict.authPanel.pipeline.approved}
        </span>
      </div>
    </div>
  );
}
