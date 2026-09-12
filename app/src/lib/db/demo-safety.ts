export function requireDemoPassword(password = process.env.DEMO_PASSWORD): string {
  if (process.env.NODE_ENV === "production") throw new Error("Demo seeding is disabled in production.");
  if (!password || password.length < 16 || password === "DemoMLR2026!") {
    throw new Error("Set DEMO_PASSWORD to a private random password of at least 16 characters.");
  }
  return password;
}
