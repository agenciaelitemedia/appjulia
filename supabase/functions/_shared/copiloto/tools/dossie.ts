/**
 * Domínio complementar (P1 do backlog):
 * - documentos/mídias da conversa com link legível;
 * - timeline de um contrato (envio, cadências de cobrança, assinatura);
 * - presença da equipe separada do cadastro de usuários.
 *
 * Somente leitura. `clientId` sempre do token OAuth.
 */
import { CopilotoError, coverage, dateOut, ok, safeDbError, tzOf, untrusted, type ToolOutput } from "../envelope.ts";
import { agentCodes, legacyRaw } from "../legacy.ts";
import { MAX_ROWS, num, SCOPE_READ, str, type CopilotoContext, type CopilotoTool } from "../types.ts";

const MEDIA_TYPES = ["image", "video", "audio", "ptt", "document", "sticker"];

function kindOf(type: string): string {
  const t = String(type || "").toLowerCase();
  if (t.includes("image")) return "imagem";
  if (t.includes("video")) return "video";
  if (t.includes("audio") || t.includes("ptt")) return "audio";
  if (t.includes("sticker")) return "sticker";
  if (t.includes("document")) return "documento";
  return t || "arquivo";
}

function usableLink(url: unknown): boolean {
  const u = String(url || "");
  if (!u) return false;
  if (u.startsWith("waba_media:")) return false;
  if (u.includes(".enc")) return false;
  if (u.includes("mmg.whatsapp.net")) return false;
  return u.startsWith("http");
}

async function resolveContact(ctx: CopilotoContext, contatoId: string, conversationId: string) {
  if (contatoId) {
    const { data, error } = await ctx.supabase
      .from("chat_contacts")
      .select("id, name, phone")
      .eq("client_id", ctx.clientId)
      .eq("id", contatoId)
      .maybeSingle();
    if (error) throw safeDbError("database", error);
    if (!data) throw new CopilotoError("NOT_FOUND", "Contato não encontrado neste escritório.");
    return data;
  }
  const { data: conv, error: convErr } = await ctx.supabase
    .from("chat_conversations")
    .select("id, contact_id")
    .eq("client_id", ctx.clientId)
    .eq("id", conversationId)
    .maybeSingle();
  if (convErr) throw safeDbError("database", convErr);
  if (!conv) throw new CopilotoError("NOT_FOUND", "Atendimento não encontrado neste escritório.");
  return await resolveContact(ctx, conv.contact_id, "");
}

