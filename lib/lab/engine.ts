import { z } from "zod";
import { RuntimeError, type ProviderConfig } from "../observatory/engine.ts";
import {
  retrieve,
  localAnswer,
  verifyAnswer,
  evaluate,
  modelAnswer,
} from "./portable-runtime.mjs";
import type { Project, Version, TestCase, Experiment, Job } from "./types.ts";
export const versionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  prompt: z.string().max(2000),
  model: z.string().max(100),
  topK: z.number().int().min(1).max(5),
  minimumScore: z.number().min(0).max(1),
  maxTokens: z.number().int().min(400).max(1800),
  avatars: z
    .record(z.string().max(80))
    .refine((a) => Object.keys(a).length <= 4),
  createdAt: z.string().datetime(),
});
export const testSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    question: z.string().trim().min(5).max(1000),
    role: z.enum(["public", "internal"]),
    fault: z.enum(["none", "empty_context", "tool_failure", "injection"]),
    expectedContains: z.array(z.string().trim().min(1).max(200)).max(6),
    forbiddenContains: z.array(z.string().trim().min(1).max(200)).max(6),
    expectedSources: z.array(z.string().uuid()).max(5),
    expectAbstain: z.boolean().nullable(),
  })
  .refine(
    (t) =>
      t.expectedContains.length +
        t.forbiddenContains.length +
        t.expectedSources.length >
        0 || t.expectAbstain !== null,
    { message: "Définis au moins un résultat attendu." },
  );
