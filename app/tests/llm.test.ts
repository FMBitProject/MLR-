import { withEnv } from "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { getLlmProvider, llmComplete } from "../src/lib/llm.ts";

// Every provider key, so each case starts from a clean slate.
const NO_KEYS = {
  AI_PROVIDER: undefined,
  AI_MODEL: undefined,
  GROQ_API_KEY: undefined,
  XAI_API_KEY: undefined,
  OPENAI_API_KEY: undefined,
  ANTHROPIC_API_KEY: undefined,
  AI_BASE_URL: undefined,
  AI_API_KEY: undefined,
};

test("llm: no keys configured means no provider (AI is always optional)", async () => {
  await withEnv(NO_KEYS, () => assert.equal(getLlmProvider(), null));
});

test("llm: each key selects its provider with the documented default model", async () => {
  const cases = [
    ["GROQ_API_KEY", "groq", "llama-3.3-70b-versatile"],
    ["XAI_API_KEY", "xai", "grok-3-mini"],
    ["OPENAI_API_KEY", "openai", "gpt-4o-mini"],
    ["ANTHROPIC_API_KEY", "anthropic", "claude-haiku-4-5"],
  ] as const;
  for (const [envKey, kind, model] of cases) {
    await withEnv({ ...NO_KEYS, [envKey]: "k" }, () => {
      const p = getLlmProvider()!;
      assert.equal(p.kind, kind);
      assert.equal(p.model, model);
      assert.ok(p.label.length > 0);
    });
  }
});

test("llm: first key wins in the documented precedence order", async () => {
  await withEnv(
    { ...NO_KEYS, GROQ_API_KEY: "k", XAI_API_KEY: "k", OPENAI_API_KEY: "k", ANTHROPIC_API_KEY: "k" },
    () => assert.equal(getLlmProvider()!.kind, "groq"),
  );
  await withEnv({ ...NO_KEYS, XAI_API_KEY: "k", OPENAI_API_KEY: "k" }, () =>
    assert.equal(getLlmProvider()!.kind, "xai"),
  );
  await withEnv({ ...NO_KEYS, OPENAI_API_KEY: "k", ANTHROPIC_API_KEY: "k" }, () =>
    assert.equal(getLlmProvider()!.kind, "openai"),
  );
});

test("llm: AI_PROVIDER forces a specific backend past the precedence order", async () => {
  await withEnv(
    { ...NO_KEYS, AI_PROVIDER: "anthropic", GROQ_API_KEY: "k", ANTHROPIC_API_KEY: "k" },
    () => assert.equal(getLlmProvider()!.kind, "anthropic"),
  );
  await withEnv({ ...NO_KEYS, AI_PROVIDER: "OPENAI", OPENAI_API_KEY: "k" }, () =>
    assert.equal(getLlmProvider()!.kind, "openai", "the forced value is case-insensitive"),
  );
});

test("llm: forcing a provider whose key is absent falls through, not crashes", async () => {
  await withEnv({ ...NO_KEYS, AI_PROVIDER: "groq", OPENAI_API_KEY: "k" }, () => {
    // Groq is forced but unkeyed; no other branch matches a forced value, so
    // only the custom endpoint could answer — and it is not configured.
    assert.equal(getLlmProvider(), null);
  });
});

test("llm: a custom OpenAI-compatible endpoint needs both URL and key", async () => {
  await withEnv({ ...NO_KEYS, AI_BASE_URL: "https://x/v1", AI_API_KEY: "k" }, () =>
    assert.equal(getLlmProvider()!.kind, "custom"),
  );
  await withEnv({ ...NO_KEYS, AI_BASE_URL: "https://x/v1" }, () =>
    assert.equal(getLlmProvider(), null, "URL without a key is not a provider"),
  );
  await withEnv({ ...NO_KEYS, AI_API_KEY: "k" }, () =>
    assert.equal(getLlmProvider(), null, "key without a URL is not a provider"),
  );
});

test("llm: AI_MODEL overrides the default model for any provider", async () => {
  await withEnv({ ...NO_KEYS, GROQ_API_KEY: "k", AI_MODEL: "custom-model-1" }, () =>
    assert.equal(getLlmProvider()!.model, "custom-model-1"),
  );
  await withEnv({ ...NO_KEYS, ANTHROPIC_API_KEY: "k", AI_MODEL: "custom-model-1" }, () =>
    assert.equal(getLlmProvider()!.model, "custom-model-1"),
  );
});

test("llm: llmComplete returns null with no provider, so callers fall back silently", async () => {
  await withEnv(NO_KEYS, async () => {
    assert.equal(await llmComplete({ system: "s", user: "u" }), null);
  });
});

test("llm: an HTTP error from the provider yields null, never a throw", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("boom", { status: 500 })) as typeof fetch;
  try {
    await withEnv({ ...NO_KEYS, GROQ_API_KEY: "k" }, async () => {
      assert.equal(await llmComplete({ system: "s", user: "u" }), null);
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("llm: a network failure yields null, never a throw", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;
  try {
    await withEnv({ ...NO_KEYS, OPENAI_API_KEY: "k" }, async () => {
      assert.equal(await llmComplete({ system: "s", user: "u" }), null);
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("llm: a successful completion returns the assistant text", async () => {
  const realFetch = globalThis.fetch;
  let seen: { url: string; body: Record<string, unknown> } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = { url: String(url), body: JSON.parse(String(init.body)) };
    return Response.json({ choices: [{ message: { content: "CONSISTENT" } }] });
  }) as unknown as typeof fetch;
  try {
    await withEnv({ ...NO_KEYS, GROQ_API_KEY: "k" }, async () => {
      const out = await llmComplete({ system: "s", user: "u", maxTokens: 32, json: true });
      assert.equal(out, "CONSISTENT");
    });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(seen!.url.startsWith("https://api.groq.com/openai/v1"), seen!.url);
  assert.equal(seen!.body.max_tokens, 32);
  assert.equal(seen!.body.temperature, 0, "deterministic output for a compliance tool");
  assert.deepEqual(seen!.body.response_format, { type: "json_object" });
});

test("llm: a malformed response body yields null rather than undefined text", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ unexpected: true })) as typeof fetch;
  try {
    await withEnv({ ...NO_KEYS, OPENAI_API_KEY: "k" }, async () => {
      assert.equal(await llmComplete({ system: "s", user: "u" }), null);
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});
