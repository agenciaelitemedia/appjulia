/**
 * Domínio: análises. A Julia NÃO gera parecer — ela monta o dossiê e devolve
 * o comando de análise. O parecer é produzido pelo modelo do cliente MCP.
 */
import { agentCodes, legacyRaw } from "../legacy.ts";
import {
  ANALYSIS_ATENDIMENTO,
  ANALYSIS_CONTRATO,
  ANALYSIS_DOCUMENTAL,
  ANALYSIS_PRESCRICAO,
  ANALYSIS_QUALIFICACAO,
  ANALYSIS_VIABILIDADE,
} from "../prompts.ts";
import { clip, fmtDate, MAX_MESSAGES, str, type CopilotoContext, type CopilotoTool } from "../types.ts";
import { compileLeadContext, resolveTarget } from "./chat.ts";

const target = {
  conversation_id: { type: "string", description: "UUID da conversa." },
  contato_id: { type: "string", description: "ID do contato (alternativa ao conversation_id)." },
};

async function dossier(ctx: CopilotoContext, args: Record<string, unknown>) {
  const { contactId } = await resolveTarget(ctx, args as { conversation_id?: string; contato_id?: string });
  const compiled = await compileLeadContext(ctx, contactId, MAX_MESSAGES);
  return { contactId, text: compiled.text };
}

async function attachments(ctx: CopilotoContext, contactId: string) {
  const { data } = await ctx.supabase
    .from("chat_messages")
    .select("id, type, file_name, caption, from_me, timestamp")
    .eq("client_id", ctx.clientId)
    .eq("contact_id", contactId)
    .in("type", ["document", "image", "audio", "ptt", "video"])
    .order("timestamp", { ascending: false })
    .limit(50);
  if (!data?.length) return "Nenhum anexo registrado no atendimento.";
  // deno-lint-ignore no-explicit-any
  return data
    .map(
      (m: any) =>
        `- ${m.file_name || `(${m.type})`} · ${m.from_me ? "ATENDENTE" : "CLIENTE"} · ${fmtDate(m.timestamp)}${
          m.caption ? ` · ${m.caption}` : ""
        } · message_id: ${m.id}`,
    )
    .join("\n");
}

