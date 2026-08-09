// X-Julia — configuração de provedores de LLM/voz e chaves de API.
// GET  ?client_id=123     -> provedores (ativos, modelos liberados) + status mascarado das chaves
// POST { action: 'save_provider' | 'save_client_key' }
// As chaves nunca são devolvidas em texto puro; apenas mascaradas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { XJ_MODEL_CATALOG } from "../_shared/x-julia/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const clientId = url.searchParams.get("client_id");

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
        .order("model");

      return json({ providers, client_keys: clientKeys, model_pricing: pricing ?? [] });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body?.action ?? "");

      if (action === "save_provider") {
        const provider = String(body?.provider ?? "").trim();
        const kind = String(body?.kind ?? "llm").trim();
        if (!provider || !["llm", "voice"].includes(kind)) {
          return json({ error: "provider e kind (llm|voice) são obrigatórios" }, 400);
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
        const clientId = String(body?.client_id ?? "").trim();
        const provider = String(body?.provider ?? "").trim();
        const kind = String(body?.kind ?? "llm").trim();
        const apiKey = String(body?.api_key ?? "").trim();
        if (!clientId || !provider || !["llm", "voice"].includes(kind)) {
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

      return json({ error: `ação desconhecida: ${action}` }, 400);
    }

    return json({ error: "método não suportado" }, 405);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});