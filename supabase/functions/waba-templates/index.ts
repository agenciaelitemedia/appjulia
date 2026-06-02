// ============================================
// WABA Templates Management Edge Function
// Proxies Meta Graph API v22.0 for Message Templates
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GRAPH_API = "https://graph.facebook.com/v22.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function loadQueue(queueId: string) {
  const { data, error } = await supabase
    .from("queues")
    .select("id, client_id, channel_type, waba_id, waba_token, waba_number_id")
    .eq("id", queueId)
    .single();
  if (error || !data) throw new Error("Fila não encontrada");
  if (data.channel_type !== "waba")
    throw new Error("Esta fila não é do tipo WABA");
  if (!data.waba_id || !data.waba_token)
    throw new Error("Credenciais WABA ausentes nesta fila");
  return data;
}

function friendlyMetaError(err: any): string {
  const msg = err?.error?.message || err?.message || "Erro desconhecido da Meta";
  const code = err?.error?.code;
  const sub = err?.error?.error_subcode;
  const map: Record<number, string> = {
    100: "Parâmetro inválido enviado para a Meta. Revise nome, idioma e variáveis.",
    190: "Token de acesso expirado ou inválido. Reconecte a fila WABA.",
    132000: "O conteúdo do template viola as políticas da Meta.",
    132001: "Template duplicado: já existe um com este nome e idioma.",
    132005: "Categoria inválida para este template.",
    132007: "Variáveis do template estão fora do padrão exigido.",
    132012: "Botão configurado de forma inválida.",
  };
  if (code && map[code]) return `${map[code]} (cod ${code}${sub ? "/" + sub : ""})`;
  return `${msg}${code ? ` (cod ${code})` : ""}`;
}

