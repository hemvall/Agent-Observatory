import { RuntimeError, type ProviderConfig } from "./engine.ts";

/** Explicit selection never falls back to another provider or another key. */
export function resolveProvider(
  values: Record<string, string | undefined>,
): ProviderConfig & { provider: "groq" | "openai"; model: string } {
  const requested = values.AI_PROVIDER?.trim().toLowerCase();
  if (requested && requested !== "groq" && requested !== "openai") {
    throw new RuntimeError("AI_PROVIDER doit être groq ou openai.", 503);
  }
  const provider =
    requested || (values.GROQ_API_KEY?.trim() ? "groq" : "openai");
  return provider === "groq"
    ? {
        provider,
        apiKey: values.GROQ_API_KEY?.trim(),
        model: values.GROQ_MODEL?.trim() || "openai/gpt-oss-20b",
      }
    : {
        provider: "openai",
        apiKey: values.OPENAI_API_KEY?.trim(),
        model: values.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
      };
}
