/**
 * Domínio: contatos/leads (Supabase) e dossiê 360º cruzando CRM, contratos e ligações.
 */
import { CopilotoError, coverage, dateOut, ok, safeDbError, tzOf, type ToolOutput } from "../envelope.ts";
import { legacyRaw, agentCodes } from "../legacy.ts";
import { fmtDate, MAX_ROWS, num, SCOPE_READ, str, type CopilotoTool } from "../types.ts";
import { fetchContact } from "./chat.ts";

export const contatoTools: CopilotoTool[] = [
  {
    name: "julia_contatos_buscar",
    version: "2.0.0",
    mode: "read",
    requiredScope: SCOPE_READ,
    description:
      "Busca determinística de lead/contato por contato_id, telefone normalizado, e-mail ou nome. Nunca escolhe entre homônimos: quando há mais de um candidato, devolve todos com match_type e confiança para desambiguação. Busca por ID retorna exatamente um registro.",
    inputSchema: {
      type: "object",
      properties: {
        contato_id: { type: "string", description: "ID exato do contato (retorna 1 registro)." },
        telefone: { type: "string", description: "Telefone (dígitos, com ou sem DDI/9º dígito)." },
        email: { type: "string", description: "E-mail do lead." },
        nome: { type: "string", description: "Nome ou parte do nome." },
        termo: { type: "string", description: "Termo livre (telefone ou nome) — compatibilidade." },
        limite: { type: "number", description: "Máx. 200 (padrão 20)." },
        timezone: { type: "string" },
      },
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const tz = tzOf(args);
      const limite = num(args.limite, 20, MAX_ROWS);
      const contatoId = str(args.contato_id);
      const emailArg = str(args.email);
      const nomeArg = str(args.nome);
      const termo = str(args.termo);
      const telefoneArg = str(args.telefone) || (termo.replace(/\D/g, "").length >= 4 ? termo : "");
      const nome = nomeArg || (!telefoneArg && termo ? termo : "");

      const SELECT = "id, name, phone, email, channel_type, last_message_at, last_message_text, unread_count, created_at";
      let matchType: "id" | "phone" | "email" | "name" = "name";
      let q = ctx.supabase.from("chat_contacts").select(SELECT).eq("client_id", ctx.clientId);

      if (contatoId) {
        matchType = "id";
        q = q.eq("id", contatoId).limit(1);
      } else if (telefoneArg) {
        matchType = "phone";
        const digits = telefoneArg.replace(/\D/g, "");
        // Últimos 8 dígitos: imune a DDI e ao 9º dígito.
        q = q.eq("is_group", false).ilike("phone", `%${digits.slice(-8)}%`).order("last_message_at", { ascending: false, nullsFirst: false }).limit(limite);
      } else if (emailArg) {
        matchType = "email";
        q = q.eq("is_group", false).ilike("email", emailArg).limit(limite);
      } else if (nome) {
        matchType = "name";
        q = q.eq("is_group", false).ilike("name", `%${nome}%`).order("last_message_at", { ascending: false, nullsFirst: false }).limit(limite);
      } else {
        throw new CopilotoError("INVALID_INPUT", "Informe contato_id, telefone, email ou nome.");
      }

      const { data, error } = await q;
      if (error) throw safeDbError("database", error);
      // deno-lint-ignore no-explicit-any
      const rows = (data || []) as any[];

      if (!rows.length) {
        throw new CopilotoError("NOT_FOUND", "Nenhum lead encontrado neste escritório com o critério informado.", {
          details: { match_type: matchType },
        });
      }

      const digits = telefoneArg.replace(/\D/g, "");
      const candidatos = rows.map((c) => {
        const cDigits = String(c.phone || "").replace(/\D/g, "");
        let confidence = 0.5;
        if (matchType === "id") confidence = 1;
        else if (matchType === "phone") confidence = cDigits === digits ? 1 : cDigits.endsWith(digits.slice(-8)) ? 0.9 : 0.7;
        else if (matchType === "email") confidence = 1;
        else confidence = String(c.name || "").toLowerCase() === nome.toLowerCase() ? 0.8 : 0.5;
        return {
          contato_id: c.id,
          nome: c.name ?? null,
          // Desambiguação sem expor PII completa quando há vários candidatos.
          telefone: rows.length > 1 && matchType === "name" ? `••••${cDigits.slice(-4)}` : c.phone ?? null,
          canal: c.channel_type ?? null,
          ultima_mensagem: dateOut(c.last_message_at, tz),
          nao_lidas: c.unread_count ?? 0,
          match_type: matchType,
          confidence,
        };
      });

      if (candidatos.length > 1 && matchType !== "id") {
        throw new CopilotoError("AMBIGUOUS_MATCH", `${candidatos.length} candidatos para este critério. Escolha pelo contato_id e repita a busca.`, {
          details: { match_type: matchType, candidates: candidatos.slice(0, 20) },
        });
      }

      const text = candidatos
        .map(
          (c) =>
            `- ${c.nome || "(sem nome)"} · ${c.telefone || "sem telefone"} · canal ${c.canal || "whatsapp"} · última mensagem ${
              c.ultima_mensagem.legivel
            } · match ${c.match_type} (confiança ${c.confidence})\n  contato_id: ${c.contato_id}`,
        )
        .join("\n");

      return ok(
        { match_type: matchType, items: candidatos },
        {
          requestId: ctx.requestId!,
          toolName: "julia_contatos_buscar",
          toolVersion: "2.0.0",
          timezone: tz,
          coverage: coverage({ complete: rows.length < limite, warnings: rows.length >= limite ? ["Resultado truncado no limite informado."] : [] }),
          text,
        },
      );
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
