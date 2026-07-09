// On-demand AI substantiation: does the flagged promotional copy stay within
// what the journals in the Claims Library actually report? Works for ANY flag
// (even those with no matching claim): it ranks every product claim that
// carries a PMID, fetches those abstracts free from PubMed (efetch), and asks
// the configured LLM whether any of them supports the copy — or whether the
// reviewer should verify manually. Strictly assistive (PRD §6).

import { fetchAbstract } from "./pubmed";
import { llmComplete } from "./llm";
import { similarity } from "./claims-check";

// One candidate journal drawn from a library claim's reference.
export type JournalCandidate = {
  pmid: string;
  citation: string;
  claimText: string;
};

export type JournalCheckResult = {
  // supported | not_supported | unclear | abstract_only (no API key)
  verdict: string;
  note: string;
  pmid: string;
} | null;

const MAX_ARTICLES = 3; // cap PubMed fetches + prompt size per check

async function judgeWithLlm(
  flaggedText: string,
  articles: Array<{ pmid: string; citation: string; abstract: string }>,
): Promise<{ verdict: string; note: string; pmid: string } | null> {
  const journalsBlock = articles
    .map(
      (a, i) =>
        `[Article ${i + 1} · PMID ${a.pmid}] ${a.citation}\nAbstract: ${a.abstract.slice(0, 3500)}`,
    )
    .join("\n\n");

  const text = await llmComplete({
    json: true,
    maxTokens: 350,
    system:
      'You verify pharmaceutical promotional copy against candidate journal abstracts drawn from the approved claims library. Decide whether any provided article substantiates the copy. Reply with JSON only: {"verdict":"SUPPORTED|NOT_SUPPORTED|UNCLEAR","pmid":"<PMID of the most relevant article, or empty>","reason":"<one short sentence in Indonesian>"}. SUPPORTED = an article clearly reports the same or stronger evidence than the copy asserts (the copy stays within it). NOT_SUPPORTED = an article IS about this copy\'s topic but the copy exaggerates, broadens, or contradicts what it reports. UNCLEAR = none of the provided articles is actually about this copy\'s subject/study, or the abstract lacks the detail to judge — do NOT answer NOT_SUPPORTED merely because the right article is absent; answer UNCLEAR and your reason MUST remind the reviewer to locate and verify the correct source manually. You never approve content; a human reviewer decides.',
    user: `Candidate journal articles:\n${journalsBlock}\n\nPromotional copy to verify:\n"""${flaggedText}"""`,
  });
  if (!text) return null;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const verdict = String(parsed.verdict ?? "").toLowerCase();
    if (!["supported", "not_supported", "unclear"].includes(verdict)) return null;
    const cleanPmid = String(parsed.pmid ?? "").replace(/\D/g, "");
    const pmid = articles.some((a) => a.pmid === cleanPmid) ? cleanPmid : articles[0].pmid;
    return { verdict, note: String(parsed.reason ?? "").slice(0, 400), pmid };
  } catch {
    return null;
  }
}

export async function checkAgainstJournal(opts: {
  flaggedText: string;
  candidates: JournalCandidate[];
}): Promise<JournalCheckResult> {
  if (!opts.candidates.length) return null;

  // Rank library journals by lexical closeness (claim text + citation wording)
  // to the flagged copy, then substantiate against the most promising few.
  const ranked = [...opts.candidates]
    .map((c) => ({
      c,
      score: Math.max(
        similarity(opts.flaggedText, c.claimText),
        similarity(opts.flaggedText, c.citation),
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const articles: Array<{ pmid: string; citation: string; abstract: string }> = [];
  for (const { c } of ranked) {
    if (articles.length >= MAX_ARTICLES) break;
    if (seen.has(c.pmid)) continue;
    seen.add(c.pmid);
    const abstract = await fetchAbstract(c.pmid);
    if (abstract) articles.push({ pmid: c.pmid, citation: c.citation, abstract });
  }
  if (!articles.length) return null;

  const judged = await judgeWithLlm(opts.flaggedText, articles);
  if (judged) return judged;

  // No API key (or model unavailable): still valuable — surface the closest
  // abstract inline so the reviewer can verify without leaving the app.
  const top = articles[0];
  return {
    verdict: "abstract_only",
    note: top.abstract.replace(/\s+/g, " ").slice(0, 420),
    pmid: top.pmid,
  };
}
