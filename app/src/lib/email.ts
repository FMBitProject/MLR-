import { Resend } from "resend";
import { dictionaries, type Locale } from "./i18n";

// Resolves the app's public base URL for links inside emails.
// APP_URL is the explicit override (set this to your real domain in
// production). VERCEL_URL is Vercel's auto-injected deployment host (no
// protocol) — a reasonable fallback for preview deploys. Falls back to
// localhost for dev.
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const FROM = process.env.EMAIL_FROM ?? "MLR Flow <onboarding@resend.dev>";

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set. Get a free key at resend.com and set it " +
        "in your environment variables.",
    );
  }
  return new Resend(key);
}

async function sendEmail(to: string, subject: string, html: string) {
  // Dev convenience: without a Resend key, log the email instead of failing
  // the whole registration/invite flow — lets you click through locally.
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set — cannot send email in production.");
    }
    console.log(`\n[dev email] to=${to} subject="${subject}"\n${html}\n`);
    return;
  }
  const resend = client();
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}

const shell = (
  title: string,
  body: string,
  footer = "Jika Anda tidak meminta ini, abaikan email ini.",
) => `
<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
  <p style="color: #0f766e; font-weight: 700; letter-spacing: 0.05em; font-size: 12px; text-transform: uppercase;">MLR Flow</p>
  <h1 style="font-size: 20px; color: #0f172a; margin: 8px 0 16px;">${title}</h1>
  ${body}
  <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
    ${footer}
  </p>
</div>`;

