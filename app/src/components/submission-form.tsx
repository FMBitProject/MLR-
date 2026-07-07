"use client";

import { useState, useTransition } from "react";
import { ArrowRight, UploadCloud, FileText } from "lucide-react";
import { createSubmission } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

type Product = { id: string; name: string };

export function SubmissionForm({
  dict,
  products,
  workflows,
}: {
  dict: Dict;
  products: Product[];
  workflows: Record<string, string[]>;
}) {
  const [channel, setChannel] = useState("print");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stages = workflows[channel] ?? [
    "medical_reviewer",
    "legal_reviewer",
    "regulatory_reviewer",
  ];

  const onSubmit = (formData: FormData) => {
    const text = String(formData.get("text") ?? "").trim();
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!text && !hasFile) {
      setError(dict.newSubmission.needTextOrFile);
      return;
    }
    setError(null);
    startTransition(() => createSubmission(formData));
  };

  const input =
    "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";
  const label = "mb-1.5 block text-[13px] font-medium text-slate-700";

  return (
    <form action={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div>
          <label className={label}>{dict.newSubmission.contentTitle}</label>
          <input
            name="title"
            required
            placeholder={dict.newSubmission.titlePlaceholder}
            className={input}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <label className={label}>{dict.newSubmission.product}</label>
            <select name="productId" required className={input} defaultValue="">
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
            <label className={label}>{dict.newSubmission.channel}</label>
            <select
              name="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className={input}
            >
              {(["print", "digital", "e-detail", "social"] as const).map((c) => (
                <option key={c} value={c}>
                  {dict.channels[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>{dict.newSubmission.audience}</label>
            <select name="audience" className={input}>
              <option value="hcp">{dict.newSubmission.audienceHcp}</option>
              <option value="public">{dict.newSubmission.audiencePublic}</option>
            </select>
          </div>
        </div>

        <div>
          <label className={label}>{dict.newSubmission.text}</label>
          <textarea
            name="text"
            rows={9}
            placeholder={dict.newSubmission.textPlaceholder}
            className={input + " resize-y leading-relaxed"}
          />
        </div>

        <div>
          <label className={label}>{dict.newSubmission.file}</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3.5 transition hover:border-brand-400 hover:bg-brand-50/40">
            <UploadCloud className="size-5 text-slate-400" />
            <span className="text-sm text-slate-600">
              {fileName ?? "PDF · PPTX · DOCX"}
            </span>
            <input
              type="file"
              name="file"
              accept=".pdf,.pptx,.docx"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          <p className="mt-1.5 text-[12px] text-slate-400">{dict.newSubmission.fileNote}</p>
        </div>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? dict.newSubmission.submitting : dict.newSubmission.submit}
          <ArrowRight className="size-4" />
        </button>
      </div>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">
          {dict.newSubmission.workflowPreview}
        </h3>
        <ol className="mt-4 space-y-0">
          {stages.map((role, i) => (
            <li key={role} className="relative flex gap-3 pb-5 last:pb-0">
              {i < stages.length - 1 ? (
                <span className="absolute left-[13px] top-7 h-full w-px bg-slate-200" />
              ) : null}
              <span className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700 ring-1 ring-brand-200">
                {i + 1}
              </span>
              <div className="pt-1">
                <p className="text-[13.5px] font-medium text-slate-800">
                  {dict.roles[role as keyof Dict["roles"]] ?? role}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-violet-50 p-3 text-[12px] leading-relaxed text-violet-800 ring-1 ring-inset ring-violet-200">
          <FileText className="mt-0.5 size-4 shrink-0" />
          {dict.newSubmission.subtitle}
        </div>
      </aside>
    </form>
  );
}
