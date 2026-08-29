/**
 * Domínio: contratos ZapSign (view legada vw_painelv2_desempenho_julia_contratos).
 */
import { agentCodes, legacyRaw } from "../legacy.ts";
import { clip, fmtDate, MAX_ROWS, num, str, type CopilotoTool } from "../types.ts";

export const contratoTools: CopilotoTool[] = [
  {
    name: "julia_contratos_listar",
    description:
      "Contratos ZapSign do escritório com filtros por status (pendente/assinado), período e busca por nome/CPF/telefone. Retorna código do documento, status, signatário e datas.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filtro parcial de status do documento (ex.: signed, pending)." },
        busca: { type: "string", description: "Nome do signatário, CPF ou telefone." },
        dias: { type: "number", description: "Somente contratos dos últimos N dias." },
        limite: { type: "number", description: "Máx. 200 (padrão 30)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const codes = await agentCodes(ctx);
      if (!codes.length) return "Este escritório não possui agentes com contratos vinculados.";
      const rows = await legacyRaw(
        ctx,
        `SELECT cod_document, zapsing_doctoken, status_document, situacao, signer_name, signer_cpf,
                whatsapp, case_title, case_category_name, data_contrato, data_assinatura
           FROM vw_painelv2_desempenho_julia_contratos
          WHERE cod_agent::text = ANY($1::varchar[])
            AND ($2::text IS NULL OR status_document ILIKE '%' || $2 || '%')
            AND ($3::text IS NULL OR signer_name ILIKE '%' || $3 || '%'
                 OR signer_cpf::text ILIKE '%' || $3 || '%' OR whatsapp::text ILIKE '%' || $3 || '%')
            AND ($4::int IS NULL OR data_contrato >= now() - ($4::int || ' days')::interval)
          ORDER BY data_contrato DESC NULLS LAST
          LIMIT $5::int`,
        [codes, str(args.status) || null, str(args.busca) || null, args.dias ?? null, num(args.limite, 30, MAX_ROWS)],
      );
      if (!rows.length) return "Nenhum contrato encontrado com esses filtros.";
      // deno-lint-ignore no-explicit-any
      return rows
        .map(
          (c: any) =>
            `- ${c.cod_document || "—"} · ${c.status_document || "—"}${c.situacao ? ` (${c.situacao})` : ""} · signatário ${
              c.signer_name || "—"
            } (${c.signer_cpf || "sem CPF"}) · ${c.whatsapp || "sem telefone"}\n  caso: ${c.case_title || "—"} · categoria ${
              c.case_category_name || "—"
            } · enviado ${fmtDate(c.data_contrato)} · assinado ${fmtDate(c.data_assinatura)}\n  doc_token: ${c.zapsing_doctoken || "—"}`,
        )
        .join("\n");
    },
  },
  {
    name: "julia_contratos_obter",
    description:
      "Detalhes de um contrato: qualificação completa do signatário (CPF, endereço, cidade/UF, CEP), status de assinatura, categoria do caso e resumo do caso registrado.",
    inputSchema: {
      type: "object",
      properties: { doc_token: { type: "string", description: "zapsing_doctoken do contrato." } },
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
      return clip(
        [
          "=== CONTRATO ===",
          `Documento: ${c.cod_document || "—"} · Status: ${c.status_document || "—"}${c.situacao ? ` (${c.situacao})` : ""}`,
          `Signatário: ${c.signer_name || "—"} · CPF ${c.signer_cpf || "—"}`,
          `Endereço: ${c.signer_endereco || "—"}, ${c.signer_bairro || "—"}, ${c.signer_cidade || "—"}/${c.signer_uf || "—"} · CEP ${
            c.signer_cep || "—"
          }`,
          `WhatsApp: ${c.whatsapp || "—"}`,
          `Caso: ${c.case_title || "—"} · Categoria: ${c.case_category_name || "—"}`,
          `Enviado: ${fmtDate(c.data_contrato)} · Assinado: ${fmtDate(c.data_assinatura)}`,
          c.resumo_do_caso ? `\n--- RESUMO DO CASO ---\n${c.resumo_do_caso}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  },
  {
    name: "julia_contratos_metricas",
    description:
      "Métricas de contratos no período: enviados, assinados, taxa de conversão e tempo médio até a assinatura, com quebra por categoria de caso.",
    inputSchema: {
      type: "object",
      properties: { dias: { type: "number", description: "Janela em dias (padrão 30)." } },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const codes = await agentCodes(ctx);
      if (!codes.length) return "Este escritório não possui agentes com contratos vinculados.";
      const dias = num(args.dias, 30, 365);
      const rows = await legacyRaw(
        ctx,
        `SELECT coalesce(case_category_name, 'sem categoria') AS categoria,
                count(*) AS enviados,
                count(data_assinatura) AS assinados,
                round(avg(EXTRACT(EPOCH FROM (data_assinatura - data_contrato)) / 3600)::numeric, 1) AS horas_media
           FROM vw_painelv2_desempenho_julia_contratos
          WHERE cod_agent::text = ANY($1::varchar[])
            AND data_contrato >= now() - ($2::int || ' days')::interval
          GROUP BY 1 ORDER BY enviados DESC`,
        [codes, dias],
      );
      if (!rows.length) return `Nenhum contrato nos últimos ${dias} dias.`;
      // deno-lint-ignore no-explicit-any
      const tot = rows.reduce((a: any, r: any) => ({ e: a.e + Number(r.enviados), s: a.s + Number(r.assinados) }), { e: 0, s: 0 });
      return [
        `Contratos dos últimos ${dias} dias: ${tot.e} enviados · ${tot.s} assinados · conversão ${
          tot.e ? ((tot.s / tot.e) * 100).toFixed(1) : "0.0"
        }%`,
        "",
        // deno-lint-ignore no-explicit-any
        ...rows.map(
          (r: any) =>
            `- ${r.categoria}: ${r.enviados} enviados · ${r.assinados} assinados · média ${r.horas_media ?? "—"}h até assinar`,
        ),
      ].join("\n");
    },
  },
];
