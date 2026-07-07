import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, t } from "./db";

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

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
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
  const user = db.select().from(t.users).where(eq(t.users.id, userId)).get();
  return user ?? null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
