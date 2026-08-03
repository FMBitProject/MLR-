"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { payRenewalInvoice } from "@/lib/actions";
import { PLANS, formatIdr, effectivePriceIdr, promoActive, type PlanId } from "@/lib/plans";
import type { Dict } from "@/lib/i18n";

/**
 * Plan chooser on the billing card. A free-tier workspace picks the plan it
 * wants; a paid one defaults to renewing what it already has but can switch to
 * a pricier one. `options` is pre-filtered to same-or-pricier plans, so no
 * downgrade is ever offered.
 */
export function PlanPicker({
  currentPlan,
  options,
  isFree,
  hasPendingInvoice,
  dict,
}: {
  currentPlan: string;
  options: PlanId[];
  isFree: boolean;
  hasPendingInvoice: boolean;
  dict: Dict;
}) {
  const [selected, setSelected] = useState<PlanId>(
    options.includes(currentPlan as PlanId) ? (currentPlan as PlanId) : options[0],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Selection drives the label first: switching plans always reads as an
  // upgrade; only when staying on the current plan does a pending invoice
  // turn it into "continue payment", else a plain renewal.
  const label =
    selected !== currentPlan
      ? dict.settings.billingUpgrade
      : hasPendingInvoice
        ? dict.settings.billingPayPending
        : isFree
          ? dict.settings.billingUpgrade
          : dict.settings.billingPay;

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const res = await payRenewalInvoice(null, fd);
          if (res?.redirectTo) {
            window.location.href = res.redirectTo;
            return;
          }
          if (res?.error) setError(res.error);
        })
      }
      className="space-y-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((id) => {
          const plan = PLANS[id];
          const price = effectivePriceIdr(plan) ?? plan.monthlyPriceIdr ?? 0;
          const active = selected === id;
          return (
            <label
              key={id}
              className={
                "cursor-pointer rounded-xl border px-3.5 py-3 transition " +
                (active
                  ? "border-brand-400 bg-brand-50/70 ring-2 ring-brand-500/15"
                  : "border-slate-200 bg-white hover:border-slate-300")
              }
            >
              <input
                type="radio"
                name="plan"
                value={id}
                checked={active}
                onChange={() => setSelected(id)}
                className="sr-only"
              />
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold capitalize text-slate-800">
                  {id}
                  {id === currentPlan ? (
                    <span className="ml-1.5 text-[11px] font-medium text-slate-400">
                      {dict.settings.billingCurrentPlan}
                    </span>
                  ) : null}
                </span>
                {promoActive(plan) ? (
                  <span className="text-[11px] font-medium text-slate-400 line-through">
                    {formatIdr(plan.monthlyPriceIdr ?? 0)}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[15px] font-semibold tracking-tight text-slate-900">
                {formatIdr(price)}
                <span className="text-[11.5px] font-normal text-slate-400">
                  {dict.settings.planPerMonth}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
          {dict.settings.billingError}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50"
      >
        <CreditCard className="size-3.5" />
        {pending ? dict.settings.billingPaying : label}
      </button>
    </form>
  );
}
