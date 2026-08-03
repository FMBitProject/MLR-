import type { LegalSection } from "@/lib/legal";

// Highlights any "[BELUM DIISI: …]" / "[NOT YET SPECIFIED: …]" placeholder so
// an unfilled legal detail is impossible to miss on a published page.
const PLACEHOLDER = /(\[(?:BELUM DIISI|NOT YET SPECIFIED)[^\]]*\])/g;

function withPlaceholders(text: string) {
  return text.split(PLACEHOLDER).map((part, i) =>
    PLACEHOLDER.test(part) ? (
      <mark
        key={i}
        className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 ring-1 ring-inset ring-amber-300"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function LegalBody({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-9">
      {sections.map((s) => (
        <section key={s.heading}>
          <h2 className="text-[16px] font-semibold tracking-tight text-slate-900">
            {s.heading}
          </h2>
          <div className="mt-2.5 space-y-2.5">
            {s.body.map((p, i) => (
              <p key={i} className="text-[14px] leading-relaxed text-slate-600">
                {withPlaceholders(p)}
              </p>
            ))}
          </div>
          {s.list ? (
            <ul className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">
              {s.list.map((li, i) => (
                <li key={i} className="text-[14px] leading-relaxed text-slate-600">
                  {withPlaceholders(li)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
