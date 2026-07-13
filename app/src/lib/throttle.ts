import { eq, sql } from "drizzle-orm";
import { db, t } from "./db";

// Fixed-window rate limiter backed by Postgres, so limits hold across
// serverless instances. One atomic upsert per attempt: if the window has
// expired the counter resets to 1, otherwise it increments.

/** Records an attempt and returns true if it is within the limit. */
export async function consumeAttempt(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowMs);
  const row = (
    await db
      .insert(t.authThrottle)
      .values({ key, attempts: 1, windowStart: new Date() })
      .onConflictDoUpdate({
        target: t.authThrottle.key,
        set: {
          attempts: sql`case when ${t.authThrottle.windowStart} < ${cutoff} then 1 else ${t.authThrottle.attempts} + 1 end`,
          windowStart: sql`case when ${t.authThrottle.windowStart} < ${cutoff} then now() else ${t.authThrottle.windowStart} end`,
        },
      })
      .returning({ attempts: t.authThrottle.attempts })
  )[0];
  return (row?.attempts ?? 1) <= limit;
}

/** Clears the counter (e.g. after a successful login). */
export async function clearThrottle(key: string): Promise<void> {
  await db.delete(t.authThrottle).where(eq(t.authThrottle.key, key));
}
