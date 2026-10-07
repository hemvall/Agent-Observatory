import { z } from "zod";
import {
  errorResponse,
  providerConfig,
  readPayload,
} from "@/lib/observatory/api";
import {
  executeStep,
  RuntimeError,
  transition,
} from "@/lib/observatory/engine";
import { getRun, updateRun, acquireLease } from "@/lib/observatory/store";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    return Response.json(
      { run: await getRun((await context.params).id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const parsed = z
      .object({
        action: z.enum(["advance", "pause", "resume", "approve", "cancel"]),
      })
      .safeParse(await readPayload(request));
    if (!parsed.success) throw new RuntimeError("Action invalide.");
    const run = await getRun((await context.params).id);
    if (parsed.data.action !== "advance")
      return Response.json({
        run: await updateRun(transition(run, parsed.data.action), run.revision),
      });
    if (run.status !== "running")
      throw new RuntimeError(
        "La mission ne peut pas avancer dans cet état.",
        409,
      );
    if (
      run.cursor === 2 &&
      (run.analysisProgress?.nextAttemptAt || 0) > Date.now()
    )
      throw new RuntimeError(
        "Le quota Groq est en récupération. La reprise est programmée.",
        409,
      );
    const leased = await acquireLease(run);
    try {
      const next = await executeStep(leased, providerConfig());
      return Response.json({ run: await updateRun(next, leased.revision) });
    } catch (error) {
      if (!(error instanceof RuntimeError && error.code === 409)) {
        // Never overwrite a concurrent pause/cancel after an external call.
        const current = await getRun(run.id);
        if (current.revision === leased.revision)
          await updateRun(
            {
              ...current,
              status: "failed",
              lockedUntil: 0,
              error:
                error instanceof RuntimeError
                  ? error.message
                  : "L’étape a échoué. Vous pouvez la reprendre.",
              updatedAt: new Date().toISOString(),
            },
            leased.revision,
          );
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
