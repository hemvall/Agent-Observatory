import { z } from "zod";
import { readPayload, errorResponse } from "@/lib/observatory/api";
import { RuntimeError } from "@/lib/observatory/engine";
import { createProject } from "@/lib/lab/engine";
import { insertProject, listProjects } from "@/lib/lab/store";
export async function GET() {
  try {
    return Response.json(
      { projects: await listProjects() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        template: z.boolean().default(false),
      })
      .safeParse(await readPayload(request));
    if (!input.success) throw new RuntimeError("Donne un nom au projet.");
    return Response.json(
      {
        project: await insertProject(
          createProject(input.data.name, input.data.template),
        ),
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
