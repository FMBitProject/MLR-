"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { saveClaim } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

type Product = { id: string; name: string };

export type ClaimDraft = {
  id: string;
  productId: string;
  claimText: string;
  channelScope: string[];
  expiresAt: string; // yyyy-mm-dd
} | null;

const CHANNELS = ["print", "digital", "hcp_only"] as const;

export function ClaimFormButton({
  dict,
  products,
}: {
  dict: Dict;
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99]"
      >
        <Plus className="size-4" />
        {dict.claims.add}
      </button>
      {open ? (
        <ClaimModal dict={dict} products={products} draft={null} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

export function ClaimEditButton({
  dict,
  products,
  draft,
  label,
}: {
  dict: Dict;
  products: Product[];
  draft: NonNullable<ClaimDraft>;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        {label}
      </button>
      {open ? (
        <ClaimModal dict={dict} products={products} draft={draft} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function ClaimModal({
  dict,
  products,
  draft,
  onClose,
}: {
  dict: Dict;
  products: Product[];
  draft: ClaimDraft;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const input =
    "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-fade-up rounded-2xl bg-white p-6 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-slate-900">
            {draft ? dict.claims.editTitle : dict.claims.addTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>
        <form
          action={(fd) =>
            startTransition(async () => {
              await saveClaim(fd);
              onClose();
            })
          }
          className="space-y-4"
        >
          {draft ? <input type="hidden" name="id" value={draft.id} /> : null}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {dict.newSubmission.product}
            </label>
            <select
              name="productId"
              required
              defaultValue={draft?.productId ?? ""}
              className={input}
            >
              <option value="" disabled>
                —
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {dict.claims.claimText}
            </label>
            <textarea
              name="claimText"
              required
              rows={4}
              defaultValue={draft?.claimText ?? ""}
              className={input + " resize-y leading-relaxed"}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                {dict.claims.channels}
              </label>
              <div className="space-y-1.5">
                {CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-[13px] text-slate-700">
                    <input
                      type="checkbox"
                      name="channels"
                      value={c}
                      defaultChecked={draft ? draft.channelScope.includes(c) : c !== "hcp_only"}
                      className="size-4 rounded border-slate-300 accent-teal-700"
                    />
                    {dict.channels[c]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                {dict.claims.expires}
              </label>
              <input
                type="date"
                name="expiresAt"
                required
                defaultValue={draft?.expiresAt ?? ""}
                className={input}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              {dict.common.cancel}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-60"
            >
              {dict.claims.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
