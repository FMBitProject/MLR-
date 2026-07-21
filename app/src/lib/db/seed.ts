import type { drizzle } from "drizzle-orm/node-postgres";
import * as t from "./schema";
import { renderTextPages } from "../svg";
import { hashPassword } from "../password";

type DB = ReturnType<typeof drizzle<typeof t>>;

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 86_400_000);
const daysAhead = (n: number) => new Date(now + n * 86_400_000);

const TENANT = "tn-nusantara";

// Journal references backing the demo claims. Real articles, verified against
// PubMed — also used by db/index.ts to backfill databases seeded before the
// refs column existed. "Data on file" shows a non-journal substantiation type.
export const SEED_CLAIM_REFERENCES: Record<string, t.ClaimReference[]> = {
  "c-cvx-1": [
    {
      citation:
        "ALLHAT Officers and Coordinators. Major outcomes in high-risk hypertensive patients randomized to angiotensin-converting enzyme inhibitor or calcium channel blocker vs diuretic (ALLHAT). JAMA. 2002;288(23):2981-97.",
      pmid: "12479763",
      doi: "10.1001/jama.288.23.2981",
    },
  ],
  "c-cvx-3": [
    {
      citation:
        "Data on file: Laporan keamanan studi klinis fase III Cardiovex, PT Nusantara Pharma, 2024.",
    },
  ],
  "c-glf-1": [
    {
      citation:
        "UK Prospective Diabetes Study (UKPDS) Group. Effect of intensive blood-glucose control with metformin on complications in overweight patients with type 2 diabetes (UKPDS 34). Lancet. 1998;352(9131):854-65.",
      pmid: "9742977",
      doi: "10.1016/S0140-6736(98)07037-8",
    },
  ],
  "c-glf-2": [
    {
      citation:
        "Blonde L, Dailey GE, Jabbour SA, et al. Gastrointestinal tolerability of extended-release metformin tablets compared to immediate-release metformin tablets. Curr Med Res Opin. 2004;20(4):565-72.",
      pmid: "15119994",
      doi: "10.1185/030079904125003278",
    },
  ],
};

