import { sendStaleReviewReminders } from "@/lib/reminders";

// Daily reminder sweep. On Vercel this is invoked by the cron entry in
// vercel.json (Vercel sends `Authorization: Bearer ${CRON_SECRET}`); on
// self-hosted deployments point any scheduler at it with the same header:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/reminders
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Never run an unauthenticated email cannon in production.
    if (process.env.NODE_ENV === "production") {
      return new Response("CRON_SECRET is not configured", { status: 503 });
    }
  } else if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stats = await sendStaleReviewReminders();
  console.log("reminder sweep:", stats);
  return Response.json(stats);
}
