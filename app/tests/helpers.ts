// Shared test setup. Imported first by every test file that (transitively)
// pulls in lib/db, whose module body throws without DATABASE_URL. The pg Pool
// is lazy — it never dials Postgres unless a query actually runs — so a dummy
// URL is enough to import DB-touching modules and exercise their pure parts.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";

/** Runs `fn` with `env` applied, restoring the previous values afterwards. */
export async function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** Imports a module fresh, bypassing the ESM cache (for env-read-at-import modules). */
export async function freshImport<T>(specifier: string): Promise<T> {
  return import(`${specifier}?v=${Math.random()}`) as Promise<T>;
}
