import Link from "next/link";
import { ShieldCheck } from "lucide-react";

// Brand mark used on every public page (landing, login, register, pricing).
// Always links back to the landing page.
export function BrandLogo({
  appName,
  tagline,
  variant = "light",
}: {
  appName: string;
  tagline: string;
  /** "dark" for the gradient brand panels, "light" for light backgrounds. */
  variant?: "light" | "dark";
}) {
  const dark = variant === "dark";
  return (
    <Link href="/" className="group flex w-fit items-center gap-3">
      <div
        className={
          "flex size-10 items-center justify-center rounded-xl ring-1 transition group-hover:scale-105 " +
          (dark ? "bg-white/10 ring-white/20" : "bg-brand-900 ring-brand-800")
        }
      >
        <ShieldCheck className="size-5 text-brand-300" />
      </div>
      <div>
        <p
          className={
            "text-lg font-semibold tracking-tight " + (dark ? "text-white" : "text-slate-900")
          }
        >
          {appName}
        </p>
        <p
          className={
            "text-[11px] uppercase tracking-[0.18em] " +
            (dark ? "text-brand-300/80" : "text-slate-400")
          }
        >
          {tagline}
        </p>
      </div>
    </Link>
  );
}
