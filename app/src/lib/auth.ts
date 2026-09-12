import { cookies } from "next/headers";
import { cache } from "react";
import { t } from "./db";
import { issueSession, sessionUser, revokeSession, SESSION_TTL_SECONDS } from "./session-store";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

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

export async function createSession(userId: string, expectedPasswordHash: string) {
  const store = await cookies();
  const token = await issueSession(userId, expectedPasswordHash);
  const previous = store.get(COOKIE)?.value;
  if (previous) await revokeSession(previous);
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await revokeSession(token);
  store.delete(COOKIE);
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  return raw ? sessionUser(raw) : null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
