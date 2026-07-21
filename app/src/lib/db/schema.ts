import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  jsonb,
  timestamp,
  customType,
} from "drizzle-orm/pg-core";

// Postgres bytea — drizzle-orm's pg-core has no built-in binary column type.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

// Multi-tenant: every table carries tenantId (directly or via its parent).
// Runs on Postgres (Neon in production, local Postgres in dev) via the
// node-postgres driver — see db/index.ts. Every query is filtered by
// tenantId from the authenticated session at the application layer.

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("starter"),
  // Subscription paid through this date. Null = billing not managed by the
  // app (enterprise/manual tenants) — treated as always active. New
  // registrations get a trial window; payments extend it by one month.
  planActiveUntil: timestamp("plan_active_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// Subscription invoices, paid via Midtrans Snap. The invoice id doubles as
// the Midtrans order_id, so the payment notification webhook can find the
// row without a mapping table.
export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  number: text("number").notNull().unique(), // human-readable, e.g. INV-20260720-A1B2C3
  plan: text("plan").notNull(),
  amountIdr: integer("amount_idr").notNull(),
  // The subscription month this invoice pays for. Finalized at payment time
  // (anchored at max(now, previous planActiveUntil)) so late payers aren't
  // charged for days that already elapsed.
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"), // pending | paid | expired | canceled
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  snapToken: text("snap_token"),
  snapRedirectUrl: text("snap_redirect_url"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paymentType: text("payment_type"), // from the Midtrans notification, e.g. bank_transfer
  lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // super_admin | marketing | medical_reviewer | legal_reviewer | regulatory_reviewer | compliance_admin
  role: text("role").notNull(),
  locale: text("locale").notNull().default("id"),
  passwordHash: text("password_hash").notNull(),
  // Null until the owner proves they control the address (register/invite
  // link). Login is blocked while null — see requireVerifiedUser in auth.ts.
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// Single-use tokens for the two account-activation flows: "verify" (the
// account already has a password — self-registration — just confirm the
// address) and "invite" (an admin created the row with no usable password;
// the recipient sets one when accepting).
export const accountTokens = pgTable("account_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  purpose: text("purpose").notNull(), // verify | invite
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  bpomRegistrationNo: text("bpom_registration_no"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// A supporting literature citation attached to an approved claim.
// pmid links to PubMed, doi to doi.org; url covers data-on-file / other
// sources; docId points at an ingested full-text document (uploaded PDF)
// in journal_documents so the AI can read the article body, not just cite it.
export type ClaimReference = {
  citation: string;
  pmid?: string | null;
  doi?: string | null;
  url?: string | null;
  docId?: string | null;
};

export const approvedClaims = pgTable("approved_claims", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  productId: text("product_id").notNull().references(() => products.id),
  claimText: text("claim_text").notNull(),
  // Where the claim came from, e.g. "SOP-PROM-001.txt" for document imports
  source: text("source"),
  // JSON array of supporting journal references ("refs" in SQL: REFERENCES is a keyword)
  references: jsonb("refs").$type<ClaimReference[]>(),
  // JSON array, e.g. ["print","digital","hcp_only"]
  channelScope: jsonb("channel_scope").$type<string[]>(),
  approvedBy: text("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: text("status").notNull().default("active"), // active | expired | withdrawn
});

// Journal corpus for RAG substantiation: the readable text of every article
// the tenant has provided (uploaded PDF) or that could be fetched free
// (PubMed Central full text, else the PubMed abstract). Chunking/retrieval
// happen at query time — at library scale a table of chunks is unnecessary.
export const journalDocuments = pgTable("journal_documents", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  pmid: text("pmid"),
  citation: text("citation").notNull(),
  // pdf_upload | pmc_fulltext | pubmed_abstract
  source: text("source").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const contentSubmissions = pgTable("content_submissions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  productId: text("product_id").notNull().references(() => products.id),
  title: text("title").notNull(),
  channel: text("channel"), // print | digital | e-detail | social
  targetAudience: text("target_audience"), // hcp | public
  submittedBy: text("submitted_by").notNull().references(() => users.id),
  status: text("status").notNull().default("in_review"), // in_review | changes_requested | approved | rejected | withdrawn
  currentStage: text("current_stage"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  // Market lifecycle after approval: approved material expires (default one
  // year, editable by compliance) and can be withdrawn from circulation
  // early (label change, BPOM finding). Expired/withdrawn material stays in
  // the library for the audit trail but can no longer be reused.
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  // Throttles the pre-expiry reminder digest, mirrors invoices.lastReminderAt.
  expiryRemindedAt: timestamp("expiry_reminded_at", { withTimezone: true }),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  withdrawnBy: text("withdrawn_by").references(() => users.id),
  withdrawnReason: text("withdrawn_reason"),
});

export const contentVersions = pgTable("content_versions", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => contentSubmissions.id),
  versionNumber: integer("version_number").notNull(),
  fileName: text("file_name"),
  // The original uploaded file (PPTX/PDF/DOCX), stored inline — content is
  // capped at 20MB client-side, so Postgres bytea avoids needing a separate
  // object storage service. See src/lib/storage.ts.
  fileData: bytea("file_data"),
  textContent: text("text_content"),
  // Mandatory summary of what changed, required from v2 onward
  changeNote: text("change_note"),
  isLocked: boolean("is_locked").notNull().default(false),
  processingStatus: text("processing_status").notNull().default("ready"), // processing | ready
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const contentVersionPages = pgTable("content_version_pages", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => contentVersions.id),
  pageNumber: integer("page_number").notNull(),
  // SVG render stored inline; served via /api/pages/[id]
  renderedSvg: text("rendered_svg").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
});

export const contentElements = pgTable("content_elements", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => contentVersions.id),
  pageNumber: integer("page_number").notNull(),
  elementType: text("element_type").notNull(), // text_block | image | table | chart | footnote
  extractionMethod: text("extraction_method").notNull(), // native_text | ocr | manual
  extractedText: text("extracted_text"),
  ocrConfidence: real("ocr_confidence"),
  // { x, y, width, height } relative to the rendered page (same units as page width/height)
  boundingBox: jsonb("bounding_box").$type<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>(),
  requiresManualReview: boolean("requires_manual_review").notNull().default(false),
});

export const reviewStages = pgTable("review_stages", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => contentSubmissions.id),
  stageOrder: integer("stage_order").notNull(),
  reviewerRole: text("reviewer_role").notNull(), // medical_reviewer | legal_reviewer | regulatory_reviewer
  assignedTo: text("assigned_to").references(() => users.id),
  status: text("status").notNull().default("pending"), // pending | in_progress | approved | rejected | changes_requested | skipped
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNote: text("decision_note"),
  // Who actually signed the decision (may differ from assignedTo when an
  // admin decides). Set together with the e-signature: the decision form
  // re-verifies the account password, and the signature manifest goes to
  // the audit log ("signature" in details).
  decidedBy: text("decided_by").references(() => users.id),
});

