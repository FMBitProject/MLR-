// Journal corpus for RAG substantiation. Each claim reference resolves to a
// journal_documents row holding the best readable text we can get, in order
// of preference: the tenant's uploaded PDF (full text incl. tables), free
// PubMed Central full text (open-access articles), else the PubMed abstract.
// Retrieval chunks documents at query time and ranks chunks with TF-IDF
// cosine — plenty at library scale; production swaps this for pgvector
// embeddings per PRD §6 without changing callers.

import { eq, and } from "drizzle-orm";
import { db, t } from "./db";
import { fetchAbstract, fetchPmcFullText } from "./pubmed";
import type { ClaimReference } from "./db/schema";

export type JournalDoc = typeof t.journalDocuments.$inferSelect;

/**
 * Resolve a claim reference to a corpus document, fetching and caching the
 * best available text on first use. Returns null when nothing is readable
 * (no PDF, not on PubMed).
 */
export async function ensureJournalDocument(
  tenantId: string,
  ref: ClaimReference,
): Promise<JournalDoc | null> {
  if (ref.docId) {
    const doc = db
      .select()
      .from(t.journalDocuments)
      .where(
        and(eq(t.journalDocuments.id, ref.docId), eq(t.journalDocuments.tenantId, tenantId)),
      )
      .get();
    if (doc) return doc;
  }

  if (!ref.pmid) return null;

  const cached = db
    .select()
    .from(t.journalDocuments)
    .where(
      and(eq(t.journalDocuments.pmid, ref.pmid), eq(t.journalDocuments.tenantId, tenantId)),
    )
    .get();
  if (cached) return cached;

  const fullText = await fetchPmcFullText(ref.pmid);
  const content = fullText ?? (await fetchAbstract(ref.pmid));
  if (!content) return null;

  const doc = {
    id: crypto.randomUUID(),
    tenantId,
    pmid: ref.pmid,
    citation: ref.citation,
    source: fullText ? "pmc_fulltext" : "pubmed_abstract",
    content,
    createdAt: new Date(),
  };
  db.insert(t.journalDocuments).values(doc).run();
  return doc;
}

/* --------------------------- chunk retrieval --------------------------- */

const CHUNK_CHARS = 1400;
const CHUNK_OVERLAP = 200;

export type RetrievedChunk = {
  docId: string;
  pmid: string | null;
  citation: string;
  source: string;
  text: string;
  score: number;
};

function chunkDocument(content: string): string[] {
  if (content.length <= CHUNK_CHARS) return [content];
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(start + CHUNK_CHARS, content.length);
    // prefer to break on a paragraph/sentence boundary near the end
    if (end < content.length) {
      const window = content.slice(start, end);
      const cut = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(". "));
      if (cut > CHUNK_CHARS * 0.5) end = start + cut + 1;
    }
    chunks.push(content.slice(start, end).trim());
    if (end >= content.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * TF-IDF cosine over all chunks of the given documents; returns the best
 * chunks overall (capped) so the judge sees evidence from the right places.
 */
export function retrieveChunks(
  query: string,
  docs: JournalDoc[],
  maxChunks = 6,
): RetrievedChunk[] {
  const all: Array<{ doc: JournalDoc; text: string; tokens: string[] }> = [];
  for (const doc of docs) {
    for (const text of chunkDocument(doc.content)) {
      all.push({ doc, text, tokens: tokenize(text) });
    }
  }
  if (!all.length) return [];

  const df = new Map<string, number>();
  for (const c of all) {
    for (const w of new Set(c.tokens)) df.set(w, (df.get(w) ?? 0) + 1);
  }
  const idf = (w: string) => Math.log(1 + all.length / (1 + (df.get(w) ?? 0)));

  const qTokens = tokenize(query);
  const qWeights = new Map<string, number>();
  for (const w of qTokens) qWeights.set(w, (qWeights.get(w) ?? 0) + idf(w));

  const scored = all.map((c) => {
    const tf = new Map<string, number>();
    for (const w of c.tokens) tf.set(w, (tf.get(w) ?? 0) + 1);
    let dot = 0;
    let norm = 0;
    for (const [w, n] of tf) {
      const weight = n * idf(w);
      norm += weight * weight;
      const qw = qWeights.get(w);
      if (qw) dot += weight * qw;
    }
    return { c, score: norm ? dot / Math.sqrt(norm) : 0 };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .map(({ c, score }) => ({
      docId: c.doc.id,
      pmid: c.doc.pmid,
      citation: c.doc.citation,
      source: c.doc.source,
      text: c.text,
      score,
    }));
}
