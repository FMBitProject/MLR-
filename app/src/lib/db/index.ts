import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seed } from "./seed";

const DATA_DIR = path.join(process.cwd(), ".data");

const DDL = `
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id', password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL, bpom_registration_no TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS approved_claims (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id), claim_text TEXT NOT NULL,
  channel_scope TEXT, approved_by TEXT REFERENCES users(id),
  approved_at INTEGER, expires_at INTEGER, status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS content_submissions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id), title TEXT NOT NULL,
  channel TEXT, target_audience TEXT, submitted_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'in_review', current_stage TEXT,
  created_at INTEGER NOT NULL, decided_at INTEGER
);
CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES content_submissions(id),
  version_number INTEGER NOT NULL, file_name TEXT, text_content TEXT,
  is_locked INTEGER NOT NULL DEFAULT 0, processing_status TEXT NOT NULL DEFAULT 'ready',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS content_version_pages (
  id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES content_versions(id),
  page_number INTEGER NOT NULL, rendered_svg TEXT NOT NULL,
  width INTEGER NOT NULL, height INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS content_elements (
  id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES content_versions(id),
  page_number INTEGER NOT NULL, element_type TEXT NOT NULL,
  extraction_method TEXT NOT NULL, extracted_text TEXT, ocr_confidence REAL,
  bounding_box TEXT, requires_manual_review INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS review_stages (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES content_submissions(id),
  stage_order INTEGER NOT NULL, reviewer_role TEXT NOT NULL,
  assigned_to TEXT REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending',
  decided_at INTEGER, decision_note TEXT
);
CREATE TABLE IF NOT EXISTS review_comments (
  id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES content_versions(id),
  element_id TEXT REFERENCES content_elements(id),
  reviewer_id TEXT NOT NULL REFERENCES users(id), comment TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS claim_flags (
  id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES content_versions(id),
  element_id TEXT REFERENCES content_elements(id), flagged_text TEXT NOT NULL,
  matched_claim_id TEXT REFERENCES approved_claims(id), similarity_score REAL,
  flag_type TEXT NOT NULL DEFAULT 'no_match', reviewer_decision TEXT,
  decided_by TEXT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL,
  performed_by TEXT NOT NULL REFERENCES users(id), details TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  channel TEXT NOT NULL, stages TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'sequential'
);
`;

type DB = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __mlrDb: DB | undefined;
}

function createDb(): DB {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(path.join(DATA_DIR, "mlr.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(DDL);
  const db = drizzle(sqlite, { schema });
  const row = sqlite.prepare("SELECT COUNT(*) AS n FROM tenants").get() as { n: number };
  if (row.n === 0) seed(db);
  return db;
}

// Reuse across HMR reloads in dev
export const db: DB = globalThis.__mlrDb ?? createDb();
globalThis.__mlrDb = db;

export * as t from "./schema";
