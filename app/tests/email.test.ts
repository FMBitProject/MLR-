import { withEnv, freshImport } from "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("../src/lib/email.ts");
const fresh = () => freshImport<Mod>("../src/lib/email.ts");

const URL_ENV = { APP_URL: undefined, VERCEL_URL: undefined };

/** Captures the dev-mode `[dev email]` console output of one send. */
async function captureRaw(fn: () => Promise<unknown>): Promise<string> {
  const real = console.log;
  let out = "";
  console.log = (...args: unknown[]) => {
    out += args.map(String).join(" ");
  };
  try {
    await fn();
  } finally {
    console.log = real;
  }
  return out;
}

/** Just the HTML body of the captured email, without the subject line. */
async function capture(fn: () => Promise<unknown>): Promise<string> {
  const raw = await captureRaw(fn);
  const i = raw.indexOf("\n<div");
  return i >= 0 ? raw.slice(i) : raw.replace(/^[\s\S]*?subject="[^"]*"/, "");
}

test("email: appUrl prefers APP_URL and strips a trailing slash", async () => {
  const m = await fresh();
  await withEnv({ ...URL_ENV, APP_URL: "https://mlr.example.com/" }, () =>
    assert.equal(m.appUrl(), "https://mlr.example.com"),
  );
  await withEnv({ ...URL_ENV, APP_URL: "https://mlr.example.com" }, () =>
    assert.equal(m.appUrl(), "https://mlr.example.com"),
  );
});

test("email: APP_URL wins over Vercel's injected host", async () => {
  const m = await fresh();
  await withEnv({ APP_URL: "https://real.example.com", VERCEL_URL: "preview.vercel.app" }, () =>
    assert.equal(m.appUrl(), "https://real.example.com"),
  );
});

test("email: VERCEL_URL is used with an https scheme prepended", async () => {
  const m = await fresh();
  await withEnv({ ...URL_ENV, VERCEL_URL: "preview-abc.vercel.app" }, () =>
    assert.equal(m.appUrl(), "https://preview-abc.vercel.app"),
  );
});

test("email: dev falls back to localhost", async () => {
  const m = await fresh();
  await withEnv(URL_ENV, () => assert.equal(m.appUrl(), "http://localhost:3000"));
});

test("email: links in emails are absolute and carry the token", async () => {
  const m = await fresh();
  const out = await withEnv(
    { ...URL_ENV, APP_URL: "https://mlr.example.com", RESEND_API_KEY: undefined, NODE_ENV: "development" },
    () => capture(() => m.sendVerificationEmail("a@b.co", "Budi", "tok123")),
  );
  assert.ok(out.includes("https://mlr.example.com/verify-email?token=tok123"), out.slice(0, 300));
});

test("email: a hostile display name cannot inject HTML into the body", async () => {
  const m = await fresh();
  const hostile = `<img src=x onerror="alert(1)">`;
  const out = await withEnv(
    { ...URL_ENV, RESEND_API_KEY: undefined, NODE_ENV: "development" },
    () => capture(() => m.sendVerificationEmail("a@b.co", hostile, "tok")),
  );
  assert.ok(!out.includes("<img src=x"), "raw tag reached the HTML body");
  assert.ok(out.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"), "expected escaped name");
});

test("email: a hostile tenant name in an invite is escaped in the HTML body", async () => {
  const m = await fresh();
  const out = await withEnv(
    { ...URL_ENV, RESEND_API_KEY: undefined, NODE_ENV: "development" },
    () => capture(() => m.sendInviteEmail("a@b.co", "Budi", `</p><script>x()</script>`, "tok")),
  );
  assert.ok(!out.includes("<script>"), "script tag reached the HTML body");
  assert.ok(out.includes("&lt;script&gt;"));
});

test("email: newlines in a workspace name cannot break the subject line", async () => {
  const m = await fresh();
  const raw = await withEnv(
    { ...URL_ENV, RESEND_API_KEY: undefined, NODE_ENV: "development" },
    () => captureRaw(() => m.sendInviteEmail("a@b.co", "Budi", "Acme\r\nX-Injected: 1", "tok")),
  );
  const subject = raw.match(/subject="([^"]*)"/)?.[1] ?? "";
  assert.ok(subject.length > 0, "no subject captured");
  assert.ok(!/[\r\n]/.test(subject), `raw newline survived into the subject: ${JSON.stringify(subject)}`);
  assert.ok(subject.includes("Acme X-Injected: 1"), "the name should be flattened, not dropped");
});

test("email: an over-long workspace name is truncated in the subject", async () => {
  const m = await fresh();
  const raw = await withEnv(
    { ...URL_ENV, RESEND_API_KEY: undefined, NODE_ENV: "development" },
    () => captureRaw(() => m.sendInviteEmail("a@b.co", "Budi", "W".repeat(500), "tok")),
  );
  const subject = raw.match(/subject="([^"]*)"/)?.[1] ?? "";
  assert.ok(subject.length <= 180, `subject not capped: ${subject.length} chars`);
  assert.ok(subject.endsWith("…"), "a truncated subject should show it was cut");
});

