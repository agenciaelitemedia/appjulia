/**
 * Domínio: Chat, mensagens, anexos e auditoria do atendimento (Supabase).
 * Todas as consultas filtram `client_id` do token.
 */
import { buildLeadContext, type CopilotoMessage } from "../context.ts";
import { bullets, clip, fmtDate, MAX_MESSAGES, MAX_ROWS, num, str, type CopilotoContext, type CopilotoTool } from "../types.ts";

const MSG_FIELDS =
  "id, text, caption, type, from_me, internal_note, sender_name, file_name, timestamp, metadata, media_url, channel_type, message_id";

/* ------------------------- resolução de links de mídia --------------------- */

const MEDIA_TYPES = ["image", "video", "audio", "ptt", "sticker", "document"];
/** Máximo de arquivos materializados por leitura (evita estourar tempo da função). */
const MEDIA_LINK_CAP = 30;

function hasUsableLink(u: string | null | undefined): boolean {
  if (!u) return false;
  if (u.startsWith("waba_media:")) return false;
  if (u.includes(".enc") || u.includes("mmg.whatsapp.net")) return false;
  return /^https?:\/\//i.test(u);
}

/**
 * Materializa mídias criptografadas no bucket público chat-media (mesmo fluxo
 * do chat ao abrir a conversa) e devolve mapa message_id -> URL pública.
 */
