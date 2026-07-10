"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { login } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

const DEMO_ACCOUNTS: Array<{ email: string; roleKey: keyof Dict["roles"]; name: string }> = [
  { email: "dewi@nusantara-pharma.co.id", roleKey: "marketing", name: "Dewi Lestari" },
  { email: "budi@nusantara-pharma.co.id", roleKey: "medical_reviewer", name: "dr. Budi Santoso" },
  { email: "ratna@nusantara-pharma.co.id", roleKey: "legal_reviewer", name: "Ratna Wijaya" },
  { email: "agus@nusantara-pharma.co.id", roleKey: "regulatory_reviewer", name: "Agus Prasetyo" },
  { email: "sari@nusantara-pharma.co.id", roleKey: "compliance_admin", name: "Sari Handayani" },
  { email: "rudi@nusantara-pharma.co.id", roleKey: "super_admin", name: "Rudi Hartono" },
];

export function LoginForm({ dict }: { dict: Dict }) {
  const [state, formAction, pending] = useActionState(login, null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const fill = (email: string) => {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = "demo123";
    emailRef.current?.form?.requestSubmit();
  };

  return (
    <div className="w-full max-w-md animate-fade-up">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        {dict.login.title}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{dict.login.subtitle}</p>

      <form action={formAction} className="mt-8 space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
            {dict.login.email}
          </label>
          <input
            ref={emailRef}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="nama@perusahaan.co.id"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
            {dict.login.password}
          </label>
          <input
            ref={passwordRef}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
        {state?.error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
            {dict.login.invalid}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "…" : dict.login.submit}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-slate-500">
        {dict.login.noAccount}{" "}
        <Link href="/register" className="font-medium text-brand-700 hover:text-brand-800">
          {dict.login.registerLink}
        </Link>
      </p>

      <div className="mt-8">
        <p className="text-[12px] font-medium uppercase tracking-wider text-slate-400">
          {dict.login.demoHint}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => fill(a.email)}
              className="group rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-brand-300 hover:bg-brand-50/60"
            >
              <span className="block text-[13px] font-medium text-slate-800 group-hover:text-brand-900">
                {a.name}
              </span>
              <span className="block text-[11px] text-slate-500">
                {dict.roles[a.roleKey]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
