"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Undo2 } from "lucide-react";
import { setContentExpiry, withdrawSubmission } from "@/lib/actions";
import type { dictionaries } from "@/lib/i18n";

type Dict = (typeof dictionaries)["id"];

// Compliance-only lifecycle controls on a library row: adjust the market
// expiry date, or withdraw the material from circulation with a reason.
export function LibraryLifecycle({
  submissionId,
  expiresAt,
  dict,
}: {
  submissionId: string;
  expiresAt: string | null; // yyyy-mm-dd for the date input
  dict: Dict;
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (withdrawing) {
    return (
      <form
        action={(fd) => startTransition(() => withdrawSubmission(fd))}
        className="flex w-full items-center gap-2"
      >
        <input type="hidden" name="submissionId" value={submissionId} />
        <input
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={dict.library.withdrawReason}
          className="min-w-0 flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[12.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-300"
          autoFocus
        />
        <button
          type="submit"
          disabled={pending || !reason.trim()}
          className="rounded-lg bg-rose-600 px-3 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {dict.library.withdrawConfirm}
        </button>
        <button
          type="button"
          onClick={() => setWithdrawing(false)}
          className="rounded-lg px-2 py-2 text-[12.5px] font-medium text-slate-500 hover:text-slate-700"
        >
          {dict.library.withdrawCancel}
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <form
        action={(fd) => startTransition(() => setContentExpiry(fd))}
        className="flex items-center gap-1.5"
      >
        <input type="hidden" name="submissionId" value={submissionId} />
        <CalendarClock className="size-3.5 text-slate-400" />
        <input
          type="date"
          name="expiresAt"
          defaultValue={expiresAt ?? ""}
          required
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40"
        >
          {dict.library.saveExpiry}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setWithdrawing(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200 transition hover:bg-rose-50"
      >
        <Undo2 className="size-3.5" />
        {dict.library.withdraw}
      </button>
    </div>
  );
}
