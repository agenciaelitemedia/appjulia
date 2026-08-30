/**
 * Domínio: métricas de funil e de qualidade/SLA calculadas no servidor
 * (P1.7 e P1.11). Cada métrica traz numerador, denominador, taxa, definição
 * e cobertura, para reconciliar com a coorte de `julia_leads_listar`.
 */
import { coverage, dateOut, isoOrNull, ok, safeDbError, tzOf, type ToolOutput } from "../envelope.ts";
import { agentCodes, legacyRaw } from "../legacy.ts";
import { MAX_ROWS, num, SCOPE_READ, str, type CopilotoContext, type CopilotoTool } from "../types.ts";

interface Metric {
  chave: string;
  rotulo: string;
  numerador: number;
  denominador: number | null;
  taxa: number | null;
  definicao: string;
}

function metric(chave: string, rotulo: string, numerador: number, denominador: number | null, definicao: string): Metric {
  return {
    chave,
    rotulo,
    numerador,
    denominador,
    taxa: denominador && denominador > 0 ? Math.round((numerador / denominador) * 1000) / 10 : null,
    definicao,
  };
}

function windowFrom(args: { periodo_de?: unknown; periodo_ate?: unknown; dias?: unknown }): { from: string; to: string } {
  const to = isoOrNull(args.periodo_ate, "periodo_ate") ?? new Date().toISOString();
  const from =
    isoOrNull(args.periodo_de, "periodo_de") ??
    new Date(new Date(to).getTime() - num(args.dias, 30, 365) * 86400_000).toISOString();
  return { from, to };
}

