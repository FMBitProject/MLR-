import { withEnv } from "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractClaimCandidates } from "../src/lib/claims-extract.ts";

// With no AI key the LLM path returns null, so these exercise the heuristic.
const NO_AI = {
  AI_PROVIDER: undefined, GROQ_API_KEY: undefined, XAI_API_KEY: undefined,
  OPENAI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined,
  AI_BASE_URL: undefined, AI_API_KEY: undefined,
};

const heuristic = (text: string) => withEnv(NO_AI, () => extractClaimCandidates(text));

const CLAIM = "Obat X terbukti menurunkan kadar kolesterol LDL pada pasien dislipidemia dewasa.";
const CLAIM2 = "Dosis yang dianjurkan adalah satu tablet setiap hari sesudah makan malam.";

test("extract: without an AI key the heuristic engine is reported", async () => {
  const out = await heuristic(CLAIM);
  assert.equal(out.engine, "heuristic");
  assert.deepEqual(out.candidates, [CLAIM]);
});

test("extract: sentences are split on newlines and terminal punctuation", async () => {
  const out = await heuristic(`${CLAIM} ${CLAIM2}`);
  assert.deepEqual(out.candidates, [CLAIM, CLAIM2]);
});

test("extract: list numbering and bullets are stripped from the front", async () => {
  const out = await heuristic(`1. ${CLAIM}\n- ${CLAIM2}`);
  assert.deepEqual(out.candidates, [CLAIM, CLAIM2]);
});

test("extract: fragments too short to be a claim are skipped", async () => {
  const out = await heuristic("Tujuan.\n1x sehari.\nAman.\n" + CLAIM);
  assert.deepEqual(out.candidates, [CLAIM]);
});

test("extract: over-long paragraphs are skipped", async () => {
  const out = await heuristic("kata ".repeat(120));
  assert.deepEqual(out.candidates, []);
});

test("extract: sentences with fewer than six words are skipped", async () => {
  const short = "Obat ini sangat aman dipakaiiiiiiiiiiiiiiiiiiiiiiiiiiii.";
  assert.ok(short.length >= 30 && short.split(/\s+/).length < 6);
  assert.deepEqual((await heuristic(short)).candidates, []);
});

test("extract: SOP structural headings are filtered out", async () => {
  const noise = [
    "BAB II Ruang lingkup dokumen ini mencakup seluruh unit terkait pemasaran.",
    "Pasal 4 Ketentuan umum yang berlaku bagi seluruh karyawan perusahaan ini.",
    "Lampiran A Daftar dokumen pendukung yang wajib disertakan pada pengajuan.",
    "Tujuan dari prosedur ini adalah memastikan kepatuhan seluruh materi promosi.",
    "Ruang lingkup prosedur mencakup semua materi promosi yang diterbitkan tim.",
    "Referensi utama yang digunakan dalam penyusunan dokumen prosedur operasional.",
  ].join("\n");
  const out = await heuristic(`${noise}\n${CLAIM}`);
  assert.deepEqual(out.candidates, [CLAIM], "structural headings leaked into candidates");
});

test("extract: an 'SOP -' document header is filtered out", async () => {
  const out = await heuristic(
    `SOP - Prosedur pengajuan materi promosi untuk seluruh produk perusahaan.\n${CLAIM}`,
  );
  assert.deepEqual(out.candidates, [CLAIM]);
});

test("extract: a 'Rev. 3' revision header is filtered out", async () => {
  // Regression: the sentence splitter used to break on the period in "Rev.",
  // stranding the marker in its own fragment so the revision filter could
  // never match the tail — which then looked like a clean claim.
  const out = await heuristic(
    `Dokumen ini Rev. 3 berlaku sejak tanggal satu Januari dua ribu dua puluh enam.\n${CLAIM}`,
  );
  assert.deepEqual(out.candidates, [CLAIM]);
});

test("extract: other reference abbreviations do not split a sentence either", async () => {
  // "No." would strand the number the same way "Rev." did.
  const out = await heuristic(
    `Dokumen No. 12 tentang tata cara pengajuan materi promosi kepada tim medis.\n${CLAIM}`,
  );
  assert.ok(out.candidates.includes(CLAIM));
  assert.ok(
    !out.candidates.some((c) => c.startsWith("12 tentang")),
    `abbreviation split leaked a fragment: ${JSON.stringify(out.candidates)}`,
  );
});

test("extract: a real sentence end is still split normally", async () => {
  const out = await heuristic(`${CLAIM} ${CLAIM2}`);
  assert.deepEqual(out.candidates, [CLAIM, CLAIM2]);
});

test("extract: duplicate sentences are collapsed case-insensitively", async () => {
  const out = await heuristic(`${CLAIM}\n${CLAIM.toUpperCase()}\n${CLAIM}`);
  assert.equal(out.candidates.length, 1);
});

test("extract: at most 20 candidates are returned", async () => {
  const many = Array.from(
    { length: 40 },
    (_, i) => `Obat nomor ${i} terbukti menurunkan kadar kolesterol pada pasien dewasa.`,
  ).join("\n");
  assert.equal((await heuristic(many)).candidates.length, 20);
});

test("extract: empty input yields no candidates and does not throw", async () => {
  assert.deepEqual((await heuristic("")).candidates, []);
  assert.deepEqual((await heuristic("   \n\n  ")).candidates, []);
});

test("extract: a valid LLM response is preferred and labelled 'claude'", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      choices: [{ message: { content: `Here you go: ["${CLAIM}", "${CLAIM2}"]` } }],
    })) as typeof fetch;
  try {
    const out = await withEnv({ ...NO_AI, GROQ_API_KEY: "k" }, () => extractClaimCandidates("doc"));
    assert.equal(out.engine, "claude");
    assert.deepEqual(out.candidates, [CLAIM, CLAIM2]);
  } finally { globalThis.fetch = real; }
});

test("extract: a malformed or empty LLM response falls back to the heuristic", async () => {
  const real = globalThis.fetch;
  for (const content of ["not json at all", "[]", '["short"]', '{"claims":[]}']) {
    globalThis.fetch = (async () =>
      Response.json({ choices: [{ message: { content } }] })) as typeof fetch;
    const out = await withEnv({ ...NO_AI, GROQ_API_KEY: "k" }, () =>
      extractClaimCandidates(CLAIM),
    );
    assert.equal(out.engine, "heuristic", `did not fall back for: ${content}`);
    assert.deepEqual(out.candidates, [CLAIM]);
  }
  globalThis.fetch = real;
});

test("extract: an LLM outage falls back to the heuristic rather than failing", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("down"); }) as typeof fetch;
  try {
    const out = await withEnv({ ...NO_AI, GROQ_API_KEY: "k" }, () => extractClaimCandidates(CLAIM));
    assert.equal(out.engine, "heuristic");
    assert.deepEqual(out.candidates, [CLAIM]);
  } finally { globalThis.fetch = real; }
});

test("extract: LLM output is capped at 20 and non-strings are dropped", async () => {
  const real = globalThis.fetch;
  const arr = JSON.stringify([...Array.from({ length: 30 }, (_, i) => `Klaim panjang nomor ${i} yang cukup deskriptif.`), 42, null]);
  globalThis.fetch = (async () =>
    Response.json({ choices: [{ message: { content: arr } }] })) as typeof fetch;
  try {
    const out = await withEnv({ ...NO_AI, GROQ_API_KEY: "k" }, () => extractClaimCandidates("doc"));
    assert.equal(out.candidates.length, 20);
    for (const c of out.candidates) assert.equal(typeof c, "string");
  } finally { globalThis.fetch = real; }
});
