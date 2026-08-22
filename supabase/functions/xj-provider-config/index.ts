// X-Julia — configuração de provedores de LLM/voz e chaves de API.
// GET  ?client_id=123     -> provedores (ativos, modelos liberados) + status mascarado das chaves
// POST { action: 'save_provider' | 'save_client_key' }
// As chaves nunca são devolvidas em texto puro; apenas mascaradas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { XJ_MODEL_CATALOG } from "../_shared/x-julia/pricing.ts";
import { getProvider } from "../_shared/x-julia/llm.ts";
import { requireAppIdentity, XJ_GUARD_HEADERS, xjGuardFailed } from "../_shared/x-julia/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": XJ_GUARD_HEADERS,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};


const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mask(key?: string | null): string | null {
  const k = (key ?? "").toString().trim();
  if (!k) return null;
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export interface RemoteModel {
  model: string;
  input_per_1m?: number | null;
  output_per_1m?: number | null;
  context_tokens?: number | null;
  note?: string | null;
}

// Resolve a chave utilizável para consultar o provedor: chave do escritório
// (quando client_id informado) -> chave padrão -> legado ai_provider_keys.
async function resolveProviderKey(providerId: string, clientId?: string | null): Promise<string> {
  const def = getProvider(providerId);
  if (!def.keyName) return Deno.env.get("LOVABLE_API_KEY") ?? "";

  if (clientId) {
    const { data } = await supabase
      .from("xj_client_provider_keys")
      .select("api_key")
      .eq("client_id", String(clientId))
      .eq("provider", providerId)
      .eq("kind", "llm")
      .maybeSingle();
    const k = (data?.api_key ?? "").toString().trim();
    if (k) return k;
  }

  const { data: settings } = await supabase
    .from("xj_provider_settings")
    .select("default_key")
    .eq("provider", providerId)
    .eq("kind", "llm")
    .maybeSingle();
  const std = (settings?.default_key ?? "").toString().trim();
  if (std) return std;

  const { data: legacy } = await supabase
    .from("ai_provider_keys")
    .select("api_key")
    .eq("provider", def.keyName)
    .maybeSingle();
  return (legacy?.api_key ?? "").toString().trim();
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Busca a lista de modelos direto na API do provedor.
async function fetchProviderModels(providerId: string, apiKey: string): Promise<RemoteModel[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (providerId === "lovable") {
    // O gateway não expõe /models: devolve o catálogo conhecido do sistema.
    return Object.entries(XJ_MODEL_CATALOG)
      .filter(([key]) => key.startsWith("lovable/"))
      .map(([key, info]) => ({
        model: key.split("/").slice(1).join("/"),
        input_per_1m: info.inputPer1M,
        output_per_1m: info.outputPer1M,
        context_tokens: info.context,
        note: info.note,
      }));
  }

  if (providerId === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/models", { headers });
    const raw = await res.text();
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${raw.slice(0, 300)}`);
    const parsed = JSON.parse(raw);
    return (parsed?.data ?? []).map((m: any) => {
      const inPrice = num(m?.pricing?.prompt);
      const outPrice = num(m?.pricing?.completion);
      return {
        model: String(m?.id ?? ""),
        // OpenRouter devolve preço por token; convertemos para 1M.
        input_per_1m: inPrice === null ? null : Number((inPrice * 1_000_000).toFixed(4)),
        output_per_1m: outPrice === null ? null : Number((outPrice * 1_000_000).toFixed(4)),
        context_tokens: num(m?.context_length),
        note: m?.name ? String(m.name) : null,
      };
    }).filter((m: RemoteModel) => m.model);
  }

  if (providerId === "anthropic") {
    if (!apiKey) throw new Error("chave da Anthropic não configurada");
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { ...headers, "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${raw.slice(0, 300)}`);
    const parsed = JSON.parse(raw);
    return (parsed?.data ?? [])
      .map((m: any) => ({ model: String(m?.id ?? ""), note: m?.display_name ? String(m.display_name) : null }))
      .filter((m: RemoteModel) => m.model);
  }

  if (providerId === "gemini") {
    if (!apiKey) throw new Error("chave do Google Gemini não configurada");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
    );
    const raw = await res.text();
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${raw.slice(0, 300)}`);
    const parsed = JSON.parse(raw);
    return (parsed?.models ?? [])
      .filter((m: any) => (m?.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: any) => ({
        model: String(m?.name ?? "").replace(/^models\//, ""),
        context_tokens: num(m?.inputTokenLimit),
        note: m?.displayName ? String(m.displayName) : null,
      }))
      .filter((m: RemoteModel) => m.model);
  }

  // Demais provedores falam o padrão OpenAI: GET /models.
  const endpoints: Record<string, string> = {
    openai: "https://api.openai.com/v1/models",
    deepseek: "https://api.deepseek.com/v1/models",
    grok: "https://api.x.ai/v1/models",
    llmapi: "https://api.llmapi.ai/v1/models",
  };
  const url = endpoints[providerId];
  if (!url) throw new Error(`provedor ${providerId} não suporta listagem automática de modelos`);
  if (!apiKey) throw new Error("chave do provedor não configurada");

  const res = await fetch(url, { headers: { ...headers, Authorization: `Bearer ${apiKey}` } });
  const raw = await res.text();
  if (!res.ok) throw new Error(`${providerId} ${res.status}: ${raw.slice(0, 300)}`);
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : (parsed?.data ?? parsed?.models ?? []);
  return (list ?? [])
    .map((m: any) => ({
      model: String(typeof m === "string" ? m : (m?.id ?? m?.model ?? "")),
      context_tokens: num(m?.context_window ?? m?.context_length ?? null),
    }))
    .filter((m: RemoteModel) => m.model);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Guarda de identidade: sem sessão válida do painel, nada é lido nem gravado.
  const identity = await requireAppIdentity(req);
  if (xjGuardFailed(identity)) return json({ error: identity.error }, identity.status);
  const adminOnly = () => (identity.isAdmin ? null : json({ error: "ação restrita ao administrador" }, 403));

  try {
    if (req.method === "GET") {
      // O client_id do chamador é ignorado: usa-se o resolvido no servidor.
      // Admin pode inspecionar outro escritório explicitamente.
      const url = new URL(req.url);
      const requested = (url.searchParams.get("client_id") ?? "").trim();
      const clientId = identity.isAdmin && requested ? requested : identity.clientId;

      const { data: settings, error } = await supabase
        .from("xj_provider_settings")
        .select("provider, kind, is_enabled, enabled_models, default_key");
      if (error) return json({ error: error.message }, 500);

      const providers = (settings ?? []).map((row) => ({
        provider: row.provider,
        kind: row.kind,
        is_enabled: !!row.is_enabled,
        enabled_models: Array.isArray(row.enabled_models) ? row.enabled_models : [],
        default_key_masked: mask(row.default_key),
      }));

      let clientKeys: Array<{ provider: string; kind: string; masked: string | null }> = [];
      if (clientId) {
        const { data: keys } = await supabase
          .from("xj_client_provider_keys")
          .select("provider, kind, api_key")
          .eq("client_id", String(clientId));
        clientKeys = (keys ?? []).map((k) => ({
          provider: k.provider,
          kind: k.kind,
          masked: mask(k.api_key),
        }));
      }

      const { data: pricing } = await supabase
        .from("xj_model_pricing")
        .select("id, provider, model, input_per_1m, output_per_1m, context_tokens, note, is_active, updated_at")
        .order("provider")
        .order("model")
        .limit(5000);

      return json({ providers, client_keys: clientKeys, model_pricing: pricing ?? [] });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body?.action ?? "");

      if (action === "save_provider") {
        const denied = adminOnly();
        if (denied) return denied;
        const provider = String(body?.provider ?? "").trim();
        const kind = String(body?.kind ?? "llm").trim();
        if (!provider || !["llm", "voice", "contract"].includes(kind)) {
          return json({ error: "provider e kind (llm|voice|contract) são obrigatórios" }, 400);
        }

        const payload: Record<string, unknown> = {
          provider,
          kind,
          is_enabled: !!body?.is_enabled,
          enabled_models: Array.isArray(body?.enabled_models) ? body.enabled_models : [],
        };
        // default_key só é alterado quando enviado (string vazia limpa a chave).
        if (typeof body?.default_key === "string") {
          payload.default_key = body.default_key.trim() || null;
        }

        const { error } = await supabase
          .from("xj_provider_settings")
          .upsert(payload, { onConflict: "provider,kind" });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      if (action === "save_client_key") {
        // Escritório sempre vem da sessão; admin pode agir em outro explicitamente.
        const requested = String(body?.client_id ?? "").trim();
        const clientId = identity.isAdmin && requested ? requested : identity.clientId;
        const provider = String(body?.provider ?? "").trim();
        const kind = String(body?.kind ?? "llm").trim();
        const apiKey = String(body?.api_key ?? "").trim();
        if (!clientId || !provider || !["llm", "voice", "contract"].includes(kind)) {
          return json({ error: "client_id, provider e kind são obrigatórios" }, 400);
        }

        if (!apiKey) {
          await supabase
            .from("xj_client_provider_keys")
            .delete()
            .eq("client_id", clientId)
            .eq("provider", provider)
            .eq("kind", kind);
          return json({ ok: true, masked: null });
        }

        const { error } = await supabase
          .from("xj_client_provider_keys")
          .upsert(
            { client_id: clientId, provider, kind, api_key: apiKey },
            { onConflict: "client_id,provider,kind" },
          );
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, masked: mask(apiKey) });
      }


      if (action === "save_model_pricing") {
        const denied = adminOnly();
        if (denied) return denied;
        const provider = String(body?.provider ?? "").trim();
        const model = String(body?.model ?? "").trim();
        if (!provider || !model) return json({ error: "provider e model são obrigatórios" }, 400);

        const payload = {
          provider,
          model,
          input_per_1m: Number(body?.input_per_1m ?? 0) || 0,
          output_per_1m: Number(body?.output_per_1m ?? 0) || 0,
          context_tokens: Math.round(Number(body?.context_tokens ?? 0) || 0),
          note: body?.note ? String(body.note) : null,
          is_active: body?.is_active === undefined ? true : !!body.is_active,
        };
        const { error } = await supabase
          .from("xj_model_pricing")
          .upsert(payload, { onConflict: "provider,model" });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      if (action === "delete_model_pricing") {
        const denied = adminOnly();
        if (denied) return denied;
        const provider = String(body?.provider ?? "").trim();
        const model = String(body?.model ?? "").trim();
        if (!provider || !model) return json({ error: "provider e model são obrigatórios" }, 400);
        const { error } = await supabase
          .from("xj_model_pricing")
          .delete()
          .eq("provider", provider)
          .eq("model", model);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      // Popula a tabela com o catálogo padrão do código (não sobrescreve linhas existentes salvo force).
      if (action === "seed_model_pricing") {
        const denied = adminOnly();
        if (denied) return denied;
        const force = !!body?.force;
        const rows = Object.entries(XJ_MODEL_CATALOG).map(([key, info]) => {
          const parts = key.split("/");
          return {
            provider: parts[0],
            model: parts.slice(1).join("/"),
            input_per_1m: info.inputPer1M,
            output_per_1m: info.outputPer1M,
            context_tokens: info.context,
            note: info.note,
            is_active: true,
          };
        });

        if (!force) {
          const { data: existing } = await supabase.from("xj_model_pricing").select("provider, model");
          const has = new Set((existing ?? []).map((r: any) => `${r.provider}/${r.model}`));
          const toInsert = rows.filter((r) => !has.has(`${r.provider}/${r.model}`));
          if (!toInsert.length) return json({ ok: true, inserted: 0 });
          const { error } = await supabase.from("xj_model_pricing").insert(toInsert);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true, inserted: toInsert.length });
        }

        const { error } = await supabase
          .from("xj_model_pricing")
          .upsert(rows, { onConflict: "provider,model" });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, inserted: rows.length });
      }

      // Lista modelos direto na API do provedor de LLM.
      if (action === "list_provider_models") {
        const provider = String(body?.provider ?? "").trim();
        if (!provider) return json({ error: "provider é obrigatório" }, 400);
        const requestedClient = String(body?.client_id ?? "").trim();
        const clientId = identity.isAdmin && requestedClient ? requestedClient : identity.clientId;
        try {
          const key = await resolveProviderKey(provider, clientId);
          const models = await fetchProviderModels(provider, key);
          models.sort((a, b) => a.model.localeCompare(b.model));
          return json({ ok: true, provider, models });
        } catch (err) {
          return json({ error: String((err as Error)?.message ?? err) }, 400);
        }
      }

      // Importa modelos vindos do provedor para o catálogo de preços.
      if (action === "import_provider_models") {
        const denied = adminOnly();
        if (denied) return denied;
        const provider = String(body?.provider ?? "").trim();
        const models = Array.isArray(body?.models) ? body.models : [];
        if (!provider || !models.length) return json({ error: "provider e models são obrigatórios" }, 400);

        const rows = models
          .map((m: any) => ({
            provider,
            model: String(m?.model ?? "").trim(),
            input_per_1m: Number(m?.input_per_1m ?? 0) || 0,
            output_per_1m: Number(m?.output_per_1m ?? 0) || 0,
            context_tokens: Math.round(Number(m?.context_tokens ?? 0) || 0),
            note: m?.note ? String(m.note).slice(0, 300) : null,
            is_active: true,
          }))
          .filter((r: any) => r.model);
        if (!rows.length) return json({ error: "nenhum modelo válido" }, 400);

        const { error } = await supabase
          .from("xj_model_pricing")
          .upsert(rows, { onConflict: "provider,model" });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, imported: rows.length });
      }

      return json({ error: `ação desconhecida: ${action}` }, 400);
    }

    return json({ error: "método não suportado" }, 405);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});