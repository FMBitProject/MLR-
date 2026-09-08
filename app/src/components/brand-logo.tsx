import Link from "next/link";

// Brand mark used on every public page (landing, login, register, pricing).
// Always links back to the landing page. The logo image already bakes in the
// full "IntelliBase MLR Flow" wordmark — `appName` is used only as its alt
// text, `tagline` renders separately since it isn't part of the artwork.
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
          "flex items-center rounded-xl px-3 py-2 transition group-hover:scale-105 " +
          (dark ? "bg-white/95 shadow-sm" : "")
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt={appName} className="h-8 w-auto sm:h-9" />
      </div>
      <p
        className={
          "text-[11px] uppercase tracking-[0.18em] " +
          (dark ? "text-brand-300/80" : "text-slate-400")
        }
      >
        {tagline}
      </p>
    </Link>
  );
}
