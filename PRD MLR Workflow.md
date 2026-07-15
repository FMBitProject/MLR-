# PRD: MLR Review Workflow Tool (Lite) — for Mid-Size Pharma Companies

**Version:** 1.0
**Date:** July 6, 2026
**Status:** Draft for Development
**Product Owner:** [Your Name]
**Positioning:** An affordable, Indonesia-aware alternative to Veeva Vault PromoMats for pharma companies too small for enterprise-tier pricing.

---

## 1. Executive Summary

MLR Review Workflow Tool is a B2B SaaS platform that digitizes the Medical-Legal-Regulatory (MLR) review process for promotional and medical content in pharmaceutical companies. It routes content (brochures, e-detail aids, digital ads, leave-behinds) through Medical, Legal, and Regulatory reviewers in a structured, auditable workflow — replacing email chains and scattered file versions.

Unlike Veeva Vault PromoMats, which targets large multinational pharma with enterprise pricing and complex configuration, this product targets **mid-size pharma companies** (local and regional) that need the same core workflow discipline without the enterprise price tag or implementation overhead — and with review categories aligned to Indonesia's promotional guidelines (Pedoman Promosi Obat) in addition to general international practice.

---

## 2. Problem Statement

| Problem | Impact |
|---|---|
| MLR review happens over email/WhatsApp with attachments | Reviewers lose track of which version is current; approvals aren't documented |
| No single source of truth for approved claims | Marketing/local teams reuse outdated or unapproved claims in new materials |
| No audit trail | Hard to prove compliance during BPOM inspection or internal audit |
| Enterprise tools (Veeva) are priced and built for multinational scale | Mid-size pharma companies are priced out or over-served by tools far more complex than they need |
| Review bottlenecks | Marketing waits days/weeks for Medical/Legal/Regulatory sign-off with no visibility into where content is stuck |

---

## 3. Goals & Success Metrics

### Goals
- Give Marketing, Medical, Legal, and Regulatory teams one shared workflow and system of record for promotional content approval
- Reduce review cycle time and eliminate "which version is final" confusion
- Provide an audit-ready trail of who approved what, when, and against which claim
- Offer this at a price point accessible to mid-size pharma companies, not just multinational enterprises

### Success Metrics
- Average review cycle time (submission → final approval), target: reduced by 40%+ vs. email-based process
- % of content submissions with zero rework cycles due to claim mismatches
- Audit trail completeness: 100% of approvals logged with reviewer identity, timestamp, and version reference
- Tenant retention and expansion (more brands/users onboarded per tenant over time)

---

## 4. Target Users & Personas

**1. Marketing / Content Creator**
Submits promotional materials for review. Wants fast, predictable turnaround and clear feedback instead of scattered email comments.

**2. Medical Reviewer**
Checks scientific/clinical accuracy of claims against approved product information. Needs quick access to the approved claims library and product label references.

**3. Legal Reviewer**
Checks for legal risk, IP, and contractual compliance in promotional content.

**4. Regulatory Affairs Reviewer**
Confirms content aligns with the registered BPOM label and Pedoman Promosi Obat requirements.

**5. Compliance / QA Admin**
Owns the approved claims library, manages workflow configuration, and pulls audit reports for inspections.

**6. Company Admin (Tenant Super Admin)**
Manages users, roles, billing, and workspace settings.

---

## 5. Scope

### In Scope (MVP)
- Multi-tenant workspace (1 pharma company = 1 workspace)
- Content submission with file upload (PDF, PPTX, DOCX, images) and/or rich text
- Configurable multi-stage review workflow (sequential or parallel: Medical → Legal → Regulatory, or custom order per tenant)
- Version control: every resubmission creates a new version; approved version is locked
- Inline commenting and annotation per reviewer
- Approved Claims Library: searchable repository of pre-approved claims per product, with expiry dates and channel scope
- AI-assisted claims cross-check: flags content text that doesn't match any approved claim, for human reviewer attention (does not auto-approve or auto-reject)
- Full audit trail: every action (submit, comment, approve, reject, reassign) logged with user, timestamp, and version reference
- Role-based access control
- Dashboard: content status overview, average cycle time, bottleneck stage identification
- Bilingual UI: Indonesian and English

