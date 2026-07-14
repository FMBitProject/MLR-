"use client";

import { useState, useTransition } from "react";
import { acceptInvite } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

export function AcceptInviteForm({
  dict,
  token,
  tenantName,
}: {
  dict: Dict;
  token: string;
  tenantName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await acceptInvite(formData);
        if (res?.error) setError(dict.verifyEmail.inviteInvalid);
      } catch (e) {
        // redirect() throws internally on success — let it propagate
        if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
        setError(dict.verifyEmail.inviteInvalid);
      }
    });
  };

  return (
    <div className="w-full max-w-md animate-fade-up">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        {dict.verifyEmail.inviteTitle}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {dict.verifyEmail.inviteBody} <strong>{tenantName}</strong>.
      </p>

      <form action={onSubmit} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
            {dict.verifyEmail.password}
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? dict.verifyEmail.submitting : dict.verifyEmail.submit}
        </button>
      </form>
    </div>
  );
}