export const analiseTools: CopilotoTool[] = [
  {
    name: "julia_analise_atendimento",
    description:
      "Monta o dossiê da conversa e devolve o comando para você produzir a análise do ATENDIMENTO: como foi conduzido, do que se trata, pendências e próximo passo. Não gera a análise — você a escreve com base no retorno.",
    inputSchema: { type: "object", properties: target, additionalProperties: false },
    run: async (ctx, args) => {
      const d = await dossier(ctx, args);
      return clip(`${ANALYSIS_ATENDIMENTO}\n\n${d.text}`, 24000);
    },
  },
  {
    name: "julia_analise_viabilidade_juridica",
    description:
      "Dossiê completo (conversa + resumos + anexos) com o comando para um PARECER DE VIABILIDADE: fatos, enquadramento legal, prescrição, provas existentes e faltantes, veredito e outras teses possíveis.",
    inputSchema: { type: "object", properties: target, additionalProperties: false },
    run: async (ctx, args) => {
      const d = await dossier(ctx, args);
      const { data: sums } = await ctx.supabase
        .from("chat_conversation_summaries")
        .select("summary, created_at")
        .eq("client_id", ctx.clientId)
        .eq("contact_id", d.contactId)
        .order("created_at", { ascending: false })
        .limit(3);
      const resumos = (sums || [])
        // deno-lint-ignore no-explicit-any
        .map((s: any) => `- [${fmtDate(s.created_at)}] ${s.summary}`)
        .join("\n");
      return clip(
        [
          ANALYSIS_VIABILIDADE,
          "",
          d.text,
          "",
          "=== RESUMOS ANTERIORES ===",
          resumos || "Nenhum resumo gravado.",
          "",
          "=== ANEXOS ===",
          await attachments(ctx, d.contactId),
        ].join("\n"),
        28000,
      );
    },
  },
  {
    name: "julia_analise_documental",
    description:
      "Lista os anexos do atendimento (com o texto extraído dos PDFs, quando disponível) e devolve o comando para AUDITORIA DOCUMENTAL: o que cada documento comprova, inconsistências e checklist do que falta.",
    inputSchema: {
      type: "object",
      properties: { ...target, incluir_texto: { type: "boolean", description: "Extrair o texto dos PDFs (padrão true)." } },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const { contactId } = await resolveTarget(ctx, args as { conversation_id?: string; contato_id?: string });
      const list = await attachments(ctx, contactId);
      const parts = [ANALYSIS_DOCUMENTAL, "", "=== ANEXOS ===", list];

      if (args.incluir_texto !== false) {
        const { data } = await ctx.supabase
          .from("chat_messages")
          .select("id, file_name, media_url")
          .eq("client_id", ctx.clientId)
          .eq("contact_id", contactId)
          .eq("type", "document")
          .order("timestamp", { ascending: false })
          .limit(5);
        for (const m of data || []) {
          if (!m.media_url) continue;
          try {
            const res = await fetch(m.media_url);
            if (!res.ok) continue;
            const buf = new Uint8Array(await res.arrayBuffer());
            const isPdf = String(m.file_name || "").toLowerCase().endsWith(".pdf") || (buf[0] === 0x25 && buf[1] === 0x50);
            if (!isPdf) continue;
            const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
            const pdf = await getDocumentProxy(buf);
            const { text } = await extractText(pdf, { mergePages: true });
            parts.push("", `=== CONTEÚDO: ${m.file_name} ===`, clip(String(text), 6000));
          } catch {
            parts.push("", `=== CONTEÚDO: ${m.file_name} === (falha na extração)`);
          }
        }
      }

      const compiled = await compileLeadContext(ctx, contactId, 40);
      parts.push("", compiled.text);
      return clip(parts.join("\n"), 28000);
    },
  },
  {
    name: "julia_analise_qualificacao_lead",
    description:
      "Dossiê comercial do lead (conversa + etapa no CRM + tempo parado + ligações) com o comando para QUALIFICAÇÃO: score 0-100, sinais positivos/risco e recomendação de avançar, nutrir ou desqualificar.",
    inputSchema: { type: "object", properties: target, additionalProperties: false },
    run: async (ctx, args) => {
      const d = await dossier(ctx, args);
      const { data: contact } = await ctx.supabase
        .from("chat_contacts")
        .select("phone")
        .eq("client_id", ctx.clientId)
        .eq("id", d.contactId)
        .maybeSingle();
      const digits = String(contact?.phone || "").replace(/\D/g, "");
      const codes = await agentCodes(ctx);
      let crm = "Nenhum card no CRM de Leads.";
      if (digits && codes.length) {
        const rows = await legacyRaw(
          ctx,
          `SELECT s.name AS stage_name, c.stage_entered_at, c.owner_name,
                  EXTRACT(DAY FROM (now() - c.stage_entered_at))::int AS dias
             FROM crm_atendimento_cards c
             LEFT JOIN crm_atendimento_stages s ON s.id = c.stage_id
            WHERE c.cod_agent = ANY($1::varchar[])
              AND regexp_replace(c.whatsapp_number, '\\D', '', 'g') LIKE '%' || $2 || '%'
            ORDER BY c.stage_entered_at DESC LIMIT 5`,
          [codes, digits.slice(-8)],
        );
        if (rows.length) {
          // deno-lint-ignore no-explicit-any
          crm = rows
            .map((r: any) => `- etapa ${r.stage_name || "—"} há ${r.dias ?? "?"} dias · responsável ${r.owner_name || "—"}`)
            .join("\n");
        }
      }
      const { data: calls } = await ctx.supabase
        .from("wavoip_call_logs")
        .select("direction, status, started_at, duration_seconds")
        .eq("contact_id", d.contactId)
        .order("started_at", { ascending: false })
        .limit(10);
      return clip(
        [
          ANALYSIS_QUALIFICACAO,
          "",
          d.text,
          "",
          "=== SITUAÇÃO NO CRM ===",
          crm,
          "",
          "=== TENTATIVAS DE CONTATO POR LIGAÇÃO ===",
          calls?.length
            ? // deno-lint-ignore no-explicit-any
              calls.map((c: any) => `- ${fmtDate(c.started_at)} · ${c.direction} · ${c.status} · ${c.duration_seconds || 0}s`).join("\n")
            : "Nenhuma ligação registrada.",
        ].join("\n"),
        26000,
      );
    },
  },
  {
    name: "julia_analise_prescricao",
    description:
      "Extrai a linha do tempo dos fatos narrados na conversa e devolve o comando para AVALIAÇÃO DE PRESCRIÇÃO/DECADÊNCIA: prazos aplicáveis, marco inicial, risco e urgências.",
    inputSchema: { type: "object", properties: target, additionalProperties: false },
    run: async (ctx, args) => {
      const d = await dossier(ctx, args);
      return clip(`${ANALYSIS_PRESCRICAO}\n\n${d.text}`, 24000);
    },
  },
  {
    name: "julia_analise_contrato",
    description:
      "Cruza um contrato ZapSign com a conversa do lead e devolve o comando para CONFERÊNCIA: partes, objeto, divergências de qualificação, pendências de assinatura e recomendação.",
    inputSchema: {
      type: "object",
      properties: {
        doc_token: { type: "string", description: "zapsing_doctoken do contrato." },
        contato_id: { type: "string", description: "Contato para cruzar com a conversa (opcional)." },
      },
      required: ["doc_token"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const codes = await agentCodes(ctx);
      const rows = await legacyRaw(
        ctx,
        `SELECT * FROM vw_painelv2_desempenho_julia_contratos
          WHERE zapsing_doctoken = $1 AND cod_agent::text = ANY($2::varchar[]) LIMIT 1`,
        [str(args.doc_token), codes],
      );
      // deno-lint-ignore no-explicit-any
      const c: any = rows[0];
      if (!c) throw new Error("Contrato não encontrado neste escritório.");

      let conversa = "Contato não informado — conversa não incluída.";
      if (str(args.contato_id)) {
        const compiled = await compileLeadContext(ctx, str(args.contato_id), 60);
        conversa = compiled.text;
      }

      return clip(
        [
          ANALYSIS_CONTRATO,
          "",
          "=== CONTRATO ===",
          `Documento: ${c.cod_document || "—"} · Status: ${c.status_document || "—"}`,
          `Signatário: ${c.signer_name || "—"} · CPF ${c.signer_cpf || "—"}`,
          `Endereço: ${c.signer_endereco || "—"}, ${c.signer_bairro || "—"}, ${c.signer_cidade || "—"}/${c.signer_uf || "—"} · CEP ${
            c.signer_cep || "—"
          }`,
          `Caso: ${c.case_title || "—"} · Categoria: ${c.case_category_name || "—"}`,
          `Enviado ${fmtDate(c.data_contrato)} · Assinado ${fmtDate(c.data_assinatura)}`,
          c.resumo_do_caso ? `Resumo registrado: ${c.resumo_do_caso}` : null,
          "",
          "=== CONVERSA ===",
          conversa,
        ]
          .filter(Boolean)
          .join("\n"),
        26000,
      );
    },
  },
];
