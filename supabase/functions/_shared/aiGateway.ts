// Shared resolver for AI model/provider/endpoint/key per agent feature.
// Centralizes the Lovable AI Gateway (default) <-> OpenRouter switch.
// Request bodies are identical (OpenAI format) — only URL + auth header change.

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENROUTER_GATEWAY = "https://openrouter.ai/api/v1/chat/completions";
const GLOBAL = "GLOBAL";

// Per-feature fallback model (used when nothing is configured or on safe fallback).
export const FEATURE_DEFAULT_MODEL: Record<string, string> = {
  chat_assist: "google/gemini-2.5-flash",
  chat_resume: "google/gemini-2.5-flash",
  chat_transcription: "google/gemini-2.5-flash",
  copilot_crm: "google/gemini-2.5-flash",
  copilot_chat: "google/gemini-2.5-flash",
  chat_autoreply: "google/gemini-2.5-flash",
  support_transcription: "google/gemini-2.5-flash",
  script_generation: "google/gemini-3-flash-preview",
};

export interface ResolvedAI {
  model: string;
  endpoint: string;
  apiKey: string;
  provider: "lovable" | "openrouter";
  prompt: string | null;
}

function lovableFallback(feature: string, fallbackModel?: string): ResolvedAI {
  return {
    model: fallbackModel || FEATURE_DEFAULT_MODEL[feature] || "google/gemini-2.5-flash",
    endpoint: LOVABLE_GATEWAY,
    apiKey: Deno.env.get("LOVABLE_API_KEY") ?? "",
    provider: "lovable",
    prompt: null,
  };
}

// deno-lint-ignore no-explicit-any
export async function resolveAI(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  feature: string,
  fallbackModel?: string,
): Promise<ResolvedAI> {
  const fb = lovableFallback(feature, fallbackModel);

  // 1) Read the global selected config for this feature (most recent wins).
  const { data: cfg } = await supabase
    .from("client_ai_model_config")
    .select("model, provider, prompt, updated_at")
    .eq("feature", feature)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prompt = (cfg?.prompt ?? "").toString().trim().length > 0 ? cfg.prompt : null;
  const model = cfg?.model || fb.model;
  const provider = (cfg?.provider || "lovable") as "lovable" | "openrouter";

  // 2) Lovable provider → default gateway + Lovable key.
  if (provider !== "openrouter") {
    return { ...fb, model, prompt };
  }

  // 3) OpenRouter provider → fetch the account key (service_role bypasses RLS).
  const { data: keyRow } = await supabase
    .from("ai_provider_keys")
    .select("api_key")
    .eq("provider", "openrouter")
    .maybeSingle();

  const orKey = (keyRow?.api_key ?? "").toString().trim();
  if (!orKey) {
    // Safe fallback: no key configured → keep Lovable working, never break.
    console.warn(`[aiGateway] feature='${feature}' provider=openrouter but no key set; falling back to Lovable.`);
    return { ...fb, model: fb.model, prompt };
  }

  return {
    model,
    endpoint: OPENROUTER_GATEWAY,
    apiKey: orKey,
    provider: "openrouter",
    prompt,
  };
}

// Optional headers recommended by OpenRouter (no-op for Lovable).
export function providerHeaders(provider: string): Record<string, string> {
  if (provider === "openrouter") {
    return {
      "HTTP-Referer": "https://julia.app",
      "X-Title": "Julia",
    };
  }
  return {};
}

export { GLOBAL };
