/**
 * Domínio: contatos/leads (Supabase) e dossiê 360º cruzando CRM, contratos e ligações.
 */
import { legacyRaw, agentCodes } from "../legacy.ts";
import { fmtDate, MAX_ROWS, num, str, type CopilotoTool } from "../types.ts";
import { fetchContact } from "./chat.ts";

export const contatoTools: CopilotoTool[] = [
  {
    name: "julia_contatos_buscar",
    description:
      "Busca leads/contatos do escritório por telefone (dígitos, com ou sem DDI/9º dígito) ou nome. Retorna contato_id, nome, telefone, canal e data da última mensagem.",
    inputSchema: {
      type: "object",
      properties: {
        termo: { type: "string", description: "Telefone (dígitos) ou parte do nome." },
        limite: { type: "number", description: "Máx. 200 (padrão 20)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const termo = str(args.termo);
      let query = ctx.supabase
        .from("chat_contacts")
        .select("id, name, phone, channel_type, last_message_at, last_message_text, unread_count")
        .eq("client_id", ctx.clientId)
        .eq("is_group", false)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(num(args.limite, 20, MAX_ROWS));

      if (termo) {
        const digits = termo.replace(/\D/g, "");
        query = digits.length >= 4 ? query.ilike("phone", `%${digits}%`) : query.ilike("name", `%${termo}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhum lead encontrado para este termo.";

      // deno-lint-ignore no-explicit-any
      return data
        .map(
          (c: any) =>
            `- ${c.name || "(sem nome)"} · ${c.phone || "sem telefone"} · canal ${c.channel_type || "whatsapp"} · última mensagem ${fmtDate(
              c.last_message_at,
            )}${c.unread_count ? ` · ${c.unread_count} não lidas` : ""}\n  contato_id: ${c.id}`,
        )
        .join("\n");
    },
  },
  {
    name: "julia_contatos_obter_perfil",
    description:
      "Dossiê 360º do lead: cadastro, canais, conversas (com protocolo e status), cards no CRM de Leads, contratos ZapSign e ligações registradas.",
    inputSchema: {
      type: "object",
      properties: { contato_id: { type: "string", description: "ID do contato." } },
      required: ["contato_id"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const contactId = str(args.contato_id);
      const contact = await fetchContact(ctx, contactId);

      const [{ data: convs }, { data: wavoip }, { data: voip }] = await Promise.all([
        ctx.supabase
          .from("chat_conversations")
          .select("id, protocol, status, channel, assigned_to, opened_at, closed_at")
          .eq("client_id", ctx.clientId)
          .eq("contact_id", contactId)
          .order("opened_at", { ascending: false })
          .limit(20),
        ctx.supabase
          .from("wavoip_call_logs")
          .select("direction, status, started_at, duration_seconds")
          .eq("contact_id", contactId)
          .order("started_at", { ascending: false })
          .limit(10),
        ctx.supabase
          .from("phone_call_logs")
          .select("direction, status, started_at, duration_seconds")
          .eq("contact_id", contactId)
          .order("started_at", { ascending: false })
          .limit(10),
      ]);

      const digits = String(contact.phone || "").replace(/\D/g, "");
      const codes = await agentCodes(ctx);
      let cards: Record<string, unknown>[] = [];
      let contratos: Record<string, unknown>[] = [];
      if (digits && codes.length) {
        cards = await legacyRaw(
          ctx,
          `SELECT c.id, c.contact_name, s.name AS stage_name, c.stage_entered_at, c.notes, c.owner_name
             FROM crm_atendimento_cards c
             LEFT JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE c.cod_agent = ANY($1::varchar[])
              AND regexp_replace(c.whatsapp_number, '\\D', '', 'g') LIKE '%' || $2 || '%'
            ORDER BY c.stage_entered_at DESC LIMIT 10`,
          [codes, digits.slice(-8)],
        );
        contratos = await legacyRaw(
          ctx,
          `SELECT cod_document, zapsing_doctoken, status_document, signer_name, data_contrato, data_assinatura, case_title
             FROM vw_painelv2_desempenho_julia_contratos
            WHERE cod_agent::text = ANY($1::varchar[])
              AND regexp_replace(whatsapp::text, '\\D', '', 'g') LIKE '%' || $2 || '%'
            ORDER BY data_contrato DESC LIMIT 10`,
          [codes, digits.slice(-8)],
        );
      }

      const calls = [...(wavoip || []), ...(voip || [])];

      return [
        "=== DOSSIÊ DO LEAD ===",
        `Nome: ${contact.name || "não informado"}`,
        `Telefone: ${contact.phone || "não informado"}`,
        `Canal: ${contact.channel_type || "whatsapp"}${contact.channel_source ? ` (${contact.channel_source})` : ""}`,
        `Última mensagem: ${fmtDate(contact.last_message_at)}`,
        `contato_id: ${contactId}`,
        "",
        "--- ATENDIMENTOS ---",
        convs?.length
          ? // deno-lint-ignore no-explicit-any
            convs
              .map(
                (c: any) =>
                  `- ${c.protocol || "sem protocolo"} · ${c.status} · canal ${c.channel || "whatsapp"} · responsável ${
                    c.assigned_to || "—"
                  } · aberto ${fmtDate(c.opened_at)}\n  conversation_id: ${c.id}`,
              )
              .join("\n")
          : "Nenhum atendimento registrado.",
        "",
        "--- CRM DE LEADS ---",
        cards.length
          ? // deno-lint-ignore no-explicit-any
            cards
              .map(
                (c: any) =>
                  `- card ${c.id} · etapa ${c.stage_name || "—"} desde ${fmtDate(c.stage_entered_at)} · responsável ${
                    c.owner_name || "—"
                  }${c.notes ? ` · notas: ${c.notes}` : ""}`,
              )
              .join("\n")
          : "Nenhum card encontrado.",
        "",
        "--- CONTRATOS ---",
        contratos.length
          ? // deno-lint-ignore no-explicit-any
            contratos
              .map(
                (c: any) =>
                  `- ${c.cod_document || "—"} · ${c.status_document} · signatário ${c.signer_name || "—"} · caso ${
                    c.case_title || "—"
                  } · enviado ${fmtDate(c.data_contrato)} · assinado ${fmtDate(c.data_assinatura)}\n  doc_token: ${
                    c.zapsing_doctoken || "—"
                  }`,
              )
              .join("\n")
          : "Nenhum contrato encontrado.",
        "",
        "--- LIGAÇÕES ---",
        calls.length
          ? // deno-lint-ignore no-explicit-any
            calls
              .map(
                (c: any) =>
                  `- ${fmtDate(c.started_at)} · ${c.direction || "—"} · ${c.status || "—"} · ${c.duration_seconds || 0}s`,
              )
              .join("\n")
          : "Nenhuma ligação registrada.",
      ].join("\n");
    },
  },
];
