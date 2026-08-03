import { getDict } from "@/lib/i18n-server";
import { formatDate } from "@/lib/i18n";
import { PRIVACY } from "@/lib/legal";
import { COMPANY } from "@/lib/company";
import { PublicPage } from "@/components/public-page";
import { LegalBody } from "@/components/legal-body";

export const metadata = { title: "Kebijakan Privasi — MLR Flow" };

export default async function PrivacyPage() {
  const { dict, locale } = await getDict();
  const doc = PRIVACY[locale];
  return (
    <PublicPage
      dict={dict}
      locale={locale}
      title={doc.title}
      subtitle={doc.subtitle}
      meta={`${doc.updatedLabel}: ${formatDate(
        new Date(`${COMPANY.legalUpdatedAt}T12:00:00Z`),
        locale,
      )}`}
    >
      <LegalBody sections={doc.sections} />
    </PublicPage>
  );
}
