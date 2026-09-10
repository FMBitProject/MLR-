/**
 * Form styling for the public (unauthenticated) pages.
 *
 * One place, because /login, /register, /reset-password and /verify-email all
 * sit on the same ink-950 ground and had drifted into four slightly different
 * white-card treatments. Contrast is checked against that ground: label
 * slate-300 and placeholder slate-400 both clear WCAG AA on it, and the focus
 * ring is the brand accent rather than a second hue.
 *
 * Radius follows the public scale: interactive elements 12px, the card 16px.
 */
export const CARD =
  "rounded-2xl border border-white/10 bg-white/[0.04] p-7 sm:p-8";

export const TITLE =
  "text-[26px] font-semibold leading-tight tracking-tight text-white";

export const SUBTITLE = "mt-2 text-[14px] leading-relaxed text-slate-300";

export const LABEL = "mb-1.5 block text-[13px] font-medium text-slate-300";

export const SUBMIT =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-brand-300 px-4 py-2.5 text-[14px] font-semibold text-brand-950 transition duration-200 hover:bg-brand-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-brand-300";

/** Inline error, below the field or below the form. Rose is the only hue on
 *  the public surface besides the brand accent, and it carries real state. */
export const ERROR_BOX =
  "flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-rose-200";

/** Neutral notice panel: verification prompts, "link sent" confirmations. */
export const NOTICE_BOX =
  "rounded-xl border border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-200";

export const ICON_IN_FIELD =
  "pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400";

/** `invalid` swaps the border and ring to the error tone, so the failure shows
 *  on the input itself and not only in the message below it. */
export function fieldClass(invalid: boolean) {
  return (
    "w-full rounded-xl border bg-ink-950/50 py-2.5 pl-10 text-[14px] text-white placeholder:text-slate-400 " +
    "outline-none transition duration-200 hover:border-white/30 focus:ring-4 " +
    (invalid
      ? "border-rose-400/60 focus:border-rose-300 focus:ring-rose-400/20"
      : "border-white/15 focus:border-brand-300 focus:ring-brand-300/20")
  );
}
