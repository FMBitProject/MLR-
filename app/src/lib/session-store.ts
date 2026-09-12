import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db, t } from "./db";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
// TODO(review, minor): periodically delete expired session rows. Expiry is
// enforced on reads; cleanup is intentionally deferred to a separate change.

export function validateAuthSecret(secret: string | undefined, production: boolean): string {
  if (secret && (secret.length < 32 || /demo-secret|build-time-placeholder|change.in.production/i.test(secret))) {
    throw new Error("AUTH_SECRET must be a new random secret of at least 32 characters.");
  }
  if (!secret && production) throw new Error("AUTH_SECRET is required in production.");
  return secret || randomBytes(32).toString("hex");
}

const secret = validateAuthSecret(process.env.AUTH_SECRET, process.env.NODE_ENV === "production");
const validToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
const digest = (token: string) => createHmac("sha256", secret).update(token).digest("hex");

export async function issueSession(userId: string, expectedPasswordHash: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    // Serializes session creation with password resets. A login verified
    // against an old password must not create a session after the reset.
    const [user] = await tx.select().from(t.users).where(eq(t.users.id, userId)).for("update");
    if (!user?.emailVerifiedAt || user.passwordHash !== expectedPasswordHash) {
      throw new Error("UNAUTHENTICATED");
    }
    await tx.insert(t.sessions).values({
      tokenHash: digest(token), userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    });
  });
  return token;
}

export async function sessionUser(token: string) {
  // Reject every legacy userId.signature cookie, including forged ones.
  if (!validToken(token)) return null;
  const [row] = await db.select({ user: t.users }).from(t.sessions)
    .innerJoin(t.users, eq(t.sessions.userId, t.users.id))
    .where(and(eq(t.sessions.tokenHash, digest(token)), gt(t.sessions.expiresAt, new Date()), isNotNull(t.users.emailVerifiedAt)));
  return row?.user ?? null;
}

export async function revokeSession(token: string) {
  if (validToken(token)) await db.delete(t.sessions).where(eq(t.sessions.tokenHash, digest(token)));
}
