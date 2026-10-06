import { env } from "cloudflare:workers";
import type { Run } from "./types";
import { RuntimeError } from "./engine";
type Row = {
  id: string;
  data: string;
  revision: number;
  updated_at: string;
  locked_until: number;
};
function database() {
  if (!env.DB)
    throw new RuntimeError(
      "La sauvegarde des missions est indisponible. Réessayez dans un instant.",
      503,
    );
  return env.DB;
}
function fromRow(row: Row): Run {
  return {
    ...JSON.parse(row.data),
    revision: row.revision,
    lockedUntil: row.locked_until,
  };
}
export async function getRun(id: string) {
  const row = await database()
    .prepare("SELECT * FROM runs WHERE id = ?")
    .bind(id)
    .first<Row>();
  if (!row) throw new RuntimeError("Mission introuvable.", 404);
  return fromRow(row);
}
export async function listRuns() {
  const result = await database()
    .prepare("SELECT * FROM runs ORDER BY updated_at DESC LIMIT 50")
    .all<Row>();
  return result.results
    .map(fromRow)
    .map((run) => ({
      id: run.id,
      title: run.title,
      status: run.status,
      cursor: run.cursor,
      mode: run.mode,
      updatedAt: run.updatedAt,
      scenario: run.scenario,
    }));
}
export async function saveNewRun(run: Run) {
  await database()
    .prepare(
      "INSERT INTO runs (id,data,revision,updated_at,locked_until) VALUES (?,?,0,?,0)",
    )
    .bind(run.id, JSON.stringify(run), run.updatedAt)
    .run();
}
export async function updateRun(next: Run, expectedRevision: number) {
  next.revision = expectedRevision + 1;
  const result = await database()
    .prepare(
      "UPDATE runs SET data = ?, revision = ?, updated_at = ?, locked_until = ? WHERE id = ? AND revision = ?",
    )
    .bind(
      JSON.stringify(next),
      next.revision,
      next.updatedAt,
      next.lockedUntil,
      next.id,
      expectedRevision,
    )
    .run();
  if (!result.meta.changes)
    throw new RuntimeError(
      "La mission a changé. Son état vient d’être actualisé.",
      409,
    );
  return next;
}
export async function acquireLease(run: Run) {
  const until = Date.now() + 180000;
  const result = await database()
    .prepare(
      "UPDATE runs SET revision = revision + 1, locked_until = ? WHERE id = ? AND revision = ? AND locked_until <= ?",
    )
    .bind(until, run.id, run.revision, Date.now())
    .run();
  if (!result.meta.changes)
    throw new RuntimeError("Cette étape est déjà en cours.", 409);
  return { ...run, revision: run.revision + 1, lockedUntil: until };
}
