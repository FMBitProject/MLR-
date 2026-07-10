"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

export function RegisterForm({ dict }: { dict: Dict }) {
  const [state, formAction, pending] = useActionState(register, null);

  const input =
    "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";
  const label = "mb-1.5 block text-[13px] font-medium text-slate-700";

  return (
    <div className="w-full max-w-md animate-fade-up">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        {dict.register.title}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{dict.register.subtitle}</p>

      <form action={formAction} className="mt-8 space-y-4">
        <div>
          <label className={label}>{dict.register.companyName}</label>
          <input
            name="companyName"
            required
            autoComplete="organization"
            placeholder={dict.register.companyPlaceholder}
            className={input}
          />
        </div>
        <div>
          <label className={label}>{dict.register.yourName}</label>
          <input name="name" required autoComplete="name" className={input} />
        </div>
        <div>
          <label className={label}>{dict.login.email}</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="nama@perusahaan.co.id"
            className={input}
          />
        </div>
        <div>
          <label className={label}>{dict.login.password}</label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
            className={input}
          />
          <p className="mt-1.5 text-[12px] text-slate-400">{dict.register.passwordHint}</p>
        </div>
        {state?.error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
            {state.error === "email_taken" ? dict.register.emailTaken : dict.register.invalid}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "…" : dict.register.submit}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-slate-500">
        {dict.register.haveAccount}{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          {dict.register.signIn}
        </Link>
      </p>
    </div>
  );
}
