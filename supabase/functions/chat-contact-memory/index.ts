import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { requireAppIdentity, xjGuardFailed, XJ_GUARD_HEADERS } from "../_shared/x-julia/guard.ts";
import { resolveAI, providerHeaders } from "../_shared/aiGateway.ts";
import { logAIUsage } from "../_shared/aiUsageLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": XJ_GUARD_HEADERS,
};

const CATEGORIES = [
  "profile_context", "needs_case", "pains_objections", "agreements_commitments",
  "next_steps", "team_observations",
] as const;

const BodySchema = z.object({
  action: z.enum(["list", "generate", "create", "update", "archive"]),
  contact_id: z.string().uuid(),
  item_id: z.string().uuid().optional(),
  category: z.enum(CATEGORIES).optional(),
  content: z.string().trim().min(1).max(4000).optional(),
  page: z.number().int().min(0).max(10000).optional(),
  page_size: z.number().int().min(1).max(100).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function transcriptionOf(metadata: Record<string, unknown> | null): string | null {
  const regular = metadata?.transcription as { status?: string; text?: string } | undefined;
  const internal = metadata?.transcription_internal as { status?: string; text?: string } | undefined;
  if (regular?.status === "ok" && regular.text?.trim()) return regular.text.trim();
  if (internal?.status === "ok" && internal.text?.trim()) return internal.text.trim();
  return null;
}

async function canEdit(supabase: any, contactId: string, userId: string, role: string) {
  if (["admin", "user", "colaborador"].includes(role)) return true;
  const { data } = await supabase
    .from("chat_conversations")
    .select("assigned_user_id")
    .eq("contact_id", contactId)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.assigned_user_id != null && String(data.assigned_user_id) === userId;
}

function itemSnapshot(row: any) {
  return { category: row.category, content: row.content, status: row.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const identity = await requireAppIdentity(req);
  if (xjGuardFailed(identity)) return json({ error: identity.error }, identity.status);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Parâmetros inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: contact } = await supabase
      .from("chat_contacts")
      .select("id, name, phone, client_id")
      .eq("id", body.contact_id)
      .eq("client_id", identity.clientId)
      .maybeSingle();
    if (!contact) return json({ error: "Contato não encontrado neste escritório" }, 404);
    const editable = await canEdit(supabase, contact.id, identity.userId, identity.role);

    if (body.action === "list") {
      const page = body.page ?? 0;
      const pageSize = body.page_size ?? 50;
      const [{ data: items }, { data: state }, { data: summaries }, { data: conversations }, { data: documents }] = await Promise.all([
        supabase.from("chat_contact_memory_items").select("*").eq("client_id", identity.clientId).eq("contact_id", contact.id).eq("status", "active").order("source_at", { ascending: false, nullsFirst: false }),
        supabase.from("chat_contact_memory_state").select("*").eq("client_id", identity.clientId).eq("contact_id", contact.id).maybeSingle(),
        supabase.from("chat_conversation_summaries").select("*").eq("client_id", identity.clientId).eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("chat_conversations").select("id, observations, protocol, created_at").eq("client_id", identity.clientId).eq("contact_id", contact.id).order("created_at", { ascending: false }),
        supabase.from("chat_messages").select("id, conversation_id, type, from_me, sender_name, media_url, file_name, caption, metadata, timestamp").eq("client_id", identity.clientId).eq("contact_id", contact.id).in("type", ["image", "video", "document", "sticker"]).order("timestamp", { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1),
      ]);
      const conversationIds = (conversations || []).map((c: any) => c.id);
      let messages: any[] = [];
      if (conversationIds.length) {
        const { data } = await supabase
          .from("chat_messages")
          .select("id, conversation_id, text, type, from_me, internal_note, sender_name, media_url, file_name, caption, metadata, timestamp, created_at")
          .eq("client_id", identity.clientId)
          .eq("contact_id", contact.id)
          .or("from_me.eq.false,internal_note.eq.true")
          .order("timestamp", { ascending: false })
          .range(page * pageSize, page * pageSize + pageSize - 1);
        messages = data || [];
      }
      const observations = (conversations || []).filter((c: any) => c.observations?.trim()).map((c: any) => ({
        id: `observation-${c.id}`, conversation_id: c.id, text: c.observations, type: "observation",
        from_me: true, internal_note: true, sender_name: "Equipe", timestamp: c.created_at, protocol: c.protocol,
      }));
      return json({ contact, can_edit: editable, items: items || [], state, summaries: summaries || [], documents: documents || [], sources: page === 0 ? [...messages, ...observations].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))) : messages });
    }

    if (!editable) return json({ error: "Somente o responsável ou gestores podem alterar a memória" }, 403);

    if (body.action === "create") {
      if (!body.category || !body.content) return json({ error: "Categoria e conteúdo são obrigatórios" }, 400);
      const { data: inserted, error } = await supabase.from("chat_contact_memory_items").insert({
        client_id: identity.clientId, contact_id: contact.id, category: body.category, content: body.content,
        source_type: "manual", source_at: new Date().toISOString(), created_by_user_id: identity.userId,
        created_by_name: identity.email, updated_by_user_id: identity.userId, updated_by_name: identity.email,
      }).select("*").single();
      if (error) throw error;
      await supabase.from("chat_contact_memory_history").insert({ memory_item_id: inserted.id, client_id: identity.clientId, contact_id: contact.id, action: "created", new_value: itemSnapshot(inserted), actor_user_id: identity.userId, actor_name: identity.email });
      return json({ item: inserted });
    }

    if (body.action === "update" || body.action === "archive") {
      if (!body.item_id) return json({ error: "Item obrigatório" }, 400);
      const { data: current } = await supabase.from("chat_contact_memory_items").select("*").eq("id", body.item_id).eq("client_id", identity.clientId).eq("contact_id", contact.id).maybeSingle();
      if (!current) return json({ error: "Item não encontrado" }, 404);
      const patch = body.action === "archive"
        ? { status: "archived", updated_by_user_id: identity.userId, updated_by_name: identity.email }
        : { ...(body.category ? { category: body.category } : {}), ...(body.content ? { content: body.content } : {}), updated_by_user_id: identity.userId, updated_by_name: identity.email };
      const { data: updated, error } = await supabase.from("chat_contact_memory_items").update(patch).eq("id", current.id).select("*").single();
      if (error) throw error;
      await supabase.from("chat_contact_memory_history").insert({ memory_item_id: current.id, client_id: identity.clientId, contact_id: contact.id, action: body.action === "archive" ? "archived" : "updated", previous_value: itemSnapshot(current), new_value: itemSnapshot(updated), actor_user_id: identity.userId, actor_name: identity.email });
      return json({ item: updated });
    }

    const { data: state } = await supabase.from("chat_contact_memory_state").select("last_processed_at").eq("contact_id", contact.id).maybeSingle();
    let messageQuery = supabase
      .from("chat_messages")
      .select("id, conversation_id, text, type, from_me, internal_note, sender_name, media_url, metadata, timestamp")
      .eq("client_id", identity.clientId)
      .eq("contact_id", contact.id)
      .or("from_me.eq.false,internal_note.eq.true")
      .order("timestamp", { ascending: true })
      .limit(500);
    if (state?.last_processed_at) messageQuery = messageQuery.gt("timestamp", state.last_processed_at);
    let { data: messages } = await messageQuery;
    messages = messages || [];

    const pendingAudio = messages.filter((m: any) => ["audio", "ptt"].includes(m.type) && !transcriptionOf(m.metadata));
    const transcriptionFailures: string[] = [];
    for (const audio of pendingAudio.slice(0, 30)) {
      const { data, error } = await supabase.functions.invoke("chat-transcribe-audio", { body: { message_id: audio.id, internal: true } });
      if (error || data?.ok === false) transcriptionFailures.push(audio.id);
    }
    if (pendingAudio.length) {
      const { data: refreshed } = await messageQuery;
      messages = refreshed || messages;
    }

    const { data: conversations } = await supabase.from("chat_conversations").select("id, observations, updated_at").eq("client_id", identity.clientId).eq("contact_id", contact.id);
    const { data: summaries } = await supabase.from("chat_conversation_summaries").select("id, summary, atendimento, sentiment, created_at").eq("client_id", identity.clientId).eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(10);
    const sourceLines = messages.map((m: any) => {
      const tr = transcriptionOf(m.metadata);
      const content = tr || m.text || "";
      const source = m.internal_note ? "NOTA INTERNA" : (m.from_me ? "ATENDENTE" : "CLIENTE");
      return `${m.id}|${m.conversation_id}|${m.timestamp}|${m.type}|${source}|${m.sender_name || ""}|${content.slice(0, 1600)}`;
    }).filter((line: string) => line.split("|").at(-1)?.trim());
    for (const c of conversations || []) if (c.observations?.trim()) sourceLines.push(`observation-${c.id}|${c.id}|${c.updated_at}|observation|OBSERVAÇÃO|Equipe|${c.observations.slice(0, 1600)}`);
    const prior = (summaries || []).map((s: any) => `${s.created_at}: ${s.summary}${s.atendimento ? ` Atendimento: ${s.atendimento}` : ""}`).join("\n");
    if (!sourceLines.length) return json({ error: "Não há novidades para gerar memória", transcription_failures: transcriptionFailures }, 400);

    const ai = await resolveAI(supabase, "chat_resume");
    if (!ai.apiKey) return json({ error: "IA não configurada" }, 503);
    const prompt = `Organize uma memória factual de atendimento em português. Use somente fatos explícitos. Não invente nem infira. Retorne JSON válido: {"items":[{"category":"profile_context|needs_case|pains_objections|agreements_commitments|next_steps|team_observations","content":"texto conciso","source_id":"id da primeira coluna","source_type":"message|audio|internal_note|observation|summary","confidence":0.0}]}. Consolide duplicatas. Mensagens do atendente só entram quando forem compromisso explícito; notas internas entram em team_observations.\n\nRESUMOS ANTERIORES:\n${prior || "Nenhum"}\n\nFONTES NOVAS:\n${sourceLines.join("\n")}`;
    const started = Date.now();
    const response = await fetch(ai.endpoint, { method: "POST", headers: { Authorization: `Bearer ${ai.apiKey}`, "Content-Type": "application/json", ...providerHeaders(ai.provider) }, body: JSON.stringify({ model: ai.model, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } }) });
    const responseText = await response.text();
    if (!response.ok) {
      await logAIUsage(supabase, { client_id: identity.clientId, feature: "chat_resume", provider: ai.provider, endpoint: ai.endpoint, model: ai.model, status: "failed", duration_ms: Date.now() - started, error_reason: `ai_${response.status}`, context: { contact_id: contact.id, mode: "contact_memory" } });
      return json({ error: responseText || "Falha ao gerar memória" }, response.status);
    }
    const aiData = JSON.parse(responseText);
    const raw = aiData?.choices?.[0]?.message?.content ?? "{}";
    const parsedAi = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    const sourceMap = new Map(messages.map((m: any) => [m.id, m]));
    const prepared = (Array.isArray(parsedAi.items) ? parsedAi.items : []).filter((i: any) => CATEGORIES.includes(i.category) && String(i.content || "").trim()).slice(0, 60).map((i: any) => {
      const src = sourceMap.get(String(i.source_id));
      const sourceType = src && ["audio", "ptt"].includes(src.type) ? "audio" : (src?.internal_note ? "internal_note" : (String(i.source_type || "message")));
      return { client_id: identity.clientId, contact_id: contact.id, category: i.category, content: String(i.content).trim().slice(0, 4000), source_type: ["message","audio","internal_note","observation","summary"].includes(sourceType) ? sourceType : "message", source_message_id: src?.id ?? null, source_conversation_id: src?.conversation_id ?? null, source_at: src?.timestamp ?? new Date().toISOString(), source_author: src?.sender_name ?? (src?.from_me ? "Atendente" : "Cliente"), confidence: Math.max(0, Math.min(1, Number(i.confidence) || 0.8)), created_by_user_id: identity.userId, created_by_name: identity.email, updated_by_user_id: identity.userId, updated_by_name: identity.email };
    });
    let inserted: any[] = [];
    for (const row of prepared) {
      if (row.source_message_id) {
        const { data: duplicate } = await supabase.from("chat_contact_memory_items").select("id").eq("contact_id", contact.id).eq("source_message_id", row.source_message_id).eq("content", row.content).limit(1).maybeSingle();
        if (duplicate) continue;
      }
      const { data } = await supabase.from("chat_contact_memory_items").insert(row).select("*").single();
      if (data) inserted.push(data);
    }
    const lastSourceAt = messages.at(-1)?.timestamp ?? new Date().toISOString();
    await supabase.from("chat_contact_memory_state").upsert({ contact_id: contact.id, client_id: identity.clientId, last_processed_at: lastSourceAt, last_source_at: lastSourceAt, last_generated_at: new Date().toISOString(), last_generated_by_user_id: identity.userId, pending_source_count: 0 });
    await logAIUsage(supabase, { client_id: identity.clientId, feature: "chat_resume", provider: ai.provider, endpoint: ai.endpoint, model: ai.model, status: "ok", duration_ms: Date.now() - started, usage: aiData?.usage, context: { contact_id: contact.id, mode: "contact_memory", source_count: sourceLines.length, item_count: inserted.length } });
    return json({ items: inserted, transcription_failures: transcriptionFailures, processed_sources: sourceLines.length });
  } catch (error) {
    console.error("[chat-contact-memory]", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});