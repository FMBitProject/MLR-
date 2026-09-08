import "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieveChunks, type JournalDoc } from "../src/lib/journal-corpus.ts";

const doc = (id: string, content: string, over: Partial<JournalDoc> = {}): JournalDoc =>
  ({
    id,
    tenantId: "t1",
    pmid: `pmid-${id}`,
    citation: `Citation ${id}`,
    source: "pubmed_abstract",
    content,
    createdAt: new Date(),
    ...over,
  }) as JournalDoc;

test("corpus: no documents yields no chunks", () => {
  assert.deepEqual(retrieveChunks("apa saja", []), []);
});

test("corpus: a short document is returned as a single chunk", () => {
  const out = retrieveChunks("kolesterol", [doc("a", "Studi kolesterol LDL pada dewasa.")]);
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Studi kolesterol LDL pada dewasa.");
  assert.equal(out[0].docId, "a");
});

test("corpus: chunk metadata carries the citation, pmid and source through", () => {
  const out = retrieveChunks("ldl", [doc("a", "Menurunkan LDL sebesar 40 persen.", { source: "pmc_fulltext" })]);
  assert.equal(out[0].citation, "Citation a");
  assert.equal(out[0].pmid, "pmid-a");
  assert.equal(out[0].source, "pmc_fulltext");
});

test("corpus: the most relevant document ranks first", () => {
  const relevant = doc("hit", "Terapi menurunkan risiko kardiovaskular mayor sebesar 22 persen.");
  const noise = doc("miss", "Metode sterilisasi kemasan botol plastik untuk distribusi.");
  const out = retrieveChunks("risiko kardiovaskular mayor", [noise, relevant]);
  assert.equal(out[0].docId, "hit");
});

test("corpus: results are sorted by descending score", () => {
  const out = retrieveChunks("kolesterol LDL", [
    doc("a", "kolesterol LDL turun signifikan pada kelompok terapi"),
    doc("b", "distribusi kemasan dan logistik gudang regional"),
    doc("c", "kadar kolesterol diukur pada awal studi"),
  ]);
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].score >= out[i].score);
});

test("corpus: maxChunks caps the result set", () => {
  const docs = Array.from({ length: 10 }, (_, i) => doc(`d${i}`, `kolesterol studi nomor ${i}`));
  assert.equal(retrieveChunks("kolesterol", docs, 3).length, 3);
  assert.equal(retrieveChunks("kolesterol", docs).length, 6, "default cap is 6");
});

test("corpus: a long document is split into several overlapping chunks", () => {
  const long = Array.from({ length: 60 }, (_, i) => `Kalimat nomor ${i} tentang studi klinis acak terkontrol.`).join(" ");
  assert.ok(long.length > 1400);
  const out = retrieveChunks("studi klinis", [doc("long", long)], 20);
  assert.ok(out.length > 1, "long content must be chunked");
  for (const c of out) assert.ok(c.text.length <= 1600, `chunk too long: ${c.text.length}`);
});

test("corpus: chunking loses no content (overlap covers the seams)", () => {
  const long = Array.from({ length: 80 }, (_, i) => `Bagian ${i} berisi temuan penting.`).join("\n");
  const out = retrieveChunks("temuan", [doc("long", long)], 50);
  const joined = out.map((c) => c.text).join(" ");
  assert.ok(joined.includes("Bagian 0 "), "start missing");
  assert.ok(joined.includes("Bagian 79"), "end missing");
});

test("corpus: a query with no shared terms still returns chunks with score 0", () => {
  const out = retrieveChunks("zzzz qqqq", [doc("a", "kolesterol LDL dewasa")]);
  assert.equal(out.length, 1);
  assert.equal(out[0].score, 0);
});

test("corpus: an empty query does not throw and scores everything 0", () => {
  const out = retrieveChunks("", [doc("a", "kolesterol LDL dewasa")]);
  assert.equal(out[0].score, 0);
});

test("corpus: a document with empty content contributes no chunk", () => {
  // Regression: chunkDocument() used to return [content] on the short path
  // before the .filter(Boolean) that guards the long path, so a blank document
  // produced one empty chunk — which made journal-check.ts report a verdict
  // over no evidence at all.
  assert.deepEqual(retrieveChunks("apa pun", [doc("empty", "")]), []);
});

test("corpus: a whitespace-only document contributes no chunk either", () => {
  assert.deepEqual(retrieveChunks("apa pun", [doc("blank", "   \n\n  ")]), []);
});

test("corpus: a blank document is skipped but its siblings still rank", () => {
  const out = retrieveChunks("kolesterol", [doc("empty", ""), doc("real", "kadar kolesterol LDL turun")]);
  assert.equal(out.length, 1);
  assert.equal(out[0].docId, "real");
});

test("corpus: scores are finite numbers, never NaN", () => {
  const out = retrieveChunks("kolesterol", [doc("a", "kolesterol"), doc("b", "")]);
  for (const c of out) assert.ok(Number.isFinite(c.score), `score was ${c.score}`);
});

test("corpus: idf downweights a term present in every document", () => {
  // "studi" is everywhere; "kardiovaskular" is distinctive and should decide.
  const docs = [
    doc("a", "studi tentang distribusi kemasan"),
    doc("b", "studi tentang kardiovaskular mayor"),
    doc("c", "studi tentang logistik gudang"),
  ];
  assert.equal(retrieveChunks("studi kardiovaskular", docs)[0].docId, "b");
});
