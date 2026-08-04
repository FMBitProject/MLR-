import Link from "next/link";
import clsx from "clsx";
import type { BillingState } from "@/lib/billing";
import { formatDate, daysUntil, type Dict, type Locale } from "@/lib/i18n";

/**
 * Sidebar card telling the signed-in user which plan their workspace is on and
 * how long it stays that way. Rendered for every role — non-admins can't pay,
 * but they still need to know the workspace is days away from read-only.
 */
export function PlanBadge({
  plan,
  billing,
  free,
  isAdmin,
  dict,
  locale,
}: {
  plan: string;
  billing: BillingState;
  /** Free tier: never invoiced, never lapses. */
  free: boolean;
  isAdmin: boolean;
  dict: Dict;
  locale: Locale;
}) {
  const d = dict.planCard;
  const status = free ? "free" : !billing.managed ? "manual" : billing.status;

  const label = {
    free: d.free,
    manual: d.manual,
    active: d.statusActive,
    grace: d.statusGrace,
    delinquent: d.statusLocked,
  }[status];

  return (
    <div className="mb-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          {plan}
        </p>
        <span
          className={clsx(
            "rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
            (status === "active" || status === "free") &&
              "bg-brand-500/15 text-brand-300 ring-brand-400/30",
            status === "manual" && "bg-white/5 text-slate-300 ring-white/15",
            status === "grace" && "bg-amber-400/15 text-amber-300 ring-amber-400/30",
            status === "delinquent" && "bg-red-500/15 text-red-300 ring-red-400/30",
          )}
        >
          {label}
        </span>
      </div>

      {status === "free" ? (
        <p className="mt-1.5 text-[11.5px] text-slate-400">{d.freeNote}</p>
      ) : status === "manual" ? (
        <p className="mt-1.5 text-[11.5px] text-slate-400">{d.manualNote}</p>
      ) : status === "active" ? (
        <>
          <p className="mt-1.5 text-[11.5px] text-slate-400">
            {d.activeUntil} {formatDate(billing.activeUntil, locale)}
          </p>
          {billing.activeUntil ? (
            <p className="text-[11px] text-slate-500">
              {daysUntil(billing.activeUntil, locale)}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[11.5px] text-slate-400">
            {d.endedOn} {formatDate(billing.activeUntil, locale)}
          </p>
          {status === "grace" && billing.graceUntil ? (
            <p className="text-[11px] text-amber-300/80">
              {d.readOnlyFrom} {formatDate(billing.graceUntil, locale)}
            </p>
          ) : null}
        </>
      )}

      {isAdmin && status !== "manual" ? (
        <Link
          href="/settings"
          className="mt-2 inline-block text-[11px] font-medium text-brand-300 transition hover:text-brand-200"
        >
          {free ? d.upgrade : d.manage} →
        </Link>
      ) : null}
    </div>
  );
}