async function metaFetch(
  path: string,
  token: string,
  init: RequestInit = {}
) {
  const url = path.startsWith("http") ? path : `${GRAPH_API}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const resp = await fetch(url, { ...init, headers });
  const text = await resp.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!resp.ok) {
    const err = new Error(friendlyMetaError(body));
    (err as any).meta = body;
    (err as any).status = resp.status;
    throw err;
  }
  return body;
}

async function listTemplates(queue: any) {
  const all: any[] = [];
  let url:
    | string
    | null = `/${queue.waba_id}/message_templates?fields=name,language,category,sub_category,status,components,quality_score,rejected_reason,id&limit=100`;
  while (url) {
    const page: any = await metaFetch(url, queue.waba_token);
    if (Array.isArray(page?.data)) all.push(...page.data);
    url = page?.paging?.next ?? null;
  }
  return all;
}

async function syncToCache(queue: any, templates: any[]) {
  const rows = templates.map((t) => ({
    client_id: queue.client_id,
    queue_id: queue.id,
    waba_id: queue.waba_id,
    meta_template_id: String(t.id),
    name: t.name,
    language: t.language,
    category: t.category,
    sub_category: t.sub_category ?? null,
    status: t.status,
    rejection_reason: t.rejected_reason ?? null,
    quality_score: t.quality_score ?? null,
    components: t.components ?? [],
    last_edited_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }));

  if (rows.length === 0) {
    // Apaga cache da fila se Meta não tem mais nenhum
    await supabase.from("waba_templates").delete().eq("queue_id", queue.id);
    return 0;
  }

  await supabase
    .from("waba_templates")
    .upsert(rows, { onConflict: "queue_id,name,language" });

  // Remove do cache os que não existem mais na Meta
  const keepIds = rows.map((r) => r.meta_template_id);
  await supabase
    .from("waba_templates")
    .delete()
    .eq("queue_id", queue.id)
    .not("meta_template_id", "in", `(${keepIds.map((k) => `"${k}"`).join(",")})`);

  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, queue_id } = body || {};
    if (!action) return json({ error: "Missing action" }, 400);
    if (!queue_id) return json({ error: "Missing queue_id" }, 400);

    const queue = await loadQueue(queue_id);

    switch (action) {
      case "sync": {
        const templates = await listTemplates(queue);
        const synced = await syncToCache(queue, templates);
        return json({ success: true, synced, templates });
      }

      case "list": {
        // Lista direto da Meta (sem persistir) - útil para refresh manual
        const templates = await listTemplates(queue);
        return json({ success: true, templates });
      }

      case "get": {
        const { template_id } = body;
        if (!template_id) return json({ error: "Missing template_id" }, 400);
        const tpl = await metaFetch(
          `/${template_id}?fields=name,language,category,sub_category,status,components,quality_score,rejected_reason,id`,
          queue.waba_token
        );
        return json({ success: true, template: tpl });
      }

      case "create": {
        const { name, language, category, components, allow_category_change } =
          body;
        if (!name || !language || !category || !components)
          return json(
            { error: "name, language, category, components são obrigatórios" },
            400
          );
        const payload: any = { name, language, category, components };
        if (allow_category_change) payload.allow_category_change = true;
        const created = await metaFetch(
          `/${queue.waba_id}/message_templates`,
          queue.waba_token,
          { method: "POST", body: JSON.stringify(payload) }
        );
        // Re-sincroniza para popular cache
        const templates = await listTemplates(queue);
        await syncToCache(queue, templates);
        return json({ success: true, created });
      }

      case "edit": {
        const { template_id, components, category } = body;
        if (!template_id)
          return json({ error: "Missing template_id" }, 400);
        const payload: any = {};
        if (components) payload.components = components;
        if (category) payload.category = category;
        const updated = await metaFetch(
          `/${template_id}`,
          queue.waba_token,
          { method: "POST", body: JSON.stringify(payload) }
        );
        const templates = await listTemplates(queue);
        await syncToCache(queue, templates);
        return json({ success: true, updated });
      }

      case "delete": {
        const { name, hsm_id } = body;
        if (!name) return json({ error: "Missing name" }, 400);
        const qs = new URLSearchParams({ name });
        if (hsm_id) qs.set("hsm_id", hsm_id);
        const deleted = await metaFetch(
          `/${queue.waba_id}/message_templates?${qs.toString()}`,
          queue.waba_token,
          { method: "DELETE" }
        );
        await supabase
          .from("waba_templates")
          .delete()
          .eq("queue_id", queue.id)
          .eq("name", name);
        return json({ success: true, deleted });
      }

      case "upload_media_handle": {
        // Resumable Upload API: requer META_APP_ID + arquivo base64
        const { file_base64, file_type, file_name } = body;
        if (!file_base64 || !file_type)
          return json({ error: "file_base64 e file_type obrigatórios" }, 400);
        const appId = Deno.env.get("META_APP_ID");
        if (!appId)
          return json({ error: "META_APP_ID não configurado" }, 500);

        const bin = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));

        // 1. Criar sessão de upload
        const sessionQs = new URLSearchParams({
          file_length: String(bin.byteLength),
          file_type,
          ...(file_name ? { file_name } : {}),
        });
        const session: any = await metaFetch(
          `/${appId}/uploads?${sessionQs.toString()}`,
          queue.waba_token,
          { method: "POST" }
        );
        const sessionId = String(session.id || "").replace(/^upload:/, "");
        if (!sessionId)
          return json({ error: "Sessão de upload não retornada" }, 500);

        // 2. Enviar binário
        const uploadResp = await fetch(
          `${GRAPH_API}/upload:${sessionId}`,
          {
            method: "POST",
            headers: {
              Authorization: `OAuth ${queue.waba_token}`,
              file_offset: "0",
            },
            body: bin,
          }
        );
        const uploadJson = await uploadResp.json();
        if (!uploadResp.ok || !uploadJson?.h) {
          return json(
            { error: "Falha no upload", details: uploadJson },
            500
          );
        }
        return json({ success: true, handle: uploadJson.h });
      }

      default:
        return json({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("[waba-templates] error:", err);
    return json(
      { error: err?.message || "Erro interno", meta: (err as any).meta },
      (err as any).status || 500
    );
  }
});