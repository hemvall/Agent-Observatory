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
              overview: {
                summary:
                  "Le projet documente un mécanisme de reprise persistant dont le comportement en cas de panne doit être vérifié.",
                strengths: ["La reprise est explicitement documentée."],
                limitations: ["Les tests ne sont pas exécutés."],
              },
              findings: [
                {
                  title: "Reprise",
                  detail: "Tests de panne à confirmer.",
                  severity: "warning",
                  sourceIds: ["S1"],
                  action:
                    "Ajouter un test de reprise après une panne et vérifier le checkpoint enregistré.",
                  evidence: [{ sourceId: "S1", quote: input.document }],
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
    const waiting = await executeStep(
      run,
      resolveProvider({ GROQ_API_KEY: "groq-test" }),
    );
    assert.equal(waiting.cursor, 2);
    assert.ok(waiting.analysisProgress!.nextAttemptAt > Date.now());
    assert.equal(waiting.status, "running");
    assert.equal(run.cursor, 2);
    assert.equal(run.findings.length, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("413 reduces the batch without losing its position, then resumes all content with cumulative usage", async () => {
  const original = globalThis.fetch;
  const { analysisBatch, transition } =
    await import("../lib/observatory/engine.ts");
  const contents = Array.from(
    { length: 400 },
    (_, i) => `const permission${i} = user.isAdmin;\n`,
  ).join("");
  let first = true;
  const sent: string[] = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.max_completion_tokens, 3000);
    assert.equal(body.reasoning_effort, "low");
    if (first) {
      first = false;
      return Response.json({}, { status: 413 });
    }
    const payload = JSON.parse(body.messages[1].content);
    const docs = payload.documents;
    assert.equal(new Set(docs.map((s: any) => s.id)).size, docs.length);
    assert.ok(
      docs.reduce((n: number, s: any) => n + s.content.length, 0) <= 3000,
    );
    sent.push(...docs.map((s: any) => s.content));
    const quote = docs[0].content.split("\n")[0];
    return Response.json(
      {
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                overview: {
                  summary:
                    "Ce lot contient des contrôles de permission basés sur le rôle de l’utilisateur.",
                  strengths: ["Un contrôle est présent."],
                  limitations: ["Pas de tests exécutés."],
                },
                findings: [
                  {
                    title: quote,
                    detail:
                      "Le rôle pilote la permission ; sa provenance doit être vérifiée.",
                    severity: "warning",
                    sourceIds: [docs[0].id],
                    action:
                      "Ajouter un test du contrôle avec un utilisateur sans permission et vérifier le refus.",
                    evidence: [{ sourceId: docs[0].id, quote }],
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10 },
      },
      { headers: { "x-ratelimit-reset-tokens": "1m2s" } },
    );
  };
  try {
    let run = createRun({ ...input }, true);
    run.cursor = 2;
    run.sources = [{ id: "S1", name: "auth.ts", content: contents }];
    const before = structuredClone(run);
    run = await executeStep(run, { provider: "groq", apiKey: "test" });
    assert.deepEqual(before.sources, run.sources);
    assert.equal(run.cursor, 2);
    assert.equal(run.analysisProgress?.budget, 3000);
    assert.equal(run.analysisProgress?.offset, 0);
    const config = { provider: "groq" as const, apiKey: "test" };
    run = await executeStep(run, config);
    assert.equal(run.analysisProgress?.completed, 1);
    assert.ok(run.analysisProgress!.nextAttemptAt >= Date.now() + 60000);
    const saved = JSON.parse(JSON.stringify(transition(run, "pause")));
    assert.equal(saved.analysisProgress.offset, run.analysisProgress?.offset);
    run = transition(saved, "resume");
    await assert.rejects(() => executeStep(run, config), /quota Groq/);
    const batch = analysisBatch(
      run.sources,
      run.analysisProgress!.sourceIndex,
      run.analysisProgress!.offset,
      3000,
    );
    assert.ok(batch.documents[0].startLine! > 1);
    while (run.cursor === 2) {
      run.analysisProgress!.nextAttemptAt = 0;
      run = await executeStep(run, config);
    }
    assert.equal(sent.join(""), contents);
    assert.equal(run.cursor, 3);
    assert.equal(run.inputTokens, 20 * sent.length);
    assert.equal(run.outputTokens, 10 * sent.length);
    const proof = run.findings.at(-1)!.evidence![0];
    assert.equal(contents.split("\n")[proof.line - 1], proof.quote);
    assert.equal(run.analysisProgress!.nextAttemptAt, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("429 respects Retry-After while 401 does not trigger size or quota retries", async () => {
  const original = globalThis.fetch;
  const config = { provider: "groq" as const, apiKey: "secret-for-test" };
  let run = createRun({ ...input }, true);
  run.cursor = 2;
  run.sources = [{ id: "S1", name: "spec.md", content: input.document }];
  try {
    globalThis.fetch = async () =>
      Response.json(
        { error: { message: "secret-for-test" } },
        { status: 429, headers: { "retry-after": "120" } },
      );
    const waiting = await executeStep(run, config);
    assert.equal(waiting.status, "running");
    assert.equal(waiting.analysisProgress!.retries, 1);
    assert.ok(waiting.analysisProgress!.nextAttemptAt >= Date.now() + 119000);
    assert.equal(JSON.stringify(waiting).includes("secret-for-test"), false);
    globalThis.fetch = async () => Response.json({}, { status: 401 });
    await assert.rejects(() => executeStep(run, config), /refuse la clé API/);
    assert.equal(run.analysisProgress, undefined);
    globalThis.fetch = async () => Response.json({}, { status: 413 });
    run.analysisProgress = {
      sourceIndex: 0,
      offset: 0,
      budget: 1000,
      completed: 0,
      retries: 0,
      nextAttemptAt: 0,
    };
    await assert.rejects(() => executeStep(run, config), /lot trop volumineux/);
    assert.equal(run.cursor, 2);
  } finally {
    globalThis.fetch = original;
  }
});
