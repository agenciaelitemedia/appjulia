// ============================================
// X-Julia — camada de LLM multi-provedor (tool calling)
// Provedores: lovable (gateway), openai, openrouter, anthropic,
// deepseek, grok (xai), gemini (Google direto), llmapi.
// Todos falam formato OpenAI, exceto anthropic (convertido aqui).
// ============================================
import type { XJChatMessage } from "./types.ts";

export interface XJProviderDef {
  id: string;
  label: string;
  endpoint: string;
  keyName: string | null; // linha em ai_provider_keys
  style: "openai" | "anthropic";
  models: string[];
}

export const XJ_PROVIDERS: XJProviderDef[] = [
  {
    id: "lovable",
    label: "Lovable AI (sem chave)",
    endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
    keyName: null,
    style: "openai",
    models: [
      "google/gemini-3.6-flash",
      "google/gemini-3.1-pro-preview",
      "google/gemini-3.1-flash-lite",
      "openai/gpt-5.6-terra",
      "openai/gpt-5.6-luna",
      "openai/gpt-5.5",
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    keyName: "openai",
    style: "openai",
    models: ["gpt-4.1", "gpt-4o", "gpt-4o-mini"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyName: "openrouter",
    style: "openai",
    models: [
      "anthropic/claude-sonnet-4",
      "openai/gpt-4.1",
      "google/gemini-2.5-pro",
      "deepseek/deepseek-chat",
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    endpoint: "https://api.anthropic.com/v1/messages",
    keyName: "anthropic",
    style: "anthropic",
    models: ["claude-sonnet-4-20250514", "claude-3-7-sonnet-latest", "claude-3-5-haiku-latest"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    keyName: "deepseek",
    style: "openai",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "grok",
    label: "Grok (xAI)",
    endpoint: "https://api.x.ai/v1/chat/completions",
    keyName: "xai",
    style: "openai",
    models: ["grok-4", "grok-3", "grok-3-mini"],
  },
  {
    id: "gemini",
    label: "Google Gemini (direto)",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyName: "gemini",
    style: "openai",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    id: "llmapi",
    label: "LLM API",
    endpoint: "https://api.llmapi.com/chat/completions",
    keyName: "llmapi",
    style: "openai",
    models: ["gpt-4o", "claude-3-5-sonnet", "llama3.1-70b"],
  },
];

export function getProvider(id: string): XJProviderDef {
  return XJ_PROVIDERS.find((p) => p.id === id) ?? XJ_PROVIDERS[0];
}

// deno-lint-ignore no-explicit-any
async function resolveKey(
  supabase: any,
  provider: XJProviderDef,
  opts?: { clientId?: string | null; keyMode?: string | null },
): Promise<string> {
  if (!provider.keyName) return Deno.env.get("LOVABLE_API_KEY") ?? "";

  // 1. Chave personalizada do escritório (quando o agente está em modo custom).
  if (opts?.keyMode === "custom" && opts?.clientId) {
    const { data } = await supabase
      .from("xj_client_provider_keys")
      .select("api_key")
      .eq("client_id", String(opts.clientId))
      .eq("provider", provider.id)
      .eq("kind", "llm")
      .maybeSingle();
    const custom = (data?.api_key ?? "").toString().trim();
    if (custom) return custom;
  }

  // 2. Chave padrão configurada em Configuração do X-Julia.
  const { data: settings } = await supabase
    .from("xj_provider_settings")
    .select("api_key:default_key")
    .eq("provider", provider.id)
    .eq("kind", "llm")
    .maybeSingle();
  const std = (settings?.api_key ?? "").toString().trim();
  if (std) return std;

  // 3. Legado: ai_provider_keys.
  const { data } = await supabase
    .from("ai_provider_keys")
    .select("api_key")
    .eq("provider", provider.keyName)
    .maybeSingle();
  return (data?.api_key ?? "").toString().trim();
}

export interface XJToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface XJCompletion {
  text: string;
  // deno-lint-ignore no-explicit-any
  toolCalls: Array<{ id: string; name: string; args: any }>;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number;
}

export interface XJCompleteInput {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  provider: string;
  model: string;
  messages: XJChatMessage[];
  tools?: XJToolDef[];
  fallbackEnabled?: boolean;
  temperature?: number;
  /** Escritório (client_id) dono do agente — usado para chave personalizada. */
  clientId?: string | null;
  /** 'default' | 'custom' — origem da chave de API do provedor. */
  keyMode?: string | null;
}

/** Chamada única com fallback automático para o gateway Lovable. */
export async function xjComplete(input: XJCompleteInput): Promise<XJCompletion> {
  try {
    return await callProvider(input, input.provider, input.model);
  } catch (err) {
    console.warn("[x-julia/llm] provider falhou:", input.provider, String(err));
    if (input.fallbackEnabled === false || input.provider === "lovable") throw err;
    return await callProvider(input, "lovable", "google/gemini-3.6-flash");
  }
}

async function callProvider(
  input: XJCompleteInput,
  providerId: string,
  model: string,
): Promise<XJCompletion> {
  const provider = getProvider(providerId);
  const apiKey = await resolveKey(
    input.supabase,
    provider,
    providerId === input.provider ? { clientId: input.clientId, keyMode: input.keyMode } : undefined,
  );
  if (!apiKey) throw new Error(`chave do provedor ${provider.label} não configurada`);
  const started = Date.now();

  if (provider.style === "anthropic") {
    return await callAnthropic(input, provider, model, apiKey, started);
  }
  return await callOpenAIStyle(input, provider, model, apiKey, started);
}

async function callOpenAIStyle(
  input: XJCompleteInput,
  provider: XJProviderDef,
  model: string,
  apiKey: string,
  started: number,
): Promise<XJCompletion> {
  const body: Record<string, unknown> = {
    model,
    messages: input.messages,
  };
  if (input.tools?.length) {
    body.tools = input.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = "auto";
  }
  // Modelos GPT-5.x recusam temperature/max_tokens; só enviamos fora dessa família.
  if (typeof input.temperature === "number" && !/gpt-5/.test(model)) {
    body.temperature = input.temperature;
  }
  if (/gpt-5\.6/.test(model)) body.reasoning_effort = "none";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.id === "lovable") {
    headers["Lovable-API-Key"] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (provider.id === "openrouter") {
    headers["HTTP-Referer"] = "https://julia.app";
    headers["X-Title"] = "X-Julia";
  }

  const res = await fetch(provider.endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  const raw = await res.text();
  if (!res.ok) throw new Error(`${provider.label} ${res.status}: ${raw.slice(0, 400)}`);
  const json = JSON.parse(raw);
  const choice = json.choices?.[0]?.message ?? {};

  return {
    text: (choice.content ?? "").toString(),
    toolCalls: (choice.tool_calls ?? []).map((tc: any) => ({
      id: tc.id ?? crypto.randomUUID(),
      name: tc.function?.name ?? "",
      args: safeJson(tc.function?.arguments),
    })),
    provider: provider.id,
    model,
    promptTokens: json.usage?.prompt_tokens ?? null,
    completionTokens: json.usage?.completion_tokens ?? null,
    durationMs: Date.now() - started,
  };
}

async function callAnthropic(
  input: XJCompleteInput,
  provider: XJProviderDef,
  model: string,
  apiKey: string,
  started: number,
): Promise<XJCompletion> {
  const system = input.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content ?? "")
    .join("\n\n");

  const messages = input.messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "tool") {
        return {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content ?? "" }],
        };
      }
      if (m.role === "assistant" && m.tool_calls?.length) {
        return {
          role: "assistant",
          content: [
            ...(m.content ? [{ type: "text", text: m.content }] : []),
            ...m.tool_calls.map((tc: any) => ({
              type: "tool_use",
              id: tc.id,
              name: tc.function?.name,
              input: safeJson(tc.function?.arguments),
            })),
          ],
        };
      }
      return { role: m.role, content: m.content ?? "" };
    });

  const body: Record<string, unknown> = { model, system, messages, max_tokens: 2048 };
  if (input.tools?.length) {
    body.tools = input.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  const res = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`${provider.label} ${res.status}: ${raw.slice(0, 400)}`);
  const json = JSON.parse(raw);
  const blocks: any[] = json.content ?? [];

  return {
    text: blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim(),
    toolCalls: blocks
      .filter((b) => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, args: b.input ?? {} })),
    provider: provider.id,
    model,
    promptTokens: json.usage?.input_tokens ?? null,
    completionTokens: json.usage?.output_tokens ?? null,
    durationMs: Date.now() - started,
  };
}

function safeJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}