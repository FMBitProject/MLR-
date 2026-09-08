import "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { similarity } from "../src/lib/claims-check.ts";

// Thresholds mirrored from claims-check.ts — the values reviewers depend on.
const MATCH_THRESHOLD = 0.72;
const RELATED_THRESHOLD = 0.35;

// Cosine over float64 can land a hair above 1.0 for identical vectors
// (1.0000000000000002). Harmless — callers round to 2dp before storing —
// but exact equality to 1 is the wrong assertion.
const isOne = (n: number) => Math.abs(n - 1) < 1e-9;

test("claims: identical text scores 1", () => {
  assert.ok(isOne(similarity("obat X menurunkan tekanan darah", "obat X menurunkan tekanan darah")));
});

test("claims: similarity is symmetric", () => {
  const a = "efikasi terbukti pada pasien dewasa";
  const b = "terbukti efikasi untuk pasien dewasa dengan hipertensi";
  assert.equal(similarity(a, b), similarity(b, a));
});

test("claims: word order does not matter (bag of words)", () => {
  assert.ok(isOne(similarity("menurunkan tekanan darah", "darah tekanan menurunkan")));
});

test("claims: score always lies in [0, 1]", () => {
  const samples = ["obat X aman", "", "menurunkan LDL hingga 50%", "!!!", "dan atau yang", "obat X aman"];
  for (const a of samples)
    for (const b of samples) {
      const s = similarity(a, b);
      assert.ok(s >= 0 && s <= 1 + 1e-9, `similarity(${a},${b}) = ${s} out of range`);
    }
});

test("claims: empty or stopword-only text scores 0 instead of NaN", () => {
  assert.equal(similarity("", "obat X"), 0);
  assert.equal(similarity("obat X", ""), 0);
  assert.equal(similarity("", ""), 0);
  assert.equal(similarity("dan atau yang untuk", "obat X menurunkan"), 0);
  assert.equal(similarity("!!! ??? ...", "obat X"), 0, "punctuation-only is not a claim");
});

test("claims: punctuation and case are ignored", () => {
  assert.ok(isOne(similarity("Obat X, menurunkan LDL.", "obat x menurunkan ldl")));
});

test("claims: stopwords do not inflate the score", () => {
  // Two sentences sharing only stopwords must not look related.
  assert.equal(similarity("dan atau yang untuk pada", "dan atau yang untuk dengan"), 0);
});

test("claims: unrelated copy stays below the review threshold", () => {
  const claim = "Obat X menurunkan kadar kolesterol LDL pada pasien dislipidemia.";
  const unrelated = "Kemasan baru tersedia dalam ukuran botol 100 mililiter.";
  assert.ok(
    similarity(unrelated, claim) < RELATED_THRESHOLD,
    "unrelated copy would be mis-labelled as 'matched'",
  );
});

test("claims: near-verbatim copy clears the match threshold (no flag)", () => {
  const claim = "Obat X menurunkan kadar kolesterol LDL pada pasien dislipidemia dewasa.";
  const copy = "Obat X menurunkan kadar kolesterol LDL pada pasien dislipidemia dewasa";
  assert.ok(similarity(copy, claim) >= MATCH_THRESHOLD);
});

test("claims: an exaggerated variant still scores as related, so a human sees it", () => {
  const claim = "Obat X menurunkan kadar kolesterol LDL pada pasien dislipidemia dewasa.";
  const exaggerated = "Obat X menurunkan kadar kolesterol LDL pada semua pasien tanpa efek samping.";
  const s = similarity(exaggerated, claim);
  assert.ok(s >= RELATED_THRESHOLD, `expected related, got ${s}`);
  assert.ok(s < MATCH_THRESHOLD, `must not auto-pass as consistent, got ${s}`);
});

test("claims: repeated words raise term frequency, not the ceiling", () => {
  const s = similarity("efikasi efikasi efikasi", "efikasi");
  assert.ok(isOne(s), "a repeated single term is still the same direction");
});

test("claims: partially overlapping claims land between the thresholds", () => {
  const claim = "Terapi kombinasi menurunkan risiko kejadian kardiovaskular mayor.";
  const copy = "Terapi kombinasi menurunkan risiko infeksi saluran pernapasan.";
  const s = similarity(copy, claim);
  assert.ok(s > 0 && s < MATCH_THRESHOLD, `expected a flagged middle ground, got ${s}`);
});

test("claims: English claims tokenize too (bilingual library)", () => {
  assert.ok(isOne(similarity("reduces LDL cholesterol in adults", "reduces LDL cholesterol in adults")));
  assert.equal(similarity("the a an of to in on", "for with and or is"), 0, "English stopwords stripped");
});

test("claims: single-character tokens are dropped as noise", () => {
  assert.equal(similarity("a b c d", "a b c d"), 0);
});

test("claims: identical text may overshoot 1.0 by a float epsilon, never meaningfully", () => {
  // Documents the known float behaviour: the stored score rounds to 2dp, so
  // an overshoot can never present to a reviewer as >1.00.
  const raw = similarity("obat X menurunkan tekanan darah", "obat X menurunkan tekanan darah");
  assert.ok(raw <= 1 + 1e-9, `overshoot too large: ${raw}`);
  assert.equal(Math.round(raw * 100) / 100, 1, "the persisted score is exactly 1.00");
});
