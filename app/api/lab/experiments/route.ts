import {
  errorResponse,
  readPayload,
  providerConfig,
} from "@/lib/observatory/api";
import { RuntimeError } from "@/lib/observatory/engine";
import { createExperiment, experimentInput } from "@/lib/lab/engine";
import { getProject, listExperiments, insertExperiment } from "@/lib/lab/store";
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("project");
    if (!id) throw new RuntimeError("Projet requis.");
    await getProject(id);
    return Response.json(
      { experiments: await listExperiments(id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    const input = experimentInput.safeParse(await readPayload(req));
    if (!input.success)
      throw new RuntimeError(
        "Vérifie les versions, les tests et le mode sélectionné.",
      );
    return Response.json(
      {
        experiment: await insertExperiment(
          createExperiment(
            await getProject(input.data.projectId),
            input.data,
            Boolean(providerConfig().apiKey),
          ),
        ),
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
