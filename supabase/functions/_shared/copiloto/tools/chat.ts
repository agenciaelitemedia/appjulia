/**
 * Domínio: Chat, mensagens, anexos e auditoria do atendimento (Supabase).
 * Todas as consultas filtram `client_id` do token.
 */
import { buildLeadContext, type CopilotoMessage } from "../context.ts";
import { bullets, clip, fmtDate, MAX_MESSAGES, MAX_ROWS, num, str, type CopilotoContext, type CopilotoTool } from "../types.ts";
import {
  coverage,
  dateOut,
  dayRangeInTz,
  invalid,
  ok,
  periodRangeInTz,
  safeDbError,
  tzOf,
  zonedInputToUtcIso,
} from "../envelope.ts";
import { agentCodes, legacyRaw } from "../legacy.ts";

const MSG_FIELDS =
  "id, text, caption, type, from_me, internal_note, sender_name, file_name, timestamp, metadata, media_url, channel_type, message_id";

/* ----------------------------- origem do lead ------------------------------ */

export interface LeadCampaign {
  campanha_id: string | null;
  titulo: string | null;
  plataforma: string | null;
  url: string | null;
  entrou_em: string | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp_uazapi: "WhatsApp (API não oficial)",
  whatsapp_waba: "WhatsApp (API Oficial Meta)",
  instagram: "Instagram Direct",
  webchat: "WebChat do site",
};

/** Frase curta de origem, sempre preenchida (nunca devolve lacuna silenciosa). */
// deno-lint-ignore no-explicit-any
function describeOrigin(r: any, campanha: LeadCampaign | null): string {
  const canal = String(r.channel || r.channel_type || "");
  const parts = [CHANNEL_LABELS[canal] || canal || "canal não identificado"];
  if (r.channel_source) parts.push(`origem ${r.channel_source}`);
  if (r.queue_name) parts.push(`fila ${r.queue_name}`);
  if (r.cod_agent) parts.push(`agente ${r.cod_agent}`);
  if (campanha) {
    parts.push(`campanha ${campanha.titulo || campanha.campanha_id}${campanha.plataforma ? ` (${campanha.plataforma})` : ""}`);
  } else {
    parts.push("sem campanha de anúncio registrada");
  }
  return parts.join(" · ");
}

/**
 * Campanha de anúncio (Meta Ads) do lead, no banco legado `campaing_ads`,
 * casada por telefone normalizado e escopada aos cod_agent do escritório.
 */
async function fetchCampaignOrigins(
  ctx: CopilotoContext,
  // deno-lint-ignore no-explicit-any
  rows: any[],
  warnings: string[],
): Promise<Map<string, LeadCampaign>> {
  const map = new Map<string, LeadCampaign>();
  const phones = [...new Set(rows.map((r) => String(r.phone || "").replace(/\D/g, "")).filter((p) => p.length >= 8))];
  if (!phones.length) return map;

  try {
    const codes = await agentCodes(ctx);
    if (!codes.length) return map;
    const legacyRows = await legacyRaw<{
      matched_phone: string;
      created_at: string;
      // deno-lint-ignore no-explicit-any
      campaign_data: any;
    }>(
      ctx,
      `SELECT DISTINCT ON (matched_phone)
              regexp_replace(COALESCE(NULLIF((ca.campaign_data::jsonb)->>'phone',''), s.whatsapp_number::text, ''), '\\D', '', 'g') AS matched_phone,
              ca.created_at,
              (ca.campaign_data::jsonb) AS campaign_data
         FROM campaing_ads ca
         LEFT JOIN sessions s ON s.id = ca.session_id::bigint
        WHERE ca.cod_agent::text = ANY($1::varchar[])
          AND regexp_replace(COALESCE(NULLIF((ca.campaign_data::jsonb)->>'phone',''), s.whatsapp_number::text, ''), '\\D', '', 'g') = ANY($2::varchar[])
        ORDER BY matched_phone, ca.created_at DESC`,
      [codes, phones],
    );
    for (const row of legacyRows) {
      const d = row.campaign_data || {};
      map.set(String(row.matched_phone), {
        campanha_id: d.sourceID ?? null,
        titulo: d.title ?? null,
        plataforma: d.sourceApp ?? null,
        url: d.sourceURL ?? null,
        entrou_em: row.created_at ?? null,
      });
    }
  } catch {
    warnings.push("Origem de campanha indisponível nesta consulta (banco legado não respondeu); canal e fila seguem completos.");
  }
  return map;
}


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