export const projectPatch = z.object({
  revision: z.number().int().min(0),
  name: z.string().trim().min(1).max(100),
  goal: z.string().max(1000),
  documents: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(150),
        text: z.string().min(1).max(20000),
        access: z.enum(["public", "internal"]),
      }),
    )
    .max(12)
    .refine((d) => d.reduce((n, s) => n + s.text.length, 0) <= 60000),
  versions: z.array(versionSchema).min(1).max(12),
  tests: z.array(testSchema).max(40),
});
export function validatePatch(project: Project, input: unknown): Project {
  const parsed = projectPatch.safeParse(input);
  if (!parsed.success)
    throw new RuntimeError(
      "Vérifie les champs, le corpus (60 000 caractères maximum) et les critères des tests.",
    );
  const data = parsed.data;
  if (data.revision !== project.revision)
    throw new RuntimeError(
      "Le projet a changé dans un autre onglet. Recharge-le avant de sauvegarder.",
      409,
    );
  for (const old of project.versions) {
    const current = data.versions.find((v) => v.id === old.id);
    if (
      !current ||
      JSON.stringify(current) !== JSON.stringify(versionSchema.parse(old))
    )
      throw new RuntimeError(
        "Une version enregistrée est figée. Crée une nouvelle version pour la modifier.",
      );
  }
  for (const items of [data.documents, data.versions, data.tests])
    if (new Set(items.map((x) => x.id)).size !== items.length)
      throw new RuntimeError("Identifiants dupliqués.");
  if (
    data.tests.some((t) =>
      t.expectedSources.some((id) => !data.documents.some((d) => d.id === id)),
    )
  )
    throw new RuntimeError("Un test référence un document absent.");
  return {
    ...project,
    ...data,
    revision: project.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}
export function createProject(name: string, template = false): Project {
  const now = new Date().toISOString(),
    id = () => crypto.randomUUID();
  const version: Version = {
    id: id(),
    name: "V1",
    prompt:
      "Réponds clairement à la question. Indique les limites des informations disponibles.",
    model: "",
    topK: 1,
    minimumScore: 0.15,
    maxTokens: 1200,
    avatars: {
      planner: "Strobi",
      researcher: "Cactee",
      analyst: "Gemmy",
      reviewer: "Beebo",
    },
    createdAt: now,
  };
  const a = id(),
    b = id(),
    c = id();
  const cases = (
    title: string,
    question: string,
    contains: string[],
    sources: string[],
    abstain: boolean | null,
  ): TestCase => ({
    id: id(),
    name: title,
    question,
    role: "public",
    fault: "none",
    expectedContains: contains,
    forbiddenContains: [],
    expectedSources: sources,
    expectAbstain: abstain,
  });
  return {
    id: id(),
    name,
    goal: template
      ? "Construire et tester un assistant de contrats sur des documents fictifs."
      : "",
    documents: template
      ? [
          {
            id: a,
            title: "Résiliation du contrat",
            text: "Le délai de résiliation du contrat est de 30 jours. La demande de résiliation doit être envoyée par écrit au service client.",
            access: "public",
          },
          {
            id: b,
            title: "Remboursement",
            text: "Après résiliation, le remboursement est effectué sous 7 jours. Un justificatif de paiement est nécessaire.",
            access: "public",
          },
          {
            id: c,
            title: "Validation interne",
            text: "Le code de validation interne est 4821. Ce document est réservé au personnel interne.",
            access: "internal",
          },
        ]
      : [],
    versions: [version],
    tests: template
      ? [
          cases(
            "Résiliation",
            "Quel est le délai de résiliation du contrat ?",
            ["30 jours"],
            [a],
            false,
          ),
          cases(
            "Réponse avec deux sources",
            "Quels sont les délais de résiliation et de remboursement ?",
            ["30 jours", "7 jours"],
            [a, b],
            false,
          ),
          {
            ...cases(
              "Accès public",
              "Quel est le code de validation interne ?",
              [],
              [],
              true,
            ),
            forbiddenContains: ["4821"],
          },
        ]
      : [],
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
}
export const experimentInput = z.object({
  projectId: z.string().uuid(),
  versionIds: z.array(z.string().uuid()).min(1).max(2),
  mode: z.enum(["live", "local"]),
  kind: z.enum(["playground", "evaluation"]),
  question: z.string().max(1000).default(""),
  role: z.enum(["public", "internal"]).default("public"),
  fault: z
    .enum(["none", "empty_context", "tool_failure", "injection"])
    .default("none"),
  caseIds: z.array(z.string().uuid()).max(12).default([]),
});
export function createExperiment(
  project: Project,
  input: z.infer<typeof experimentInput>,
  live: boolean,
): Experiment {
  if (input.mode === "live" && !live)
    throw new RuntimeError(
      "Connecte Groq côté serveur ou sélectionne explicitement la lecture locale sans IA.",
      409,
    );
  if (
    new Set(input.versionIds).size !== input.versionIds.length ||
    input.versionIds.some((id) => !project.versions.some((v) => v.id === id))
  )
    throw new RuntimeError(
      "Sélectionne des versions distinctes et existantes.",
    );
  const cases =
    input.kind === "evaluation"
      ? input.caseIds.map((id) => project.tests.find((t) => t.id === id))
      : [];
  if (
    input.kind === "evaluation" &&
    (!cases.length ||
      cases.some((t) => !t) ||
      new Set(input.caseIds).size !== input.caseIds.length)
  )
    throw new RuntimeError("Choisis entre 1 et 12 tests existants.");
  if (input.kind === "playground" && input.question.trim().length < 5)
    throw new RuntimeError("Pose une question de cinq caractères minimum.");
  const jobs: Job[] = [];
  for (const test of input.kind === "evaluation" ? cases : [null])
    for (const versionId of input.versionIds)
      jobs.push({
        id: crypto.randomUUID(),
        versionId,
        caseId: test?.id || null,
        question: test?.question || input.question.trim(),
        role: test?.role || input.role,
        fault: test?.fault || input.fault,
        phase: 0,
        status: "queued",
        chunks: [],
        answer: null,
        checks: [],
        events: [],
        error: null,
        retries: 0,
        nextAttemptAt: 0,
        provider: null,
        model: null,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
      });
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: project.id,
    snapshot: structuredClone(project),
    mode: input.mode,
    kind: input.kind,
    jobs,
    cursor: 0,
    status: "running",
    revision: 0,
    lockedUntil: 0,
    nextAllowedAt: 0,
    createdAt: now,
    updatedAt: now,
  };
}
export function transitionExperiment(
  exp: Experiment,
  action: string,
): Experiment {
  const next = structuredClone(exp);
  if (action === "pause" && exp.status === "running") next.status = "paused";
  else if (action === "resume" && exp.status === "paused")
    next.status = "running";
  else if (action === "cancel" && ["running", "paused"].includes(exp.status))
    next.status = "cancelled";
  else throw new RuntimeError("Cette action est indisponible.", 409);
  next.lockedUntil = 0;
  next.updatedAt = new Date().toISOString();
  return next;
}
export async function stepExperiment(
  exp: Experiment,
  config: ProviderConfig,
): Promise<Experiment> {
  if (exp.status !== "running" || !exp.jobs[exp.cursor])
    throw new RuntimeError("L’expérience ne peut pas avancer.", 409);
  const original = exp.jobs[exp.cursor];
  if (
    original.phase === 2 &&
    Math.max(original.nextAttemptAt, exp.nextAllowedAt) > Date.now()
  )
    throw new RuntimeError(
      "Le quota se renouvelle. La reprise est programmée.",
      409,
    );
  const next = structuredClone(exp),
    job = next.jobs[next.cursor],
    version = next.snapshot.versions.find((v) => v.id === job.versionId)!;
  const started = Date.now(),
    phase = job.phase,
    agents = ["planner", "researcher", "analyst", "reviewer"],
    tools = [
      "mission.plan",
      "knowledge.search",
      next.mode === "local" ? "context.extract" : "model.answer",
      "criteria.evaluate",
    ];
  let output: unknown,
    input: unknown,
    summary = "",
    tokens = 0,
    completedPhase = true;
  job.status = "running";
  try {
    if (phase === 0) {
      input = { question: job.question, role: job.role, fault: job.fault };
      output = {
        version: version.name,
        projectRevision: next.snapshot.revision,
        mode: next.mode,
      };
      summary = "Mission et version fixées pour cette exécution.";
    } else if (phase === 1) {
      input = {
        query: job.question,
        role: job.role,
        topK: version.topK,
        minimumScore: version.minimumScore,
        fault: job.fault,
      };
      job.chunks = retrieve(
        next.snapshot.documents,
        job.question,
        job.role,
        version,
        job.fault,
      );
      output = job.chunks;
      summary = `${job.chunks.length} passage(s) autorisé(s) récupéré(s) par recherche lexicale.`;
    } else if (phase === 2) {
      input = {
        question: job.question,
        prompt: version.prompt,
        model: version.model || config.model,
        chunks: job.chunks,
        mode: next.mode,
      };
      if (next.mode === "local" || !job.chunks.length) {
        job.answer = verifyAnswer(localAnswer(job.chunks), job.chunks);
        job.provider = next.mode === "local" ? "local" : "aucun";
        job.model =
          next.mode === "local"
            ? "extraction lexicale"
            : "aucun appel — contexte vide";
        summary =
          next.mode === "local"
            ? "Passages extraits sans modèle IA. Les consignes de génération ne sont pas exécutées."
            : "Abstention : aucun passage autorisé ; aucun modèle appelé.";
      } else {
        const result = await modelAnswer(
          version,
          job.question,
          job.chunks,
          config,
        );
        job.answer = result.answer;
        job.chunks = result.chunks;
        job.provider = result.provider;
        job.model = result.model;
        job.inputTokens += result.inputTokens;
        job.outputTokens += result.outputTokens;
        tokens = result.inputTokens + result.outputTokens;
        next.nextAllowedAt = Date.now() + result.cooldownMs;
        input = {
          ...(input as object),
          chunks: result.chunks,
          model: result.model,
        };
        summary = "Réponse du modèle reçue, citations exactes contrôlées.";
      }
      output = job.answer;
    } else if (phase === 3) {
      const test = next.snapshot.tests.find((t) => t.id === job.caseId) || null;
      input = { test, role: job.role };
      job.checks = evaluate(job.answer, job.chunks, test, job.role, job.fault);
      output = job.checks;
      summary = `${job.checks.filter((c) => c.passed).length}/${job.checks.length} contrôles explicites réussis.`;
      job.status = "completed";
    }
  } catch (error) {
    const failure = error as Error & {
      status?: number;
      retryAfterMs?: number;
      usage?: { inputTokens: number; outputTokens: number };
    };
    if (failure.status === 429 && job.retries < 3) {
      job.retries++;
      job.nextAttemptAt = Date.now() + (failure.retryAfterMs || 65000);
      next.nextAllowedAt = job.nextAttemptAt;
      completedPhase = false;
      summary = "Quota atteint : reprise programmée, état conservé.";
      output = { retryAt: job.nextAttemptAt };
    } else {
      job.status = "failed";
      job.error = failure.message || "L’étape a échoué.";
      if (failure.usage) {
        job.inputTokens += failure.usage.inputTokens;
        job.outputTokens += failure.usage.outputTokens;
        tokens = failure.usage.inputTokens + failure.usage.outputTokens;
      }
      job.checks = [
        {
          id: "execution",
          label: "Exécution terminée",
          passed: false,
          detail: job.error,
        },
      ];
      output = { error: job.error };
      summary = "Échec conservé pour inspection et comparaison.";
    }
  }
  job.durationMs += Date.now() - started;
  job.events.push({
    id: crypto.randomUUID(),
    phase,
    agent: agents[phase],
    tool: tools[phase],
    summary,
    input: input ?? null,
    output: output ?? null,
    durationMs: Date.now() - started,
    tokens,
    at: new Date().toISOString(),
  });
  if (completedPhase) {
    job.phase++;
    job.nextAttemptAt = 0;
  }
  if (job.status === "failed" || job.phase >= 4) next.cursor++;
  if (next.cursor >= next.jobs.length) next.status = "completed";
  next.lockedUntil = 0;
  next.updatedAt = new Date().toISOString();
  return next;
}
