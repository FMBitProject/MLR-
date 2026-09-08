"use client";

import { useState, useTransition } from "react";
import { Radio, X } from "lucide-react";
import { publishDistribution, pullDistribution } from "@/lib/actions";
import { formatDate } from "@/lib/i18n";
import type { dictionaries, Locale } from "@/lib/i18n";

type Dict = (typeof dictionaries)["id"];

export type Distribution = {
  id: string;
  channel: string;
  label: string | null;
  publishedAt: number;
};

const CHANNELS = ["print", "digital", "e-detail", "social", "hcp_only"] as const;

// Where an approved submission is actually live right now — distinct from
// the single intended channel picked at submission time.
export function DistributionTracker({
  submissionId,
  live,
  canManage,
  dict,
  locale,
}: {
  submissionId: string;
  live: Distribution[];
  canManage: boolean;
  dict: Dict;
  locale: Locale;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="w-full border-t border-slate-100 pt-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {dict.library.distribution}
      </p>
      {live.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {live.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-800 ring-1 ring-inset ring-emerald-200"
            >
              <Radio className="size-3 animate-pulse" />
              {dict.channels[d.channel as keyof typeof dict.channels] ?? d.channel}
              {d.label ? <span className="text-emerald-600">· {d.label}</span> : null}
              <span className="text-emerald-600">
                · {dict.library.distributionLive} {formatDate(d.publishedAt, locale)}
              </span>
              {canManage ? (
                <form
                  action={(fd) => startTransition(() => pullDistribution(fd))}
                  className="ml-0.5"
                >
                  <input type="hidden" name="distributionId" value={d.id} />
                  <button
                    type="submit"
                    disabled={pending}
                    title={dict.library.distributionPull}
                    className="text-emerald-500 hover:text-rose-600 disabled:opacity-40"
                  >
                    <X className="size-3.5" />
                  </button>
                </form>
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-slate-400">{dict.library.distributionEmpty}</p>
      )}

      {canManage ? (
        adding ? (
          <form
            action={(fd) =>
              startTransition(() => {
                publishDistribution(fd);
                setAdding(false);
              })
            }
            className="mt-2 flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="submissionId" value={submissionId} />
            <select
              name="channel"
              required
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {dict.channels[c]}
                </option>
              ))}
            </select>
            <input
              name="label"
              placeholder={dict.library.distributionLabelPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-700 px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-40"
            >
              {dict.library.distributionPublish}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-700"
            >
              {dict.library.withdrawCancel}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
          >
            <Radio className="size-3.5" />
            {dict.library.distributionAdd}
          </button>
        )
      ) : null}
    </div>
  );
}
