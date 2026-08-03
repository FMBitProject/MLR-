import { getDict } from "@/lib/i18n-server";
import { FAQ } from "@/lib/legal";
import { PublicPage } from "@/components/public-page";

export const metadata = { title: "FAQ — MLR Flow" };

export default async function FaqPage() {
  const { dict, locale } = await getDict();
  const doc = FAQ[locale];

  return (
    <PublicPage dict={dict} locale={locale} title={doc.title} subtitle={doc.subtitle}>
      <div className="space-y-10">
        {doc.groups.map((group) => (
          <section key={group.name}>
            <h2 className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-brand-700">
              {group.name}
            </h2>
            <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {group.items.map((item) => (
                <details key={item.q} className="group px-5 py-4 open:bg-slate-50/60">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[14.5px] font-medium text-slate-800 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                    {item.q}
                    <span
                      aria-hidden
                      className="mt-0.5 shrink-0 text-[18px] leading-none text-slate-400 transition group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-2.5 max-w-[62ch] text-[14px] leading-relaxed text-slate-600">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PublicPage>
  );
}
