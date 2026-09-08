import "./helpers.ts";
import { withEnv } from "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAgainstJournal, type JournalCandidate } from "../src/lib/journal-check.ts";

const NO_AI = {
  AI_PROVIDER: undefined, GROQ_API_KEY: undefined, XAI_API_KEY: undefined,
  OPENAI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined,
  AI_BASE_URL: undefined, AI_API_KEY: undefined,
};

const cand = (over: Partial<JournalCandidate["ref"]> = {}, claimText = "Klaim"): JournalCandidate => ({
  ref: { citation: "Smith J. A trial. NEJM. 2024.", pmid: null, doi: null, ...over },
  claimText,
});

test("journal: no candidates means no verdict at all", async () => {
  await withEnv(NO_AI, async () => {
    assert.equal(
      await checkAgainstJournal({ flaggedText: "copy", tenantId: "t1", candidates: [] }),
      null,
    );
  });
});

test("journal: candidates with neither a PMID nor a docId are unusable", async () => {
  await withEnv(NO_AI, async () => {
    const out = await checkAgainstJournal({
      flaggedText: "copy",
      tenantId: "t1",
      candidates: [cand(), cand()],
    });
    assert.equal(out, null, "a citation with no identity cannot be resolved to a document");
  });
});

// NOTE: every path past the dedupe/identity guards calls ensureJournalDocument,
// which queries journal_documents — so it needs a live Postgres and belongs in
// an integration suite, not here. Two observations from reading that path,
// worth covering there:
//   1. checkAgainstJournal wraps no part of the corpus resolution in try/catch,
//      so a DB error propagates to the caller rather than degrading to null the
//      way every other AI failure in this module does.
//   2. retrieveChunks can return one blank chunk for an empty-content document
//      (see the todo in journal-corpus.test.ts), which makes the no-LLM branch
//      return verdict "abstract_only" with an empty note.
