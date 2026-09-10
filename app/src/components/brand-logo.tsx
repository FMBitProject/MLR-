import Link from "next/link";

/**
 * Brand mark for every public page. Always links back to the landing page.
 *
 * The artwork already bakes in the full "IntelliBase MLR Flow" wordmark, so
 * `appName` is only its alt text and nothing is set beside it: the small
 * uppercase tagline that used to sit here read as a decorative micro-label
 * on every single page, which is the pattern the redesign is removing.
 */
export function BrandLogo({
  appName,
  variant = "light",
}: {
  appName: string;
  /** "dark" for the ink-950 public surface, "light" for the app shell. */
  variant?: "light" | "dark";
}) {
  return (
    <Link
      href="/"
      className="flex w-fit items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={variant === "dark" ? "/brand/logo-dark.png" : "/brand/logo.png"}
        alt={appName}
        className="h-8 w-auto shrink-0 sm:h-9"
      />
    </Link>
  );
}
