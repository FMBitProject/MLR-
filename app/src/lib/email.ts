import { Resend } from "resend";

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

const shell = (title: string, body: string) => `
<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
  <p style="color: #0f766e; font-weight: 700; letter-spacing: 0.05em; font-size: 12px; text-transform: uppercase;">MLR Flow</p>
  <h1 style="font-size: 20px; color: #0f172a; margin: 8px 0 16px;">${title}</h1>
  ${body}
  <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
    Jika Anda tidak meminta ini, abaikan email ini.
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
