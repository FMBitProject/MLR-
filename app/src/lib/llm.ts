// Provider-agnostic LLM helper for the assistive AI features (claims
// adjudication, journal substantiation, SOP extraction). One place decides
// which provider to call, chosen entirely by environment variables so no code
// change is needed to switch between free and paid backends.
//
// Supported (first key found wins; AI_PROVIDER can force one):
//   GROQ_API_KEY    → Groq, free tier, base https://api.groq.com/openai/v1
//                     default model llama-3.3-70b-versatile
//   XAI_API_KEY     → xAI Grok, base https://api.x.ai/v1
//                     default model grok-3-mini
//   OPENAI_API_KEY  → OpenAI, base https://api.openai.com/v1, default gpt-4o-mini
//   ANTHROPIC_API_KEY → Anthropic, default claude-haiku-4-5
//   AI_BASE_URL + AI_API_KEY → any OpenAI-compatible endpoint (OpenRouter,
//                     Ollama, etc.)
// Override the model anywhere with AI_MODEL.

export type LlmProvider = {
  kind: "groq" | "xai" | "openai" | "anthropic" | "custom";
  label: string;
  model: string;
};

export function getLlmProvider(): LlmProvider | null {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  const model = process.env.AI_MODEL;

  const pick = (
    kind: LlmProvider["kind"],
    label: string,
    defaultModel: string,
  ): LlmProvider => ({ kind, label, model: model || defaultModel });

  if ((forced === "groq" || !forced) && process.env.GROQ_API_KEY)
    return pick("groq", "Groq", "llama-3.3-70b-versatile");
  if ((forced === "xai" || !forced) && process.env.XAI_API_KEY)
    return pick("xai", "xAI Grok", "grok-3-mini");
  if ((forced === "openai" || !forced) && process.env.OPENAI_API_KEY)
    return pick("openai", "OpenAI", "gpt-4o-mini");
  if ((forced === "anthropic" || !forced) && process.env.ANTHROPIC_API_KEY)
    return pick("anthropic", "Anthropic Claude", "claude-haiku-4-5");
  if (process.env.AI_BASE_URL && process.env.AI_API_KEY)
    return pick("custom", "Custom (OpenAI-compatible)", model || "");
  return null;
}

function openAiCompatConfig(p: LlmProvider): { baseUrl: string; apiKey: string } | null {
  switch (p.kind) {
    case "groq":
      return { baseUrl: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY! };
    case "xai":
      return { baseUrl: "https://api.x.ai/v1", apiKey: process.env.XAI_API_KEY! };
    case "openai":
      return { baseUrl: "https://api.openai.com/v1", apiKey: process.env.OPENAI_API_KEY! };
    case "custom":
      return { baseUrl: process.env.AI_BASE_URL!, apiKey: process.env.AI_API_KEY! };
    default:
      return null;
  }
}

/**
 * Single completion. Returns the assistant text, or null on any failure so
 * callers fall back to their non-AI path silently (AI is always optional).
 */
export async function llmComplete(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  /** hint that the reply should be JSON (enables json mode where supported) */
  json?: boolean;
}): Promise<string | null> {
  const provider = getLlmProvider();
  if (!provider) return null;
  const maxTokens = opts.maxTokens ?? 400;

  try {
    if (provider.kind === "anthropic") {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic();
      const res = await client.messages.create({
        model: provider.model,
        max_tokens: maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      });
      const block = res.content[0];
      return block?.type === "text" ? block.text : null;
    }

    const cfg = openAiCompatConfig(provider);
    if (!cfg) return null;
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        temperature: 0,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
