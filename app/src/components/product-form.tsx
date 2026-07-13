"use client";

import { useRef, useState, useTransition } from "react";
import { PackagePlus } from "lucide-react";
import { createProduct } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

export function ProductForm({ dict }: { dict: Dict }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await createProduct(formData);
        if (res?.error) {
          setError(
            res.error === "PLAN_LIMIT" ? dict.settings.planLimit : dict.settings.productFailed,
          );
          return;
        }
        formRef.current?.reset();
      } catch {
        setError(dict.settings.productFailed);
      }
    });
  };

  const input =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

  return (
    <form ref={formRef} action={onSubmit} className="space-y-3 px-6 py-5">
      <div className="grid grid-cols-2 gap-3">
        <input name="name" required placeholder={dict.settings.productName} className={input} />
        <input
          name="bpomRegistrationNo"
          placeholder={dict.settings.productBpom}
          className={input}
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700 ring-1 ring-inset ring-rose-200">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60"
      >
        <PackagePlus className="size-3.5" />
        {pending ? dict.settings.productAdding : dict.settings.productAdd}
      </button>
    </form>
  );
}
