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

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string,
  locale: Locale,
) {
  const link = `${appUrl()}/reset-password?token=${token}`;
  const copy =
    locale === "id"
      ? {
          subject: "Atur ulang kata sandi Anda — MLR Flow",
          title: `Halo ${name}, atur ulang kata sandi Anda`,
          body: "Kami menerima permintaan untuk mengatur ulang kata sandi akun MLR Flow Anda. Klik tombol di bawah untuk membuat kata sandi baru. Tautan berlaku 1 jam.",
          cta: "Atur Ulang Kata Sandi",
          copyHint: "Atau salin tautan ini:",
          footer:
            "Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini — kata sandi Anda tidak berubah.",
        }
      : {
          subject: "Reset your password — MLR Flow",
          title: `Hi ${name}, reset your password`,
          body: "We received a request to reset the password for your MLR Flow account. Click the button below to choose a new password. The link is valid for 1 hour.",
          cta: "Reset Password",
          copyHint: "Or copy this link:",
          footer:
            "If you didn't request a password reset, ignore this email — your password is unchanged.",
        };
  await sendEmail(
    to,
    copy.subject,
    shell(
      copy.title,
      `<p style="color: #334155; font-size: 14px; line-height: 1.6;">${copy.body}</p>
      ${button(link, copy.cta)}
      <p style="color: #94a3b8; font-size: 12px;">${copy.copyHint} ${link}</p>`,
      copy.footer,
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

export type ReminderItem = {
  title: string;
  productName: string;
  versionLabel: string;
  stageRole: string;
  daysWaiting: number;
  submissionId: string;
  /** Assigned reviewer's name, for the admin digest. */
  reviewerName?: string | null;
};

const reminderRows = (items: ReminderItem[], locale: Locale, withReviewer: boolean) =>
  items
    .map((it) => {
      const days =
        locale === "id" ? `menunggu ${it.daysWaiting} hari` : `waiting ${it.daysWaiting} days`;
      const reviewer = withReviewer
        ? ` · ${esc(it.reviewerName ?? roleLabel(it.stageRole, locale))}`
        : "";
      return `<li style="margin: 0 0 10px;">
        <a href="${appUrl()}/submissions/${it.submissionId}" style="color: #0f766e; font-weight: 600; text-decoration: none;">${esc(it.title)}</a>
        <span style="color: #64748b; font-size: 13px;"> — ${esc(it.productName)} · ${it.versionLabel} · ${roleLabel(it.stageRole, locale)}${reviewer} · <strong style="color: #b45309;">${days}</strong></span>
      </li>`;
    })
    .join("");

/** Daily digest to a reviewer: everything stuck waiting on them. */
export async function sendReviewReminderEmail(
  to: string,
  opts: { locale: Locale; items: ReminderItem[] },
) {
  const { locale, items } = opts;
  const n = items.length;
  const subject =
    locale === "id"
      ? `${n} materi menunggu review Anda`
      : `${n} ${n === 1 ? "item is" : "items are"} waiting for your review`;
  const body =
    locale === "id"
      ? `Materi berikut sudah menunggu review Anda lebih lama dari seharusnya. Reviewer lain dan tim marketing menunggu giliran setelah Anda:`
      : `The following materials have been waiting for your review longer than they should. Other reviewers and the marketing team are queued behind you:`;
  await sendEmail(
    to,
    `${subject} — MLR Flow`,
    shell(
      locale === "id" ? "Pengingat review harian" : "Daily review reminder",
      `<p style="color: #334155; font-size: 14px; line-height: 1.6;">${body}</p>
      <ul style="padding-left: 18px; margin: 12px 0 4px;">${reminderRows(items, locale, false)}</ul>
      ${button(`${appUrl()}/dashboard`, locale === "id" ? "Buka Dashboard" : "Open Dashboard")}`,
      noReplyFooter[locale],
    ),
  );
}

/** Daily digest to workspace admins: every stuck stage and who it waits on. */
export async function sendBottleneckDigestEmail(
  to: string,
  opts: { locale: Locale; items: ReminderItem[] },
) {
  const { locale, items } = opts;
  const subject =
    locale === "id"
      ? `Bottleneck review: ${items.length} materi macet`
      : `Review bottleneck: ${items.length} stuck ${items.length === 1 ? "item" : "items"}`;
  const body =
    locale === "id"
      ? `Materi berikut macet di tahap review lebih lama dari seharusnya:`
      : `The following materials are stuck in review longer than they should be:`;
  await sendEmail(
    to,
    `${subject} — MLR Flow`,
    shell(
      locale === "id" ? "Ringkasan bottleneck review" : "Review bottleneck summary",
      `<p style="color: #334155; font-size: 14px; line-height: 1.6;">${body}</p>
      <ul style="padding-left: 18px; margin: 12px 0 4px;">${reminderRows(items, locale, true)}</ul>
      ${button(`${appUrl()}/dashboard`, locale === "id" ? "Buka Dashboard" : "Open Dashboard")}`,
      noReplyFooter[locale],
    ),
  );
}

/**
 * Renewal invoice notice to workspace admins. Sent when the invoice is
 * raised and re-sent (throttled) while it stays unpaid; the copy escalates
 * with the billing status.
 */
export async function sendInvoiceEmail(
  to: string,
  opts: {
    locale: Locale;
    status: "active" | "grace" | "delinquent";
    tenantName: string;
    invoiceNumber: string;
    plan: string;
    amountIdr: number;
    activeUntil: Date;
    payUrl: string | null;
  },
) {
  const { locale } = opts;
  const amount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(opts.amountIdr);
  const until = opts.activeUntil.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const copy = {
    active: {
      subject:
        locale === "id"
          ? `Tagihan perpanjangan ${opts.invoiceNumber}`
          : `Renewal invoice ${opts.invoiceNumber}`,
      heading: locale === "id" ? "Tagihan langganan Anda" : "Your subscription invoice",
      body:
        locale === "id"
          ? `Langganan MLR Flow workspace <strong>${esc(opts.tenantName)}</strong> (paket ${esc(opts.plan)}) aktif sampai <strong>${until}</strong>. Bayar tagihan <strong>${esc(opts.invoiceNumber)}</strong> sebesar <strong>${amount}</strong> untuk memperpanjang satu bulan.`
          : `The MLR Flow subscription for workspace <strong>${esc(opts.tenantName)}</strong> (${esc(opts.plan)} plan) is active until <strong>${until}</strong>. Pay invoice <strong>${esc(opts.invoiceNumber)}</strong> of <strong>${amount}</strong> to extend it by one month.`,
    },
    grace: {
      subject:
        locale === "id"
          ? `Langganan berakhir — masa tenggang berjalan (${opts.invoiceNumber})`
          : `Subscription lapsed — grace period running (${opts.invoiceNumber})`,
      heading: locale === "id" ? "Langganan Anda telah berakhir" : "Your subscription has lapsed",
      body:
        locale === "id"
          ? `Langganan workspace <strong>${esc(opts.tenantName)}</strong> berakhir pada <strong>${until}</strong>. Workspace masih dapat digunakan penuh selama masa tenggang, lalu beralih ke mode baca-saja. Bayar <strong>${amount}</strong> (${esc(opts.invoiceNumber)}) untuk melanjutkan.`
          : `The subscription for workspace <strong>${esc(opts.tenantName)}</strong> lapsed on <strong>${until}</strong>. The workspace keeps full access during the grace period, then becomes read-only. Pay <strong>${amount}</strong> (${esc(opts.invoiceNumber)}) to continue.`,
    },
    delinquent: {
      subject:
        locale === "id"
          ? `Workspace baca-saja — tagihan belum dibayar (${opts.invoiceNumber})`
          : `Workspace is read-only — unpaid invoice (${opts.invoiceNumber})`,
      heading:
        locale === "id" ? "Workspace Anda kini baca-saja" : "Your workspace is now read-only",
      body:
        locale === "id"
          ? `Masa tenggang workspace <strong>${esc(opts.tenantName)}</strong> telah habis, sehingga pengajuan konten baru dinonaktifkan. Semua data dan review yang berjalan tetap aman. Bayar <strong>${amount}</strong> (${esc(opts.invoiceNumber)}) untuk memulihkan akses penuh.`
          : `The grace period for workspace <strong>${esc(opts.tenantName)}</strong> has ended, so new content submissions are disabled. All data and in-flight reviews remain safe. Pay <strong>${amount}</strong> (${esc(opts.invoiceNumber)}) to restore full access.`,
    },
  }[opts.status];

  const payBlock = opts.payUrl
    ? button(opts.payUrl, locale === "id" ? "Bayar Sekarang" : "Pay Now")
    : button(
        `${appUrl()}/settings`,
        locale === "id" ? "Buka Pengaturan Billing" : "Open Billing Settings",
      );

  await sendEmail(
    to,
    `${copy.subject} — MLR Flow`,
    shell(
      copy.heading,
      `<p style="color: #334155; font-size: 14px; line-height: 1.6;">${copy.body}</p>
      ${payBlock}`,
      noReplyFooter[locale],
    ),
  );
}

export type ExpiryItem = {
  title: string;
  productName: string;
  expiresAt: Date;
  /** Negative once past expiry. */
  daysLeft: number;
  submissionId: string;
};

/**
 * Digest to compliance/QA and workspace admins: approved material expiring
 * within 30 days or already expired — pull it from circulation or extend
 * its expiry after re-review.
 */
export async function sendContentExpiryEmail(
  to: string,
  opts: { locale: Locale; items: ExpiryItem[] },
) {
  const { locale, items } = opts;
  const n = items.length;
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const dayNote = (it: ExpiryItem) =>
    it.daysLeft < 0
      ? locale === "id"
        ? `kedaluwarsa ${-it.daysLeft} hari lalu`
        : `expired ${-it.daysLeft} days ago`
      : locale === "id"
        ? `${it.daysLeft} hari lagi`
        : `${it.daysLeft} days left`;

  const rows = items
    .map(
      (it) => `<li style="margin: 0 0 10px;">
        <a href="${appUrl()}/submissions/${it.submissionId}" style="color: #0f766e; font-weight: 600; text-decoration: none;">${esc(it.title)}</a>
        <span style="color: #64748b; font-size: 13px;"> — ${esc(it.productName)} · ${fmt(it.expiresAt)} · <strong style="color: ${it.daysLeft < 0 ? "#be123c" : "#b45309"};">${dayNote(it)}</strong></span>
      </li>`,
    )
    .join("");

  const subject =
    locale === "id"
      ? `${n} materi disetujui akan/telah kedaluwarsa`
      : `${n} approved ${n === 1 ? "material is" : "materials are"} expiring or expired`;
  const body =
    locale === "id"
      ? `Materi berikut mendekati atau telah melewati tanggal kedaluwarsanya. Tarik dari peredaran, atau perpanjang tanggalnya setelah review ulang:`
      : `The following materials are approaching or past their expiry date. Withdraw them from circulation, or extend the date after re-review:`;

  await sendEmail(
    to,
    `${subject} — MLR Flow`,
    shell(
      locale === "id" ? "Pengingat kedaluwarsa materi" : "Material expiry reminder",
      `<p style="color: #334155; font-size: 14px; line-height: 1.6;">${body}</p>
      <ul style="padding-left: 18px; margin: 12px 0 4px;">${rows}</ul>
      ${button(`${appUrl()}/library`, locale === "id" ? "Buka Library" : "Open Library")}`,
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
