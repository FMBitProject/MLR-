import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { LoginForm } from "@/components/login-form";
import { AuthPanel } from "@/components/auth-panel";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const { dict, locale } = await getDict();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AuthPanel dict={dict} headline={dict.authPanel.loginHeadline} />

      {/* pt-16 below lg keeps the absolutely-positioned locale switcher clear
          of the card; on lg the panel takes the top-left and there's room. */}
      <main className="relative flex flex-1 items-center justify-center bg-[#f6f8fa] px-5 pb-10 pt-16 sm:px-8 lg:py-12">
        <div className="absolute right-5 top-5 sm:right-6 sm:top-6">
          <LocaleSwitcher locale={locale} />
        </div>
        <LoginForm dict={dict} />
      </main>
    </div>
  );
}
