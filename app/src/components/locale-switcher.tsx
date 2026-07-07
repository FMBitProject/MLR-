"use client";

import { useTransition } from "react";
import clsx from "clsx";
import { setLocale } from "@/lib/actions";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-[12px] font-semibold shadow-sm">
      {(["id", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => setLocale(l))}
          className={clsx(
            "rounded-md px-2.5 py-1 uppercase tracking-wide transition",
            locale === l
              ? "bg-brand-700 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
