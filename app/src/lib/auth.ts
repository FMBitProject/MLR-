import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, t } from "./db";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

// Fails fast in production if AUTH_SECRET is missing — silently falling back
// to a hardcoded value would let anyone who's read this (public) repo forge
// a valid session cookie for any user. Dev keeps the fallback for friction-free
// `npm run dev` with no env setup.
if (!process.env.AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "AUTH_SECRET is not set. Generate one with `openssl rand -hex 32` and " +
      "set it in your deployment's environment variables.",
  );
}
const SECRET = process.env.AUTH_SECRET ?? "mlr-demo-secret-change-in-production";
const COOKIE = "mlr_session";

export type SessionUser = typeof t.users.$inferSelect;

export type Role =
  | "super_admin"
  | "marketing"
  | "medical_reviewer"
  | "legal_reviewer"
  | "regulatory_reviewer"
  | "compliance_admin";

export const REVIEWER_ROLES: Role[] = [
  "medical_reviewer",
  "legal_reviewer",
  "regulatory_reviewer",
];

// Who may create/upload content submissions. Medical/Legal/Regulatory
// reviewers only review — they never author or upload content for review.
export const SUBMITTER_ROLES: Role[] = ["marketing", "super_admin"];

// Who may manage the Approved Claims Library (add/edit/import/expire).
// Compliance/QA owns it per the PRD; Medical Reviewer co-manages since
// medical affairs scientifically validates claims.
export const CLAIM_MANAGER_ROLES: Role[] = [
  "compliance_admin",
  "super_admin",
  "medical_reviewer",
];

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export async function createSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const userId = raw.slice(0, dot);
  if (sign(userId) !== raw.slice(dot + 1)) return null;
  const user = (await db.select().from(t.users).where(eq(t.users.id, userId)))[0];
  return user ?? null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
