"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";
import { TITLE, SUBTITLE, LABEL, SUBMIT, ERROR_BOX, NOTICE_BOX, fieldClass } from "@/components/public/field";

// Same dark field as /login and /register, minus the leading-icon padding:
// these two forms have no in-field icons.
const inputCls = fieldClass(false).replace("pl-10", "px-3.5");

export function RequestResetForm({ dict }: { dict: Dict }) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  return (
    <div className="w-full max-w-md animate-fade-up">
      <h1 className={TITLE}>
        {dict.resetPassword.requestTitle}
      </h1>
      <p className={SUBTITLE}>{dict.resetPassword.requestBody}</p>

      {state?.sent ? (
        <p className={`mt-8 ${NOTICE_BOX}`}>
          {dict.resetPassword.sent}
        </p>
      ) : (
        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <label className={LABEL}>
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
            <p className={ERROR_BOX}>
              {dict.resetPassword.throttled}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className={SUBMIT}
          >
            {pending ? dict.resetPassword.requestSubmitting : dict.resetPassword.requestSubmit}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-[13px]">
        <Link href="/login" className="font-semibold text-brand-300 transition hover:text-brand-200">
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
      <h1 className={TITLE}>
        {dict.resetPassword.setTitle}
      </h1>
      <p className={SUBTITLE}>
        {dict.resetPassword.setBody} <strong>{email}</strong>.
      </p>

      <form action={onSubmit} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className={LABEL}>
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
          <p className={ERROR_BOX}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className={SUBMIT}
        >
          {pending ? dict.resetPassword.setSubmitting : dict.resetPassword.setSubmit}
        </button>
      </form>
    </div>
  );
}
