import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  executeStep,
  transition,
  evidenceChecks,
  deterministicFindings,
  repositoryName,
} from "../lib/observatory/engine.ts";
import type { Run } from "../lib/observatory/types.ts";
const input = {
  objective: "Auditer les garanties de ce runtime.",
  scenario: "architecture" as const,
  mode: "demo" as const,
  repository: "",
  document: "",
};
test("full mission stops at approval, resumes and produces referenced artifacts without tokens", async () => {
  let run = createRun({ ...input }, false);
  for (let i = 0; i < 4; i++) run = await executeStep(run);
  assert.equal(run.status, "waiting");
  assert.equal(run.cursor, 4);
  assert.equal(run.traces.length, 4);
  await assert.rejects(() => executeStep(run));
  const checkpoint = JSON.parse(JSON.stringify(run)) as Run;
  run = transition(checkpoint, "approve");
  while (run.status === "running") run = await executeStep(run);
  assert.equal(run.status, "completed");
  assert.equal(run.cursor, 7);
  assert.equal(run.traces.length, 7);
  assert.ok(run.report.includes("Sources"));
  assert.ok(run.report.includes("[S1]"));
  assert.ok(run.checks.every((c) => c.passed));
  assert.equal(run.inputTokens + run.outputTokens, 0);
});
test("pause survives serialization and resume retains the cursor and evidence", async () => {
  let run = await executeStep(createRun({ ...input }, false));
  run = transition(run, "pause");
  await assert.rejects(() => executeStep(run));
  const restored = JSON.parse(JSON.stringify(run)) as Run;
  const resumed = transition(restored, "resume");
  assert.equal(resumed.cursor, 1);
  assert.deepEqual(resumed.traces, run.traces);
  assert.equal((await executeStep(resumed)).sources.length, 4);
});
test("cancellation and premature approvals cannot bypass the state machine", () => {
  const run = createRun({ ...input }, false);
  assert.throws(() => transition(run, "approve"));
  const cancelled = transition(run, "cancel");
  assert.equal(cancelled.status, "cancelled");
  assert.throws(() => transition(cancelled, "resume"));
});
test("the evidence gate refuses missing and unknown citations", () => {
  const run = createRun({ ...input }, false);
  run.sources = [{ id: "S1", name: "source", content: "Document réel." }];
  run.findings = [
    {
      title: "Unsupported",
      detail: "Claim",
      severity: "info",
      sourceIds: ["S404"],
    },
  ];
  assert.equal(evidenceChecks(run)[1].passed, false);
  run.findings[0].sourceIds = [];
  assert.equal(evidenceChecks(run)[1].passed, false);
});
test("live mode never silently falls back to the demo engine", () => {
  assert.throws(() => createRun({ ...input, mode: "live" }, false), /clé API/);
});
test("unmatched documents return an explicit limited-analysis finding", () => {
  const findings = deterministicFindings(
    [{ id: "S1", name: "text", content: "Le soleil se couche sur la mer." }],
    "documents",
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0].title, /limitée/);
  assert.deepEqual(findings[0].sourceIds, ["S1"]);
});
test("repository input cannot become an arbitrary network destination", () => {
  assert.equal(
    repositoryName("https://github.com/hemvall/avatar-lab.git"),
    "hemvall/avatar-lab",
  );
  for (const value of [
    "https://example.org/a/b",
    "a/b/../../secrets",
    "a/b?ref=evil",
    "a/b/c",
    "a\\b",
  ])
    assert.throws(() => repositoryName(value));
});
test("provider failures preserve the original checkpoint", async () => {
  let run = createRun({ ...input, mode: "live" }, true);
  run.cursor = 2;
  run.sources = [{ id: "S1", name: "doc", content: "Checkpoint persistant." }];
  const before = structuredClone(run);
  await assert.rejects(() => executeStep(run, {}));
  assert.deepEqual(run, before);
});
test("live analysis uses provider-reported tokens and rejects invented source IDs", async () => {
  const original = globalThis.fetch;
  let captured: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    captured = JSON.parse(String(init?.body));
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              findings: [
                {
                  title: "Reprise",
                  detail: "Checkpoint documenté, tests de panne à confirmer.",
                  severity: "info",
                  sourceIds: ["S1"],
                },
              ],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 40 },
    });
  };
  try {
    const run = createRun({ ...input, mode: "live" }, true);
    run.cursor = 2;
    run.sources = [
      { id: "S1", name: "design.md", content: "Checkpoint persistant." },
    ];
    const next = await executeStep(run, {
      apiKey: "test-key",
      model: "test-model",
    });
    assert.equal(next.model, "test-model");
    assert.equal(next.inputTokens, 100);
    assert.equal(next.outputTokens, 40);
    assert.equal(next.traces[0].tokens, 140);
    assert.equal(JSON.stringify(captured).includes("test-key"), false);
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                findings: [
                  {
                    title: "Unknown",
                    detail: "Claim",
                    severity: "warning",
                    sourceIds: ["S404"],
                  },
                ],
              }),
            },
          },
        ],
      });
    await assert.rejects(
      () => executeStep(run, { apiKey: "test-key" }),
      /source inexistante/,
    );
    assert.equal(run.findings.length, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("repository collection pins blobs and citations to one commit", async () => {
  const { readRepository } = await import("../lib/observatory/engine.ts");
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    if (url.endsWith("/repos/owner/repo"))
      return Response.json({ default_branch: "main" });
    if (url.endsWith("/commits/main"))
      return Response.json({
        sha: "commit123",
        commit: { tree: { sha: "tree123" } },
      });
    if (url.endsWith("/git/trees/tree123?recursive=1"))
      return Response.json({
        sha: "tree123",
        truncated: false,
        tree: [
          { path: "README.md", type: "blob", size: 100, sha: "blob123" },
          { path: "malicious.exe", type: "blob", size: 1, sha: "ignored" },
        ],
      });
    if (url.endsWith("/git/blobs/blob123"))
      return Response.json({
        content: btoa("Checkpoints and human approval."),
        encoding: "base64",
      });
    throw new Error("Unexpected network request");
  };
  try {
    const sources = await readRepository("owner/repo");
    assert.equal(sources.length, 1);
    assert.equal(sources[0].sha, "blob123");
    assert.equal(
      sources[0].url,
      "https://github.com/owner/repo/blob/commit123/README.md",
    );
    assert.match(sources[0].content, /Checkpoints/);
    assert.equal(
      requested.some((u) => u.includes("ignored")),
      false,
    );
  } finally {
    globalThis.fetch = original;
  }
});
