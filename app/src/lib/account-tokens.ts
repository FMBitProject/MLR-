import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, t } from "./db";
import { hashPassword } from "./password";

type Purpose = "verify" | "invite" | "reset";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const validToken = (token: string) => /^[a-f0-9]{64}$/.test(token);

/** Replace prior tokens under the same user lock used by redemption. */
export async function createAccountToken(userId: string, purpose: Purpose): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    const [user] = await tx.select({ id: t.users.id }).from(t.users).where(eq(t.users.id, userId)).for("update");
    if (!user) throw new Error("NOT_FOUND");
    await tx.delete(t.accountTokens).where(eq(t.accountTokens.userId, userId));
    await tx.insert(t.accountTokens).values({
      tokenHash: tokenHash(token), userId, purpose,
      expiresAt: new Date(Date.now() + (purpose === "reset" ? 1 : 24) * 60 * 60_000),
      createdAt: new Date(),
    });
  });
  return token;
}

/** Read-only lookup for activation/reset pages; never returns the token digest. */
export async function findAccountToken(token: string) {
  if (!validToken(token)) return null;
  const [row] = await db.select({
    userId: t.accountTokens.userId, purpose: t.accountTokens.purpose,
    expiresAt: t.accountTokens.expiresAt, user: t.users,
  }).from(t.accountTokens).innerJoin(t.users, eq(t.accountTokens.userId, t.users.id))
    .where(and(eq(t.accountTokens.tokenHash, tokenHash(token)), gt(t.accountTokens.expiresAt, new Date())));
  return row ?? null;
}

/** Consume once, update credentials and revoke sessions in ONE transaction. */
export async function redeemAccountToken(token: string, purpose: Purpose, password?: string) {
  if (!validToken(token) || (purpose !== "verify" && (!password || password.length < 8))) return null;
  return db.transaction(async (tx) => {
    const hash = tokenHash(token);
    const [candidate] = await tx.select().from(t.accountTokens).where(eq(t.accountTokens.tokenHash, hash));
    if (!candidate) return null;
    const [user] = await tx.select().from(t.users).where(eq(t.users.id, candidate.userId)).for("update");
    if (!user) return null;
    const consumed = await tx.delete(t.accountTokens).where(and(
      eq(t.accountTokens.tokenHash, hash), eq(t.accountTokens.purpose, purpose),
      gt(t.accountTokens.expiresAt, new Date()),
    )).returning({ userId: t.accountTokens.userId });
    if (!consumed.length) return null;
    const [updated] = await tx.update(t.users).set(purpose === "verify"
      ? { emailVerifiedAt: new Date() }
      : { passwordHash: hashPassword(password!), ...(purpose === "invite" ? { emailVerifiedAt: new Date() } : {}) },
    ).where(eq(t.users.id, user.id)).returning();
    if (purpose !== "verify") await tx.delete(t.sessions).where(eq(t.sessions.userId, user.id));
    return { userId: user.id, user: updated };
  });
}
