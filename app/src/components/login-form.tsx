"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { login, resendVerificationEmail } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";
import { CARD, TITLE, SUBTITLE, LABEL, SUBMIT, ERROR_BOX, NOTICE_BOX, fieldClass } from "@/components/public/field";

// One account per review role in the demo workspace (tn-demo), so the full
// submit → review → approve flow can be walked through — see db/seed-demo.ts.
const DEMO_ACCOUNTS: Array<{ email: string; roleKey: keyof Dict["roles"]; name: string }> = [
  { email: "dewi@mlrflow-demo.id", roleKey: "marketing", name: "Dewi Lestari" },
  { email: "budi@mlrflow-demo.id", roleKey: "medical_reviewer", name: "dr. Budi Santoso" },
  { email: "ratna@mlrflow-demo.id", roleKey: "legal_reviewer", name: "Ratna Wijaya" },
  { email: "agus@mlrflow-demo.id", roleKey: "regulatory_reviewer", name: "Agus Prasetyo" },
  { email: "sari@mlrflow-demo.id", roleKey: "compliance_admin", name: "Sari Handayani" },
  { email: "rudi@mlrflow-demo.id", roleKey: "super_admin", name: "Rudi Hartono" },
];

const DEMO_PASSWORD = "DemoMLR2026!";



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
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
    setEmail(address);
    emailRef.current?.form?.requestSubmit();
  };

  return (
    <div className="w-full max-w-[420px] animate-fade-up">
      <div className={CARD}>
        <h1 className={TITLE}>
          {dict.login.title}
        </h1>
        <p className={SUBTITLE}>{dict.login.subtitle}</p>

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
                className="text-[12px] font-medium text-brand-300 underline-offset-2 transition hover:text-brand-200 hover:underline"
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
                className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
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
              className={`animate-shake ${ERROR_BOX}`}
            >
              <AlertCircle aria-hidden className="mt-px size-4 shrink-0 text-rose-600" />
              <span>{state.error === "locked" ? dict.login.locked : dict.login.invalid}</span>
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className={SUBMIT}
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
            <p className={`mt-4 ${NOTICE_BOX}`}>
              {dict.login.verificationResent}
            </p>
          ) : (
            <div className={`mt-4 ${NOTICE_BOX}`}>
              <p>{dict.login.unverified}</p>
              <form action={resendAction} className="mt-2">
                <input type="hidden" name="email" value={email} />
                <button
                  type="submit"
                  disabled={resendPending}
                  className="inline-flex items-center gap-1.5 font-semibold text-brand-300 underline decoration-dotted underline-offset-2 transition hover:decoration-solid disabled:opacity-60"
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

        <div className="mt-6 space-y-2 text-center text-[13px] text-slate-400">
          <p>
            {dict.login.noAccount}{" "}
            <Link
              href="/register"
              className="whitespace-nowrap font-semibold text-brand-300 underline-offset-2 transition hover:text-brand-200 hover:underline"
            >
              {dict.login.registerLink}
            </Link>
          </p>
          <p>
            <Link
              href="/pricing"
              className="font-medium text-brand-300 underline-offset-2 transition hover:text-brand-200 hover:underline"
            >
              {dict.pricing.title}
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[12.5px] font-medium text-slate-400">
          {dict.login.demoHint}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              disabled={pending}
              onClick={() => fill(a.email)}
              className="group rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-left transition duration-200 hover:border-brand-300/50 hover:bg-white/[0.08] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 disabled:opacity-60"
            >
              <span className="block text-[13px] font-medium text-white">
                {a.name}
              </span>
              <span className="block text-[11px] text-slate-400">{dict.roles[a.roleKey]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