async function resolveMediaLinks(messages: { id: string; type: string | null; media_url?: string | null }[]): Promise<Map<string, string>> {
  const targets = messages
    .filter((m) => MEDIA_TYPES.includes(String(m.type || "")) && !hasUsableLink(m.media_url ?? null))
    .slice(0, MEDIA_LINK_CAP);
  const out = new Map<string, string>();
  if (!targets.length) return out;

  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  for (let i = 0; i < targets.length; i += 5) {
    const chunk = targets.slice(i, i + 5);
    const results = await Promise.all(
      chunk.map(async (m) => {
        try {
          const res = await fetch(`${base}/functions/v1/chat-media-download`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({ messageId: m.id }),
          });
          if (!res.ok) return null;
          const json = await res.json();
          return typeof json?.url === "string" && json.url ? ([m.id, json.url] as const) : null;
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) if (r) out.set(r[0], r[1]);
  }
  return out;
}

/** Preenche `media_url` das mensagens com os links recém-materializados. */
function applyLinks<T extends { id: string; media_url?: string | null }>(messages: T[], links: Map<string, string>): T[] {
  for (const m of messages) {
    if (!hasUsableLink(m.media_url ?? null)) {
      const u = links.get(m.id);
      if (u) m.media_url = u;
    }
  }
  return messages;
}

export async function fetchContact(ctx: CopilotoContext, contactId: string) {
  const { data, error } = await ctx.supabase
    .from("chat_contacts")
    .select("id, name, phone, channel_type, channel_source, last_message_at")
    .eq("client_id", ctx.clientId)
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado neste escritório.");
  return data;
}

/** Resolve o contato a partir de conversation_id OU contato_id (sempre no escopo do token). */
export async function resolveTarget(
  ctx: CopilotoContext,
  args: { conversation_id?: string; contato_id?: string },
): Promise<{ contactId: string; conversationId: string | null }> {
  const conversationId = str(args.conversation_id);
  if (conversationId) {
    const { data, error } = await ctx.supabase
      .from("chat_conversations")
      .select("id, contact_id")
      .eq("client_id", ctx.clientId)
      .eq("id", conversationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Conversa não encontrada neste escritório.");
    return { contactId: data.contact_id, conversationId: data.id };
  }
  const contactId = str(args.contato_id);
  if (!contactId) throw new Error("Informe conversation_id ou contato_id.");
  await fetchContact(ctx, contactId);
  return { contactId, conversationId: null };
}

export async function compileLeadContext(
  ctx: CopilotoContext,
  contactId: string,
  limit = MAX_MESSAGES,
  opts?: { withLinks?: boolean; maxMessages?: number },
) {
  const contact = await fetchContact(ctx, contactId);
  const cap = opts?.maxMessages ?? MAX_MESSAGES;
  const { data, error } = await ctx.supabase
    .from("chat_messages")
    .select(MSG_FIELDS)
    .eq("client_id", ctx.clientId)
    .eq("contact_id", contactId)
    .order("timestamp", { ascending: false })
    .limit(num(limit, cap, cap));
  if (error) throw new Error(error.message);
  // deno-lint-ignore no-explicit-any
  let messages = (data || []) as any[];
  if (opts?.withLinks !== false) {
    const links = await resolveMediaLinks(messages);
    applyLinks(messages, links);
  }
  return buildLeadContext(
    {
      contactId,
      conversationId: null,
      name: contact.name ?? null,
      phone: contact.phone ?? null,
      channel: contact.channel_type ?? null,
    },
    messages as CopilotoMessage[],
  );
}

export const chatTools: CopilotoTool[] = [
  {
    name: "julia_chat_listar_conversas",
    description:
      "Lista atendimentos do inbox do escritório com filtros (status, fila, responsável, busca por nome/telefone). Retorna protocolo, canal, prioridade, responsável e datas — use o conversation_id nas demais tools.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["all", "pending", "open", "resolved", "closed"], description: "Status do atendimento (padrão: all)." },
        queue_id: { type: "string", description: "UUID da fila." },
        assigned_user_id: { type: "string", description: "ID do atendente responsável." },
        busca: { type: "string", description: "Nome ou telefone do lead." },
        limite: { type: "number", description: "Máx. 200 (padrão 20)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const limit = num(args.limite, 20, MAX_ROWS);
      let contactIds: string[] | null = null;
      const busca = str(args.busca);
      if (busca) {
        const digits = busca.replace(/\D/g, "");
        let q = ctx.supabase.from("chat_contacts").select("id").eq("client_id", ctx.clientId).limit(200);
        q = digits.length >= 4 ? q.ilike("phone", `%${digits}%`) : q.ilike("name", `%${busca}%`);
        const { data } = await q;
        contactIds = (data || []).map((c: { id: string }) => c.id);
        if (!contactIds.length) return "Nenhuma conversa encontrada para esta busca.";
      }

      let query = ctx.supabase
        .from("chat_conversations")
        .select("id, protocol, status, priority, channel, queue_id, assigned_to, assigned_user_id, opened_at, updated_at, contact_id, snoozed_until")
        .eq("client_id", ctx.clientId)
        .order("updated_at", { ascending: false })
        .limit(limit);

      const status = str(args.status);
      if (status && status !== "all") query = query.eq("status", status);
      if (str(args.queue_id)) query = query.eq("queue_id", str(args.queue_id));
      if (str(args.assigned_user_id)) query = query.eq("assigned_user_id", str(args.assigned_user_id));
      if (contactIds) query = query.in("contact_id", contactIds);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhuma conversa encontrada com esses filtros.";

      const ids = [...new Set(data.map((c: { contact_id: string }) => c.contact_id))];
      const { data: contacts } = await ctx.supabase
        .from("chat_contacts")
        .select("id, name, phone")
        .in("id", ids);
      const byId = new Map((contacts || []).map((c: { id: string }) => [c.id, c]));

      // deno-lint-ignore no-explicit-any
      return data
        .map((c: any) => {
          const ct = byId.get(c.contact_id) as { name?: string; phone?: string } | undefined;
          return [
            `- ${ct?.name || "(sem nome)"} · ${ct?.phone || "sem telefone"}`,
            `protocolo ${c.protocol || "—"} · status ${c.status} · prioridade ${c.priority || "normal"} · canal ${c.channel || "whatsapp"}`,
            `responsável ${c.assigned_to || "sem responsável"} · atualizado ${fmtDate(c.updated_at)}${c.snoozed_until ? ` · pausado até ${fmtDate(c.snoozed_until)}` : ""}`,
            `  conversation_id: ${c.id} · contato_id: ${c.contact_id}`,
          ].join("\n  ");
        })
        .join("\n");
    },
  },
  {
    name: "julia_chat_obter_conversa",
    description:
      "Dossiê de um atendimento: protocolo, fila, responsável, prioridade, tempos de SLA (primeira resposta e resolução), motivo e nota de encerramento, tags, pausa (snooze) e ticket vinculado.",
    inputSchema: {
      type: "object",
      properties: { conversation_id: { type: "string", description: "UUID da conversa." } },
      required: ["conversation_id"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const id = str(args.conversation_id);
      const { data: c, error } = await ctx.supabase
        .from("chat_conversations")
        .select("*")
        .eq("client_id", ctx.clientId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!c) throw new Error("Conversa não encontrada neste escritório.");

      const contact = await fetchContact(ctx, c.contact_id);
      const [{ data: queue }, { data: tags }] = await Promise.all([
        c.queue_id
          ? ctx.supabase.from("queues").select("name, channel_type").eq("id", c.queue_id).maybeSingle()
          : Promise.resolve({ data: null }),
        ctx.supabase.from("chat_conversation_tags").select("tag_id, chat_tags(name)").eq("conversation_id", id),
      ]);

      const tagNames = (tags || [])
        // deno-lint-ignore no-explicit-any
        .map((t: any) => t.chat_tags?.name)
        .filter(Boolean)
        .join(", ");

      return [
        "=== ATENDIMENTO ===",
        `Cliente: ${contact.name || "não informado"} · ${contact.phone || "sem telefone"}`,
        `Protocolo: ${c.protocol || "—"} · Status: ${c.status} · Prioridade: ${c.priority || "normal"}`,
        `Canal: ${c.channel || "whatsapp"} · Fila: ${queue?.name || "sem fila"}`,
        `Responsável: ${c.assigned_to || "sem responsável"} (atribuído em ${fmtDate(c.assigned_at)})`,
        `Departamento: ${c.department || "—"} · Tags: ${tagNames || "nenhuma"}`,
        `Aberto em: ${fmtDate(c.opened_at)} · 1ª resposta: ${fmtDate(c.first_response_at)}`,
        `Resolvido em: ${fmtDate(c.resolved_at)} · Fechado em: ${fmtDate(c.closed_at)}`,
        `Última mensagem do cliente: ${fmtDate(c.last_customer_message_at)}`,
        c.snoozed_until ? `Pausado até ${fmtDate(c.snoozed_until)} (${c.snooze_reason || "sem motivo"})` : null,
        c.close_reason || c.close_note
          ? `Encerramento: ${c.close_reason || "—"}${c.close_note ? ` — ${c.close_note}` : ""}`
          : null,
        c.active_ticket_protocol ? `Ticket vinculado: ${c.active_ticket_protocol} (#${c.active_ticket_number})` : null,
        c.observations ? `Observações: ${c.observations}` : null,
        `contato_id: ${c.contact_id}`,
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
  {
    name: "julia_chat_ler_mensagens",
    description:
      "Histórico cronológico da conversa do lead (até 100 mensagens), com papel (CLIENTE / ATENDENTE / NOTA INTERNA), transcrição de áudios e nomes dos anexos. Aceita conversation_id ou contato_id.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "UUID da conversa." },
        contato_id: { type: "string", description: "ID do contato (alternativa ao conversation_id)." },
        limite: { type: "number", description: "Quantidade de mensagens (máx. 100)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const { contactId } = await resolveTarget(ctx, args);
      const compiled = await compileLeadContext(ctx, contactId, num(args.limite, MAX_MESSAGES, MAX_MESSAGES));
      return clip(compiled.text, 24000);
    },
  },
  {
    name: "julia_chat_listar_arquivos",
    description:
      "Lista os anexos trocados no atendimento (documentos, imagens, áudios, vídeos) com nome do arquivo, quem enviou, data e message_id para leitura do conteúdo.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "UUID da conversa." },
        contato_id: { type: "string", description: "ID do contato (alternativa)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const { contactId } = await resolveTarget(ctx, args);
      const { data, error } = await ctx.supabase
        .from("chat_messages")
        .select("id, type, file_name, caption, from_me, timestamp, media_url")
        .eq("client_id", ctx.clientId)
        .eq("contact_id", contactId)
        .in("type", ["document", "image", "audio", "ptt", "video"])
        .order("timestamp", { ascending: false })
        .limit(MAX_ROWS);
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhum anexo neste atendimento.";
      // deno-lint-ignore no-explicit-any
      return data
        .map(
          (m: any) =>
            `- ${m.file_name || `(${m.type} sem nome)`} · tipo ${m.type} · enviado por ${m.from_me ? "ATENDENTE" : "CLIENTE"} · ${fmtDate(m.timestamp)}${
              m.caption ? ` · legenda: ${m.caption}` : ""
            }\n  message_id: ${m.id}${m.media_url ? "" : " (sem mídia armazenada)"}`,
        )
        .join("\n");
    },
  },
  {
    name: "julia_chat_ler_conteudo_arquivo",
    description:
      "Extrai o texto de um anexo (PDF ou texto) enviado no atendimento, para leitura de contratos, holerites, extratos e certidões. Imagens sem camada de texto retornam aviso.",
    inputSchema: {
      type: "object",
      properties: {
        message_id: { type: "string", description: "ID da mensagem que contém o arquivo (de julia_chat_listar_arquivos)." },
        max_paginas: { type: "number", description: "Limite de páginas do PDF (padrão 10, máx. 30)." },
      },
      required: ["message_id"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const { data: msg, error } = await ctx.supabase
        .from("chat_messages")
        .select("id, type, file_name, media_url, text, caption")
        .eq("client_id", ctx.clientId)
        .eq("id", str(args.message_id))
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!msg) throw new Error("Mensagem não encontrada neste escritório.");
      if (!msg.media_url) return "Esta mensagem não tem arquivo armazenado para leitura.";

      const maxPages = num(args.max_paginas, 10, 30);
      const res = await fetch(msg.media_url);
      if (!res.ok) return `Não foi possível baixar o arquivo (HTTP ${res.status}).`;
      const buf = new Uint8Array(await res.arrayBuffer());
      const name = String(msg.file_name || "").toLowerCase();

      if (name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".json")) {
        return clip(new TextDecoder().decode(buf));
      }

      const isPdf = name.endsWith(".pdf") || (buf[0] === 0x25 && buf[1] === 0x50);
      if (!isPdf) {
        return `Arquivo "${msg.file_name || msg.type}" não é PDF nem texto — extração automática indisponível. Legenda registrada: ${
          msg.caption || msg.text || "(nenhuma)"
        }`;
      }

      try {
        const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
        const pdf = await getDocumentProxy(buf);
        const { text, totalPages } = await extractText(pdf, { mergePages: false });
        const pages = (Array.isArray(text) ? text : [String(text)]).slice(0, maxPages);
        return clip(
          `=== ${msg.file_name || "documento.pdf"} (${totalPages} páginas, exibindo ${pages.length}) ===\n\n` +
            pages.map((p: string, i: number) => `--- página ${i + 1} ---\n${p}`).join("\n\n"),
          20000,
        );
      } catch (e) {
        return `Falha ao extrair o texto do PDF "${msg.file_name}": ${(e as Error).message}`;
      }
    },
  },
  {
    name: "julia_chat_historico_atendimento",
    description:
      "Linha do tempo de auditoria do atendimento: abertura, transferências entre atendentes, devoluções à fila, pausas (snooze) e encerramentos.",
    inputSchema: {
      type: "object",
      properties: { conversation_id: { type: "string", description: "UUID da conversa." } },
      required: ["conversation_id"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const { conversationId } = await resolveTarget(ctx, args);
      const { data, error } = await ctx.supabase
        .from("chat_conversation_history")
        .select("action, actor_name, from_value, to_value, notes, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(MAX_ROWS);
      if (error) throw new Error(error.message);
      if (!data?.length) return "Sem eventos de auditoria neste atendimento.";
      // deno-lint-ignore no-explicit-any
      return data
        .map(
          (h: any) =>
            `- [${fmtDate(h.created_at)}] ${h.action}${h.actor_name ? ` por ${h.actor_name}` : ""}${
              h.from_value || h.to_value ? ` (${h.from_value || "—"} → ${h.to_value || "—"})` : ""
            }${h.notes ? ` · ${h.notes}` : ""}`,
        )
        .join("\n");
    },
  },
  {
    name: "julia_chat_listar_resumos",
    description:
      "Resumos de IA já gravados no atendimento (gerados no encerramento ou manualmente), com sentimento, período coberto e quantidade de mensagens.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "UUID da conversa." },
        contato_id: { type: "string", description: "ID do contato (alternativa)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const { contactId } = await resolveTarget(ctx, args);
      const { data, error } = await ctx.supabase
        .from("chat_conversation_summaries")
        .select("summary, atendimento, sentiment, message_count, first_message_ts, last_message_ts, triggered_by, created_at")
        .eq("client_id", ctx.clientId)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhum resumo gravado para este lead.";
      // deno-lint-ignore no-explicit-any
      return data
        .map(
          (s: any) =>
            `### Resumo de ${fmtDate(s.created_at)} (${s.triggered_by || "automático"}) — sentimento ${s.sentiment || "—"}, ${s.message_count || 0} mensagens\n${
              s.summary || "(sem texto)"
            }${s.atendimento ? `\nAtendimento: ${s.atendimento}` : ""}`,
        )
        .join("\n\n");
    },
  },
  {
    name: "julia_chat_listar_tags",
    description: "Lista as tags/etiquetas cadastradas no escritório, usadas para classificar atendimentos.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (ctx) => {
      const { data, error } = await ctx.supabase
        .from("chat_tags")
        .select("id, name, color")
        .eq("client_id", ctx.clientId)
        .order("name");
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhuma tag cadastrada.";
      return bullets(data, [["name", "tag"], ["id", "id"]]);
    },
  },
];
