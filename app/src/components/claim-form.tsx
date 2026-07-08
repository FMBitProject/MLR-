"use client";

import { useState, useTransition } from "react";
import { BookMarked, Plus, Search, X } from "lucide-react";
import { saveClaim, lookupReference } from "@/lib/actions";
import type { ClaimReference } from "@/lib/db/schema";
import type { Dict } from "@/lib/i18n";

type Product = { id: string; name: string };

export type ClaimDraft = {
  id: string;
  productId: string;
  claimText: string;
  channelScope: string[];
  expiresAt: string; // yyyy-mm-dd
  references: ClaimReference[];
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

  const [refs, setRefs] = useState<ClaimReference[]>(draft?.references ?? []);
  const [lookupId, setLookupId] = useState("");
  const [lookupFailed, setLookupFailed] = useState(false);
  const [looking, startLookup] = useTransition();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCitation, setManualCitation] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  const runLookup = () => {
    const id = lookupId.trim();
    if (!id || looking) return;
    startLookup(async () => {
      const ref = await lookupReference(id);
      if (ref) {
        setRefs((r) => [...r, ref]);
        setLookupId("");
        setLookupFailed(false);
      } else {
        setLookupFailed(true);
      }
    });
  };

  const addManual = () => {
    const citation = manualCitation.trim();
    if (!citation) return;
    setRefs((r) => [...r, { citation, url: manualUrl.trim() || null }]);
    setManualCitation("");
    setManualUrl("");
    setManualOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-2xl bg-white p-6 shadow-pop">
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

          {/* Supporting journal references */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {dict.claims.references}
            </label>
            <p className="mb-2 text-[11.5px] leading-relaxed text-slate-400">
              {dict.claims.refHint}
            </p>
            <input type="hidden" name="referencesJson" value={JSON.stringify(refs)} />
            {refs.length ? (
              <ul className="mb-2 space-y-1.5">
                {refs.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2"
                  >
                    <BookMarked className="mt-0.5 size-3.5 shrink-0 text-brand-600" />
                    <span className="flex-1 text-[12px] leading-snug text-slate-600">
                      {r.citation}
                      {r.pmid ? (
                        <span className="ml-1.5 font-semibold text-brand-700">
                          PMID {r.pmid}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      aria-label={dict.claims.refRemove}
                      onClick={() => setRefs((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded p-0.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-2">
              <input
                value={lookupId}
                onChange={(e) => {
                  setLookupId(e.target.value);
                  setLookupFailed(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runLookup();
                  }
                }}
                placeholder={dict.claims.refLookupPlaceholder}
                className={input + " flex-1"}
              />
              <button
                type="button"
                onClick={runLookup}
                disabled={looking || !lookupId.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-[12.5px] font-semibold text-brand-800 shadow-sm transition hover:bg-brand-100 disabled:opacity-50"
              >
                <Search className="size-3.5" />
                {looking ? dict.claims.refLooking : dict.claims.refLookup}
              </button>
            </div>
            {lookupFailed ? (
              <p className="mt-1.5 text-[11.5px] text-rose-600">{dict.claims.refNotFound}</p>
            ) : null}
            {manualOpen ? (
              <div className="mt-2 space-y-2 rounded-xl border border-dashed border-slate-300 p-3">
                <input
                  value={manualCitation}
                  onChange={(e) => setManualCitation(e.target.value)}
                  placeholder={dict.claims.refCitation}
                  className={input}
                />
                <input
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder={dict.claims.refUrl}
                  className={input}
                />
                <button
                  type="button"
                  onClick={addManual}
                  disabled={!manualCitation.trim()}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {dict.claims.refAdd}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="mt-1.5 text-[11.5px] font-semibold text-slate-400 transition hover:text-slate-600"
              >
                {dict.claims.refManualToggle}
              </button>
            )}
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
