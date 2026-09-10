import { Plus } from "lucide-react";
import { getDict } from "@/lib/i18n-server";
import { FAQ } from "@/lib/legal";
import { PublicPage } from "@/components/public-page";

export const metadata = { title: "FAQ · Intellibase MLR Flow" };

export default async function FaqPage() {
  const { dict, locale } = await getDict();
  const doc = FAQ[locale];

  return (
    <PublicPage dict={dict} locale={locale} title={doc.title} subtitle={doc.subtitle}>
      <div className="space-y-12">
        {doc.groups.map((group) => (
          <section key={group.name}>
            {/* A plain heading, not an uppercase micro-label: the group name is
                real navigation, so it should read like one. */}
            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              {group.name}
            </h2>
            {/* Accordion rather than a flat list: these groups run well past
                five items, and collapsed rows keep the page scannable. */}
            <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
              {group.items.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium text-white marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300">
                    {item.q}
                    <Plus
                      aria-hidden
                      strokeWidth={1.75}
                      className="mt-0.5 size-4 shrink-0 text-slate-400 transition group-open:rotate-45"
                    />
                  </summary>
                  <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-slate-300">
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
