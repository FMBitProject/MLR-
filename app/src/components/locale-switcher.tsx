"use client";

import { useTransition } from "react";
import clsx from "clsx";
import { setLocale } from "@/lib/actions";
import type { Locale } from "@/lib/i18n";

/**
 * `variant="dark"` is for the public surface (ink-950 ground); the default
 * light styling stays for the signed-in app. Both variants keep the active
 * pill above WCAG AA against their own background.
 */
export function LocaleSwitcher({
  locale,
  variant = "light",
}: {
  locale: Locale;
  variant?: "light" | "dark";
}) {
  const [pending, startTransition] = useTransition();
  const dark = variant === "dark";
  return (
    <div
      className={clsx(
        "flex items-center rounded-xl border p-0.5 text-[12px] font-semibold",
        dark ? "border-white/15 bg-white/[0.04]" : "border-slate-200 bg-white shadow-sm",
      )}
    >
      {(["id", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => setLocale(l))}
          className={clsx(
            "rounded-[9px] px-2.5 py-1 uppercase tracking-wide transition active:scale-[0.98]",
            locale === l
              ? dark
                ? "bg-brand-300 text-brand-950"
                : "bg-brand-700 text-white shadow-sm"
              : dark
                ? "text-slate-300 hover:text-white"
                : "text-slate-500 hover:text-slate-800",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
