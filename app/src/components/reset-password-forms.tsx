"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

export function RequestResetForm({ dict }: { dict: Dict }) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  return (
    <div className="w-full max-w-md animate-fade-up">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        {dict.resetPassword.requestTitle}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{dict.resetPassword.requestBody}</p>

      {state?.sent ? (
        <p className="mt-8 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700 ring-1 ring-inset ring-emerald-200">
          {dict.resetPassword.sent}
        </p>
      ) : (
        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {dict.resetPassword.email}
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@perusahaan.co.id"
              className={inputCls}
            />
          </div>
          {state?.error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
              {dict.resetPassword.throttled}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
          >
            {pending ? dict.resetPassword.requestSubmitting : dict.resetPassword.requestSubmit}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-[13px]">
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          {dict.resetPassword.backToLogin}
        </Link>
      </p>
    </div>
  );
}

export function SetNewPasswordForm({
  dict,
  token,
  email,
}: {
  dict: Dict;
  token: string;
  email: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await resetPassword(formData);
        if (res?.error) setError(dict.resetPassword.invalid);
      } catch (e) {
        // redirect() throws internally on success — let it propagate
        if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
        setError(dict.resetPassword.invalid);
      }
    });
  };

  return (
    <div className="w-full max-w-md animate-fade-up">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        {dict.resetPassword.setTitle}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {dict.resetPassword.setBody} <strong>{email}</strong>.
      </p>

      <form action={onSubmit} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
            {dict.resetPassword.password}
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
            className={inputCls}
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
          {pending ? dict.resetPassword.setSubmitting : dict.resetPassword.setSubmit}
        </button>
      </form>
    </div>
  );
}
