import { redirect } from "next/navigation";
import { ShieldCheck, FileSearch, GitBranch, Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { RegisterForm } from "@/components/register-form";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const { dict, locale } = await getDict();

  const features =
    locale === "id"
      ? [
          { icon: GitBranch, text: "Workflow review multi-tahap: Medical → Legal → Regulatory" },
          { icon: Sparkles, text: "AI claims check menandai teks yang tak sesuai Claims Library" },
          { icon: FileSearch, text: "Review visual per halaman — komentar ter-pin tepat di elemennya" },
          { icon: ShieldCheck, text: "Jejak audit lengkap, siap inspeksi BPOM" },
        ]
      : [
          { icon: GitBranch, text: "Multi-stage review workflow: Medical → Legal → Regulatory" },
          { icon: Sparkles, text: "AI claims check flags copy that doesn't match the Claims Library" },
          { icon: FileSearch, text: "Visual page-by-page review — comments pinned to the exact element" },
          { icon: ShieldCheck, text: "Complete audit trail, ready for BPOM inspection" },
        ];

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-[480px] rounded-full bg-brand-500/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[420px] rounded-full bg-teal-400/10 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <ShieldCheck className="size-5 text-brand-300" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">{dict.appName}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-brand-300/80">
                {dict.tagline}
              </p>
            </div>
          </div>

          <h2 className="mt-16 max-w-md text-[34px] font-semibold leading-[1.15] tracking-tight">
            {locale === "id"
              ? "Workspace terpisah untuk setiap perusahaan — data Anda tidak pernah tercampur dengan tenant lain."
              : "A separate workspace per company — your data never mixes with another tenant."}
          </h2>

          <ul className="mt-10 space-y-4">
            {features.map((f) => (
              <li key={f.text} className="flex items-start gap-3 text-[15px] text-brand-100/90">
                <f.icon className="mt-0.5 size-[18px] shrink-0 text-brand-300" />
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[12px] text-brand-200/60">{dict.login.compliance}</p>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-[#f6f8fa] px-6 py-12">
        <div className="absolute right-6 top-6">
          <LocaleSwitcher locale={locale} />
        </div>
        <RegisterForm dict={dict} />
      </div>
    </div>
  );
}
