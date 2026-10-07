import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  validatePatch,
  createExperiment,
  experimentInput,
  stepExperiment,
  transitionExperiment,
} from "../lib/lab/engine.ts";
import {
  retrieve,
  localAnswer,
  verifyAnswer,
  modelAnswer,
} from "../lib/lab/portable-runtime.mjs";
import type { Experiment } from "../lib/lab/types.ts";
const config = { provider: "groq" as const, apiKey: "test-only" };
function input(
  p: ReturnType<typeof createProject>,
  versions = p.versions.map((v) => v.id),
) {
  return experimentInput.parse({
    projectId: p.id,
    versionIds: versions,
    mode: "local",
    kind: "evaluation",
    caseIds: p.tests.map((t) => t.id),
  });
}
async function finish(e: Experiment) {
  while (e.status === "running") e = await stepExperiment(e, {});
  return e;
}
test("saved configurations are immutable and updates require the current project revision", () => {
  const p = createProject("Test", true),
    draft = structuredClone(p);
  draft.versions[0].topK = 3;
  assert.throws(() => validatePatch(p, draft), /figée/);
  assert.throws(() => validatePatch(p, { ...p, revision: 99 }), /autre onglet/);
  const v2 = { ...p.versions[0], id: crypto.randomUUID(), name: "V2", topK: 3 };
  const updated = validatePatch(p, { ...p, versions: [...p.versions, v2] });
  assert.equal(updated.revision, 1);
  assert.equal(p.versions.length, 1);
  const invalid = structuredClone(p);
  invalid.documents = [];
  assert.throws(() => validatePatch(p, invalid), /document absent/);
});
test("local evaluation and comparison execute actual retrieval: extra context fixes the two-source case", async () => {
  const p = createProject("Contracts", true);
  p.versions.push({
    ...p.versions[0],
    id: crypto.randomUUID(),
    name: "V2",
    topK: 3,
  });
  let e = createExperiment(p, input(p), false);
  const snapshot = structuredClone(e.snapshot);
  p.documents[0].text = "Changed after launch";
  assert.deepEqual(e.snapshot, snapshot);
  e = await finish(e);
  assert.equal(e.status, "completed");
  assert.equal(e.jobs.length, 6);
  const counts = p.versions.map(
    (v) =>
      e.jobs.filter(
        (j) =>
          j.versionId === v.id &&
          j.status === "completed" &&
          j.checks.every((c) => c.passed),
      ).length,
  );
  assert.deepEqual(counts, [2, 3]);
  assert.ok(
    e.jobs.every(
      (j) => j.inputTokens + j.outputTokens === 0 && j.events.length === 4,
    ),
  );
  assert.equal(
    e.jobs.find((j) => j.caseId === p.tests[2].id)!.answer!.abstained,
    true,
  );
});
test("public access excludes private text before a model call; role simulation remains explicit", async () => {
  const p = createProject("Test", true),
    v = { ...p.versions[0], topK: 3 };
  const chunks = retrieve(
    p.documents,
    "Quel est le code de validation interne ?",
    "public",
    v,
  );
  assert.equal(chunks.length, 0);
  assert.equal(
    retrieve(
      p.documents,
      "Quel est le code de validation interne ?",
      "internal",
      v,
    ).length,
    1,
  );
  assert.equal(localAnswer(chunks).abstained, true);
});
test("pause/resume preserves phase, retrieval and frozen version; cancelled experiments cannot advance", async () => {
  const p = createProject("Test", true);
  let e = createExperiment(p, input(p), false);
  e = await stepExperiment(e, {});
  e = await stepExperiment(e, {});
  const saved = JSON.parse(
    JSON.stringify(transitionExperiment(e, "pause")),
  ) as Experiment;
  assert.equal(saved.jobs[0].phase, 2);
  assert.ok(saved.jobs[0].chunks.length);
  await assert.rejects(() => stepExperiment(saved, {}), /ne peut pas avancer/);
  const resumed = transitionExperiment(saved, "resume");
  const done = await finish(resumed);
  assert.equal(done.jobs[0].events.length, 4);
  await assert.rejects(() =>
    stepExperiment(transitionExperiment(resumed, "cancel"), {}),
  );
});
test("tool failure is recorded as a failed test rather than fabricated success", async () => {
  const p = createProject("Test", true);
  p.tests = p.tests.slice(0, 1).map((t) => ({ ...t, fault: "tool_failure" }));
  const e = await finish(createExperiment(p, input(p), false));
  assert.equal(e.jobs[0].status, "failed");
  assert.match(e.jobs[0].error!, /Panne simulée/);
  assert.equal(e.jobs[0].checks[0].passed, false);
  assert.equal(e.jobs[0].events.length, 2);
});
test("live mode never falls back to local extraction and exact citations must be present in sent chunks", async () => {
  const p = createProject("Test", true);
  assert.throws(
    () => createExperiment(p, { ...input(p), mode: "live" }, false),
    /Connecte Groq/,
  );
  const chunks = retrieve(
    p.documents,
    p.tests[0].question,
    "public",
    p.versions[0],
  );
  assert.throws(
    () =>
      verifyAnswer(
        {
          answer: "Invented",
          abstained: false,
          citations: [{ chunkId: chunks[0].id, quote: "invented evidence" }],
        },
        chunks,
      ),
    /absente/,
  );
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(JSON.stringify(body).includes("4821"), false);
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              answer: "Le délai est de 30 jours.",
              abstained: false,
              citations: [
                {
                  chunkId: chunks[0].id,
                  quote: "Le délai de résiliation du contrat est de 30 jours.",
                },
              ],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 200, completion_tokens: 50 },
    });
  };
  try {
    let e = createExperiment(
      p,
      {
        ...input(p),
        mode: "live",
        kind: "playground",
        question: p.tests[0].question,
      },
      true,
    );
    e = await stepExperiment(e, config);
    e = await stepExperiment(e, config);
    e = await stepExperiment(e, config);
    assert.equal(e.jobs[0].inputTokens, 200);
    assert.equal(e.jobs[0].provider, "groq");
    assert.ok(!JSON.stringify(e).includes("test-only"));
    e = await stepExperiment(e, config);
    assert.equal(e.status, "completed");
  } finally {
    globalThis.fetch = original;
  }
});
test("429 schedules a persistent retry without advancing the generation phase or acquiring an endless retry loop", async () => {
  const p = createProject("Test", true);
  let e = createExperiment(
    p,
    { ...input(p), mode: "live", caseIds: [p.tests[0].id] },
    true,
  );
  e = await stepExperiment(e, config);
  e = await stepExperiment(e, config);
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({}, { status: 429, headers: { "retry-after": "90" } });
  try {
    e = await stepExperiment(e, config);
    assert.equal(e.jobs[0].phase, 2);
    assert.equal(e.status, "running");
    assert.ok(e.nextAllowedAt > Date.now() + 89000);
    await assert.rejects(() => stepExperiment(e, config), /quota/);
    for (let i = 0; i < 3; i++) {
      e.nextAllowedAt = 0;
      e.jobs[0].nextAttemptAt = 0;
      e = await stepExperiment(e, config);
    }
    assert.equal(e.jobs[0].status, "failed");
    assert.equal(e.status, "completed");
    assert.equal(e.jobs[0].retries, 3);
  } finally {
    globalThis.fetch = original;
  }
});
test("413 reduction reports the actual smaller context, and rejected answers still record provider-reported tokens", async () => {
  const p = createProject("Test", true),
    v = { ...p.versions[0], topK: 3 };
  const chunks = retrieve(
    p.documents,
    "Quels sont les délais de résiliation et remboursement ?",
    "public",
    v,
  );
  const original = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async (_url, options) => {
    attempts++;
    if (attempts === 1) return Response.json({}, { status: 413 });
    const body = JSON.parse(String(options?.body)),
      sent = JSON.parse(body.messages[1].content).passages;
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              answer: sent[0].text,
              abstained: false,
              citations: [{ chunkId: sent[0].chunkId, quote: sent[0].text }],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 30 },
    });
  };
  try {
    const result = await modelAnswer(v, "Question", chunks, config);
    assert.equal(attempts, 2);
    assert.ok(result.chunks.length < chunks.length);
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          { finish_reason: "length", message: { content: "incomplete" } },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 80 },
      });
    let e = createExperiment(
      p,
      { ...input(p), mode: "live", caseIds: [p.tests[0].id] },
      true,
    );
    e = await stepExperiment(e, config);
    e = await stepExperiment(e, config);
    e = await stepExperiment(e, config);
    assert.equal(e.jobs[0].status, "failed");
    assert.equal(e.jobs[0].inputTokens + e.jobs[0].outputTokens, 200);
  } finally {
    globalThis.fetch = original;
  }
});
