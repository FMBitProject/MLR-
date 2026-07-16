import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, t } from "./db";

const TOKEN_TTL_MS = 24 * 60 * 60_000; // 24h
// Reset links grant account takeover to whoever holds them, so they live
// much shorter than activation links.
const RESET_TTL_MS = 60 * 60_000; // 1h

/** Creates a single-use account token for a user, replacing any prior one. */
export async function createAccountToken(
  userId: string,
  purpose: "verify" | "invite" | "reset",
): Promise<string> {
  await db.delete(t.accountTokens).where(eq(t.accountTokens.userId, userId));
  const token = randomBytes(32).toString("hex");
  await db.insert(t.accountTokens).values({
    token,
    userId,
    purpose,
    expiresAt: new Date(Date.now() + (purpose === "reset" ? RESET_TTL_MS : TOKEN_TTL_MS)),
    createdAt: new Date(),
  });
  return token;
}

export type AccountTokenLookup = {
  token: string;
  userId: string;
  purpose: string;
  expiresAt: Date;
  user: typeof t.users.$inferSelect;
};

/** Looks up a token; returns null if missing or expired (expired ones are deleted). */
export async function findAccountToken(token: string): Promise<AccountTokenLookup | null> {
  const row = (
    await db
      .select({ tok: t.accountTokens, user: t.users })
      .from(t.accountTokens)
      .innerJoin(t.users, eq(t.accountTokens.userId, t.users.id))
      .where(eq(t.accountTokens.token, token))
  )[0];
  if (!row) return null;
  if (row.tok.expiresAt < new Date()) {
    await db.delete(t.accountTokens).where(eq(t.accountTokens.token, token));
    return null;
  }
  return { ...row.tok, user: row.user };
}

export async function consumeAccountToken(token: string): Promise<void> {
  await db.delete(t.accountTokens).where(eq(t.accountTokens.token, token));
}
