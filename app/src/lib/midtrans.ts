import { createHash } from "node:crypto";

// Midtrans Snap integration — plain REST, no SDK dependency.
// Docs: https://docs.midtrans.com/reference/backend-integration
//
// MIDTRANS_SERVER_KEY selects the environment by its prefix: sandbox keys
// start with "SB-Mid-server-", production keys with "Mid-server-".
// Without a key (dev), invoice creation still works but no payment link is
// produced — the webhook stays testable with the dev fallback key below.

const DEV_FALLBACK_KEY = "SB-Mid-server-dev-fallback";

export function midtransServerKey(): string | null {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (key) return key;
  if (process.env.NODE_ENV !== "production") return DEV_FALLBACK_KEY;
  return null;
}

export function midtransConfigured(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY);
}

function snapBaseUrl(key: string): string {
  return key.startsWith("SB-")
    ? "https://app.sandbox.midtrans.com/snap/v1"
    : "https://app.midtrans.com/snap/v1";
}

export type SnapTransaction = { token: string; redirectUrl: string };

/**
 * Creates a Snap transaction for an invoice and returns the hosted payment
 * page. `orderId` must be the invoice id — the payment notification webhook
 * looks the invoice up by it. Returns null in dev when no real key is set
 * (the invoice is then payable only via a simulated webhook call).
 */
export async function createSnapTransaction(opts: {
  orderId: string;
  grossAmountIdr: number;
  itemName: string;
  customerName: string;
  customerEmail: string;
  finishUrl: string;
  expiryDays: number;
}): Promise<SnapTransaction | null> {
  if (!midtransConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "MIDTRANS_SERVER_KEY is not set — cannot create payment links in production.",
      );
    }
    console.log(
      `[dev midtrans] would create Snap transaction order_id=${opts.orderId} ` +
        `amount=${opts.grossAmountIdr} — set MIDTRANS_SERVER_KEY to enable real payments.`,
    );
    return null;
  }

  const key = process.env.MIDTRANS_SERVER_KEY!;
  const res = await fetch(`${snapBaseUrl(key)}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: opts.orderId,
        gross_amount: opts.grossAmountIdr,
      },
      item_details: [
        {
          id: "subscription",
          price: opts.grossAmountIdr,
          quantity: 1,
          name: opts.itemName.slice(0, 50), // Midtrans caps item names at 50 chars
        },
      ],
      customer_details: {
        first_name: opts.customerName.slice(0, 255),
        email: opts.customerEmail,
      },
      expiry: { unit: "days", duration: opts.expiryDays },
      callbacks: { finish: opts.finishUrl },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Midtrans Snap request failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { token: string; redirect_url: string };
  return { token: data.token, redirectUrl: data.redirect_url };
}

export type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
};

/**
 * Verifies the signature on a Midtrans payment notification:
 * sha512(order_id + status_code + gross_amount + server_key).
 * https://docs.midtrans.com/docs/https-notification-webhooks
 */
export function verifyNotificationSignature(n: MidtransNotification): boolean {
  const key = midtransServerKey();
  if (!key) return false;
  const expected = createHash("sha512")
    .update(`${n.order_id}${n.status_code}${n.gross_amount}${key}`)
    .digest("hex");
  return expected === n.signature_key;
}

/** Payment states that mean "money received" per Midtrans docs. */
export function isPaidStatus(n: MidtransNotification): boolean {
  if (n.transaction_status === "settlement") return true;
  return n.transaction_status === "capture" && (n.fraud_status ?? "accept") === "accept";
}

/** Terminal failure states — the invoice's payment link is dead. */
export function isFailedStatus(n: MidtransNotification): boolean {
  return ["expire", "cancel", "deny", "failure"].includes(n.transaction_status);
}
