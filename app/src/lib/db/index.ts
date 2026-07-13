import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Postgres (Neon in production via its pooled connection string, local
// Postgres in dev). Schema changes ship as drizzle-kit migrations in
// ./migrations — applied with `npm run db:migrate`, never at runtime.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Point it at your Postgres/Neon database " +
      "(e.g. postgres://user:pass@host/db). See .env.example.",
  );
}

type DB = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __mlrPool: Pool | undefined;
  var __mlrDb: DB | undefined;
}

// Reuse the pool across HMR reloads in dev and across warm serverless
// invocations in production, so we don't exhaust Postgres connections.
const pool =
  globalThis.__mlrPool ??
  new Pool({
    connectionString,
    // Neon's pooled endpoint handles concurrency; keep per-instance pools small.
    max: Number(process.env.DB_POOL_MAX ?? 5),
  });
globalThis.__mlrPool = pool;

export const db: DB = globalThis.__mlrDb ?? drizzle(pool, { schema });
globalThis.__mlrDb = db;

export * as t from "./schema";