/* --------------------------- identificadores -------------------------------
 * Busca por telefone/protocolo é conclusiva: se não achou, não existe NESTE
 * escritório. Nunca sugerir paginação nesse caso.
 * -------------------------------------------------------------------------- */

/** Normaliza protocolo: aceita `#2026-059468`, `2026-059468` e `2026059468`. */
function protocolTerm(raw: string): string | null {
  const d = raw.replace(/[^0-9]/g, "");
  if (d.length < 6) return null;
  // O armazenado é `#AAAA-NNNNNN`; casar pelo sufixo numérico cobre as 3 formas.
  return d.length > 4 ? d.slice(4) : d;
}

/**
 * Termo de busca para telefone. Usa os 8 últimos dígitos porque números BR
 * podem estar gravados com ou sem o 9º dígito (13 vs 12 dígitos) e a busca da
 * consulta unificada é um ILIKE simples.
 */
function phoneTerm(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 8) return null;
  return d.slice(-8);
}

export interface IdentifierSearch {
  kind: "telefone" | "protocolo" | "texto";
  term: string;
}

/** Classifica o valor de `busca` e devolve o termo efetivo para o ILIKE. */
export function classifySearch(raw: string): IdentifierSearch {
  const value = raw.trim();
  if (!value) return { kind: "texto", term: value };
  const digits = value.replace(/\D/g, "");
  const looksProtocol = /^#?\d{4}-?\d{4,8}$/.test(value.replace(/\s/g, ""));
  if (looksProtocol) {
    const t = protocolTerm(value);
    if (t) return { kind: "protocolo", term: t };
  }
  // Só dígitos (ou dígitos com máscara telefônica) e tamanho de telefone.
  if (digits.length >= 8 && /^[\d\s()+\-.]+$/.test(value)) {
    const t = phoneTerm(value);
    if (t) return { kind: "telefone", term: t };
  }
  return { kind: "texto", term: value };
}

