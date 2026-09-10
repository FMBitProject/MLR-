"use client";

import { useState, useTransition } from "react";
import { acceptInvite } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";
import { TITLE, SUBTITLE, LABEL, SUBMIT, ERROR_BOX, fieldClass } from "@/components/public/field";

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
      <h1 className={TITLE}>
        {dict.verifyEmail.inviteTitle}
      </h1>
      <p className={SUBTITLE}>
        {dict.verifyEmail.inviteBody} <strong>{tenantName}</strong>.
      </p>

      <form action={onSubmit} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className={LABEL}>
            {dict.verifyEmail.password}
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
            className={fieldClass(Boolean(error)).replace("pl-10", "px-3.5")}
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
          {pending ? dict.verifyEmail.submitting : dict.verifyEmail.submit}
        </button>
      </form>
    </div>
  );
}
