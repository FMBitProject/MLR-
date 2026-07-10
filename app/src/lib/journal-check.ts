// RAG substantiation: does the flagged promotional copy stay within what the
// journals in the Claims Library actually report? Works for ANY flag (even
// those with no matching claim). Pipeline per check:
//   1. Gather every reference of the product's active claims (PMID or an
//      uploaded-PDF docId).
//   2. Let the LLM pick which cited articles plausibly relate (semantic —
//      "Post-ACS" matches "after Acute Coronary Syndromes"); lexical fallback.
//   3. Resolve those to corpus documents (uploaded PDF > free PMC full text >
//      PubMed abstract) and retrieve the most relevant chunks.
//   4. Judge the copy against the retrieved evidence; when the evidence
//      doesn't cover the topic, answer UNCLEAR and remind the reviewer to
//      verify manually. Strictly assistive (PRD §6).

import { llmComplete } from "./llm";
import { similarity } from "./claims-check";
import { ensureJournalDocument, retrieveChunks, type JournalDoc } from "./journal-corpus";
import type { ClaimReference } from "./db/schema";

// One candidate journal drawn from a library claim's reference.
export type JournalCandidate = {
  ref: ClaimReference;
  claimText: string;
};

export type JournalCheckResult = {
  // supported | not_supported | unclear | abstract_only (no API key)
  verdict: string;
  note: string;
  pmid: string | null;
} | null;

const MAX_DOCS = 3; // documents resolved/fetched per check
const MAX_CHUNKS = 6; // evidence chunks shown to the judge

// Stage 2 — semantic selection from citations alone (cheap, no fetching).
async function selectRelevant(
  flaggedText: string,
  candidates: JournalCandidate[],
): Promise<number[] | null> {
  const list = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.ref.citation}${c.ref.pmid ? ` [PMID ${c.ref.pmid}]` : " [uploaded PDF]"} (approved claim: ${c.claimText.slice(0, 100)})`,
    )
    .join("\n");
  const raw = await llmComplete({
    json: true,
    maxTokens: 120,
    system:
      'You select which cited journal articles most plausibly substantiate a piece of pharmaceutical promotional copy, judging from the citations (study names, populations, drugs, outcomes). Reply with JSON only: {"picks":[1,2]} — up to 3 list numbers ordered most-relevant first, or an empty array if none plausibly relate.',
    user: `Candidate citations:\n${list}\n\nPromotional copy:\n"""${flaggedText}"""`,
  });
  if (!raw) return null;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.picks)) return null;
    return parsed.picks
      .map((n: unknown) => Number(n) - 1)
      .filter((i: number) => Number.isInteger(i) && i >= 0 && i < candidates.length)
      .slice(0, MAX_DOCS);
  } catch {
    return null;
  }
}

const SOURCE_LABEL: Record<string, string> = {
  pdf_upload: "full text (uploaded PDF)",
  pmc_fulltext: "full text (PubMed Central)",
  pubmed_abstract: "abstract only",
};

async function judgeWithLlm(
  flaggedText: string,
  chunks: ReturnType<typeof retrieveChunks>,
  docs: Map<string, JournalDoc>,
): Promise<{ verdict: string; note: string; pmid: string | null } | null> {
  const evidence = chunks
    .map((ch, i) => {
      const label = SOURCE_LABEL[ch.source] ?? ch.source;
      return `[Excerpt ${i + 1} · ${ch.citation}${ch.pmid ? ` · PMID ${ch.pmid}` : ""} · ${label}]\n${ch.text}`;
    })
    .join("\n\n");

  const text = await llmComplete({
    json: true,
    maxTokens: 350,
    system:
      'You verify pharmaceutical promotional copy against excerpts retrieved from the cited journal articles (full text when available, otherwise abstracts). Reply with JSON only: {"verdict":"SUPPORTED|NOT_SUPPORTED|UNCLEAR","excerpt":<number of the decisive excerpt or 0>,"reason":"<one short sentence in Indonesian, quoting the key figure/finding when possible>"}. SUPPORTED = the excerpts clearly report the same or stronger evidence than the copy asserts. NOT_SUPPORTED = the excerpts cover this copy\'s topic but the copy exaggerates, broadens, or contradicts them. UNCLEAR = the excerpts are not about this copy\'s subject or lack the detail to judge — do NOT answer NOT_SUPPORTED merely because the right evidence is absent; answer UNCLEAR and your reason MUST remind the reviewer to verify against the correct source manually. You never approve content; a human reviewer decides.',
    user: `Retrieved journal excerpts:\n${evidence}\n\nPromotional copy to verify:\n"""${flaggedText}"""`,
  });
  if (!text) return null;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const verdict = String(parsed.verdict ?? "").toLowerCase();
    if (!["supported", "not_supported", "unclear"].includes(verdict)) return null;

    const idx = Number(parsed.excerpt);
    const decisive =
      Number.isInteger(idx) && idx >= 1 && idx <= chunks.length ? chunks[idx - 1] : chunks[0];
    const doc = docs.get(decisive.docId);
    const sourceNote = doc ? ` (sumber: ${SOURCE_LABEL[doc.source] ?? doc.source})` : "";
    return {
      verdict,
      note: String(parsed.reason ?? "").slice(0, 380) + sourceNote,
      pmid: decisive.pmid,
    };
  } catch {
    return null;
  }
}

export async function checkAgainstJournal(opts: {
  flaggedText: string;
  tenantId: string;
  candidates: JournalCandidate[];
}): Promise<JournalCheckResult> {
  // Deduplicate by identity (pmid or docId)
  const seen = new Set<string>();
  const unique = opts.candidates.filter((c) => {
    const key = c.ref.docId ?? c.ref.pmid ?? "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!unique.length) return null;

  // Pick relevant articles semantically; lexical fallback without an LLM.
  const picked = await selectRelevant(opts.flaggedText, unique);
  const order =
    picked && picked.length
      ? picked.map((i) => unique[i])
      : [...unique]
          .map((c) => ({
            c,
            score: Math.max(
              similarity(opts.flaggedText, c.claimText),
              similarity(opts.flaggedText, c.ref.citation),
            ),
          }))
          .sort((a, b) => b.score - a.score)
          .map((x) => x.c);

  // Resolve to corpus documents (PDF > PMC full text > abstract), cached.
  const docs = new Map<string, JournalDoc>();
  for (const c of order) {
    if (docs.size >= MAX_DOCS) break;
    const doc = await ensureJournalDocument(opts.tenantId, c.ref);
    if (doc) docs.set(doc.id, doc);
  }
  if (!docs.size) return null;

  const chunks = retrieveChunks(opts.flaggedText, [...docs.values()], MAX_CHUNKS);
  if (!chunks.length) return null;

  const judged = await judgeWithLlm(opts.flaggedText, chunks, docs);
  if (judged) return judged;

  // No AI provider: surface the best-matching excerpt so the reviewer can
  // verify inline without leaving the app.
  const top = chunks[0];
  return {
    verdict: "abstract_only",
    note: top.text.replace(/\s+/g, " ").slice(0, 420),
    pmid: top.pmid,
  };
}