### Out of Scope (MVP) — Future Phases
- Automated multi-channel content distribution/publishing (e.g. auto-push to CLM, e-detailing platforms)
- Native e-signature with cryptographic certificate (MVP uses in-app authenticated approval action + audit log, not a certified e-signature product)
- Full formal GxP/21 CFR Part 11 computer system validation package (see Section 11 note)
- Direct API integration with BPOM systems
- Native mobile app

---

## 6. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Auth | Better Auth |
| ORM | Drizzle ORM |
| Database | PostgreSQL via Neon (serverless) |
| Vector Store | `pgvector` extension on Neon (for claims-matching semantic search) |
| Styling | Tailwind CSS + shadcn/ui |
| File Storage | S3-compatible storage (Cloudflare R2 or AWS S3) for original content files, with versioned object keys |
| Embedding & LLM | Anthropic API (Claude Haiku as default for claims-matching flags; escalate to Sonnet only for more nuanced comparison cases) |
| Background Jobs | Inngest or Trigger.dev for async document parsing and claims-check |
| Rendering & OCR | Headless rendering (e.g. LibreOffice/unoconv, or a hosted conversion service) to convert PPTX/PDF/DOCX slides/pages into images; OCR engine (e.g. Tesseract or a cloud OCR API) for text embedded in images — both run as async jobs alongside claims-check |
| Deployment | Vercel (Next.js) + Neon (DB) |
| Analytics | PostHog |
| Billing | Xendit (subscription & invoicing, focused on the Indonesian market) |
| i18n | next-intl for Indonesian/English UI switching |

**Architecture note on AI usage:** The AI's role here is strictly **assistive flagging** — comparing submitted text against the Approved Claims Library and highlighting potential mismatches for a human reviewer to judge. The AI never approves, rejects, or asserts a claim is medically valid; every approval decision remains a human action tied to a named reviewer account, since this is the part of the process that carries real regulatory and legal weight.

---

## 7. Multi-Tenancy Model

Shared database, shared schema with `tenant_id` on every table — consistent with the earlier product's approach for simplicity at early scale with Drizzle + Neon. Every query is filtered by `tenant_id` from the authenticated session at the application layer.

---

## 8. Database Schema (Drizzle ORM)

