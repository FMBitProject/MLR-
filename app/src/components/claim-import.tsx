"use client";

import { useActionState, useState, useTransition } from "react";
import { FileScan, Sparkles, UploadCloud, X } from "lucide-react";
import { extractClaimsFromDoc, importClaims, type ExtractState } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

type Product = { id: string; name: string };

const CHANNELS = ["print", "digital", "hcp_only"] as const;

export function ImportSopButton({
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
        className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-sm transition hover:bg-brand-100"
      >
        <FileScan className="size-4" />
        {dict.claims.importSop}
      </button>
      {open ? (
        <ImportModal dict={dict} products={products} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function ImportModal({
  dict,
  products,
  onClose,
}: {
  dict: Dict;
  products: Product[];
  onClose: () => void;
}) {
  const [state, extractAction, extracting] = useActionState<ExtractState, FormData>(
    extractClaimsFromDoc,
    null,
  );
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);

  const input =
    "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";
  const label = "mb-1.5 block text-[13px] font-medium text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl animate-fade-up overflow-y-auto rounded-2xl bg-white p-6 shadow-pop">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-slate-900">
            {dict.claims.importTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-5 text-[12.5px] leading-relaxed text-slate-500">
          {dict.claims.importDesc}
        </p>

        {/* Step 1 — document input & extraction */}
        <form action={extractAction} className="space-y-4">
          <div>
            <label className={label}>{dict.claims.docText}</label>
            <textarea
              name="docText"
              rows={7}
              placeholder={dict.claims.docTextPlaceholder}
              className={input + " resize-y leading-relaxed"}
            />
          </div>
          <div>
            <label className={label}>{dict.claims.uploadDoc}</label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 transition hover:border-brand-400 hover:bg-brand-50/40">
              <UploadCloud className="size-5 text-slate-400" />
              <span className="text-sm text-slate-600">{fileName ?? ".txt · .md"}</span>
              <input
                type="file"
                name="docFile"
                accept=".txt,.md,text/plain,text/markdown"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </label>
            <p className="mt-1.5 text-[11.5px] text-slate-400">{dict.claims.pdfNote}</p>
          </div>
          <button
            type="submit"
            disabled={extracting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-60"
          >
            <Sparkles className="size-4" />
            {extracting ? dict.claims.extracting : dict.claims.extract}
          </button>
        </form>

        {/* Step 2 — pick candidates and save */}
        {state ? (
          state.candidates.length ? (
            <form
              action={(fd) =>
                startTransition(async () => {
                  await importClaims(fd);
                  onClose();
                })
              }
              className="mt-6 space-y-4 border-t border-slate-200 pt-5"
            >
              <input type="hidden" name="source" value={state.source} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-slate-800">
                  {dict.claims.candidates}
                </p>
                <p className="text-[11.5px] text-slate-400">
                  {dict.claims.candidatesVia}{" "}
                  {state.engine === "claude"
                    ? dict.claims.engineClaude
                    : dict.claims.engineHeuristic}
                </p>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {state.candidates.map((c, i) => (
                  <label
                    key={i}
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-700 shadow-sm transition has-checked:border-brand-300 has-checked:bg-brand-50/60"
                  >
                    <input
                      type="checkbox"
                      name="claims"
                      value={c}
                      defaultChecked
                      className="mt-1 size-4 shrink-0 accent-teal-700"
                    />
                    {c}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className={label}>{dict.newSubmission.product}</label>
                  <select name="productId" required defaultValue="" className={input}>
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
                  <label className={label}>{dict.claims.expires}</label>
                  <input type="date" name="expiresAt" required className={input} />
                </div>
                <div>
                  <label className={label}>{dict.claims.channels}</label>
                  <div className="space-y-1">
                    {CHANNELS.map((c) => (
                      <label
                        key={c}
                        className="flex items-center gap-2 text-[12.5px] text-slate-700"
                      >
                        <input
                          type="checkbox"
                          name="channels"
                          value={c}
                          defaultChecked={c !== "hcp_only"}
                          className="size-3.5 accent-teal-700"
                        />
                        {dict.channels[c]}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <p className="rounded-xl bg-violet-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-violet-800 ring-1 ring-inset ring-violet-200">
                {dict.claims.aiNote}
              </p>

              <div className="flex justify-end gap-2">
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
                  {dict.claims.importSelected}
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-500 ring-1 ring-inset ring-slate-200">
              {dict.claims.noCandidates}
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}
