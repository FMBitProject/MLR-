"use client";

import { useRef, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { createTeammate } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

const ROLES = [
  "marketing",
  "medical_reviewer",
  "legal_reviewer",
  "regulatory_reviewer",
  "compliance_admin",
  "super_admin",
] as const;

export function TeammateForm({ dict }: { dict: Dict }) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (formData: FormData) => {
    setError(null);
    setSent(false);
    startTransition(async () => {
      try {
        const res = await createTeammate(formData);
        if (res?.error) {
          setError(
            res.error === "EMAIL_TAKEN"
              ? dict.settings.teammateEmailTaken
              : res.error === "PLAN_LIMIT"
                ? dict.settings.planLimit
                : dict.settings.teammateFailed,
          );
          return;
        }
        formRef.current?.reset();
        setSent(true);
      } catch {
        setError(dict.settings.teammateFailed);
      }
    });
  };

  const input =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

  return (
    <form ref={formRef} action={onSubmit} className="space-y-3 px-6 py-5">
      <div className="grid grid-cols-2 gap-3">
        <input name="name" required placeholder={dict.settings.teammateName} className={input} />
        <input
          name="email"
          type="email"
          required
          placeholder={dict.settings.teammateEmail}
          className={input}
        />
      </div>
      <select name="role" required defaultValue="" className={input}>
        <option value="" disabled>
          {dict.settings.teammateRole}
        </option>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {dict.roles[r]}
          </option>
        ))}
      </select>
      <p className="text-[11.5px] text-slate-400">{dict.settings.teammateInviteHint}</p>
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700 ring-1 ring-inset ring-rose-200">
          {error}
        </p>
      ) : null}
      {sent ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700 ring-1 ring-inset ring-emerald-200">
          {dict.settings.teammateInvited}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60"
      >
        <UserPlus className="size-3.5" />
        {pending ? dict.settings.teammateAdding : dict.settings.teammateAdd}
      </button>
    </form>
  );
}
