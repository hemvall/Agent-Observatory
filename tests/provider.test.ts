import test from "node:test";
import assert from "node:assert/strict";
import { resolveProvider } from "../lib/observatory/provider.ts";
import { createRun, executeStep } from "../lib/observatory/engine.ts";

test("Groq selection uses only the Groq key, supports defaults and never falls back when explicitly selected", () => {
  assert.deepEqual(
    resolveProvider({
      GROQ_API_KEY: " groq-test ",
      OPENAI_API_KEY: "openai-test",
    }),
    { provider: "groq", apiKey: "groq-test", model: "openai/gpt-oss-20b" },
  );
  assert.equal(
    resolveProvider({ AI_PROVIDER: "groq", OPENAI_API_KEY: "openai-test" })
      .apiKey,
    undefined,
  );
  assert.equal(
    resolveProvider({
      AI_PROVIDER: "openai",
      GROQ_API_KEY: "groq-test",
      OPENAI_API_KEY: "openai-test",
    }).apiKey,
    "openai-test",
  );
  assert.equal(
    resolveProvider({ GROQ_API_KEY: "   ", OPENAI_API_KEY: "openai-test" })
      .provider,
    "openai",
  );
  assert.equal(
    resolveProvider({
      AI_PROVIDER: "groq",
      GROQ_MODEL: " openai/gpt-oss-120b ",
    }).model,
    "openai/gpt-oss-120b",
  );
  assert.throws(
    () => resolveProvider({ AI_PROVIDER: "untrusted-host" }),
    /AI_PROVIDER/,
  );
});

const input = {
  objective: "Analyser ce document et ses limites.",
  scenario: "documents" as const,
  document: "Checkpoints persistants, tests de reprise à réaliser.",
  repository: "",
  mode: "live" as const,
};
test("Groq analysis uses its endpoint and strict schema, records the actual provider and tokens", async () => {
  const original = globalThis.fetch;
  let url = "",
    authorization = "",
    body: any;
  globalThis.fetch = async (target, options) => {
    url = String(target);
    authorization = new Headers(options?.headers).get("Authorization") || "";
    body = JSON.parse(String(options?.body));
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              findings: [
                {
                  title: "Reprise",
                  detail: "Tests de panne à confirmer.",
                  severity: "warning",
                  sourceIds: ["S1"],
                },
              ],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 55, completion_tokens: 26 },
    });
  };
  try {
    const run = createRun({ ...input }, true);
    run.cursor = 2;
    run.sources = [{ id: "S1", name: "spec.md", content: input.document }];
    const result = await executeStep(
      run,
      resolveProvider({ GROQ_API_KEY: "groq-test" }),
    );
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(authorization, "Bearer groq-test");
    assert.equal(body.model, "openai/gpt-oss-20b");
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(result.provider, "groq");
    assert.equal(result.traces[0].tokens, 81);
    assert.equal((result.traces[0].input as any).provider, "groq");
    assert.equal(JSON.stringify(result).includes("groq-test"), false);
    assert.equal(JSON.stringify(body).includes("groq-test"), false);
    globalThis.fetch = async () => Response.json({}, { status: 429 });
    await assert.rejects(
      () => executeStep(run, resolveProvider({ GROQ_API_KEY: "groq-test" })),
      /Groq.*limite/,
    );
    assert.equal(run.cursor, 2);
    assert.equal(run.findings.length, 0);
  } finally {
    globalThis.fetch = original;
  }
});
