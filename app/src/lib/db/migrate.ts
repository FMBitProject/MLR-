import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";

// Applies every pending migration in ./migrations. Run with `npm run db:migrate`
// (locally and as a Vercel build/deploy step against the Neon database).
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });
  await pool.end();
  console.log("Migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
