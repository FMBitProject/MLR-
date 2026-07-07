// Extracts candidate claims from an SOP / label / reference document so the
// compliance admin can import them into the Claims Library. AI-assisted and
// strictly propositional: the system only PROPOSES candidates — a human picks
// which ones become approved claims (consistent with PRD §6 AI positioning).

function heuristicCandidates(text: string): string[] {
  const sentences = text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.replace(/^[\d.\-•)\s]+/, "").trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sentences) {
    if (s.length < 30 || s.length > 300) continue;
    if (s.split(/\s+/).length < 6) continue;
    if (/^(bab|pasal|lampiran|daftar isi|tujuan|ruang lingkup|referensi|revisi)\b/i.test(s)) continue;
    if (/^sop[\s\-–—:]/i.test(s) || /\brev\.?\s*\d/i.test(s)) continue; // document headers
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= 20) break;
  }
  return out;
}

async function claudeCandidates(text: string): Promise<string[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system:
        'Extract product claims from a pharmaceutical SOP/label/reference document. A claim is a statement about a product\'s efficacy, safety, indication, dosing, or usage that promotional material might reference. Return ONLY a JSON array of strings, each a single self-contained claim in the document\'s original language, verbatim or minimally normalized. Maximum 20. If none, return []. Do not invent claims that are not in the document.',
      messages: [{ role: "user", content: text.slice(0, 30_000) }],
    });
    const block = response.content[0];
    if (block?.type !== "text") return null;
    const match = block.text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;
    return arr.filter((x): x is string => typeof x === "string" && x.length > 10).slice(0, 20);
  } catch {
    return null;
  }
}

export async function extractClaimCandidates(text: string): Promise<{
  candidates: string[];
  engine: "claude" | "heuristic";
}> {
  const viaClaude = await claudeCandidates(text);
  if (viaClaude && viaClaude.length) return { candidates: viaClaude, engine: "claude" };
  return { candidates: heuristicCandidates(text), engine: "heuristic" };
}