test("email: a submission title with newlines is flattened in the subject too", async () => {
  // The fix lives in sendEmail(), so it covers every call site, not just invites.
  const m = await fresh();
  const raw = await withEnv(
    { ...URL_ENV, RESEND_API_KEY: undefined, NODE_ENV: "development" },
    () =>
      captureRaw(() =>
        m.sendDecisionEmail("a@b.co", {
          locale: "id",
          decision: "approved",
          title: "Materi\nA\r\nB",
          versionLabel: "v2",
          stageRole: "legal_reviewer",
          note: null,
          submissionId: "sub-1",
        }),
      ),
  );
  const subject = raw.match(/subject="([^"]*)"/)?.[1] ?? "";
  assert.ok(!/[\r\n]/.test(subject), `raw newline survived: ${JSON.stringify(subject)}`);
  assert.ok(subject.includes("Materi A B"));
});

test("email: an ordinary subject is left alone", async () => {
  const m = await fresh();
  const raw = await withEnv(
    { ...URL_ENV, RESEND_API_KEY: undefined, NODE_ENV: "development" },
    () => captureRaw(() => m.sendInviteEmail("a@b.co", "Budi", "Acme Pharma", "tok")),
  );
  const subject = raw.match(/subject="([^"]*)"/)?.[1] ?? "";
  assert.equal(subject, "Anda diundang ke workspace Acme Pharma — MLR Flow");
});

test("email: reminder item titles are escaped", async () => {
  const m = await fresh();
  const out = await withEnv(
    { ...URL_ENV, RESEND_API_KEY: undefined, NODE_ENV: "development" },
    () =>
      capture(() =>
        m.sendReviewReminderEmail("a@b.co", {
          locale: "id",
          items: [
            {
              title: `<script>alert(1)</script>`,
              productName: "Produk & Co",
              versionLabel: "v1",
              stageRole: "medical_reviewer",
              daysWaiting: 3,
              submissionId: "sub-1",
            },
          ],
        }),
      ),
  );
  assert.ok(!out.includes("<script>alert(1)</script>"), "unescaped title in reminder digest");
  assert.ok(out.includes("Produk &amp; Co"), "ampersand not escaped");
});

test("email: the expiry digest inflects day counts correctly in English", async () => {
  const m = await fresh();
  const item = (daysLeft: number) => ({
    title: `Materi ${daysLeft}`,
    productName: "Produk A",
    expiresAt: new Date("2026-10-01T00:00:00Z"),
    daysLeft,
    submissionId: `sub-${daysLeft}`,
  });
  const out = await withEnv(
    { ...URL_ENV, RESEND_API_KEY: undefined, NODE_ENV: "development" },
    () =>
      capture(() =>
        m.sendContentExpiryEmail("a@b.co", {
          locale: "en",
          items: [item(1), item(5), item(-1), item(-3)],
        }),
      ),
  );
  assert.ok(out.includes("1 day left"), "singular future not inflected");
  assert.ok(out.includes("5 days left"));
  assert.ok(out.includes("expired 1 day ago"), "singular past not inflected");
  assert.ok(out.includes("expired 3 days ago"));
  assert.ok(!out.includes("1 days"), "plural leaked onto a count of 1");
});

test("email: the expiry digest does not inflect in Indonesian", async () => {
  const m = await fresh();
  const out = await withEnv(
    { ...URL_ENV, RESEND_API_KEY: undefined, NODE_ENV: "development" },
    () =>
      capture(() =>
        m.sendContentExpiryEmail("a@b.co", {
          locale: "id",
          items: [
            { title: "A", productName: "P", expiresAt: new Date(), daysLeft: 1, submissionId: "s1" },
            { title: "B", productName: "P", expiresAt: new Date(), daysLeft: -1, submissionId: "s2" },
          ],
        }),
      ),
  );
  assert.ok(out.includes("1 hari lagi"));
  assert.ok(out.includes("kedaluwarsa 1 hari lalu"));
});

test("email: sending refuses silently in dev but throws in production without a key", async () => {
  const m = await fresh();
  await withEnv({ RESEND_API_KEY: undefined, NODE_ENV: "production" }, async () => {
    await assert.rejects(
      () => m.sendVerificationEmail("a@b.co", "Budi", "tok"),
      /RESEND_API_KEY is not set/,
      "production must not silently drop a verification email",
    );
  });
});

test("email: decision emails render for both locales and all three outcomes", async () => {
  const m = await fresh();
  for (const locale of ["id", "en"] as const)
    for (const decision of ["approved", "changes_requested", "rejected"] as const) {
      const out = await withEnv(
        { ...URL_ENV, RESEND_API_KEY: undefined, NODE_ENV: "development" },
        () =>
          capture(() =>
            m.sendDecisionEmail("a@b.co", {
              locale,
              decision,
              title: "Materi A",
              versionLabel: "v2",
              stageRole: "legal_reviewer",
              note: null,
              submissionId: "sub-1",
            }),
          ),
      );
      assert.ok(out.includes("Materi A"), `${locale}/${decision} lost the title`);
      assert.ok(out.includes("/submissions/sub-1"), `${locale}/${decision} lost the CTA link`);
    }
});
