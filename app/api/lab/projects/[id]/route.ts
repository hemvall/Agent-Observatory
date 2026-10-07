import { readPayload, errorResponse } from "@/lib/observatory/api";
import { validatePatch } from "@/lib/lab/engine";
import { getProject, saveProject } from "@/lib/lab/store";
type C = { params: Promise<{ id: string }> };
export async function GET(_req: Request, c: C) {
  try {
    return Response.json(
      { project: await getProject((await c.params).id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PUT(req: Request, c: C) {
  try {
    const p = await getProject((await c.params).id);
    return Response.json({
      project: await saveProject(
        validatePatch(p, await readPayload(req)),
        p.revision,
      ),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
