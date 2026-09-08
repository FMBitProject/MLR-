import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupPubmed, fetchAbstract, fetchPmcFullText } from "../src/lib/pubmed.ts";

/** Routes each outgoing NCBI request to a canned response by URL substring. */
function mockFetch(routes: Array<[string, unknown | string | number]>) {
  const real = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    const u = String(url);
    calls.push(u);
    for (const [match, body] of routes) {
      if (u.includes(match)) {
        if (typeof body === "number") return new Response("err", { status: body });
        if (typeof body === "string") return new Response(body);
        return Response.json(body);
      }
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = real; } };
}

const summary = (pmid: string, doc: Record<string, unknown>) => ({ result: { [pmid]: doc } });

const FULL_DOC = {
  title: "Effect of drug X on LDL cholesterol.",
  source: "N Engl J Med",
  pubdate: "2024 Mar 15",
  volume: "390",
  issue: "11",
  pages: "1001-1010",
  authors: [{ name: "Smith J" }, { name: "Lee K" }, { name: "Tan M" }, { name: "Rao P" }],
  articleids: [{ idtype: "doi", value: "10.1056/NEJMoa2400001" }],
};

test("pubmed: a bare PMID resolves to a formatted citation", async () => {
  const m = mockFetch([["esummary.fcgi", summary("12345", FULL_DOC)]]);
  try {
    const ref = await lookupPubmed("12345");
    assert.equal(ref!.pmid, "12345");
    assert.equal(ref!.doi, "10.1056/NEJMoa2400001");
    assert.equal(
      ref!.citation,
      "Smith J, Lee K, Tan M, et al. Effect of drug X on LDL cholesterol. N Engl J Med. 2024;390(11):1001-1010.",
    );
  } finally { m.restore(); }
});

test("pubmed: a PubMed URL is accepted", async () => {
  const m = mockFetch([["esummary.fcgi", summary("999", FULL_DOC)]]);
  try {
    const ref = await lookupPubmed("https://pubmed.ncbi.nlm.nih.gov/999/");
    assert.equal(ref!.pmid, "999");
  } finally { m.restore(); }
});

test("pubmed: a 'PMID: 123' prefix is stripped", async () => {
  const m = mockFetch([["esummary.fcgi", summary("123", FULL_DOC)]]);
  try {
    assert.equal((await lookupPubmed("PMID: 123"))!.pmid, "123");
  } finally { m.restore(); }
});

test("pubmed: a DOI is resolved to a PMID first", async () => {
  const m = mockFetch([
    ["esearch.fcgi", { esearchresult: { idlist: ["555"] } }],
    ["esummary.fcgi", summary("555", FULL_DOC)],
  ]);
  try {
    const ref = await lookupPubmed("10.1056/NEJMoa2400001");
    assert.equal(ref!.pmid, "555");
    assert.ok(m.calls.some((c) => c.includes("esearch.fcgi")), "DOI lookup was skipped");
  } finally { m.restore(); }
});

test("pubmed: trailing punctuation is trimmed off a DOI", async () => {
  const m = mockFetch([
    ["esearch.fcgi", { esearchresult: { idlist: ["555"] } }],
    ["esummary.fcgi", summary("555", FULL_DOC)],
  ]);
  try {
    await lookupPubmed("see 10.1056/NEJMoa2400001.");
    const search = m.calls.find((c) => c.includes("esearch.fcgi"))!;
    assert.ok(!decodeURIComponent(search).includes("2400001."), "trailing dot not trimmed");
  } finally { m.restore(); }
});

test("pubmed: unparseable input returns null without any network call", async () => {
  const m = mockFetch([]);
  try {
    assert.equal(await lookupPubmed("just some free text"), null);
    assert.equal(await lookupPubmed(""), null);
    assert.equal(m.calls.length, 0, "should not hit NCBI for input it cannot parse");
  } finally { m.restore(); }
});