export async function seed(db: DB) {
  await db.insert(t.tenants).values({
    id: TENANT,
    name: "PT Nusantara Pharma",
    slug: "nusantara",
    plan: "growth",
    // Mid-trial so the billing card renders in its managed (payable) state.
    planActiveUntil: new Date(Date.now() + 14 * 24 * 60 * 60_000),
    createdAt: daysAgo(120),
  });

  const users = [
    { id: "u-dewi", email: "dewi@nusantara-pharma.co.id", name: "Dewi Lestari", role: "marketing" },
    { id: "u-budi", email: "budi@nusantara-pharma.co.id", name: "dr. Budi Santoso, Sp.JP", role: "medical_reviewer" },
    { id: "u-ratna", email: "ratna@nusantara-pharma.co.id", name: "Ratna Wijaya, S.H.", role: "legal_reviewer" },
    { id: "u-agus", email: "agus@nusantara-pharma.co.id", name: "Agus Prasetyo, Apt.", role: "regulatory_reviewer" },
    { id: "u-sari", email: "sari@nusantara-pharma.co.id", name: "Sari Handayani", role: "compliance_admin" },
    { id: "u-rudi", email: "rudi@nusantara-pharma.co.id", name: "Rudi Hartono", role: "super_admin" },
  ];
  for (const u of users) {
    await db.insert(t.users).values({
      ...u,
      tenantId: TENANT,
      locale: "id",
      passwordHash: hashPassword("demo123"),
      emailVerifiedAt: daysAgo(120),
      createdAt: daysAgo(120),
    });
  }

  const products = [
    { id: "p-cardiovex", name: "Cardiovex 10 mg", bpomRegistrationNo: "DKL2234567890A1" },
    { id: "p-glucofit", name: "Glucofit XR 500", bpomRegistrationNo: "DKL2298765432A1" },
    { id: "p-respira", name: "Respira Sirup", bpomRegistrationNo: "DTL2211223344A1" },
  ];
  for (const p of products) {
    await db.insert(t.products).values({ ...p, tenantId: TENANT, createdAt: daysAgo(110) });
  }

  const claims: Array<{
    id: string; productId: string; claimText: string; channelScope: string[];
    expiresAt: Date; status?: string; approvedAt?: Date;
  }> = [
    {
      id: "c-cvx-1", productId: "p-cardiovex",
      claimText: "Cardiovex menurunkan tekanan darah sistolik rata-rata 12 mmHg dalam 8 minggu terapi.",
      channelScope: ["print", "digital", "hcp_only"], expiresAt: daysAhead(260),
    },
    {
      id: "c-cvx-2", productId: "p-cardiovex",
      claimText: "Cardiovex diindikasikan untuk pengobatan hipertensi esensial pada pasien dewasa.",
      channelScope: ["print", "digital"], expiresAt: daysAhead(400),
    },
    {
      id: "c-cvx-3", productId: "p-cardiovex",
      claimText: "Cardiovex umumnya ditoleransi dengan baik; efek samping tersering adalah edema perifer ringan.",
      channelScope: ["hcp_only", "print"], expiresAt: daysAhead(320),
    },
    {
      id: "c-cvx-4", productId: "p-cardiovex",
      claimText: "Dosis Cardiovex sekali sehari mendukung kepatuhan pasien terhadap terapi jangka panjang.",
      channelScope: ["print"], expiresAt: daysAhead(21),
    },
    {
      id: "c-glf-1", productId: "p-glucofit",
      claimText: "Glucofit XR menurunkan HbA1c rata-rata 1,5% sebagai monoterapi lini pertama diabetes melitus tipe 2.",
      channelScope: ["print", "digital", "hcp_only"], expiresAt: daysAhead(300),
    },
    {
      id: "c-glf-2", productId: "p-glucofit",
      claimText: "Formulasi lepas lambat Glucofit XR mengurangi keluhan saluran cerna dibandingkan metformin pelepasan segera.",
      channelScope: ["hcp_only"], expiresAt: daysAhead(14),
    },
    {
      id: "c-glf-3", productId: "p-glucofit",
      claimText: "Glucofit XR membantu pengelolaan gula darah sebagai bagian dari pola hidup sehat dan pengawasan dokter.",
      channelScope: ["digital"], expiresAt: daysAhead(500),
    },
    {
      id: "c-glf-4", productId: "p-glucofit",
      claimText: "Glucofit XR aman digunakan pada gangguan ginjal ringan tanpa penyesuaian dosis.",
      channelScope: ["hcp_only"], expiresAt: daysAgo(40), status: "expired",
    },
    {
      id: "c-rsp-1", productId: "p-respira",
      claimText: "Respira Sirup membantu mengencerkan dahak pada batuk berdahak.",
      channelScope: ["print", "digital"], expiresAt: daysAhead(365),
    },
    {
      id: "c-rsp-2", productId: "p-respira",
      claimText: "Respira Sirup dapat digunakan untuk anak usia 2 tahun ke atas sesuai dosis yang dianjurkan.",
      channelScope: ["print", "digital"], expiresAt: daysAhead(180),
    },
  ];
  for (const c of claims) {
    await db.insert(t.approvedClaims).values({
      id: c.id, tenantId: TENANT, productId: c.productId, claimText: c.claimText,
      references: SEED_CLAIM_REFERENCES[c.id] ?? null,
      channelScope: c.channelScope, approvedBy: "u-sari",
      approvedAt: c.approvedAt ?? daysAgo(90), expiresAt: c.expiresAt,
      status: c.status ?? "active",
    });
  }

  await db.insert(t.workflowTemplates).values([
    { id: "wf-print", tenantId: TENANT, channel: "print", stages: ["medical_reviewer", "legal_reviewer", "regulatory_reviewer"], mode: "sequential" },
    { id: "wf-digital", tenantId: TENANT, channel: "digital", stages: ["medical_reviewer", "regulatory_reviewer"], mode: "sequential" },
    { id: "wf-edetail", tenantId: TENANT, channel: "e-detail", stages: ["medical_reviewer", "legal_reviewer", "regulatory_reviewer"], mode: "sequential" },
    { id: "wf-social", tenantId: TENANT, channel: "social", stages: ["medical_reviewer", "legal_reviewer", "regulatory_reviewer"], mode: "sequential" },
  ]);

  await seedCardiovexSubmission(db);
  await seedGlucofitSubmission(db);
  await seedRespiraSubmission(db);

  const audits: Array<[string, string, string, string, string, Date, Record<string, unknown>?]> = [
    ["submission", "sub-glucofit", "submitted", "u-dewi", "v1", daysAgo(18)],
    ["version", "v-glf-1", "claims_check_completed", "u-dewi", "v1", daysAgo(18), { flags: 0 }],
    ["submission", "sub-glucofit", "approved", "u-budi", "v1", daysAgo(15), { stage: "medical_reviewer" }],
    ["submission", "sub-glucofit", "approved", "u-agus", "v1", daysAgo(10), { stage: "regulatory_reviewer", final: true }],
    ["version", "v-glf-1", "version_locked", "u-agus", "v1", daysAgo(10)],
    ["submission", "sub-respira", "submitted", "u-dewi", "v1", daysAgo(9)],
    ["version", "v-rsp-1", "claims_check_completed", "u-dewi", "v1", daysAgo(9), { flags: 1 }],
    ["submission", "sub-respira", "approved", "u-budi", "v1", daysAgo(7), { stage: "medical_reviewer" }],
    ["comment", "cm-rsp-1", "commented", "u-ratna", "v1", daysAgo(5)],
    ["submission", "sub-respira", "changes_requested", "u-ratna", "v1", daysAgo(5), { stage: "legal_reviewer" }],
    ["submission", "sub-cardiovex", "submitted", "u-dewi", "v1", daysAgo(3)],
    ["version", "v-cvx-1", "claims_check_completed", "u-dewi", "v1", daysAgo(3), { flags: 2, manual_review_elements: 1 }],
    ["comment", "cm-cvx-1", "commented", "u-budi", "v1", daysAgo(1)],
  ];
  for (const [i, [entityType, entityId, action, performedBy, version, when, details]] of audits.entries()) {
    await db.insert(t.auditLog).values({
      id: `au-seed-${i}`, tenantId: TENANT, entityType, entityId, action,
      performedBy, details: { version, ...(details ?? {}) }, createdAt: when,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Submission 1 — Cardiovex leave-behind, hand-crafted slides, flags   */
/* ------------------------------------------------------------------ */

async function seedCardiovexSubmission(db: DB) {
  await db.insert(t.contentSubmissions).values({
    id: "sub-cardiovex", tenantId: TENANT, productId: "p-cardiovex",
    title: "Cardiovex — Leave Behind HCP Q3 2026", channel: "print",
    targetAudience: "hcp", submittedBy: "u-dewi", status: "in_review",
    currentStage: "medical_reviewer", createdAt: daysAgo(3),
  });

  await db.insert(t.contentVersions).values({
    id: "v-cvx-1", submissionId: "sub-cardiovex", versionNumber: 1,
    fileName: "cardiovex-leave-behind-q3.pptx",
    textContent: null, isLocked: false, processingStatus: "ready", createdAt: daysAgo(3),
  });

  await db.insert(t.contentVersionPages).values([
    { id: "pg-cvx-1", versionId: "v-cvx-1", pageNumber: 1, renderedSvg: cardiovexSlide1(), width: 1240, height: 877 },
    { id: "pg-cvx-2", versionId: "v-cvx-1", pageNumber: 2, renderedSvg: cardiovexSlide2(), width: 1240, height: 877 },
  ]);

  await db.insert(t.contentElements).values([
    {
      id: "el-cvx-brand", versionId: "v-cvx-1", pageNumber: 1, elementType: "text_block",
      extractionMethod: "native_text",
      extractedText: "CARDIOVEX® 10 mg — amlodipine besylate",
      boundingBox: { x: 64, y: 66, width: 620, height: 74 },
    },
    {
      id: "el-cvx-headline", versionId: "v-cvx-1", pageNumber: 1, elementType: "text_block",
      extractionMethod: "native_text",
      extractedText: "Turunkan tekanan darah sistolik hingga 15 mmHg dalam 8 minggu terapi",
      boundingBox: { x: 64, y: 168, width: 780, height: 150 },
    },
    {
      id: "el-cvx-body", versionId: "v-cvx-1", pageNumber: 1, elementType: "text_block",
      extractionMethod: "native_text",
      extractedText:
        "Cardiovex diindikasikan untuk pengobatan hipertensi esensial pada pasien dewasa, dengan dosis sekali sehari yang mendukung kepatuhan terapi jangka panjang.",
      boundingBox: { x: 64, y: 356, width: 780, height: 128 },
    },
    {
      id: "el-cvx-tagline", versionId: "v-cvx-1", pageNumber: 1, elementType: "text_block",
      extractionMethod: "native_text",
      extractedText: "Pilihan #1 dokter spesialis jantung di Indonesia",
      boundingBox: { x: 64, y: 540, width: 640, height: 86 },
    },
    {
      id: "el-cvx-chart", versionId: "v-cvx-1", pageNumber: 2, elementType: "chart",
      extractionMethod: "ocr", extractedText: "mmHg 15 9 4 Plasebo Kompetitor",
      ocrConfidence: 0.41, requiresManualReview: true,
      boundingBox: { x: 64, y: 186, width: 660, height: 486 },
    },
    {
      id: "el-cvx-tolerability", versionId: "v-cvx-1", pageNumber: 2, elementType: "text_block",
      extractionMethod: "native_text",
      extractedText:
        "Umumnya ditoleransi dengan baik; efek samping tersering adalah edema perifer ringan.",
      boundingBox: { x: 764, y: 226, width: 420, height: 210 },
    },
    {
      id: "el-cvx-footnote", versionId: "v-cvx-1", pageNumber: 2, elementType: "footnote",
      extractionMethod: "native_text",
      extractedText: "*Data on file. Studi internal NP-2025-04, n=240.",
      boundingBox: { x: 64, y: 742, width: 620, height: 44 },
    },
  ]);

  await db.insert(t.claimFlags).values([
    {
      id: "fl-cvx-1", versionId: "v-cvx-1", elementId: "el-cvx-headline",
      flaggedText: "Turunkan tekanan darah sistolik hingga 15 mmHg dalam 8 minggu terapi",
      matchedClaimId: "c-cvx-1", similarityScore: 0.62, flagType: "matched",
    },
    {
      id: "fl-cvx-2", versionId: "v-cvx-1", elementId: "el-cvx-tagline",
      flaggedText: "Pilihan #1 dokter spesialis jantung di Indonesia",
      matchedClaimId: null, similarityScore: 0.08, flagType: "no_match",
    },
  ]);

  await db.insert(t.reviewComments).values([
    {
      id: "cm-cvx-1", versionId: "v-cvx-1", elementId: "el-cvx-chart", reviewerId: "u-budi",
      comment:
        "Grafik menyiratkan superioritas langsung terhadap kompetitor. Perlu referensi studi head-to-head yang valid, atau ganti dengan data vs plasebo saja.",
      resolved: false, createdAt: daysAgo(1),
    },
  ]);

  await db.insert(t.reviewStages).values([
    { id: "st-cvx-1", submissionId: "sub-cardiovex", stageOrder: 1, reviewerRole: "medical_reviewer", assignedTo: "u-budi", status: "in_progress" },
    { id: "st-cvx-2", submissionId: "sub-cardiovex", stageOrder: 2, reviewerRole: "legal_reviewer", assignedTo: "u-ratna", status: "pending" },
    { id: "st-cvx-3", submissionId: "sub-cardiovex", stageOrder: 3, reviewerRole: "regulatory_reviewer", assignedTo: "u-agus", status: "pending" },
  ]);
}

/* ------------------------------------------------------------------ */
/* Submission 2 — Glucofit digital banner, fully approved & locked     */
/* ------------------------------------------------------------------ */

async function seedGlucofitSubmission(db: DB) {
  await db.insert(t.contentSubmissions).values({
    id: "sub-glucofit", tenantId: TENANT, productId: "p-glucofit",
    title: "Glucofit XR — Banner Digital Kampanye Edukasi", channel: "digital",
    targetAudience: "public", submittedBy: "u-dewi", status: "approved",
    currentStage: null, createdAt: daysAgo(18), decidedAt: daysAgo(10),
  });

  const paragraphs = [
    "Glucofit XR membantu pengelolaan gula darah sebagai bagian dari pola hidup sehat dan pengawasan dokter.",
    "Konsultasikan penggunaan Glucofit XR kepada dokter Anda untuk memastikan terapi yang sesuai dengan kondisi Anda.",
    "Baca aturan pakai. Jika keluhan berlanjut, hubungi dokter. Izin edar BPOM DKL2298765432A1.",
  ];
  const { pages, elements } = renderTextPages({
    title: "Glucofit XR 500",
    subtitle: "Banner digital — kampanye edukasi publik",
    paragraphs,
  });

  await db.insert(t.contentVersions).values({
    id: "v-glf-1", submissionId: "sub-glucofit", versionNumber: 1,
    fileName: null, textContent: paragraphs.join("\n\n"),
    isLocked: true, processingStatus: "ready", createdAt: daysAgo(18),
  });

  for (const [i, p] of pages.entries())
    await db.insert(t.contentVersionPages).values({
      id: `pg-glf-${i + 1}`, versionId: "v-glf-1", pageNumber: p.pageNumber,
      renderedSvg: p.svg, width: p.width, height: p.height,
    });
  for (const [i, el] of elements.entries())
    await db.insert(t.contentElements).values({
      id: `el-glf-${i + 1}`, versionId: "v-glf-1", pageNumber: el.pageNumber,
      elementType: el.elementType, extractionMethod: "native_text",
      extractedText: el.text, boundingBox: el.bbox,
    });

  await db.insert(t.reviewStages).values([
    { id: "st-glf-1", submissionId: "sub-glucofit", stageOrder: 1, reviewerRole: "medical_reviewer", assignedTo: "u-budi", status: "approved", decidedAt: daysAgo(15), decisionNote: "Sesuai label dan claims library." },
    { id: "st-glf-2", submissionId: "sub-glucofit", stageOrder: 2, reviewerRole: "regulatory_reviewer", assignedTo: "u-agus", status: "approved", decidedAt: daysAgo(10), decisionNote: "Sesuai Pedoman Promosi Obat untuk media publik." },
  ]);
}

/* ------------------------------------------------------------------ */
/* Submission 3 — Respira e-detail aid, changes requested by Legal     */
/* ------------------------------------------------------------------ */

async function seedRespiraSubmission(db: DB) {
  await db.insert(t.contentSubmissions).values({
    id: "sub-respira", tenantId: TENANT, productId: "p-respira",
    title: "Respira Sirup — E-Detail Aid Apoteker", channel: "e-detail",
    targetAudience: "hcp", submittedBy: "u-dewi", status: "changes_requested",
    currentStage: "legal_reviewer", createdAt: daysAgo(9),
  });

  const paragraphs = [
    "Respira Sirup membantu mengencerkan dahak pada batuk berdahak, dengan rasa jeruk yang disukai anak.",
    "Respira Sirup dapat digunakan untuk anak usia 2 tahun ke atas sesuai dosis yang dianjurkan.",
    "Lebih efektif dan lebih cepat meredakan batuk dibandingkan sirup ambroxol merek lain di pasaran.",
    "Tersedia dalam kemasan 60 ml dan 120 ml di apotek seluruh Indonesia.",
  ];
  const { pages, elements } = renderTextPages({
    title: "Respira Sirup",
    subtitle: "E-detail aid — edukasi apoteker",
    paragraphs,
  });

  await db.insert(t.contentVersions).values({
    id: "v-rsp-1", submissionId: "sub-respira", versionNumber: 1,
    fileName: null, textContent: paragraphs.join("\n\n"),
    isLocked: false, processingStatus: "ready", createdAt: daysAgo(9),
  });

  for (const [i, p] of pages.entries())
    await db.insert(t.contentVersionPages).values({
      id: `pg-rsp-${i + 1}`, versionId: "v-rsp-1", pageNumber: p.pageNumber,
      renderedSvg: p.svg, width: p.width, height: p.height,
    });
  const elIds: string[] = [];
  for (const [i, el] of elements.entries()) {
    const id = `el-rsp-${i + 1}`;
    elIds.push(id);
    await db.insert(t.contentElements).values({
      id, versionId: "v-rsp-1", pageNumber: el.pageNumber,
      elementType: el.elementType, extractionMethod: "native_text",
      extractedText: el.text, boundingBox: el.bbox,
    });
  }

  // Paragraph 3 (comparative superiority claim) has no approved-claim match
  await db.insert(t.claimFlags).values({
    id: "fl-rsp-1", versionId: "v-rsp-1", elementId: elIds[2],
    flaggedText: paragraphs[2], matchedClaimId: "c-rsp-1",
    similarityScore: 0.31, flagType: "no_match",
    reviewerDecision: "accepted", decidedBy: "u-budi",
  });

  await db.insert(t.reviewComments).values({
    id: "cm-rsp-1", versionId: "v-rsp-1", elementId: elIds[2], reviewerId: "u-ratna",
    comment:
      "Klaim komparatif “lebih efektif dibanding merek lain” tanpa studi pembanding berisiko hukum dan melanggar Pedoman Promosi Obat. Hapus kalimat ini atau lampirkan bukti studi head-to-head.",
    resolved: false, createdAt: daysAgo(5),
  });

  await db.insert(t.reviewStages).values([
    { id: "st-rsp-1", submissionId: "sub-respira", stageOrder: 1, reviewerRole: "medical_reviewer", assignedTo: "u-budi", status: "approved", decidedAt: daysAgo(7), decisionNote: "Klaim mukolitik sesuai label." },
    { id: "st-rsp-2", submissionId: "sub-respira", stageOrder: 2, reviewerRole: "legal_reviewer", assignedTo: "u-ratna", status: "changes_requested", decidedAt: daysAgo(5), decisionNote: "Klaim komparatif tanpa bukti — lihat komentar pada elemen terkait." },
    { id: "st-rsp-3", submissionId: "sub-respira", stageOrder: 3, reviewerRole: "regulatory_reviewer", assignedTo: "u-agus", status: "pending" },
  ]);
}

/* ------------------------------------------------------------------ */
/* Hand-crafted demo slides (bounding boxes above match this layout)   */
/* ------------------------------------------------------------------ */

function cardiovexSlide1(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="877" viewBox="0 0 1240 877" font-family="Georgia, serif">
<defs>
  <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#115e59"/>
  </linearGradient>
</defs>
<rect width="1240" height="877" fill="#fdfcf9"/>
<rect x="880" y="0" width="360" height="877" fill="url(#hero)"/>
<circle cx="1060" cy="300" r="120" fill="#ffffff" opacity="0.10"/>
<circle cx="990" cy="560" r="70" fill="#ffffff" opacity="0.08"/>
<ellipse cx="1060" cy="430" rx="86" ry="40" fill="#f8fafc"/>
<ellipse cx="1060" cy="424" rx="86" ry="40" fill="#ffffff"/>
<line x1="1060" y1="384" x2="1060" y2="464" stroke="#0f766e" stroke-width="3"/>
<text x="1060" y="540" font-size="26" text-anchor="middle" fill="#ccfbf1" font-family="Arial, sans-serif" font-weight="bold">1x sehari</text>
<text x="84" y="108" font-size="38" font-weight="bold" fill="#0f766e" font-family="Arial, sans-serif">CARDIOVEX® 10 mg</text>
<text x="84" y="140" font-size="20" fill="#64748b" font-family="Arial, sans-serif">amlodipine besylate</text>
<text x="84" y="230" font-size="46" font-weight="bold" fill="#0f172a"><tspan x="84" dy="0">Turunkan tekanan darah sistolik</tspan><tspan x="84" dy="58">hingga 15 mmHg dalam 8 minggu*</tspan></text>
<text x="84" y="400" font-size="24" fill="#334155"><tspan x="84" dy="0">Cardiovex diindikasikan untuk pengobatan hipertensi esensial pada</tspan><tspan x="84" dy="36">pasien dewasa, dengan dosis sekali sehari yang mendukung</tspan><tspan x="84" dy="36">kepatuhan terapi jangka panjang.</tspan></text>
<rect x="84" y="556" width="600" height="60" rx="30" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5"/>
<text x="384" y="594" font-size="23" text-anchor="middle" fill="#92400e" font-family="Arial, sans-serif" font-weight="bold">Pilihan #1 dokter spesialis jantung di Indonesia</text>
<text x="84" y="812" font-size="16" fill="#94a3b8" font-family="Arial, sans-serif">PT Nusantara Pharma • Hanya untuk tenaga kesehatan • DKL2234567890A1</text>
</svg>`;
}

function cardiovexSlide2(): string {
  const bar = (x: number, h: number, color: string, label: string, val: string) => `
<rect x="${x}" y="${600 - h}" width="120" height="${h}" rx="6" fill="${color}"/>
<text x="${x + 60}" y="${600 - h - 14}" font-size="26" text-anchor="middle" fill="#0f172a" font-family="Arial, sans-serif" font-weight="bold">${val}</text>
<text x="${x + 60}" y="636" font-size="19" text-anchor="middle" fill="#475569" font-family="Arial, sans-serif">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="877" viewBox="0 0 1240 877" font-family="Georgia, serif">
<rect width="1240" height="877" fill="#fdfcf9"/>
<rect x="0" y="0" width="1240" height="10" fill="#0f766e"/>
<text x="84" y="120" font-size="40" font-weight="bold" fill="#0f172a">Efikasi terbukti secara klinis</text>
<rect x="84" y="186" width="640" height="486" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
<text x="120" y="238" font-size="21" fill="#334155" font-family="Arial, sans-serif" font-weight="bold">Penurunan tekanan darah sistolik (mmHg), minggu ke-8</text>
<line x1="130" y1="600" x2="690" y2="600" stroke="#cbd5e1" stroke-width="2"/>
${bar(170, 90, "#cbd5e1", "Plasebo", "-4")}
${bar(360, 200, "#94a3b8", "Kompetitor A", "-9")}
${bar(550, 330, "#0f766e", "Cardiovex", "-15")}
<text x="764" y="270" font-size="24" fill="#334155"><tspan x="764" dy="0">Umumnya ditoleransi dengan</tspan><tspan x="764" dy="36">baik; efek samping tersering</tspan><tspan x="764" dy="36">adalah edema perifer ringan.</tspan></text>
<rect x="764" y="470" width="410" height="150" rx="14" fill="#f0fdfa" stroke="#99f6e4" stroke-width="2"/>
<text x="790" y="516" font-size="20" fill="#0f766e" font-family="Arial, sans-serif" font-weight="bold">Profil keamanan</text>
<text x="790" y="552" font-size="18" fill="#115e59" font-family="Arial, sans-serif"><tspan x="790" dy="0">Insiden penghentian terapi akibat</tspan><tspan x="790" dy="28">efek samping &lt; 2% (studi internal).</tspan></text>
<text x="84" y="768" font-size="17" fill="#94a3b8" font-family="Arial, sans-serif">*Data on file. Studi internal NP-2025-04, n=240.</text>
</svg>`;
}
