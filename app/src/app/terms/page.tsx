import { getDict } from "@/lib/i18n-server";
import { formatDate } from "@/lib/i18n";
import { TERMS } from "@/lib/legal";
import { COMPANY } from "@/lib/company";
import { PublicPage } from "@/components/public-page";
import { LegalBody } from "@/components/legal-body";

export const metadata = { title: "Syarat & Ketentuan — MLR Flow" };

// Public, unauthenticated: payment providers and prospects need to read this
// without an account, and Midtrans asks for the link during verification.
export default async function TermsPage() {
  const { dict, locale } = await getDict();
  const doc = TERMS[locale];
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
