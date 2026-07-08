// On-demand AI substantiation: does the flagged promotional copy stay within
// what the cited journal actually reports? The article's abstract is fetched
// free from PubMed (efetch); when ANTHROPIC_API_KEY is set, Claude Haiku
// weighs the copy against it. Strictly assistive (PRD §6): the verdict is a
// signal for the reviewer, never a decision.

import { fetchAbstract } from "./pubmed";
import type { ClaimReference } from "./db/schema";

export type JournalCheckResult = {
  // supported | not_supported | unclear | abstract_only (no API key)
  verdict: string;
  note: string;
  pmid: string;
} | null;

async function judgeWithClaude(
  flaggedText: string,
  claimText: string | null,
  abstract: string,
): Promise<{ verdict: string; reason: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system:
        'You verify pharmaceutical promotional copy against the abstract of the journal article cited as its evidence. Reply with JSON only: {"verdict":"SUPPORTED|NOT_SUPPORTED|UNCLEAR","reason":"<one short sentence in Indonesian>"}. SUPPORTED = the copy asserts the same or weaker than the abstract reports. NOT_SUPPORTED = it exaggerates, broadens, or contradicts the abstract. UNCLEAR = the abstract does not contain enough information to judge. You never approve content; a human reviewer decides.',
      messages: [
        {
          role: "user",
          content: `Journal abstract:\n"""${abstract.slice(0, 6000)}"""\n\n${
            claimText ? `Approved claim referencing this article:\n"""${claimText}"""\n\n` : ""
          }Promotional copy to verify:\n"""${flaggedText}"""`,
        },
      ],
    });
    const block = response.content[0];
    if (block?.type !== "text") return null;
    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const verdict = String(parsed.verdict ?? "").toLowerCase();
    if (!["supported", "not_supported", "unclear"].includes(verdict)) return null;
    return { verdict, reason: String(parsed.reason ?? "").slice(0, 400) };
  } catch {
    return null;
  }
}

export async function checkAgainstJournal(opts: {
  flaggedText: string;
  claimText: string | null;
  references: ClaimReference[];
}): Promise<JournalCheckResult> {
  const ref = opts.references.find((r) => r.pmid);
  if (!ref?.pmid) return null;

  const abstract = await fetchAbstract(ref.pmid);
  if (!abstract) return null;

  const judged = await judgeWithClaude(opts.flaggedText, opts.claimText, abstract);
  if (judged) return { verdict: judged.verdict, note: judged.reason, pmid: ref.pmid };

  // No API key (or Claude unavailable): still valuable — surface the abstract
  // inline so the reviewer can verify without leaving the app.
  const excerpt = abstract.replace(/\s+/g, " ").slice(0, 420);
  return { verdict: "abstract_only", note: excerpt, pmid: ref.pmid };
}
