import { runBillingSweep } from "@/lib/billing";

// Daily billing sweep: expires dead payment links, raises renewal invoices
// for tenants within the renewal window, and emails admins about unpaid
// ones. Same auth contract as /api/cron/reminders — on Vercel the cron entry
// in vercel.json sends `Authorization: Bearer ${CRON_SECRET}`; self-hosted:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/billing
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return new Response("CRON_SECRET is not configured", { status: 503 });
    }
  } else if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stats = await runBillingSweep();
  console.log("billing sweep:", stats);
  return Response.json(stats);
}
