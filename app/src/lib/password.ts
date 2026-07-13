import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Pure password hashing (scrypt). No Next.js/db imports, so it is safe to use
// from standalone scripts (db seed) as well as the app.

export function hashPassword(password: string, salt?: string): string {
  const s = salt ?? randomBytes(8).toString("hex");
  return `${s}:${scryptSync(password, s, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
