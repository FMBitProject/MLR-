import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { seed } from "./seed";

// Seeds the demo tenant (PT Nusantara Pharma) into an empty database.
// Run with `npm run db:seed` after `npm run db:migrate`. No-ops if data exists.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  const existing = await db.select().from(schema.tenants).limit(1);
  if (existing.length > 0) {
    console.log("Database already has data — skipping seed.");
    await pool.end();
    return;
  }

  await seed(db);
  await pool.end();
  console.log("Seeded demo tenant.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
