import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

// Multi-tenant: every table carries tenantId (directly or via its parent),
// mirroring the PRD's Postgres schema. SQLite is used for the local demo;
// swap the dialect imports for pg-core + Neon in production.

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("starter"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // super_admin | marketing | medical_reviewer | legal_reviewer | regulatory_reviewer | compliance_admin
  role: text("role").notNull(),
  locale: text("locale").notNull().default("id"),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  bpomRegistrationNo: text("bpom_registration_no"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
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

export const approvedClaims = sqliteTable("approved_claims", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  productId: text("product_id").notNull().references(() => products.id),
  claimText: text("claim_text").notNull(),
  // Where the claim came from, e.g. "SOP-PROM-001.txt" for document imports
  source: text("source"),
  // JSON array of supporting journal references ("refs" in SQL: REFERENCES is a keyword)
  references: text("refs", { mode: "json" }).$type<ClaimReference[]>(),
  // JSON array, e.g. ["print","digital","hcp_only"]
  channelScope: text("channel_scope", { mode: "json" }).$type<string[]>(),
  approvedBy: text("approved_by").references(() => users.id),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  status: text("status").notNull().default("active"), // active | expired | withdrawn
});

// Journal corpus for RAG substantiation: the readable text of every article
// the tenant has provided (uploaded PDF) or that could be fetched free
// (PubMed Central full text, else the PubMed abstract). Chunking/retrieval
// happen at query time — at library scale a table of chunks is unnecessary.
export const journalDocuments = sqliteTable("journal_documents", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  pmid: text("pmid"),
  citation: text("citation").notNull(),
  // pdf_upload | pmc_fulltext | pubmed_abstract
  source: text("source").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const contentSubmissions = sqliteTable("content_submissions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  productId: text("product_id").notNull().references(() => products.id),
  title: text("title").notNull(),
  channel: text("channel"), // print | digital | e-detail | social
  targetAudience: text("target_audience"), // hcp | public
  submittedBy: text("submitted_by").notNull().references(() => users.id),
  status: text("status").notNull().default("in_review"), // in_review | changes_requested | approved | rejected | withdrawn
  currentStage: text("current_stage"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
});

export const contentVersions = sqliteTable("content_versions", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => contentSubmissions.id),
  versionNumber: integer("version_number").notNull(),
  fileName: text("file_name"),
  textContent: text("text_content"),
  // Mandatory summary of what changed, required from v2 onward
  changeNote: text("change_note"),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  processingStatus: text("processing_status").notNull().default("ready"), // processing | ready
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const contentVersionPages = sqliteTable("content_version_pages", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => contentVersions.id),
  pageNumber: integer("page_number").notNull(),
  // SVG render stored inline; served via /api/pages/[id]
  renderedSvg: text("rendered_svg").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
});

export const contentElements = sqliteTable("content_elements", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => contentVersions.id),
  pageNumber: integer("page_number").notNull(),
  elementType: text("element_type").notNull(), // text_block | image | table | chart | footnote
  extractionMethod: text("extraction_method").notNull(), // native_text | ocr | manual
  extractedText: text("extracted_text"),
  ocrConfidence: real("ocr_confidence"),
  // { x, y, width, height } relative to the rendered page (same units as page width/height)
  boundingBox: text("bounding_box", { mode: "json" }).$type<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>(),
  requiresManualReview: integer("requires_manual_review", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const reviewStages = sqliteTable("review_stages", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => contentSubmissions.id),
  stageOrder: integer("stage_order").notNull(),
  reviewerRole: text("reviewer_role").notNull(), // medical_reviewer | legal_reviewer | regulatory_reviewer
  assignedTo: text("assigned_to").references(() => users.id),
  status: text("status").notNull().default("pending"), // pending | in_progress | approved | rejected | changes_requested | skipped
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  decisionNote: text("decision_note"),
});

export const reviewComments = sqliteTable("review_comments", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => contentVersions.id),
  elementId: text("element_id").references(() => contentElements.id),
  reviewerId: text("reviewer_id").notNull().references(() => users.id),
  comment: text("comment").notNull(),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const claimFlags = sqliteTable("claim_flags", {
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

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type").notNull(), // submission | version | claim | user | flag | comment
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  performedBy: text("performed_by").notNull().references(() => users.id),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workflowTemplates = sqliteTable("workflow_templates", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  channel: text("channel").notNull(), // per content type/channel
  // ordered list of reviewer roles
  stages: text("stages", { mode: "json" }).$type<string[]>().notNull(),
  mode: text("mode").notNull().default("sequential"), // sequential | parallel
});
