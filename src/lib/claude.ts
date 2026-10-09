import Anthropic from "@anthropic-ai/sdk";
import { estimateCostUsd } from "@/domain/aiUsage";
import { dayInMadrid } from "@/domain/day";
import { prisma } from "@/lib/prisma";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

// One attempt may take 20 s, and everything (with one retry) at most 30 s.
const REQUEST_TIMEOUT_MS = 20_000;
const TOTAL_TIMEOUT_MS = 30_000;

// Models that accept `fallbacks: "default"`: if a safety classifier declines
// the request, the API answers with another model instead of refusing.
const FALLBACK_MODELS = new Set([
  "claude-fable-5-1",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5"
]);

/** Model and effort from the environment; the key never leaves the server. */
export function aiSettings(): { configured: boolean; model: string; effort: Effort } {
  const effort = process.env.ANTHROPIC_EFFORT?.trim() as Effort | undefined;
  return {
    configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
    effort: effort && EFFORTS.includes(effort) ? effort : "low"
  };
}

/** A failure explained in Spanish, ready to show next to the manual alternative. */
export class AiError extends Error {}

let client: Anthropic | null = null;

function errorMessage(error: unknown): string {
  if (error instanceof AiError) return error.message;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "La clave de la API de Claude no es válida.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Has hecho demasiadas consultas seguidas. Espera un minuto.";
  }
  if (
    error instanceof Anthropic.APIConnectionTimeoutError ||
    error instanceof Anthropic.APIUserAbortError ||
    isAbort(error)
  ) {
    return "La IA ha tardado demasiado en responder.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "No se pudo conectar con la IA. Comprueba la conexión.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return "La IA no ha aceptado la petición (¿queda saldo en la cuenta de la API?).";
  }
  if (error instanceof Anthropic.APIError) {
    return "La IA no está disponible ahora mismo. Prueba en un momento.";
  }
  return "No se pudo consultar la IA.";
}

const isAbort = (error: unknown) =>
  error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");

/** Status and message only: never the request, whose headers carry the key. */
function logError(kind: string, error: unknown) {
  const detail =
    error instanceof Anthropic.APIError
      ? `${error.status ?? "-"} ${error.constructor.name}: ${error.message}`
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
  console.error(`[ai] ${kind} failed: ${detail}`);
}

/**
 * Asks Claude for JSON that follows `schema`, records the tokens of the call
 * and returns the parsed object. Throws AiError with a message for the user.
 */
export async function requestJson(
  kind: string,
  {
    system,
    prompt,
    schema
  }: {
    system: string;
    /** Text, or content blocks such as a photo followed by the text. */
    prompt: string | Anthropic.Beta.BetaContentBlockParam[];
    schema: Record<string, unknown>;
  }
): Promise<unknown> {
  const { configured, model, effort } = aiSettings();
  if (!configured) {
    throw new AiError("La IA no está configurada: falta ANTHROPIC_API_KEY en el servidor.");
  }
  // A key that is not scoped to a workspace has to name one in every request.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  client ??= new Anthropic({
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
    defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined
  });

  const started = Date.now();
  let usage = { model, inputTokens: 0, outputTokens: 0 };
  let ok = false;
  try {
    const response = await client.beta.messages.create(
      {
        model,
        max_tokens: 16000,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { effort, format: { type: "json_schema", schema } },
        ...(FALLBACK_MODELS.has(model)
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {})
      },
      { signal: AbortSignal.timeout(TOTAL_TIMEOUT_MS) }
    );
    // A fallback may have answered: the price is the one of the model that did.
    usage = {
      model: response.model,
      inputTokens:
        response.usage.input_tokens +
        (response.usage.cache_creation_input_tokens ?? 0) +
        (response.usage.cache_read_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens
    };

    if (response.stop_reason === "refusal") {
      throw new AiError("La IA no ha querido responder a esta petición. Prueba de otra forma.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiError("La respuesta de la IA se ha cortado. Prueba otra vez.");
    }
    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AiError("La IA no ha devuelto una respuesta válida. Prueba otra vez.");
    }
    ok = true;
    return parsed;
  } catch (error) {
    logError(kind, error);
    throw error instanceof AiError ? error : new AiError(errorMessage(error));
  } finally {
    const durationMs = Date.now() - started;
    console.info(
      `[ai] ${kind}: ${usage.model} in=${usage.inputTokens} out=${usage.outputTokens} ${durationMs} ms${ok ? "" : " (failed)"}`
    );
    await prisma.aiCall
      .create({
        data: {
          day: dayInMadrid(),
          kind,
          ...usage,
          costUsd: estimateCostUsd(usage.model, usage),
          durationMs,
          ok
        }
      })
      .catch((error) => console.error("[ai] could not record the call:", error));
  }
}