```typescript
// schema.ts (summary, not final)

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('starter'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').notNull(), // super_admin, marketing, medical_reviewer, legal_reviewer, regulatory_reviewer, compliance_admin
  locale: text('locale').notNull().default('id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  bpomRegistrationNo: text('bpom_registration_no'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const approvedClaims = pgTable('approved_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  claimText: text('claim_text').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  channelScope: jsonb('channel_scope'), // e.g. ["print", "digital", "hcp_only"]
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  status: text('status').notNull().default('active'), // active, expired, withdrawn
});

export const contentSubmissions = pgTable('content_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  title: text('title').notNull(),
  channel: text('channel'), // print, digital, e-detail, social, etc.
  submittedBy: uuid('submitted_by').references(() => users.id).notNull(),
  status: text('status').notNull().default('in_review'), // in_review, approved, rejected, withdrawn
  currentStage: text('current_stage'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const contentVersions = pgTable('content_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id').references(() => contentSubmissions.id).notNull(),
  versionNumber: integer('version_number').notNull(),
  fileUrl: text('file_url'),
  textContent: text('text_content'),
  isLocked: boolean('is_locked').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const contentVersionPages = pgTable('content_version_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  versionId: uuid('version_id').references(() => contentVersions.id).notNull(),
  pageNumber: integer('page_number').notNull(), // slide number (PPTX) or page number (PDF/DOCX)
  renderedImageUrl: text('rendered_image_url').notNull(), // full-resolution PNG/JPEG render of the slide/page, stored alongside the source file
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const contentElements = pgTable('content_elements', {
  id: uuid('id').primaryKey().defaultRandom(),
  versionId: uuid('version_id').references(() => contentVersions.id).notNull(),
  pageNumber: integer('page_number').notNull(),
  elementType: text('element_type').notNull(), // text_block, image, table, chart, footnote, unknown
  extractionMethod: text('extraction_method').notNull(), // native_text, ocr, manual
  extractedText: text('extracted_text'), // null if the element has no machine-readable text (e.g. a pure chart/infographic)
  ocrConfidence: doublePrecision('ocr_confidence'), // populated only when extractionMethod = 'ocr'; null otherwise
  boundingBox: jsonb('bounding_box'), // { x, y, width, height } relative to the rendered page image, used to highlight the element in the review UI
  requiresManualReview: boolean('requires_manual_review').notNull().default(false), // true when OCR confidence is below threshold, or element is a non-text visual that may carry an implicit claim
  createdAt: timestamp('created_at').defaultNow(),
});

export const reviewStages = pgTable('review_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id').references(() => contentSubmissions.id).notNull(),
  stageOrder: integer('stage_order').notNull(),
  reviewerRole: text('reviewer_role').notNull(), // medical_reviewer, legal_reviewer, regulatory_reviewer
  assignedTo: uuid('assigned_to').references(() => users.id),
  status: text('status').notNull().default('pending'), // pending, approved, rejected, skipped
  decidedAt: timestamp('decided_at'),
});

export const reviewComments = pgTable('review_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  versionId: uuid('version_id').references(() => contentVersions.id).notNull(),
  elementId: uuid('element_id').references(() => contentElements.id), // optional: pins the comment to a specific element (e.g. a chart or text block) on the rendered slide/page; null = general version-level comment
  reviewerId: uuid('reviewer_id').references(() => users.id).notNull(),
  comment: text('comment').notNull(),
  resolved: boolean('resolved').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const claimFlags = pgTable('claim_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  versionId: uuid('version_id').references(() => contentVersions.id).notNull(),
  elementId: uuid('element_id').references(() => contentElements.id), // the specific element the flagged text was extracted from; enables highlighting the flag directly on the rendered page via the element's boundingBox. Null for legacy/whole-version flags.
  flaggedText: text('flagged_text').notNull(),
  matchedClaimId: uuid('matched_claim_id').references(() => approvedClaims.id),
  similarityScore: doublePrecision('similarity_score'),
  reviewerDecision: text('reviewer_decision'), // accepted, dismissed, escalated
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  entityType: text('entity_type').notNull(), // submission, version, claim, user
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(), // submitted, commented, approved, rejected, reassigned
  performedBy: uuid('performed_by').references(() => users.id).notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## 9. Core Features & User Stories

### 9.1 Content Submission
- As a marketing user, I can submit a new content item with file upload and metadata (product, channel, target audience)
- As a marketing user, I can resubmit a revised version; the system automatically creates a new version and resets the review status
- As a marketing user, I can see exactly which stage my content is at and who it's waiting on

### 9.2 Configurable Review Workflow
- As a compliance admin, I can configure the review stage order per content type (e.g. Medical → Legal → Regulatory, or all in parallel)
- As a reviewer, I only see content assigned to my stage and role
- As a reviewer, I can approve, reject with comments, or request changes
- As a reviewer, I can pin a comment to a specific element on the rendered slide/page (e.g. a chart, image, or specific text block) instead of only commenting at the version level, so my feedback points exactly at what's wrong
- The system automatically routes content to the next stage upon approval, or back to marketing upon rejection

### 9.3 Approved Claims Library
- As a compliance admin, I can add, edit, and expire approved claims per product, with a channel scope and expiry date
- As a medical/regulatory reviewer, I can search the claims library while reviewing content
- As a marketing user, I can browse approved claims before drafting new content, to reduce rework

### 9.4 AI-Assisted Claims Check
- When content is submitted, the system automatically compares its text against the Approved Claims Library and highlights sentences with no close match, for reviewer attention
- The flag includes the closest matching approved claim (if any) and a similarity indicator, but the reviewer makes the final call — the AI does not approve or reject anything
- Each flag is linked to the specific `contentElement` its text came from, so the review UI can highlight the exact spot on the rendered slide/page image, not just show a text snippet out of context
- If no relevant claim is found in the library, the system says so explicitly rather than guessing

### 9.5 Audit Trail & Reporting
- Every submission, comment, approval, and rejection is logged with user, timestamp, and version reference
- As a compliance admin, I can export an audit report for a specific product/time range for internal or BPOM inspection purposes
- As a compliance admin, I can see which approved claims are nearing expiry and need re-approval

### 9.6 Dashboard & Analytics
- As a marketing manager, I can see average review cycle time by stage, to identify bottlenecks
- As a compliance admin, I can see how many pieces of content were flagged for claim mismatches over time

### 9.7 Content Parsing, OCR Limitation Handling & Visual Review
- When a version is submitted, the system renders every slide/page (PPTX, PDF, DOCX) to a static image (`contentVersionPages`), so reviewers always see exactly what the intended audience would see — not just a text transcript
- The system extracts text into `contentElements` per page/slide, using native text extraction where available (PPTX/DOCX XML, PDF text layer) and OCR only for text embedded inside images, screenshots, or infographics
- **OCR limitation:** OCR-extracted text is inherently less reliable than native text — it can misread characters, drop text in low-contrast or stylized graphics, or fail entirely on complex charts/infographics. The AI-assisted claims check (9.4) can only compare text it successfully extracted; it has no visibility into a claim implied purely visually (e.g. a chart's shape or color coding implying a comparative efficacy claim with no accompanying text)
- Elements with OCR confidence below a configurable threshold, or elements classified as non-text visuals (chart, image, table), are flagged `requiresManualReview = true` and surfaced to reviewers distinctly from AI-flagged text mismatches
- As a reviewer, I review the rendered slide/page image as my primary reference during MLR review, with extracted text and AI claims flags shown as an aid — not a replacement for looking at the actual visual
- The product does not claim OCR-based claims detection is exhaustive; this limitation is disclosed in the compliance positioning (see Section 11) so tenants don't over-rely on automated flagging for image-heavy content (e.g. infographics, e-detail aids with embedded charts)
- Both AI claim flags (9.4) and reviewer comments (9.2) reference the specific `contentElement` they concern, so a reviewer opening a submission sees every flag and comment pinned directly onto the rendered slide/page image at the right spot — instead of a flat list disconnected from the visual

---

## 10. Non-Functional Requirements

- **Tenant data isolation** enforced at the application/query layer via `tenant_id` on every table
- **Immutability of approved versions**: once a version is approved, its file and text content cannot be edited — only superseded by a new version
- **Response time**: content list and dashboard views under 2 seconds; claims-check flagging can run asynchronously and doesn't block submission
- **Rendering & OCR processing**: slide/page rendering and OCR extraction run asynchronously as part of the submission pipeline (same background job queue as claims-check) and should complete within a few minutes for typical content length (≤30 slides/pages); the reviewer sees a processing status while extraction is in progress rather than an empty/broken view
- **Audit log integrity**: audit log entries are append-only (no update/delete permitted from the application layer)

---

## 11. Important Compliance Positioning Note

This product **supports** MLR review discipline and creates a strong audit trail, but a formal claim of GxP / 21 CFR Part 11 "compliance" or "validation" is a specific regulatory status that requires a documented computer system validation (CSV) process, which is beyond MVP scope. For the MVP:

- Market the product as "audit-ready" and "structured for regulatory review processes," not as "21 CFR Part 11 compliant" or "GxP validated," until a formal validation package is built and, if needed, reviewed with qualified regulatory/legal counsel
- Treat this as a roadmap item, not a launch claim — an inaccurate compliance claim to a pharma buyer is a bigger commercial and legal risk than not having the certification yet
- Disclose the OCR/AI extraction limitation (see Section 9.7) explicitly to tenants: the AI claims-check cannot see claims embedded purely in visual/graphic elements, so human review of the rendered slide/page image remains mandatory for every submission, not an optional convenience layer
- This note isn't a legal opinion — bring in appropriate regulatory/legal counsel before making any formal compliance claims in sales materials or contracts

---

## 12. Pricing Model

Implemented in `src/lib/plans.ts` (the single source of truth the app enforces) and published on `/pricing`.

| Plan | List price | Launch promo (through Dec 31, 2026) | Limits | Feature access |
|---|---|---|---|---|
| Starter | Rp 3,500,000/month | Rp 2,500,000/month | 3 products, 15 users, 25 submissions/month | Standard 3-stage workflow, AI claims check, Approved Content Library, audit trail, bilingual UI, email support |
| Growth | Rp 9,500,000/month | Rp 6,500,000/month | 15 products, 50 users, 150 submissions/month | Everything in Starter + AI journal substantiation (PubMed/full-text), per-channel workflow customization, priority support |
| Enterprise | Custom | — | unlimited products/users/submissions | Everything in Growth + dedicated onboarding, custom SLA |

The promo price is what new and existing tenants pay while the promo runs; after it ends, pricing reverts to list automatically (`promoEndsAt` in `plans.ts`). The `/pricing` page shows the list price struck through next to the promo price with an explicit end date.

Enforcement points: user/product creation, monthly submission count, journal substantiation action, and workflow customization are all gated server-side by plan; the UI hides or locks gated features with an upgrade hint. Prices exclude VAT.

Pricing is set deliberately low relative to the estimated $50–200/user/month range reported for enterprise Vault-class tools, so it stays accessible to low- and mid-scale pharma companies that would otherwise have no MLR tooling at all — not just a discount off enterprise pricing, but a different market segment.

---

## 13. Roadmap / Milestones

**Phase 1 — MVP (target 8-10 weeks)**
- Auth + multi-tenant workspace
- Content submission + versioning
- Configurable review workflow
- Approved Claims Library + AI-assisted flagging
- Audit trail + basic reporting
- Bilingual UI

**Phase 2**
- Formal e-signature integration (certified provider)
- Multi-channel distribution tracking (which version is live where)
- Integration with existing DAM/CRM tools already used by the client

**Phase 3**
- Begin formal computer system validation (CSV) documentation package for clients that require it
- Expanded analytics: claims reuse rate, reviewer workload balancing

---

## 14. Competitive Positioning vs. Veeva Vault PromoMats

| Dimension | Veeva Vault PromoMats | This Product (MVP) |
|---|---|---|
| Target segment | Large multinational pharma | Mid-size local/regional pharma |
| Pricing | Enterprise, quote-based, reportedly ~$50–200/user/month | Transparent tiered pricing, positioned well below enterprise range |
| Implementation | Complex, often requires dedicated system owners and training | Lightweight, self-serve onboarding |
| Regulatory scope | Global (FDA/EMA-oriented), broad Vault ecosystem | Focused on core MLR workflow + Indonesia-specific promotional guideline alignment |
| AI claims checking | Full AI Agents suite (broader scope) | Simple, transparent flagging assistant — no black-box claim generation |

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Buyer expects full Veeva-equivalent feature depth at a fraction of the price | Be explicit in sales conversations about MVP scope vs. roadmap; don't overclaim compliance certification |
| AI claims-check gives false confidence (misses a real mismatch) | Position clearly as an assistive flag, not a guarantee; human reviewer remains the approval authority for every submission |
| Compliance/legal teams distrust AI involvement in a regulated process | Keep AI role narrow and explainable (similarity flag only), log every AI flag and human decision in the audit trail |
| Low adoption if workflow feels slower than email at first | Prioritize simple onboarding and a UI that's faster than email for the reviewer's actual daily task |
| OCR fails to extract text from stylized graphics/infographics, so the AI claims-check misses an embedded claim | Always render every slide/page as an image so reviewers see the actual visual regardless of extraction success; flag low-confidence OCR and non-text visual elements for mandatory manual review; disclose this limitation in compliance positioning (Section 11) |

---

## 16. Open Questions

- Should claims library support multi-language claim variants (Indonesian label text vs. English scientific literature) from day one, or phase 2?
- Do target customers need on-premise/private cloud deployment options, or is standard multi-tenant SaaS acceptable for their IT security policies?
- What level of formal validation documentation (if any) should be prioritized for Phase 3, based on actual customer demand?

---

*This document is a working draft and will be updated as further technical and regulatory discussions take place.*