export const reviewComments = pgTable("review_comments", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => contentVersions.id),
  elementId: text("element_id").references(() => contentElements.id),
  reviewerId: text("reviewer_id").notNull().references(() => users.id),
  comment: text("comment").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const claimFlags = pgTable("claim_flags", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => contentVersions.id),
  elementId: text("element_id").references(() => contentElements.id),
  flaggedText: text("flagged_text").notNull(),
  matchedClaimId: text("matched_claim_id").references(() => approvedClaims.id),
  similarityScore: real("similarity_score"),
  // matched | no_match — matched means a close claim exists; reviewer still decides
  flagType: text("flag_type").notNull().default("no_match"),
  reviewerDecision: text("reviewer_decision"), // accepted | dismissed | escalated
  decidedBy: text("decided_by").references(() => users.id),
  // On-demand AI substantiation vs the cited journal's PubMed abstract:
  // supported | not_supported | unclear | abstract_only (no API key)
  journalVerdict: text("journal_verdict"),
  journalNote: text("journal_note"),
  journalPmid: text("journal_pmid"),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type").notNull(), // submission | version | claim | user | flag | comment
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  performedBy: text("performed_by").notNull().references(() => users.id),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// Fixed-window rate limiting for unauthenticated endpoints (login,
// registration). DB-backed so it works across serverless instances.
export const authThrottle = pgTable("auth_throttle", {
  key: text("key").primaryKey(), // e.g. "login:user@x.co" | "login-ip:1.2.3.4"
  attempts: integer("attempts").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

export const workflowTemplates = pgTable("workflow_templates", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  channel: text("channel").notNull(), // per content type/channel
  // ordered list of reviewer roles
  stages: jsonb("stages").$type<string[]>().notNull(),
  mode: text("mode").notNull().default("sequential"), // sequential | parallel
});
