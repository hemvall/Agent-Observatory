import { errorResponse } from "@/lib/observatory/api";
import { RuntimeError } from "@/lib/observatory/engine";
import { getProject } from "@/lib/lab/store";
import { exportAssistant } from "@/lib/lab/export";
export async function GET(
  req: Request,
  c: { params: Promise<{ id: string }> },
) {
  try {
    const p = await getProject((await c.params).id),
      version =
        new URL(req.url).searchParams.get("version") || p.versions.at(-1)!.id;
    if (!p.versions.some((v) => v.id === version))
      throw new RuntimeError("Version introuvable.", 404);
    return new Response(exportAssistant(p, version), {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Content-Disposition": 'attachment; filename="assistant.mjs"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
