import { withEnv, freshImport } from "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  midtransConfigured,
  verifyNotificationSignature,
  isPaidStatus,
  isFailedStatus,
  type MidtransNotification,
} from "../src/lib/midtrans.ts";

const KEY = "SB-Mid-server-testkey";

const sign = (orderId: string, statusCode: string, gross: string, key: string) =>
  createHash("sha512").update(`${orderId}${statusCode}${gross}${key}`).digest("hex");

const notif = (over: Partial<MidtransNotification> = {}): MidtransNotification => {
  const base = {
    order_id: "inv-1",
    status_code: "200",
    gross_amount: "799000.00",
    transaction_status: "settlement",
    signature_key: "",
    ...over,
  };
  return { ...base, signature_key: over.signature_key ?? sign(base.order_id, base.status_code, base.gross_amount, KEY) };
};

test("midtrans: configured only when a real server key is set", async () => {
  await withEnv({ MIDTRANS_SERVER_KEY: KEY }, () => assert.equal(midtransConfigured(), true));
  await withEnv({ MIDTRANS_SERVER_KEY: undefined }, () =>
    assert.equal(midtransConfigured(), false),
  );
});

test("midtrans: dev falls back to a stub key, production returns null", async () => {
  const m = await freshImport<typeof import("../src/lib/midtrans.ts")>("../src/lib/midtrans.ts");
  await withEnv({ MIDTRANS_SERVER_KEY: undefined, NODE_ENV: "development" }, () =>
    assert.equal(m.midtransServerKey(), "SB-Mid-server-dev-fallback"),
  );
  await withEnv({ MIDTRANS_SERVER_KEY: undefined, NODE_ENV: "production" }, () =>
    assert.equal(m.midtransServerKey(), null),
  );
  await withEnv({ MIDTRANS_SERVER_KEY: KEY, NODE_ENV: "production" }, () =>
    assert.equal(m.midtransServerKey(), KEY),
  );
});

test("midtrans: a correctly signed notification verifies", async () => {
  await withEnv({ MIDTRANS_SERVER_KEY: KEY }, () =>
    assert.equal(verifyNotificationSignature(notif()), true),
  );
});

test("midtrans: a forged signature is rejected", async () => {
  await withEnv({ MIDTRANS_SERVER_KEY: KEY }, () => {
    assert.equal(verifyNotificationSignature(notif({ signature_key: "deadbeef" })), false);
    assert.equal(verifyNotificationSignature(notif({ signature_key: "" })), false);
  });
});

test("midtrans: tampering with any signed field invalidates the signature", async () => {
  await withEnv({ MIDTRANS_SERVER_KEY: KEY }, () => {
    const good = notif();
    // Same signature, but the payload the attacker wants us to act on differs.
    for (const field of ["order_id", "status_code", "gross_amount"] as const) {
      const tampered = { ...good, [field]: `${good[field]}9` };
      assert.equal(
        verifyNotificationSignature(tampered),
        false,
        `tampered ${field} must not verify`,
      );
    }
  });
});

test("midtrans: a signature made with a different server key is rejected", async () => {
  const foreign = notif({ signature_key: sign("inv-1", "200", "799000.00", "Mid-server-other") });
  await withEnv({ MIDTRANS_SERVER_KEY: KEY }, () =>
    assert.equal(verifyNotificationSignature(foreign), false),
  );
});

test("midtrans: no key at all in production means nothing verifies", async () => {
  const m = await freshImport<typeof import("../src/lib/midtrans.ts")>("../src/lib/midtrans.ts");
  await withEnv({ MIDTRANS_SERVER_KEY: undefined, NODE_ENV: "production" }, () =>
    assert.equal(m.verifyNotificationSignature(notif()), false),
  );
});

test("midtrans: settlement and accepted capture mean money received", () => {
  assert.equal(isPaidStatus(notif({ transaction_status: "settlement" })), true);
  assert.equal(
    isPaidStatus(notif({ transaction_status: "capture", fraud_status: "accept" })),
    true,
  );
  assert.equal(
    isPaidStatus(notif({ transaction_status: "capture" })),
    true,
    "missing fraud_status defaults to accept",
  );
});

test("midtrans: a challenged or denied capture is NOT paid", () => {
  assert.equal(
    isPaidStatus(notif({ transaction_status: "capture", fraud_status: "challenge" })),
    false,
  );
  assert.equal(
    isPaidStatus(notif({ transaction_status: "capture", fraud_status: "deny" })),
    false,
  );
});

test("midtrans: pending and failure states are not paid", () => {
  for (const s of ["pending", "expire", "cancel", "deny", "failure", "refund", "authorize"]) {
    assert.equal(isPaidStatus(notif({ transaction_status: s })), false, `${s} must not be paid`);
  }
});

test("midtrans: terminal failure states are recognised", () => {
  for (const s of ["expire", "cancel", "deny", "failure"]) {
    assert.equal(isFailedStatus(notif({ transaction_status: s })), true, `${s} should be failed`);
  }
  for (const s of ["settlement", "capture", "pending"]) {
    assert.equal(isFailedStatus(notif({ transaction_status: s })), false);
  }
});

test("midtrans: paid and failed are mutually exclusive", () => {
  for (const s of ["settlement", "capture", "pending", "expire", "cancel", "deny", "failure"]) {
    const n = notif({ transaction_status: s });
    assert.ok(!(isPaidStatus(n) && isFailedStatus(n)), `${s} classified as both`);
  }
});
