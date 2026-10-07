import { z } from "zod";
import {
  errorResponse,
  readPayload,
  providerConfig,
} from "@/lib/observatory/api";
import { RuntimeError } from "@/lib/observatory/engine";
import { stepExperiment, transitionExperiment } from "@/lib/lab/engine";
import { getExperiment, saveExperiment, lease } from "@/lib/lab/store";
type C = { params: Promise<{ id: string }> };
export async function GET(_req: Request, c: C) {
  try {
    return Response.json(
      { experiment: await getExperiment((await c.params).id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request, c: C) {
  try {
    const input = z
      .object({ action: z.enum(["advance", "pause", "resume", "cancel"]) })
      .safeParse(await readPayload(req));
    if (!input.success) throw new RuntimeError("Action invalide.");
    const e = await getExperiment((await c.params).id);
    if (input.data.action !== "advance")
      return Response.json({
        experiment: await saveExperiment(
          transitionExperiment(e, input.data.action),
          e.revision,
        ),
      });
    if (e.status !== "running")
      throw new RuntimeError(
        "L’expérience ne peut pas avancer dans cet état.",
        409,
      );
    const job = e.jobs[e.cursor];
    if (
      job?.phase === 2 &&
      Math.max(job.nextAttemptAt, e.nextAllowedAt) > Date.now()
    )
      throw new RuntimeError("Quota en récupération. Reprise programmée.", 409);
    const locked = await lease(e);
    try {
      return Response.json({
        experiment: await saveExperiment(
          await stepExperiment(locked, providerConfig()),
          locked.revision,
        ),
      });
    } catch (error) {
      const current = await getExperiment(e.id);
      if (current.revision === locked.revision)
        await saveExperiment(
          {
            ...current,
            status: "paused",
            lockedUntil: 0,
            updatedAt: new Date().toISOString(),
          },
          locked.revision,
        );
      throw error;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
