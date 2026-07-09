// Free citation lookup against NCBI PubMed E-utilities — no API key required
// (NCBI allows up to 3 req/s without one, far above this app's usage).
// Accepts a PMID, a DOI, or a pubmed.ncbi.nlm.nih.gov URL and returns a
// formatted citation the Claims Library can attach to a claim.

import type { ClaimReference } from "./db/schema";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TIMEOUT_MS = 8_000;

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseInput(raw: string): { pmid?: string; doi?: string } {
  const input = raw.trim();
  const urlPmid = input.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
  if (urlPmid) return { pmid: urlPmid[1] };
  const doi = input.match(/10\.\d{4,9}\/[^\s"<>]+/);
  if (doi) return { doi: doi[0].replace(/[.,;)]+$/, "") };
  const pmid = input.replace(/^pmid:?\s*/i, "").trim();
  if (/^\d{1,9}$/.test(pmid)) return { pmid };
  return {};
}

async function doiToPmid(doi: string): Promise<string | null> {
  const json = await getJson(
    `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(`"${doi}"[DOI]`)}`,
  );
  const result = json?.esearchresult as { idlist?: string[] } | undefined;
  return result?.idlist?.[0] ?? null;
}

type ESummaryDoc = {
  title?: string;
  source?: string;
  pubdate?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  authors?: Array<{ name?: string }>;
  articleids?: Array<{ idtype?: string; value?: string }>;
};

/**
 * Full text from PubMed Central for open-access articles — also free.
 * PMID → PMCID via the id-converter, then efetch the article XML and strip
 * tags. Returns null when the article isn't in PMC (paywalled journals).
 */
export async function fetchPmcFullText(pmid: string): Promise<string | null> {
  try {
    const conv = await getJson(
      `https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/?ids=${encodeURIComponent(pmid)}&format=json`,
    );
    const records = conv?.records as Array<{ pmcid?: string }> | undefined;
    const pmcid = records?.[0]?.pmcid;
    if (!pmcid) return null;

    const res = await fetch(
      `${EUTILS}/efetch.fcgi?db=pmc&id=${encodeURIComponent(pmcid)}&retmode=xml`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const xml = await res.text();
    // Only the article body (skip references list); fall back to whole doc
    const body = xml.match(/<body[\s>][\s\S]*?<\/body>/)?.[0] ?? xml;
    const text = body
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<title(?:\s[^>]*)?>/g, "\n## ")
      .replace(/<\/?(?:p|sec|table-wrap|caption|tr|li)(?:\s[^>]*)?>/g, "\n")
      .replace(/<td(?:\s[^>]*)?>/g, " | ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    // A real body should be far longer than an abstract
    return text.length > 2000 ? text : null;
  } catch {
    return null;
  }
}

/** Plain-text abstract of an article — also free via E-utilities efetch. */
export async function fetchAbstract(pmid: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${EUTILS}/efetch.fcgi?db=pubmed&id=${encodeURIComponent(pmid)}&rettype=abstract&retmode=text`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text.length > 40 ? text : null;
  } catch {
    return null;
  }
}

export async function lookupPubmed(raw: string): Promise<ClaimReference | null> {
  const parsed = parseInput(raw);
  const pmid = parsed.pmid ?? (parsed.doi ? await doiToPmid(parsed.doi) : null);
  if (!pmid) return null;

  const json = await getJson(`${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${pmid}`);
  const doc = (json?.result as Record<string, ESummaryDoc> | undefined)?.[pmid];
  if (!doc?.title) return null;

  const names = (doc.authors ?? []).map((a) => a.name).filter(Boolean) as string[];
  const authors = names.length
    ? names.slice(0, 3).join(", ") + (names.length > 3 ? ", et al" : "")
    : null;
  const year = doc.pubdate?.match(/\d{4}/)?.[0] ?? null;
  const title = doc.title.replace(/\.?\s*$/, "");
  const where = [
    doc.source,
    [year, doc.volume && `;${doc.volume}`, doc.issue && `(${doc.issue})`, doc.pages && `:${doc.pages}`]
      .filter(Boolean)
      .join(""),
  ]
    .filter(Boolean)
    .join(". ");

  const doi =
    parsed.doi ??
    doc.articleids?.find((x) => x.idtype === "doi")?.value ??
    null;

  return {
    citation: [authors, title, where].filter(Boolean).join(". ") + ".",
    pmid,
    doi,
  };
}