export const chatTools: CopilotoTool[] = [
  {
    name: "julia_chat_listar_conversas",
    version: "1.3.0",
    description:
      "Lista atendimentos do inbox com a MESMA consulta unificada da tela de chat: contato, ORIGEM do lead (canal, canal de origem, fila, agente e campanha de anúncio quando registrada), fila, status, prioridade, protocolo, responsável, não lidas, última mensagem, SLA, etiquetas, ticket e CRM. A busca aceita nome, telefone (com ou sem máscara e com ou sem o 9º dígito) OU protocolo do atendimento — para localizar um registro específico prefira `julia_chat_localizar`. Janelas de tempo são resolvidas no fuso do escritório (padrão America/Sao_Paulo): use `data` para um dia civil completo 00:00–23:59:59.999 ou `de`/`ate`. Use o conversation_id nas demais tools.",

    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["all", "pending", "open", "resolved", "closed"], description: "Status do atendimento (padrão: all)." },
        tab: { type: "string", enum: ["individual", "groups"], description: "Aba: individuais ou grupos (padrão: ambos)." },
        queue_id: { type: "string", description: "UUID da fila." },
        queue_ids: { type: "array", items: { type: "string" }, description: "Várias filas (UUIDs)." },
        responsavel: { type: "string", description: "Nome do atendente responsável (ex.: 'Dra. Nicole')." },
        assigned_user_id: { type: "string", description: "ID numérico do atendente responsável." },
        unassigned: { type: "boolean", description: "true = somente sem responsável." },
        busca: {
          type: "string",
          description:
            "Nome, telefone (com ou sem máscara e com ou sem o 9º dígito) OU protocolo do atendimento (#2026-059468, 2026-059468 ou 2026059468).",
        },
        incluir_pausados: {
          type: "boolean",
          description: "Incluir atendimentos pausados (snooze). Padrão: false; forçado a true quando a busca é por telefone/protocolo.",
        },

        periodo: { type: "string", enum: ["all", "today", "7d", "30d", "3m", "month"], description: "Período relativo da última movimentação, resolvido no fuso informado (padrão: all)." },
        data: { type: "string", description: "Dia civil completo no fuso do escritório (YYYY-MM-DD): 00:00:00.000 até 23:59:59.999." },
        de: { type: "string", description: "Início da janela. Aceita YYYY-MM-DD, YYYY-MM-DDTHH:mm (hora local do fuso) ou ISO com offset." },
        ate: { type: "string", description: "Fim da janela, mesmo formato de `de`." },
        timezone: { type: "string", description: "IANA time zone usado nas janelas e na formatação (padrão America/Sao_Paulo)." },
        tag_ids: { type: "array", items: { type: "string" }, description: "UUIDs de etiquetas." },
        prioridade: { type: "string", enum: ["low", "normal", "high", "urgent"], description: "Prioridade da conversa." },
        com_ticket: { type: "boolean", description: "true = só com ticket vinculado." },
        com_crm_builder: { type: "boolean", description: "true = só com card no CRM Builder." },
        sla: { type: "array", items: { type: "string", enum: ["on_track", "at_risk", "breached"] }, description: "Situação de SLA." },
        ordenar: { type: "string", enum: ["recent", "oldest", "unread", "sla"], description: "Ordenação (padrão: recent)." },
        incluir_origem_campanha: { type: "boolean", description: "Busca a campanha de anúncio no banco legado (padrão: true)." },
        limite: { type: "number", description: "Máx. 200 (padrão 20)." },
        offset: { type: "number", description: "Pular N registros (paginação)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const tz = tzOf(args);
      const limit = num(args.limite, 20, MAX_ROWS);
      const offset = Math.max(0, Math.floor(Number(args.offset) || 0));
      const warnings: string[] = [];

      // Janela de tempo — sempre no fuso do escritório, nunca no UTC do runtime.
      let from: string | null = null;
      let to: string | null = null;
      let janelaOrigem = "sem filtro de período";
      const dataDia = str(args.data);
      const de = str(args.de);
      const ate = str(args.ate);
      const periodo = str(args.periodo);

      if (dataDia) {
        const r = dayRangeInTz(dataDia, tz);
        from = r.from;
        to = r.to;
        janelaOrigem = `dia civil ${dataDia} (${tz})`;
      } else if (de || ate) {
        from = zonedInputToUtcIso(de, "de", tz);
        to = zonedInputToUtcIso(ate, "ate", tz);
        janelaOrigem = `intervalo informado (${tz})`;
      } else if (periodo && periodo !== "all") {
        const r = periodRangeInTz(periodo, tz);
        if (r) {
          from = r.from;
          to = r.to;
          janelaOrigem = `período "${periodo}" (${tz})`;
        }
      }
      if (from && to && new Date(from) > new Date(to)) throw invalid("`de` não pode ser posterior a `ate`.");

      const queueIds = Array.isArray(args.queue_ids) ? args.queue_ids.filter(Boolean).map(String) : [];
      if (str(args.queue_id) && !queueIds.includes(str(args.queue_id))) queueIds.push(str(args.queue_id));
      const owners = str(args.responsavel) ? [str(args.responsavel)] : null;
      const sla = Array.isArray(args.sla) ? args.sla.filter(Boolean).map(String) : null;
      const tagIds = Array.isArray(args.tag_ids) ? args.tag_ids.filter(Boolean).map(String) : null;

      // Busca: telefone e protocolo são identificadores — resultado vazio é conclusivo.
      const rawSearch = str(args.busca);
      const search = rawSearch ? classifySearch(rawSearch) : null;
      const isIdentifier = !!search && search.kind !== "texto";
      if (search && search.kind === "telefone" && search.term !== rawSearch.replace(/\D/g, "")) {
        warnings.push(`Telefone pesquisado pelos 8 últimos dígitos (${search.term}) para cobrir números com e sem o 9º dígito.`);
      }
      // Identificador nunca deve ter ponto cego: inclui pausados (snooze).
      const hideSnoozed = isIdentifier ? false : args.incluir_pausados === true ? false : true;

      const { data: feed, error } = await ctx.supabase.rpc("chat_list_feed", {
        p_client_id: ctx.clientId,
        p_queue_ids: queueIds.length ? queueIds : null,
        p_status: str(args.status) && str(args.status) !== "all" ? str(args.status) : null,
        p_tab: str(args.tab) || null,
        p_owners: owners,
        p_unassigned: typeof args.unassigned === "boolean" ? args.unassigned : null,
        p_search: search ? search.term : null,

        p_from: from,
        p_to: to,
        p_tag_ids: tagIds?.length ? tagIds : null,
        p_priority: str(args.prioridade) || null,
        p_has_ticket: typeof args.com_ticket === "boolean" ? args.com_ticket : null,
        p_has_crm_builder: typeof args.com_crm_builder === "boolean" ? args.com_crm_builder : null,
        p_sla_status: sla?.length ? sla : null,
        p_sort: str(args.ordenar) || "recent",
        p_hide_snoozed: hideSnoozed,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw safeDbError("database", error);

      // deno-lint-ignore no-explicit-any
      const rows: any[] = Array.isArray(feed?.rows) ? feed.rows : [];
      const assignedUserId = str(args.assigned_user_id);
      const filtered = assignedUserId ? rows.filter((r) => String(r.assigned_user_id) === assignedUserId) : rows;
      if (assignedUserId && filtered.length !== rows.length) {
        warnings.push("Filtro assigned_user_id aplicado após a página do banco; contadores referem-se ao escopo sem esse filtro.");
      }

      // Origem do lead: canal/fila sempre; campanha de anúncio no banco legado (best-effort).
      const campanhas = (args.incluir_origem_campanha === false ? new Map() : await fetchCampaignOrigins(ctx, filtered, warnings)) as Map<
        string,
        LeadCampaign
      >;

      const itens = filtered.map((r) => {
        const digits = String(r.phone || "").replace(/\D/g, "");
        const campanha = campanhas.get(digits) ?? null;
        return {
          conversation_id: r.conversation_id,
          contato_id: r.contact_id,
          contato: r.contact_name || null,
          nome_completo: r.lead_full_name || null,
          telefone: r.phone || null,
          is_grupo: !!r.is_group,
          origem: {
            canal: r.channel || r.channel_type || null,
            canal_origem: r.channel_source || null,
            fila_id: r.queue_id ?? null,
            fila: r.queue_name || null,
            cod_agent: r.cod_agent ?? null,
            campanha,
            resumo: describeOrigin(r, campanha),
          },
          fila: r.queue_name || null,
          status: r.status,
          prioridade: r.priority || "normal",
          protocolo: r.protocol || null,
          responsavel: r.assigned_to || null,
          assigned_user_id: r.assigned_user_id ?? null,
          nao_lidas: r.unread_count ?? 0,
          ultima_mensagem: {
            ...dateOut(r.last_message_at, tz),
            texto: r.last_message_text ? clip(String(r.last_message_text), 200) : null,
            do_escritorio: r.last_message_from_me ?? null,
          },
          aberta_em: dateOut(r.opened_at, tz),
          sla: r.sla_status
            ? { tipo: r.sla_type || null, situacao: r.sla_status, minutos_restantes: r.sla_remaining_minutes ?? null, meta_minutos: r.sla_target_minutes ?? null }
            : null,
          etiquetas: (r.tags || []).map((t: { name: string }) => t.name),
          ticket: r.active_ticket_protocol ? { protocolo: r.active_ticket_protocol, numero: r.active_ticket_number ?? null } : null,
          crm: {
            builder_board: r.crm_board_name || null,
            builder_pipeline: r.crm_pipeline_name || null,
            julia_etapa: r.julia_stage_name || null,
          },
          pausado_ate: r.snoozed_until ? dateOut(r.snoozed_until, tz) : null,
          sessao_julia_ativa: r.session_is_active ?? null,
        };
      });

      const c = feed?.counters || {};
      const body = itens.length
        ? itens
            .map((i) => {
              const slaPart = i.sla
                ? ` · SLA ${i.sla.tipo || ""} ${i.sla.situacao}${
                    i.sla.minutos_restantes != null
                      ? ` (${Math.abs(i.sla.minutos_restantes)}min ${i.sla.minutos_restantes >= 0 ? "restantes" : "estourado"})`
                      : ""
                  }`
                : "";
              return [
                `- ${i.contato || "(sem nome)"} · ${i.telefone || "sem telefone"} · origem: ${i.origem.resumo}`,
                `fila ${i.fila || "sem fila"} · status ${i.status} · prioridade ${i.prioridade} · protocolo ${i.protocolo || "—"} · não lidas ${i.nao_lidas}`,
                `responsável ${i.responsavel || "sem responsável"} · última msg ${i.ultima_mensagem.legivel}${
                  i.ultima_mensagem.texto ? `: "${clip(i.ultima_mensagem.texto, 80)}"` : ""
                }${slaPart}${i.pausado_ate ? ` · pausado até ${i.pausado_ate.legivel}` : ""}`,
                `${i.etiquetas.join(", ") || "sem etiquetas"}${i.ticket ? ` · ticket ${i.ticket.protocolo} (#${i.ticket.numero})` : ""}${
                  i.crm.builder_board ? ` · CRM Builder: ${i.crm.builder_board}${i.crm.builder_pipeline ? ` / ${i.crm.builder_pipeline}` : ""}` : ""
                }${i.crm.julia_etapa ? ` · CRM Julia: ${i.crm.julia_etapa}` : ""}`,
                `  conversation_id: ${i.conversation_id} · contato_id: ${i.contato_id}`,
              ].join("\n  ");
            })
            .join("\n")
        : isIdentifier
        ? `CONCLUSIVO: nenhum atendimento com esse ${search!.kind} (${rawSearch}) existe no escritório desta sessão (client_id ${ctx.clientId}). ` +
          "A busca cobriu todos os status e também os atendimentos pausados. Não pagine nem varra a lista: o identificador não pertence a este escritório. " +
          "Se o registro deveria existir, a conexão OAuth em uso está vinculada a outro escritório."
        : "Nenhuma conversa encontrada com esses filtros.";

      const janelaTxt = from || to
        ? `Janela (${tz}): ${dateOut(from, tz).legivel} → ${dateOut(to, tz).legivel} [UTC ${from ?? "—"} → ${to ?? "—"}]`
        : `Janela: ${janelaOrigem}`;

      const text = clip(
        [
          body,
          "",
          "=== JANELA E FUSO ===",
          janelaTxt,
          search ? `Busca: ${rawSearch} (interpretada como ${search.kind}${isIdentifier ? `, termo "${search.term}"` : ""})` : null,
          "=== CONTADORES DO ESCOPO ===",
          `total ${c.total ?? "—"} · pendentes ${c.pending ?? "—"} · abertos ${c.open ?? "—"} · resolvidos ${c.resolved ?? "—"} · fechados ${c.closed ?? "—"} · não lidas ${c.unread ?? "—"}`,
          c.sla_breached != null || c.sla_at_risk != null ? `SLA estourado ${c.sla_breached ?? 0} · em risco ${c.sla_at_risk ?? 0}` : null,
          isIdentifier && !itens.length
            ? "Fim da busca por identificador — nada a paginar."
            : feed?.has_more
            ? `Há mais resultados — repita com offset ${offset + itens.length}.`
            : "Fim da lista para esta janela.",
          warnings.length ? `Avisos: ${warnings.join(" | ")}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        24000,
      );


      return ok(
        {
          itens,
          contadores: c,
          janela: { de: from, ate: to, timezone: tz, origem: janelaOrigem },
          proximo_offset: feed?.has_more ? offset + itens.length : null,
        },
        {
          requestId: ctx.requestId ?? "",
          toolName: "julia_chat_listar_conversas",
          toolVersion: "1.2.0",
          timezone: tz,
          coverage: coverage({ complete: !feed?.has_more, from, to, warnings }),
          pagination: { has_more: !!feed?.has_more, next_cursor: null, total_count: typeof c.total === "number" ? c.total : null },
          text,
        },
      );
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
      "Histórico cronológico da conversa do lead (até 200 mensagens), no mesmo padrão do chat: papel (CLIENTE / ATENDENTE / NOTA INTERNA), transcrição de áudios e LINK público de cada arquivo (imagem, áudio, vídeo, documento) para leitura pela IA. Aceita conversation_id ou contato_id.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "UUID da conversa." },
        contato_id: { type: "string", description: "ID do contato (alternativa ao conversation_id)." },
        limite: { type: "number", description: "Quantidade de mensagens (máx. 200)." },
        incluir_links: { type: "boolean", description: "Incluir links dos arquivos de mídia (padrão: true)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const { contactId } = await resolveTarget(ctx, args);
      const withLinks = typeof args.incluir_links === "boolean" ? args.incluir_links : true;
      const compiled = await compileLeadContext(ctx, contactId, num(args.limite, MAX_MESSAGES, 200), {
        withLinks,
        maxMessages: 200,
      });
      return clip(compiled.text, 24000);
    },
  },
  {
    name: "julia_chat_listar_arquivos",
    description:
      "Lista os anexos trocados no atendimento (documentos, imagens, áudios, vídeos) com nome, quem enviou, data, LINK público do arquivo e message_id para extração de texto.",
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
        .in("type", ["document", "image", "audio", "ptt", "video", "sticker"])
        .order("timestamp", { ascending: false })
        .limit(MAX_ROWS);
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhum anexo neste atendimento.";
      // deno-lint-ignore no-explicit-any
      const messages = data as any[];
      applyLinks(messages, await resolveMediaLinks(messages));
      return clip(
        messages
          .map(
            (m) =>
              `- ${m.file_name || `(${m.type} sem nome)`} · tipo ${m.type} · enviado por ${m.from_me ? "ATENDENTE" : "CLIENTE"} · ${fmtDate(m.timestamp)}${
                m.caption ? ` · legenda: ${m.caption}` : ""
              }\n  message_id: ${m.id}\n  arquivo: ${hasUsableLink(m.media_url) ? m.media_url : "(link indisponível)"}`,
          )
          .join("\n"),
        24000,
      );
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

      // Materializa a mídia criptografada (UaZapi .enc / waba_media:) se necessário.
      if (!hasUsableLink(msg.media_url)) {
        const links = await resolveMediaLinks([{ id: msg.id, type: msg.type, media_url: msg.media_url }]);
        const u = links.get(msg.id);
        if (u) msg.media_url = u;
      }
      if (!hasUsableLink(msg.media_url)) {
        return "Esta mensagem não tem arquivo armazenado para leitura (mídia expirada ou indisponível no provedor).";
      }

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