export const metricaTools: CopilotoTool[] = [
  {
    name: "julia_funil_metricas",
    version: "1.0.0",
    mode: "read",
    requiredScope: SCOPE_READ,
    description:
      "Métricas do funil calculadas no servidor, por período e timezone, com etapas SEPARADAS: leads recebidos, primeira resposta, atendimento iniciado, qualificação jurídica (qualificado / não qualificado / pendente), contrato gerado, enviado, assinado, e perdidos com motivo. Cada métrica traz numerador, denominador, taxa e definição. Reconcilia com julia_leads_listar no mesmo período.",
    inputSchema: {
      type: "object",
      properties: {
        periodo_de: { type: "string", description: "ISO 8601 (inclusivo)." },
        periodo_ate: { type: "string", description: "ISO 8601 (exclusivo)." },
        dias: { type: "number", description: "Alternativa ao período: últimos N dias (padrão 30)." },
        canal: { type: "array", items: { type: "string" }, description: "Canais (whatsapp, waba, instagram, webchat)." },
        responsavel_id: { type: "array", items: { type: "string" }, description: "IDs de responsáveis." },
        timezone: { type: "string" },
      },
      additionalProperties: false,
    },
    run: async (ctx: CopilotoContext, args): Promise<ToolOutput> => {
      const tz = tzOf(args);
      const { from, to } = windowFrom(args);
      const canais = Array.isArray(args.canal) ? args.canal.map(String) : [];
      const owners = Array.isArray(args.responsavel_id) ? args.responsavel_id.map(String) : [];
      const warnings: string[] = [];

      let q = ctx.supabase
        .from("chat_conversations")
        .select("id, status, channel, assigned_to, assigned_user_id, created_at, first_response_at, opened_at, resolved_at, closed_at, close_reason")
        .eq("client_id", ctx.clientId)
        .gte("created_at", from)
        .lt("created_at", to)
        .limit(5000);
      if (canais.length) q = q.in("channel", canais);
      if (owners.length) q = q.in("assigned_user_id", owners.map(Number).filter((n) => Number.isFinite(n)));

      const { data, error } = await q;
      if (error) throw safeDbError("database", error);
      // deno-lint-ignore no-explicit-any
      const convs = (data || []) as any[];
      if (convs.length >= 5000) warnings.push("Coorte truncada em 5000 atendimentos; reduza o período para números exatos.");

      const recebidos = convs.length;
      const comPrimeiraResposta = convs.filter((c) => c.first_response_at).length;
      const iniciados = convs.filter((c) => c.assigned_to || c.assigned_user_id).length;
      const resolvidos = convs.filter((c) => c.resolved_at).length;
      const perdidosPorMotivo: Record<string, number> = {};
      for (const c of convs) {
        if (c.close_reason) perdidosPorMotivo[c.close_reason] = (perdidosPorMotivo[c.close_reason] || 0) + 1;
      }

      // Contratos (ZapSign) — estados separados, nunca inferidos entre si.
      let contratos = { gerados: 0, enviados: 0, assinados: 0 };
      try {
        const codes = await agentCodes(ctx);
        if (codes.length) {
          const rows = await legacyRaw<{ gerados: string; enviados: string; assinados: string }>(
            ctx,
            `SELECT count(*) AS gerados,
                    count(data_contrato) AS enviados,
                    count(data_assinatura) AS assinados
               FROM vw_painelv2_desempenho_julia_contratos
              WHERE cod_agent::text = ANY($1::varchar[])
                AND data_contrato >= $2::timestamptz AND data_contrato < $3::timestamptz`,
            [codes, from, to],
          );
          contratos = {
            gerados: Number(rows[0]?.gerados || 0),
            enviados: Number(rows[0]?.enviados || 0),
            assinados: Number(rows[0]?.assinados || 0),
          };
        }
      } catch {
        warnings.push("Base legada de contratos indisponível: métricas de contrato ficaram fora deste resultado.");
      }

      // Tempo de primeira resposta (minutos).
      const trps = convs
        .filter((c) => c.first_response_at && c.created_at)
        .map((c) => (new Date(c.first_response_at).getTime() - new Date(c.created_at).getTime()) / 60000)
        .filter((m) => m >= 0)
        .sort((a, b) => a - b);
      const p50 = trps.length ? trps[Math.floor(trps.length * 0.5)] : null;
      const media = trps.length ? trps.reduce((a, b) => a + b, 0) / trps.length : null;

      const metricas: Metric[] = [
        metric("leads_recebidos", "Leads recebidos", recebidos, null, "Atendimentos criados no período (created_at)."),
        metric("primeira_resposta", "Com primeira resposta", comPrimeiraResposta, recebidos, "Atendimentos com first_response_at preenchido."),
        metric("atendimento_iniciado", "Atendimento iniciado", iniciados, recebidos, "Atendimentos com responsável atribuído."),
        metric("resolvidos", "Resolvidos", resolvidos, recebidos, "Atendimentos com resolved_at preenchido."),
        metric("contrato_gerado", "Contrato gerado", contratos.gerados, recebidos, "Registros de contrato criados no período."),
        metric("contrato_enviado", "Contrato enviado", contratos.enviados, contratos.gerados, "Contratos com data_contrato (envio) registrada."),
        metric("contrato_assinado", "Contrato assinado", contratos.assinados, contratos.enviados, "Contratos com data_assinatura registrada. Nunca inferido de 'enviado'."),
      ];

      const text = [
        `Funil de ${dateOut(from, tz).legivel} a ${dateOut(to, tz).legivel} (${tz})`,
        ...metricas.map((m) => `- ${m.rotulo}: ${m.numerador}${m.taxa != null ? ` (${m.taxa}% de ${m.denominador})` : ""} — ${m.definicao}`),
        `- Tempo até 1ª resposta: média ${media != null ? media.toFixed(1) : "—"} min · mediana ${p50 != null ? p50.toFixed(1) : "—"} min`,
        Object.keys(perdidosPorMotivo).length
          ? `- Encerramentos por motivo: ${Object.entries(perdidosPorMotivo).map(([k, v]) => `${k} (${v})`).join(", ")}`
          : "- Encerramentos por motivo: sem motivo registrado",
        "",
        "Qualificação jurídica não é derivada de interesse comercial: use julia_analise_qualificacao_lead por lead.",
        warnings.length ? `Avisos: ${warnings.join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return ok(
        {
          periodo: { de: from, ate: to },
          metricas,
          tempo_primeira_resposta_min: { media, p50, amostra: trps.length },
          encerramentos_por_motivo: perdidosPorMotivo,
          qualificacao_juridica: {
            qualificado: null,
            nao_qualificado: null,
            pendente: null,
            observacao: "Qualificação jurídica não é registrada como campo estruturado; use julia_analise_qualificacao_lead.",
          },
        },
        {
          requestId: ctx.requestId!,
          toolName: "julia_funil_metricas",
          toolVersion: "1.0.0",
          timezone: tz,
          coverage: coverage({ complete: !warnings.length, from, to, warnings }),
          text,
        },
      );
    },
  },
  {
    name: "julia_atendimento_metricas",
    version: "1.0.0",
    mode: "read",
    requiredScope: SCOPE_READ,
    description:
      "Qualidade e SLA de um atendimento (ou do escritório no período): tempo de primeira resposta, intervalos entre mensagens, mensagens dentro e fora do expediente, transferências de responsável, encerramentos e reaberturas, e separação entre mensagens humanas e automáticas.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "UUID da conversa (opcional: sem ele, agrega o período)." },
        periodo_de: { type: "string" },
        periodo_ate: { type: "string" },
        dias: { type: "number", description: "Últimos N dias quando não houver período (padrão 7)." },
        expediente_inicio: { type: "number", description: "Hora local de início do expediente (padrão 8)." },
        expediente_fim: { type: "number", description: "Hora local de fim do expediente (padrão 18)." },
        timezone: { type: "string" },
      },
      additionalProperties: false,
    },
    run: async (ctx: CopilotoContext, args): Promise<ToolOutput> => {
      const tz = tzOf(args);
      const convId = str(args.conversation_id);
      const { from, to } = windowFrom({ ...args, dias: args.dias ?? 7 });
      const hIni = num(args.expediente_inicio, 8, 23);
      const hFim = num(args.expediente_fim, 18, 24);

      let cq = ctx.supabase
        .from("chat_conversations")
        .select("id, contact_id, status, assigned_to, assigned_user_id, created_at, first_response_at, opened_at, resolved_at, closed_at, close_reason")
        .eq("client_id", ctx.clientId)
        .limit(convId ? 1 : 1000);
      cq = convId ? cq.eq("id", convId) : cq.gte("created_at", from).lt("created_at", to);
      const { data: convs, error } = await cq;
      if (error) throw safeDbError("database", error);
      if (!convs?.length) {
        return ok(
          { atendimentos: 0 },
          { requestId: ctx.requestId!, toolName: "julia_atendimento_metricas", toolVersion: "1.0.0", timezone: tz, text: "Nenhum atendimento no filtro informado." },
        );
      }

      // deno-lint-ignore no-explicit-any
      const list = convs as any[];
      const contactIds = [...new Set(list.map((c) => c.contact_id).filter(Boolean))].slice(0, 50);
      const { data: msgs } = await ctx.supabase
        .from("chat_messages")
        .select("id, contact_id, from_me, timestamp, sender_name, internal_note, metadata")
        .eq("client_id", ctx.clientId)
        .in("contact_id", contactIds.length ? contactIds : ["00000000-0000-0000-0000-000000000000"])
        .gte("timestamp", from)
        .order("timestamp", { ascending: true })
        .limit(5000);

      // deno-lint-ignore no-explicit-any
      const messages = (msgs || []) as any[];
      const hourIn = (ts: string) => Number(new Date(ts).toLocaleString("pt-BR", { hour: "2-digit", hour12: false, timeZone: tz }));
      const dentro = messages.filter((m) => {
        const h = hourIn(m.timestamp);
        return h >= hIni && h < hFim;
      }).length;
      const automaticas = messages.filter((m) => m.from_me && (m.metadata?.source === "bot" || m.metadata?.ai || /julia|bot|autom/i.test(String(m.sender_name || "")))).length;
      const humanas = messages.filter((m) => m.from_me).length - automaticas;

      const gaps: number[] = [];
      for (let i = 1; i < messages.length; i++) {
        const prev = messages[i - 1];
        const cur = messages[i];
        if (prev.contact_id !== cur.contact_id) continue;
        if (prev.from_me === cur.from_me) continue;
        const dt = (new Date(cur.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000;
        if (dt >= 0 && dt < 60 * 72) gaps.push(dt);
      }
      gaps.sort((a, b) => a - b);

      const trps = list
        .filter((c) => c.first_response_at && c.created_at)
        .map((c) => (new Date(c.first_response_at).getTime() - new Date(c.created_at).getTime()) / 60000)
        .filter((m) => m >= 0);

      // Transferências e reaberturas via auditoria do chat.
      let transferencias = 0;
      let reaberturas = 0;
      const { data: audit } = await ctx.supabase
        .from("chat_audit_log")
        .select("action, created_at, conversation_id")
        .eq("client_id", ctx.clientId)
        .gte("created_at", from)
        .limit(2000);
      // deno-lint-ignore no-explicit-any
      for (const a of (audit || []) as any[]) {
        const act = String(a.action || "").toLowerCase();
        if (convId && a.conversation_id !== convId) continue;
        if (act.includes("assign") || act.includes("transfer")) transferencias++;
        if (act.includes("reopen") || act.includes("reabert")) reaberturas++;
      }

      const payload = {
        escopo: convId ? { conversation_id: convId } : { periodo: { de: from, ate: to }, atendimentos: list.length },
        primeira_resposta_min: {
          media: trps.length ? Math.round((trps.reduce((a, b) => a + b, 0) / trps.length) * 10) / 10 : null,
          p50: trps.length ? Math.round(trps.sort((a, b) => a - b)[Math.floor(trps.length / 2)] * 10) / 10 : null,
          sem_resposta: list.filter((c) => !c.first_response_at).length,
        },
        intervalos_entre_mensagens_min: {
          amostra: gaps.length,
          media: gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 : null,
          p50: gaps.length ? Math.round(gaps[Math.floor(gaps.length / 2)] * 10) / 10 : null,
          p90: gaps.length ? Math.round(gaps[Math.floor(gaps.length * 0.9)] * 10) / 10 : null,
        },
        expediente: { inicio: hIni, fim: hFim, mensagens_dentro: dentro, mensagens_fora: messages.length - dentro },
        mensagens: { total: messages.length, do_escritorio_humanas: Math.max(0, humanas), automaticas, do_cliente: messages.filter((m) => !m.from_me).length },
        encerramentos: {
          resolvidos: list.filter((c) => c.resolved_at).length,
          fechados: list.filter((c) => c.closed_at).length,
          reaberturas,
          motivos: list.filter((c) => c.close_reason).map((c) => c.close_reason),
        },
        transferencias,
      };

      const text = [
        convId ? `Qualidade do atendimento ${convId}` : `Qualidade do atendimento — ${list.length} conversas de ${dateOut(from, tz).legivel} a ${dateOut(to, tz).legivel}`,
        `- 1ª resposta: média ${payload.primeira_resposta_min.media ?? "—"} min · mediana ${payload.primeira_resposta_min.p50 ?? "—"} min · sem resposta ${payload.primeira_resposta_min.sem_resposta}`,
        `- Intervalos entre mensagens: média ${payload.intervalos_entre_mensagens_min.media ?? "—"} min · p90 ${payload.intervalos_entre_mensagens_min.p90 ?? "—"} min`,
        `- Expediente ${hIni}h–${hFim}h: ${dentro} dentro · ${messages.length - dentro} fora`,
        `- Mensagens: ${payload.mensagens.do_cliente} do cliente · ${payload.mensagens.do_escritorio_humanas} humanas · ${automaticas} automáticas`,
        `- Encerramentos: ${payload.encerramentos.resolvidos} resolvidos · ${payload.encerramentos.fechados} fechados · ${reaberturas} reaberturas · ${transferencias} transferências`,
      ].join("\n");

      return ok(payload, {
        requestId: ctx.requestId!,
        toolName: "julia_atendimento_metricas",
        toolVersion: "1.0.0",
        timezone: tz,
        coverage: coverage({
          from,
          to,
          complete: messages.length < 5000 && contactIds.length <= 50,
          warnings: contactIds.length > 50 ? ["Amostra de mensagens limitada a 50 contatos do período."] : [],
        }),
        text,
      });
    },
  },
];

export const _unusedRows = MAX_ROWS;