const button = (href: string, label: string) => `
<a href="${href}" style="display: inline-block; background: #0f766e; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; margin: 8px 0 20px;">
  ${label}
</a>`;

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${appUrl()}/verify-email?token=${token}`;
  await sendEmail(
    to,
    "Verifikasi email Anda — MLR Flow",
    shell(
      `Halo ${name}, konfirmasi email Anda`,
      `<p style="color: #334155; font-size: 14px; line-height: 1.6;">
        Klik tombol di bawah untuk mengaktifkan akun MLR Flow Anda. Tautan berlaku 24 jam.
      </p>
      ${button(link, "Verifikasi Email")}
      <p style="color: #94a3b8; font-size: 12px;">Atau salin tautan ini: ${link}</p>`,
    ),
  );
}

// User-provided strings (titles, notes, names) go into HTML bodies — escape them.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const noReplyFooter: Record<Locale, string> = {
  id: "Anda menerima email ini karena terdaftar di workspace MLR Flow perusahaan Anda.",
  en: "You received this email because you are a member of your company's MLR Flow workspace.",
};

function roleLabel(role: string, locale: Locale): string {
  const roles = dictionaries[locale].roles as Record<string, string>;
  return roles[role] ?? role;
}

export type ReviewRequestKind = "new" | "resubmitted" | "advanced";

export async function sendReviewRequestEmail(
  to: string,
  opts: {
    locale: Locale;
    kind: ReviewRequestKind;
    title: string;
    productName: string;
    versionLabel: string;
    stageRole: string;
    submitterName: string;
    submissionId: string;
  },
) {
  const { locale } = opts;
  const stage = roleLabel(opts.stageRole, locale);
  const title = esc(opts.title);
  const meta = `${esc(opts.productName)} — ${opts.versionLabel}`;

  const subject =
    locale === "id"
      ? `Menunggu review Anda: ${opts.title}`
      : `Awaiting your review: ${opts.title}`;

  const intro: Record<ReviewRequestKind, string> =
    locale === "id"
      ? {
          new: `${esc(opts.submitterName)} mengajukan materi baru <strong>${title}</strong> (${meta}).`,
          resubmitted: `${esc(opts.submitterName)} mengajukan revisi <strong>${title}</strong> (${meta}).`,
          advanced: `<strong>${title}</strong> (${meta}) telah lolos tahap review sebelumnya.`,
        }
      : {
          new: `${esc(opts.submitterName)} submitted new material <strong>${title}</strong> (${meta}).`,
          resubmitted: `${esc(opts.submitterName)} submitted a revised version of <strong>${title}</strong> (${meta}).`,
          advanced: `<strong>${title}</strong> (${meta}) has cleared the previous review stage.`,
        };

  const waiting =
    locale === "id"
      ? `Materi ini sekarang menunggu review <strong>${stage}</strong>.`
      : `It is now waiting for <strong>${stage}</strong> review.`;

  await sendEmail(
    to,
    `${subject} — MLR Flow`,
    shell(
      locale === "id" ? "Giliran Anda mereview" : "Your review is needed",
      `<p style="color: #334155; font-size: 14px; line-height: 1.6;">
        ${intro[opts.kind]} ${waiting}
      </p>
      ${button(`${appUrl()}/submissions/${opts.submissionId}`, locale === "id" ? "Buka Review" : "Open Review")}`,
      noReplyFooter[locale],
    ),
  );
}

export async function sendDecisionEmail(
  to: string,
  opts: {
    locale: Locale;
    decision: "approved" | "changes_requested" | "rejected";
    title: string;
    versionLabel: string;
    stageRole: string;
    note: string | null;
    submissionId: string;
  },
) {
  const { locale } = opts;
  const stage = roleLabel(opts.stageRole, locale);
  const title = esc(opts.title);

  const copy = {
    approved: {
      subject: locale === "id" ? `Disetujui: ${opts.title}` : `Approved: ${opts.title}`,
      heading: locale === "id" ? "Materi Anda disetujui 🎉" : "Your material is approved 🎉",
      body:
        locale === "id"
          ? `<strong>${title}</strong> (${opts.versionLabel}) telah disetujui di semua tahap review. Versi finalnya kini dikunci dan tersedia di Approved Library.`
          : `<strong>${title}</strong> (${opts.versionLabel}) has been approved by all review stages. The final version is now locked and available in the Approved Library.`,
      cta: locale === "id" ? "Lihat Persetujuan" : "View Approval",
    },
    changes_requested: {
      subject: locale === "id" ? `Perlu revisi: ${opts.title}` : `Changes requested: ${opts.title}`,
      heading: locale === "id" ? "Reviewer meminta perubahan" : "A reviewer requested changes",
      body:
        locale === "id"
          ? `Reviewer <strong>${stage}</strong> meminta perubahan pada <strong>${title}</strong> (${opts.versionLabel}).`
          : `The <strong>${stage}</strong> reviewer requested changes to <strong>${title}</strong> (${opts.versionLabel}).`,
      cta: locale === "id" ? "Lihat Feedback" : "View Feedback",
    },
    rejected: {
      subject: locale === "id" ? `Ditolak: ${opts.title}` : `Rejected: ${opts.title}`,
      heading: locale === "id" ? "Materi Anda ditolak" : "Your material was rejected",
      body:
        locale === "id"
          ? `Reviewer <strong>${stage}</strong> menolak <strong>${title}</strong> (${opts.versionLabel}).`
          : `The <strong>${stage}</strong> reviewer rejected <strong>${title}</strong> (${opts.versionLabel}).`,
      cta: locale === "id" ? "Lihat Detail" : "View Details",
    },
  }[opts.decision];

  const noteBlock = opts.note
    ? `<blockquote style="margin: 12px 0; padding: 10px 14px; border-left: 3px solid #0f766e; background: #f0fdfa; color: #134e4a; font-size: 14px; line-height: 1.6;">${esc(opts.note)}</blockquote>`
    : "";

  await sendEmail(
    to,
    `${copy.subject} — MLR Flow`,
    shell(
      copy.heading,
      `<p style="color: #334155; font-size: 14px; line-height: 1.6;">${copy.body}</p>
      ${noteBlock}
      ${button(`${appUrl()}/submissions/${opts.submissionId}`, copy.cta)}`,
      noReplyFooter[locale],
    ),
  );
}

export async function sendInviteEmail(to: string, name: string, tenantName: string, token: string) {
  const link = `${appUrl()}/verify-email?token=${token}`;
  await sendEmail(
    to,
    `Anda diundang ke workspace ${tenantName} — MLR Flow`,
    shell(
      `Halo ${name}, atur akun Anda`,
      `<p style="color: #334155; font-size: 14px; line-height: 1.6;">
        Anda ditambahkan ke workspace <strong>${tenantName}</strong> di MLR Flow. Klik tombol di bawah
        untuk membuat kata sandi dan mengaktifkan akun. Tautan berlaku 24 jam.
      </p>
      ${button(link, "Atur Akun Saya")}
      <p style="color: #94a3b8; font-size: 12px;">Atau salin tautan ini: ${link}</p>`,
    ),
  );
}
