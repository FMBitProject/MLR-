"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, Building2, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { register, type RegisterField } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

const LABEL = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-700";

function fieldClass(invalid: boolean) {
  return (
    "w-full rounded-xl border bg-white py-2.5 pl-10 text-[14px] text-slate-900 placeholder:text-slate-400 " +
    "shadow-sm outline-none transition duration-200 hover:border-slate-400 " +
    "focus:ring-4 " +
    (invalid
      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15"
      : "border-slate-300 focus:border-brand-600 focus:ring-brand-600/15")
  );
}

const ICON =
  "pointer-events-none absolute left-3.5 top-1/2 size-[15px] -translate-y-1/2 text-slate-400";

export function RegisterForm({ dict }: { dict: Dict }) {
  const [state, formAction, pending] = useActionState(register, null);
  const [showPassword, setShowPassword] = useState(false);

  if (state?.sent) {
    return (
      <div className="w-full max-w-[420px] animate-fade-up">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_32px_-12px_rgb(15_23_42/0.12)]">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
            {dict.register.checkEmailTitle}
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
            {dict.register.checkEmailBody}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block font-semibold text-brand-700 underline-offset-2 transition hover:text-brand-800 hover:underline"
          >
            {dict.register.signIn}
          </Link>
        </div>
      </div>
    );
  }

  // The server reports which field failed — "validation" alone covers an
  // empty company name just as much as a short password, so marking the
  // password field for every validation error pointed at the wrong input.
  const invalid = (field: RegisterField) => state?.field === field;

  return (
    <div className="w-full max-w-[420px] animate-fade-up">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_32px_-12px_rgb(15_23_42/0.12)] sm:p-8">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
          {dict.register.title}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">
          {dict.register.subtitle}
        </p>

        <form action={formAction} className="mt-7 space-y-5">
          <div>
            <label htmlFor="reg-company" className={LABEL}>
              {dict.register.companyName}
            </label>
            <div className="relative">
              <Building2 aria-hidden className={ICON} />
              <input
                id="reg-company"
                name="companyName"
                required
                autoComplete="organization"
                placeholder={dict.register.companyPlaceholder}
                aria-invalid={invalid("companyName")}
                aria-describedby={state?.error ? "register-error" : undefined}
                className={fieldClass(invalid("companyName")) + " pr-3.5"}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-name" className={LABEL}>
              {dict.register.yourName}
            </label>
            <div className="relative">
              <User aria-hidden className={ICON} />
              <input
                id="reg-name"
                name="name"
                required
                autoComplete="name"
                aria-invalid={invalid("name")}
                aria-describedby={state?.error ? "register-error" : undefined}
                className={fieldClass(invalid("name")) + " pr-3.5"}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className={LABEL}>
              {dict.login.email}
            </label>
            <div className="relative">
              <Mail aria-hidden className={ICON} />
              <input
                id="reg-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="nama@perusahaan.co.id"
                aria-invalid={invalid("email")}
                aria-describedby={state?.error ? "register-error" : undefined}
                className={fieldClass(invalid("email")) + " pr-3.5"}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className={LABEL}>
              {dict.login.password}
            </label>
            <div className="relative">
              <Lock aria-hidden className={ICON} />
              <input
                id="reg-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={invalid("password")}
                aria-describedby={state?.error ? "register-error" : undefined}
                className={fieldClass(invalid("password")) + " pr-11"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? dict.login.hidePassword : dict.login.showPassword}
                className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <span className="relative block size-[17px]">
                  <Eye
                    aria-hidden
                    className={
                      "absolute inset-0 size-[17px] transition duration-200 " +
                      (showPassword ? "scale-75 opacity-0" : "scale-100 opacity-100")
                    }
                  />
                  <EyeOff
                    aria-hidden
                    className={
                      "absolute inset-0 size-[17px] transition duration-200 " +
                      (showPassword ? "scale-100 opacity-100" : "scale-75 opacity-0")
                    }
                  />
                </span>
              </button>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
              {dict.register.passwordHint}
            </p>
          </div>

          {state?.error ? (
            <p
              id="register-error"
              role="alert"
              className="animate-shake flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-rose-800 ring-1 ring-inset ring-rose-200"
            >
              <AlertCircle aria-hidden className="mt-px size-4 shrink-0 text-rose-600" />
              <span>
                {state.error === "email_taken"
                  ? dict.register.emailTaken
                  : state.error === "throttled"
                    ? dict.register.throttled
                    : dict.register.invalid}
              </span>
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-800 hover:shadow-md active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-brand-700"
          >
            {pending ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" />
                {dict.register.creating}
              </>
            ) : (
              dict.register.submit
            )}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-[13px] text-slate-600">
          <p>
            {dict.register.haveAccount}{" "}
            <Link
              href="/login"
              className="font-semibold text-brand-700 underline-offset-2 transition hover:text-brand-800 hover:underline"
            >
              {dict.register.signIn}
            </Link>
          </p>
          <p>
            <Link
              href="/pricing"
              className="font-medium text-brand-700 underline-offset-2 transition hover:text-brand-800 hover:underline"
            >
              {dict.pricing.title}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
