import { env } from "cloudflare:workers";
import { RuntimeError } from "./engine";
export function providerConfig() {
  return {
    apiKey: (env as unknown as Record<string, string>).OPENAI_API_KEY,
    model: (env as unknown as Record<string, string>).OPENAI_MODEL,
  };
}
export function errorResponse(error: unknown) {
  if (error instanceof RuntimeError)
    return Response.json({ error: error.message }, { status: error.code });
  console.error(
    "Observatory request failed",
    error instanceof Error ? error.name : "unknown",
  );
  return Response.json(
    {
      error:
        "Une erreur est survenue. Vos étapes déjà sauvegardées sont conservées.",
    },
    { status: 500 },
  );
}
export async function readPayload(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new RuntimeError("Origine de la requête refusée.", 403);
  if (Number(request.headers.get("content-length") || 0) > 180000)
    throw new RuntimeError("Document trop volumineux.", 413);
  if (!request.body) throw new RuntimeError("Requête vide.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 180000) {
      await reader.cancel();
      throw new RuntimeError("Document trop volumineux.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RuntimeError("JSON invalide.");
  }
}
