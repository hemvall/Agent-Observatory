import { errorResponse, providerConfig } from "@/lib/observatory/api";
export function GET() {
  try {
    const config = providerConfig();
    return Response.json(
      {
        liveEnabled: Boolean(config.apiKey),
        model: config.model,
        provider: config.provider,
        providerLabel: config.provider === "groq" ? "Groq" : "OpenAI",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
