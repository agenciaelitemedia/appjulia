/**
 * copiloto-analisar — fallback interno do Copiloto.
 * Quando o usuário não quer conectar o ChatGPT/Claude via MCP, a própria Julia
 * produz a análise jurídica usando o Lovable AI Gateway (modelo oficial),
 * em streaming.
 *
 * Autenticação: Bearer token emitido por `copiloto-oauth` (inclui o token curto
 * do simulador). O escritório vem do token — nunca do corpo da requisição.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAI } from "../_shared/aiGateway.ts";
import { ANALYSIS_COMMAND, buildLeadContext, type CopilotoMessage } from "../_shared/copiloto/context.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!bearer) return json({ error: "unauthorized" }, 401);

  const { data: token } = await supabase
    .from("cop_oauth_tokens")
    .select("id, julia_client_id, expires_at, revoked_at")
    .eq("access_token", bearer)
    .maybeSingle();
  if (!token || token.revoked_at || new Date(token.expires_at).getTime() < Date.now()) {
    return json({ error: "invalid_token" }, 401);
  }
  await supabase.from("cop_oauth_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", token.id);

  const clientId = String(token.julia_client_id);
  const body = await req.json().catch(() => ({}));
  const contactId = String(body?.contato_id || "");
  if (!contactId) return json({ error: "invalid_request", message: "contato_id obrigatório" }, 400);

  const { data: contact } = await supabase
    .from("chat_contacts")
    .select("id, name, phone, channel_type")
    .eq("client_id", clientId)
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return json({ error: "not_found", message: "Lead não encontrado neste escritório." }, 404);

  const { data: messages, error: msgErr } = await supabase
    .from("chat_messages")
    .select("id, text, caption, type, from_me, internal_note, sender_name, file_name, timestamp, metadata")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .order("timestamp", { ascending: false })
    .limit(100);
  if (msgErr) return json({ error: "server_error", message: msgErr.message }, 500);

  const compiled = buildLeadContext(
    {
      contactId,
      conversationId: null,
      name: contact.name ?? null,
      phone: contact.phone ?? null,
      channel: contact.channel_type ?? null,
    },
    (messages || []) as CopilotoMessage[],
  );

  const ai = await resolveAI(supabase, "copilot_chat", "google/gemini-2.5-flash");
  if (!ai.apiKey) return json({ error: "ai_not_configured", message: "IA não configurada para este projeto." }, 500);

  const res = await fetch(ai.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.apiKey}` },
    body: JSON.stringify({
      model: ai.model,
      stream: true,
      messages: [
        { role: "system", content: "Você é um advogado sênior brasileiro. Responda sempre em português do Brasil." },
        { role: "user", content: `${ANALYSIS_COMMAND}\n\n${compiled.text}` },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json({ error: "ai_error", status: res.status, message: detail.slice(0, 500) }, res.status);
  }

  return new Response(res.body, {
    headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});