test("pubmed: a DOI that resolves to nothing returns null", async () => {
  const m = mockFetch([["esearch.fcgi", { esearchresult: { idlist: [] } }]]);
  try {
    assert.equal(await lookupPubmed("10.1000/unknown"), null);
  } finally { m.restore(); }
});

test("pubmed: a summary with no title is rejected", async () => {
  const m = mockFetch([["esummary.fcgi", summary("1", { source: "Journal" })]]);
  try {
    assert.equal(await lookupPubmed("1"), null);
  } finally { m.restore(); }
});

test("pubmed: three or fewer authors are listed without 'et al'", async () => {
  const m = mockFetch([
    ["esummary.fcgi", summary("1", { ...FULL_DOC, authors: [{ name: "Smith J" }, { name: "Lee K" }] })],
  ]);
  try {
    const ref = await lookupPubmed("1");
    assert.ok(ref!.citation.startsWith("Smith J, Lee K. "));
    assert.ok(!ref!.citation.includes("et al"));
  } finally { m.restore(); }
});

test("pubmed: an article with no authors or volume still yields a usable citation", async () => {
  const m = mockFetch([["esummary.fcgi", summary("1", { title: "A note", source: "BMJ", pubdate: "2020" })]]);
  try {
    const ref = await lookupPubmed("1");
    assert.equal(ref!.citation, "A note. BMJ. 2020.");
    assert.equal(ref!.doi, null);
  } finally { m.restore(); }
});

test("pubmed: an NCBI outage returns null instead of throwing", async () => {
  const m = mockFetch([["esummary.fcgi", 503]]);
  try {
    assert.equal(await lookupPubmed("12345"), null);
  } finally { m.restore(); }
});

test("pubmed: a network exception returns null instead of throwing", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("ETIMEDOUT"); }) as typeof fetch;
  try {
    assert.equal(await lookupPubmed("12345"), null);
    assert.equal(await fetchAbstract("12345"), null);
    assert.equal(await fetchPmcFullText("12345"), null);
  } finally { globalThis.fetch = real; }
});

test("pubmed: a substantial abstract is returned, a stub is not", async () => {
  let m = mockFetch([["efetch.fcgi", "  " + "Background: this abstract is long enough to be useful. ".repeat(2) + "  "]]);
  try {
    const abs = await fetchAbstract("1");
    assert.ok(abs && abs.length > 40);
    assert.ok(!abs!.startsWith(" "), "should be trimmed");
  } finally { m.restore(); }

  m = mockFetch([["efetch.fcgi", "No abstract."]]);
  try {
    assert.equal(await fetchAbstract("1"), null, "a stub under 40 chars is not an abstract");
  } finally { m.restore(); }
});

test("pubmed: an article not in PMC has no free full text", async () => {
  const m = mockFetch([["idconv", { records: [{}] }]]);
  try {
    assert.equal(await fetchPmcFullText("1"), null);
  } finally { m.restore(); }
});

test("pubmed: PMC full text is stripped of XML and returned when long enough", async () => {
  const para = "<p>Terapi menurunkan risiko kardiovaskular mayor secara signifikan. </p>".repeat(60);
  const m = mockFetch([
    ["idconv", { records: [{ pmcid: "PMC123" }] }],
    ["efetch.fcgi", `<article><front>ignored</front><body><sec><title>Results</title>${para}</sec></body></article>`],
  ]);
  try {
    const text = await fetchPmcFullText("1");
    assert.ok(text, "expected full text");
    assert.ok(!text!.includes("<p>"), "XML tags not stripped");
    assert.ok(text!.includes("## Results"), "section titles should be kept as headings");
    assert.ok(!text!.includes("ignored"), "content outside <body> should be dropped");
  } finally { m.restore(); }
});

test("pubmed: a PMC body shorter than an abstract is rejected as not-full-text", async () => {
  const m = mockFetch([
    ["idconv", { records: [{ pmcid: "PMC123" }] }],
    ["efetch.fcgi", "<article><body><p>Too short to be a full article.</p></body></article>"],
  ]);
  try {
    assert.equal(await fetchPmcFullText("1"), null);
  } finally { m.restore(); }
});
