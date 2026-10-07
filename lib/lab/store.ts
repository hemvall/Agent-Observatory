import { env } from "cloudflare:workers";
import { RuntimeError } from "../observatory/engine";
import type { Project, Experiment } from "./types";
function db() {
  if (!env.DB)
    throw new RuntimeError("Le stockage du Lab est indisponible.", 503);
  return env.DB;
}
export async function listProjects() {
  const rows = await db()
    .prepare(
      "SELECT data,revision FROM lab_projects ORDER BY updated_at DESC LIMIT 50",
    )
    .all<{ data: string; revision: number }>();
  return rows.results.map((row) => {
    const p = { ...JSON.parse(row.data), revision: row.revision } as Project;
    return {
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      versions: p.versions.length,
      documents: p.documents.length,
      tests: p.tests.length,
    };
  });
}
export async function getProject(id: string): Promise<Project> {
  const row = await db()
    .prepare("SELECT data,revision FROM lab_projects WHERE id = ?")
    .bind(id)
    .first<{ data: string; revision: number }>();
  if (!row) throw new RuntimeError("Projet introuvable.", 404);
  return { ...JSON.parse(row.data), revision: row.revision };
}
export async function insertProject(p: Project) {
  await db()
    .prepare(
      "INSERT INTO lab_projects (id,data,revision,updated_at) VALUES (?,?,0,?)",
    )
    .bind(p.id, JSON.stringify(p), p.updatedAt)
    .run();
  return p;
}
export async function saveProject(p: Project, revision: number) {
  const result = await db()
    .prepare(
      "UPDATE lab_projects SET data = ?,revision = ?,updated_at = ? WHERE id = ? AND revision = ?",
    )
    .bind(JSON.stringify(p), p.revision, p.updatedAt, p.id, revision)
    .run();
  if (!result.meta.changes)
    throw new RuntimeError(
      "Le projet a changé. Recharge-le avant de sauvegarder.",
      409,
    );
  return p;
}
export async function listExperiments(projectId: string) {
  const rows = await db()
    .prepare(
      "SELECT data,revision,locked_until FROM lab_experiments WHERE project_id = ? ORDER BY updated_at DESC LIMIT 30",
    )
    .bind(projectId)
    .all<{ data: string; revision: number; locked_until: number }>();
  return rows.results.map((row) => {
    const e = JSON.parse(row.data) as Experiment;
    return {
      id: e.id,
      status: e.status,
      kind: e.kind,
      mode: e.mode,
      createdAt: e.createdAt,
      jobs: e.jobs.length,
      finished: e.jobs.filter((j) => ["failed", "completed"].includes(j.status))
        .length,
    };
  });
}
export async function getExperiment(id: string): Promise<Experiment> {
  const row = await db()
    .prepare(
      "SELECT data,revision,locked_until FROM lab_experiments WHERE id = ?",
    )
    .bind(id)
    .first<{ data: string; revision: number; locked_until: number }>();
  if (!row) throw new RuntimeError("Expérience introuvable.", 404);
  return {
    ...JSON.parse(row.data),
    revision: row.revision,
    lockedUntil: row.locked_until,
  };
}
export async function insertExperiment(e: Experiment) {
  await db()
    .prepare(
      "INSERT INTO lab_experiments (id,project_id,data,revision,updated_at,locked_until) VALUES (?,?,?,0,?,0)",
    )
    .bind(e.id, e.projectId, JSON.stringify(e), e.updatedAt)
    .run();
  return e;
}
export async function saveExperiment(e: Experiment, revision: number) {
  e.revision = revision + 1;
  const result = await db()
    .prepare(
      "UPDATE lab_experiments SET data = ?,revision = ?,updated_at = ?,locked_until = ? WHERE id = ? AND revision = ?",
    )
    .bind(
      JSON.stringify(e),
      e.revision,
      e.updatedAt,
      e.lockedUntil,
      e.id,
      revision,
    )
    .run();
  if (!result.meta.changes)
    throw new RuntimeError(
      "L’expérience a changé. Son état est actualisé.",
      409,
    );
  return e;
}
export async function lease(e: Experiment) {
  const until = Date.now() + 180000;
  const result = await db()
    .prepare(
      "UPDATE lab_experiments SET revision = revision + 1,locked_until = ? WHERE id = ? AND revision = ? AND locked_until <= ?",
    )
    .bind(until, e.id, e.revision, Date.now())
    .run();
  if (!result.meta.changes)
    throw new RuntimeError("Une étape est déjà en cours.", 409);
  return { ...e, revision: e.revision + 1, lockedUntil: until };
}
