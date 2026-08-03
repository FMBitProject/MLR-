"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { login, resendVerificationEmail } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

const DEMO_ACCOUNTS: Array<{ email: string; roleKey: keyof Dict["roles"]; name: string }> = [
  { email: "dewi@nusantara-pharma.co.id", roleKey: "marketing", name: "Dewi Lestari" },
  { email: "budi@nusantara-pharma.co.id", roleKey: "medical_reviewer", name: "dr. Budi Santoso" },
  { email: "ratna@nusantara-pharma.co.id", roleKey: "legal_reviewer", name: "Ratna Wijaya" },
  { email: "agus@nusantara-pharma.co.id", roleKey: "regulatory_reviewer", name: "Agus Prasetyo" },
  { email: "sari@nusantara-pharma.co.id", roleKey: "compliance_admin", name: "Sari Handayani" },
  { email: "rudi@nusantara-pharma.co.id", roleKey: "super_admin", name: "Rudi Hartono" },
];

const LABEL = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-700";

/** Shared field styling. `invalid` swaps the ring/border to the error tone so
 *  the failure is visible on the input itself, not only in the message. */
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

export function LoginForm({ dict }: { dict: Dict }) {
  const [state, formAction, pending] = useActionState(login, null);
  const [resendState, resendAction, resendPending] = useActionState(
    resendVerificationEmail,
    null,
  );
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Bumped on every attempt so the shake replays on a repeat failure — two
  // consecutive wrong passwords render identical text, and without a fresh
  // key React would keep the element mounted and the animation wouldn't run.
  // Adjusting state during render (rather than in an effect) is React's
  // documented way to react to a changed value without an extra pass.
  const [attempt, setAttempt] = useState(0);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setAttempt((n) => n + 1);
  }

  const credentialError = state?.error === "invalid" || state?.error === "locked";
  // "unverified" renders its own box below the form, not #login-error — so
  // pointing at that id would leave a reference to an element that isn't there.
  const errorId = credentialError ? "login-error" : undefined;

  const fill = (address: string) => {
    if (emailRef.current) emailRef.current.value = address;
    if (passwordRef.current) passwordRef.current.value = "demo123";
    setEmail(address);
    emailRef.current?.form?.requestSubmit();
  };

  return (
    <div className="w-full max-w-[420px] animate-fade-up">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_32px_-12px_rgb(15_23_42/0.12)] sm:p-8">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
          {dict.login.title}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{dict.login.subtitle}</p>

        <form action={formAction} className="mt-7 space-y-5">
          <div>
            <label htmlFor="login-email" className={LABEL}>
              {dict.login.email}
            </label>
            <div className="relative">
              <Mail
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 size-[15px] -translate-y-1/2 text-slate-400"
              />
              <input
                id="login-email"
                ref={emailRef}
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="nama@perusahaan.co.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={credentialError}
                aria-describedby={errorId}
                className={fieldClass(credentialError) + " pr-3.5"}
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label htmlFor="login-password" className={LABEL + " mb-0"}>
                {dict.login.password}
              </label>
              <Link
                href="/reset-password"
                tabIndex={-1}
                className="text-[12px] font-medium text-brand-700 underline-offset-2 transition hover:text-brand-800 hover:underline"
              >
                {dict.login.forgot}
              </Link>
            </div>
            <div className="relative">
              <Lock
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 size-[15px] -translate-y-1/2 text-slate-400"
              />
              <input
                id="login-password"
                ref={passwordRef}
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={credentialError}
                aria-describedby={errorId}
                className={fieldClass(credentialError) + " pr-11"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? dict.login.hidePassword : dict.login.showPassword}
                className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {/* Both icons stay mounted and crossfade, so the toggle reads
                    as one control changing state rather than a swap. */}
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
          </div>

          {state?.error && state.error !== "unverified" ? (
            <p
              key={attempt}
              id="login-error"
              role="alert"
              className="animate-shake flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-rose-800 ring-1 ring-inset ring-rose-200"
            >
              <AlertCircle aria-hidden className="mt-px size-4 shrink-0 text-rose-600" />
              <span>{state.error === "locked" ? dict.login.locked : dict.login.invalid}</span>
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
                {dict.login.signingIn}
              </>
            ) : (
              dict.login.submit
            )}
          </button>
        </form>

        {/* Outside the login <form> — nested <form> elements are invalid HTML */}
        {state?.error === "unverified" ? (
          resendState?.sent ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800 ring-1 ring-inset ring-emerald-200">
              {dict.login.verificationResent}
            </p>
          ) : (
            <div className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200">
              <p>{dict.login.unverified}</p>
              <form action={resendAction} className="mt-2">
                <input type="hidden" name="email" value={email} />
                <button
                  type="submit"
                  disabled={resendPending}
                  className="inline-flex items-center gap-1.5 font-semibold text-amber-900 underline decoration-dotted underline-offset-2 transition hover:decoration-solid disabled:opacity-60"
                >
                  {resendPending ? (
                    <Loader2 aria-hidden className="size-3.5 animate-spin" />
                  ) : null}
                  {dict.login.resendVerification}
                </button>
              </form>
            </div>
          )
        ) : null}

        <div className="mt-6 space-y-2 text-center text-[13px] text-slate-600">
          <p>
            {dict.login.noAccount}{" "}
            <Link
              href="/register"
              className="font-semibold text-brand-700 underline-offset-2 transition hover:text-brand-800 hover:underline"
            >
              {dict.login.registerLink}
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

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {dict.login.demoHint}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              disabled={pending}
              onClick={() => fill(a.email)}
              className="group rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition duration-200 hover:-translate-y-px hover:border-brand-400 hover:bg-brand-50/70 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
            >
              <span className="block text-[13px] font-medium text-slate-800 transition group-hover:text-brand-900">
                {a.name}
              </span>
              <span className="block text-[11px] text-slate-600">{dict.roles[a.roleKey]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