export const dossieTools: CopilotoTool[] = [
  {
    name: "julia_documentos_listar",
    version: "1.0.0",
    mode: "read",
    requiredScope: SCOPE_READ,
    description:
      "Lista os documentos e mídias trocados com um lead (imagem, vídeo, áudio, sticker, documento), com tipo, nome do arquivo, autor, data e link direto quando disponível. Use para pedir leitura/OCR do arquivo ao modelo.",
    inputSchema: {
      type: "object",
      properties: {
        contato_id: { type: "string", description: "ID do contato (ou informe conversation_id)." },
        conversation_id: { type: "string", description: "ID do atendimento." },
        tipos: {
          type: "array",
          items: { type: "string", enum: MEDIA_TYPES },
          description: "Filtra por tipos de mídia (padrão: todos).",
        },
        limite: { type: "number", description: "Máx. 200 (padrão 50)." },
        cursor: { type: "string", description: "Cursor opaco da página seguinte." },
        timezone: { type: "string" },
      },
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const tz = tzOf(args);
      const limite = num(args.limite, 50, MAX_ROWS);
      const contato = await resolveContact(ctx, str(args.contato_id), str(args.conversation_id));
      const tipos = Array.isArray(args.tipos) && args.tipos.length ? args.tipos.map(String) : MEDIA_TYPES;

      let q = ctx.supabase
        .from("chat_messages")
        .select("id, message_id, type, file_name, caption, media_url, metadata, from_me, sender_name, timestamp, channel_type, conversation_id")
        .eq("client_id", ctx.clientId)
        .eq("contact_id", contato.id)
        .in("type", tipos)
        .order("timestamp", { ascending: false })
        .limit(limite + 1);
      if (str(args.conversation_id)) q = q.eq("conversation_id", str(args.conversation_id));
      const cursorTs = str(args.cursor) ? atob(str(args.cursor)) : "";
      if (cursorTs) q = q.lt("timestamp", cursorTs);

      const { data, error } = await q;
      if (error) throw safeDbError("database", error);
      // deno-lint-ignore no-explicit-any
      const rows = (data || []) as any[];
      const page = rows.slice(0, limite);
      const hasMore = rows.length > limite;

      const items = page.map((m) => {
        const link = usableLink(m.media_url) ? m.media_url : null;
        return {
          message_id: m.message_id ?? m.id,
          tipo: kindOf(m.type),
          nome_arquivo: m.file_name ?? null,
          legenda: m.caption ? untrusted(m.caption) : null,
          autor: m.from_me ? m.sender_name || "escritório" : contato.name || "lead",
          direcao: m.from_me ? "saida" : "entrada",
          canal: m.channel_type ?? null,
          data: dateOut(m.timestamp, tz),
          link,
          link_status: link ? "disponivel" : "indisponivel_requer_materializacao",
          conversation_id: m.conversation_id ?? null,
        };
      });

      const text = items.length
        ? items
            .map(
              (i, idx) =>
                `${idx + 1}. [${i.data.legivel}] ${i.direcao === "saida" ? "ESCRITÓRIO" : "LEAD"} · ${i.tipo}${
                  i.nome_arquivo ? ` · ${i.nome_arquivo}` : ""
                }\n   ${i.link ?? "link indisponível (abra a conversa no painel para materializar o arquivo)"}`,
            )
            .join("\n")
        : "Nenhum documento ou mídia encontrado para este lead com os filtros informados.";

      return ok(
        {
          contato: { contato_id: contato.id, nome: contato.name, telefone: contato.phone },
          total_na_pagina: items.length,
          items,
        },
        {
          requestId: ctx.requestId!,
          toolName: "julia_documentos_listar",
          toolVersion: "1.0.0",
          timezone: tz,
          coverage: coverage({
            complete: !hasMore,
            warnings: items.some((i) => !i.link) ? ["Alguns arquivos exigem materialização no painel para gerar link público."] : [],
          }),
          nextCursor: hasMore ? btoa(String(page[page.length - 1]?.timestamp ?? "")) : null,
          text: `Documentos e mídias de ${contato.name || contato.phone}:\n${text}`,
        },
      );
    },
  },
  {
    name: "julia_contrato_timeline",
    version: "1.0.0",
    mode: "read",
    requiredScope: SCOPE_READ,
    description:
      "Timeline de um contrato ZapSign: envio, cadências de cobrança disparadas (com status e erro quando houver) e assinatura. Aceita cod_document ou doc_token.",
    inputSchema: {
      type: "object",
      properties: {
        cod_document: { type: "string", description: "Código do documento do contrato." },
        doc_token: { type: "string", description: "zapsing_doctoken do contrato." },
        timezone: { type: "string" },
      },
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const tz = tzOf(args);
      const cod = str(args.cod_document);
      const token = str(args.doc_token);
      if (!cod && !token) throw new CopilotoError("INVALID_INPUT", "Informe cod_document ou doc_token.");

      const codes = await agentCodes(ctx);
      if (!codes.length) throw new CopilotoError("NOT_FOUND", "Este escritório não possui agentes com contratos vinculados.");

      const rows = await legacyRaw(
        ctx,
        `SELECT cod_document, zapsing_doctoken, status_document, situacao, signer_name, whatsapp,
                case_title, data_contrato, data_assinatura
           FROM vw_painelv2_desempenho_julia_contratos
          WHERE cod_agent::text = ANY($1::varchar[])
            AND (($2::text IS NOT NULL AND cod_document::text = $2) OR ($3::text IS NOT NULL AND zapsing_doctoken = $3))
          LIMIT 1`,
        [codes, cod || null, token || null],
      );
      if (!rows.length) throw new CopilotoError("NOT_FOUND", "Contrato não encontrado neste escritório.");
      // deno-lint-ignore no-explicit-any
      const contrato = rows[0] as any;

      const { data: logs, error } = await ctx.supabase
        .from("contract_notification_logs")
        .select("id, type, step_number, recipient_phone, status, sent_at, error_message, created_at")
        .eq("contract_cod_document", String(contrato.cod_document))
        .order("created_at", { ascending: true })
        .limit(MAX_ROWS);
      if (error) throw safeDbError("database", error);

      const eventos = [
        { evento: "contrato_enviado", data: dateOut(contrato.data_contrato, tz), detalhe: `status ${contrato.status_document || "—"}` },
        // deno-lint-ignore no-explicit-any
        ...((logs || []) as any[]).map((l) => ({
          evento: `cobranca_${l.type || "notificacao"}`,
          data: dateOut(l.sent_at ?? l.created_at, tz),
          detalhe: `etapa ${l.step_number ?? "—"} · status ${l.status || "—"}${l.error_message ? ` · erro: ${l.error_message}` : ""}`,
        })),
      ];
      if (contrato.data_assinatura) {
        eventos.push({ evento: "contrato_assinado", data: dateOut(contrato.data_assinatura, tz), detalhe: "assinatura registrada" });
      }
      eventos.sort((a, b) => String(a.data.iso ?? "").localeCompare(String(b.data.iso ?? "")));

      const text = [
        `Contrato ${contrato.cod_document} · ${contrato.signer_name || "—"} · ${contrato.status_document || "—"}`,
        `Caso: ${contrato.case_title || "—"}`,
        "",
        ...eventos.map((e) => `- [${e.data.legivel}] ${e.evento} · ${e.detalhe}`),
      ].join("\n");

      return ok(
        {
          contrato: {
            cod_document: contrato.cod_document,
            doc_token: contrato.zapsing_doctoken,
            status: contrato.status_document,
            situacao: contrato.situacao,
            signatario: contrato.signer_name,
            telefone: contrato.whatsapp,
            caso: contrato.case_title,
            enviado_em: dateOut(contrato.data_contrato, tz),
            assinado_em: dateOut(contrato.data_assinatura, tz),
          },
          eventos,
          total_cobrancas: (logs || []).length,
        },
        {
          requestId: ctx.requestId!,
          toolName: "julia_contrato_timeline",
          toolVersion: "1.0.0",
          timezone: tz,
          coverage: coverage({ complete: true }),
          text,
        },
      );
    },
  },
  {
    name: "julia_equipe_presenca",
    version: "1.0.0",
    mode: "read",
    requiredScope: SCOPE_READ,
    description:
      "Presença e atividade da equipe (online/ausente/offline, último login, último logout com motivo e tempo online do dia). Separada do cadastro de usuários: use julia_equipe_listar para papéis e permissões.",
    inputSchema: {
      type: "object",
      properties: {
        somente_online: { type: "boolean", description: "Retorna apenas quem está online ou ausente." },
        limite: { type: "number", description: "Máx. 200 (padrão 100)." },
        timezone: { type: "string" },
      },
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const tz = tzOf(args);
      const limite = num(args.limite, 100, MAX_ROWS);

      const [presence, activity, daily] = await Promise.all([
        ctx.supabase.from("user_presence_status").select("*").eq("client_id", ctx.clientId).limit(limite),
        ctx.supabase.from("user_last_activity").select("*").limit(MAX_ROWS),
        ctx.supabase
          .from("user_presence_daily")
          .select("user_id, day_brt, online_seconds")
          .eq("client_id", ctx.clientId)
          .order("day_brt", { ascending: false })
          .limit(MAX_ROWS),
      ]);
      if (presence.error) throw safeDbError("presence", presence.error);

      // deno-lint-ignore no-explicit-any
      const actBy = new Map<string, any>(((activity.data || []) as any[]).map((a) => [String(a.user_id), a]));
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      // deno-lint-ignore no-explicit-any
      const secBy = new Map<string, number>(
        // deno-lint-ignore no-explicit-any
        ((daily.data || []) as any[]).filter((d) => String(d.day_brt) === today).map((d) => [String(d.user_id), Number(d.online_seconds || 0)]),
      );

      // deno-lint-ignore no-explicit-any
      let items = ((presence.data || []) as any[]).map((p) => {
        const act = actBy.get(String(p.user_id)) || {};
        const status = p.is_online ? (p.is_away ? "ausente" : "online") : "offline";
        const sec = secBy.get(String(p.user_id)) ?? 0;
        return {
          user_id: p.user_id,
          nome: p.user_name ?? p.name ?? null,
          status,
          ultima_atividade: dateOut(p.last_seen_at, tz),
          ultimo_login: dateOut(act.last_login_at, tz),
          ultimo_logout: dateOut(act.last_logout_at, tz),
          motivo_logout: act.last_logout_type === "inactivity" ? "inatividade" : act.last_logout_type === "manual" ? "manual" : null,
          online_hoje_minutos: Math.round(sec / 60),
        };
      });
      if (args.somente_online) items = items.filter((i) => i.status !== "offline");

      const text = items.length
        ? items
            .map(
              (i) =>
                `- ${i.nome || i.user_id} · ${i.status} · última atividade ${i.ultima_atividade.legivel} · online hoje ${i.online_hoje_minutos} min · último login ${
                  i.ultimo_login.legivel
                }${i.motivo_logout ? ` · logout ${i.motivo_logout}` : ""}`,
            )
            .join("\n")
        : "Nenhum registro de presença para este escritório.";

      return ok(
        {
          totais: {
            online: items.filter((i) => i.status === "online").length,
            ausentes: items.filter((i) => i.status === "ausente").length,
            offline: items.filter((i) => i.status === "offline").length,
          },
          items,
        },
        {
          requestId: ctx.requestId!,
          toolName: "julia_equipe_presenca",
          toolVersion: "1.0.0",
          timezone: tz,
          coverage: coverage({
            complete: items.length < limite,
            warnings: activity.error ? ["Histórico de login/logout indisponível nesta consulta."] : [],
          }),
          text,
        },
      );
    },
  },
];
