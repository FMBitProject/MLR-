import { and, eq } from "drizzle-orm";
import { db, t } from "./db";
import { llmComplete } from "./llm";

// AI-assisted claims cross-check (PRD 9.4).
// Role is strictly assistive flagging: compare extracted element text against the
// Approved Claims Library and flag mismatches for a human reviewer. Never approves
// or rejects. Default engine is a transparent lexical cosine similarity; when
// ANTHROPIC_API_KEY is set, borderline cases are adjudicated by Claude Haiku
// (per PRD §6 the default model for claims-matching flags).

const STOPWORDS = new Set(
  "dan atau yang untuk pada dengan dalam dari ke di adalah ini itu para bagi oleh serta dapat akan telah sebagai secara terhadap the a an of to in on for with and or is are be as by at from that this".split(" "),
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function similarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (!ta.length || !tb.length) return 0;
  const fa = new Map<string, number>();
  const fb = new Map<string, number>();
  for (const w of ta) fa.set(w, (fa.get(w) ?? 0) + 1);
  for (const w of tb) fb.set(w, (fb.get(w) ?? 0) + 1);
  let dot = 0;
  for (const [w, n] of fa) dot += n * (fb.get(w) ?? 0);
  const norm = (m: Map<string, number>) =>
    Math.sqrt([...m.values()].reduce((s, n) => s + n * n, 0));
  return dot / (norm(fa) * norm(fb));
}

const MATCH_THRESHOLD = 0.72; // above: consistent with library, no flag
const RELATED_THRESHOLD = 0.35; // between: flag with closest claim for review

async function refineWithLlm(
  flaggedText: string,
  claimText: string,
): Promise<"consistent" | "mismatch" | null> {
  const raw = await llmComplete({
    maxTokens: 256,
    system:
      "You compare pharmaceutical promotional copy against an approved claim. Answer with exactly one word: CONSISTENT if the copy stays within what the approved claim supports (same or weaker assertion), or MISMATCH if it exaggerates, broadens, or contradicts it. You never approve content; a human reviewer decides.",
    user: `Approved claim:\n"""${claimText}"""\n\nPromotional copy:\n"""${flaggedText}"""`,
  });
  const text = (raw ?? "").trim().toUpperCase();
  if (text.includes("CONSISTENT")) return "consistent";
  if (text.includes("MISMATCH")) return "mismatch";
  return null; // fall back silently to the lexical verdict
}

/**
 * Runs the claims check for every native-text element of a version and writes
 * claim_flags rows. Runs synchronously here; in production this is the async
 * background job (Inngest/Trigger.dev) described in the PRD.
 */
export async function runClaimsCheck(opts: {
  versionId: string;
  productId: string;
  tenantId: string;
}): Promise<number> {
  const claims = await db
    .select()
    .from(t.approvedClaims)
    .where(
      and(
        eq(t.approvedClaims.tenantId, opts.tenantId),
        eq(t.approvedClaims.productId, opts.productId),
        eq(t.approvedClaims.status, "active"),
      ),
    );

  const elements = await db
    .select()
    .from(t.contentElements)
    .where(eq(t.contentElements.versionId, opts.versionId));

  let flagCount = 0;

  for (const el of elements) {
    if (!el.extractedText || el.extractionMethod !== "native_text") continue;
    if (el.elementType === "footnote") continue;
    // Skip fragments too short to be a claim (slide titles, "1x sehari", …)
    // so full decks don't drown reviewers in meaningless no_match flags
    if (tokenize(el.extractedText).length < 5) continue;

    let best: { id: string; score: number; text: string } | null = null;
    for (const c of claims) {
      // Match against the claim text AND its journal citations, so attaching a
      // reference makes the article's own wording (drug names, trial names,
      // indications) findable even when the claim text itself is terse.
      let score = similarity(el.extractedText, c.claimText);
      for (const ref of c.references ?? []) {
        if (ref.citation) score = Math.max(score, similarity(el.extractedText, ref.citation));
      }
      if (!best || score > best.score) best = { id: c.id, score, text: c.claimText };
    }

    if (best && best.score >= MATCH_THRESHOLD) continue; // aligned with library

    let flagType: "matched" | "no_match" =
      best && best.score >= RELATED_THRESHOLD ? "matched" : "no_match";

    // Borderline: let the configured LLM take a second look (assistive only)
    if (best && flagType === "matched") {
      const verdict = await refineWithLlm(el.extractedText, best.text);
      if (verdict === "consistent") continue;
      if (verdict === "mismatch") flagType = "matched"; // keep flag, human decides
    }

    await db.insert(t.claimFlags)
      .values({
        id: crypto.randomUUID(),
        versionId: opts.versionId,
        elementId: el.id,
        flaggedText: el.extractedText,
        matchedClaimId: best && best.score >= 0.2 ? best.id : null,
        similarityScore: best ? Math.round(best.score * 100) / 100 : 0,
        flagType,
      });
    flagCount += 1;
  }

  return flagCount;
}
