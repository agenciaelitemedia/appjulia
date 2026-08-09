// ============================================
// X-Julia — skills (tools) do agente
// ============================================
import { upsertDeal } from "./crm.ts";
import { xjGenerateContract } from "./contracts.ts";
import { cancelPendingFollowups, scheduleNextFollowup } from "./followups.ts";
import { findSpecialistForCase, logXJEvent, updateSession } from "./session.ts";
import { isWithinBusinessHours } from "./activation.ts";
import {
  evaluateExpression,
  formatBRL,
  parcelamento,
  parseNumber,
  percentual,
  rendaPerCapita,
  round2,
  XJ_SALARIO_MINIMO_PADRAO,
} from "./calc.ts";
import {
  diffCalendarDaysBRT,
  formatBRT,
  formatDateBRT,
  formatFullBRT,
  isoBRT,
  nowBRT,
  resolveExpression,
  weekdayBRT,
} from "./datetime.ts";
import type { XJRunContext, XJStage } from "./types.ts";
import type { XJToolDef } from "./llm.ts";

export const XJ_TOOLS: XJToolDef[] = [
  {
    name: "registrar_dados",
    description:
      "Registra dados coletados do lead (nome, canal, origem, e respostas do roteiro do caso). Use sempre que obtiver uma informação nova.",
    parameters: {
      type: "object",
      properties: {
        contact_name: { type: "string", description: "Primeiro nome ou nome completo do lead" },
        dados: {
          type: "object",
          description: "Pares campo/valor livres com as respostas coletadas",
          additionalProperties: true,
        },
      },
    },
  },
  {
    name: "identificar_caso",
    description: "Fixa o caso jurídico do atendimento após confirmar a hipótese com o lead.",
    parameters: {
      type: "object",
      properties: {
        case_id: { type: "string", description: "id do caso na biblioteca do escritório" },
        case_type: { type: "string", description: "nome do caso, quando não houver id" },
      },
    },
  },
  {
    name: "qualificar",
    description: "Registra o resultado da qualificação do caso.",
    parameters: {
      type: "object",
      properties: {
        resultado: { type: "string", enum: ["qualificado", "desqualificado", "indefinido"] },
        motivo: { type: "string" },
        score: { type: "number", description: "0 a 100" },
      },
      required: ["resultado"],
    },
  },
  {
    name: "mover_estagio",
    description: "Avança ou retorna o estágio do atendimento (também move o card no CRM do X-Julia).",
    parameters: {
      type: "object",
      properties: {
        estagio: {
          type: "string",
          enum: ["recepcao", "triagem", "qualificacao", "negociacao", "contrato", "assinatura", "agendamento", "humano", "encerrado"],
        },
        observacao: { type: "string" },
      },
      required: ["estagio"],
    },
  },
  {
    name: "atualizar_crm",
    description: "Cria ou atualiza o card do lead no CRM do X-Julia.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        valor: { type: "number" },
        descricao: { type: "string" },
        prioridade: { type: "string", enum: ["low", "medium", "high"] },
      },
    },
  },
  {
    name: "gerar_contrato",
    description: "Gera o contrato do caso e devolve o link de assinatura. Só use com nome completo confirmado.",
    parameters: {
      type: "object",
      properties: {
        nome_completo: { type: "string" },
        cpf: { type: "string" },
        valor: { type: "number" },
      },
      required: ["nome_completo"],
    },
  },
  {
    name: "consultar_agenda",
    description: "Lista horários livres para atendimento nos próximos dias.",
    parameters: {
      type: "object",
      properties: { dias: { type: "number", description: "quantos dias à frente consultar (padrão 5)" } },
    },
  },
  {
    name: "data_hora",
    description:
      "Retorna a data/hora atual de Brasília e resolve datas relativas com precisão. Use SEMPRE antes de citar qualquer data, prazo ou horário, e para montar a data de um agendamento.",
    parameters: {
      type: "object",
      properties: {
        expressao: {
          type: "string",
          description:
            "opcional. Ex.: 'hoje', 'amanha', 'hoje+3d', '+2 semanas', 'proxima segunda', 'fim do mes', '15/09', '2026-09-15 14:00'",
        },
        formato: {
          type: "string",
          description: "opcional: 'data', 'data_hora' ou 'iso' (padrão data_hora)",
        },
      },
    },
  },
  {
    name: "agendar",
    description:
      "Cria um agendamento interno de atendimento. A data/hora deve vir de data_hora ou consultar_agenda, em ISO com fuso (ex.: 2026-09-15T14:00:00-03:00). Nunca deduza a data.",
    parameters: {
      type: "object",
      properties: {
        inicio: { type: "string", description: "data/hora ISO do início, com fuso -03:00" },
        duracao_minutos: { type: "number" },
        assunto: { type: "string" },
      },
      required: ["inicio"],
    },
  },
  {
    name: "encaminhar_humano",
    description: "Encaminha o atendimento para um humano e para de conduzir a conversa.",
    parameters: {
      type: "object",
      properties: { motivo: { type: "string" }, prioridade: { type: "string" } },
    },
  },
  {
    name: "calcular",
    description:
      "Faz QUALQUER cálculo numérico com precisão (renda per capita, soma de rendas, percentuais, honorários, parcelamento, contas livres). " +
      "Use SEMPRE que a conversa envolver número, valor, soma, divisão, percentual ou renda familiar — nunca calcule de cabeça nem estime.",
    parameters: {
      type: "object",
      properties: {
        operacao: {
          type: "string",
          description:
            "'renda_per_capita' | 'soma' | 'percentual' | 'parcelamento' | 'expressao' (padrão: expressao se vier 'expressao', senão soma)",
        },
        rendas: {
          type: "array",
          items: { type: "string" },
          description: "valores das rendas/parcelas (aceita '1.234,56', 'R$ 900' ou número)",
        },
        pessoas: { type: "number", description: "nº de pessoas do grupo familiar (renda_per_capita)" },
        salario_minimo: { type: "number", description: "opcional: salário mínimo vigente, se souber" },
        valor: { type: "number", description: "valor base (percentual/parcelamento)" },
        percentual: { type: "number", description: "percentual a aplicar, ex.: 30 para 30%" },
        parcelas: { type: "number", description: "nº de parcelas" },
        juros_mensal: { type: "number", description: "opcional: juros ao mês em %, ex.: 1.99" },
        expressao: { type: "string", description: "conta livre, ex.: '(1200+800)/4' ou '2500*0,3'" },
        descricao: { type: "string", description: "opcional: o que está sendo calculado" },
      },
    },
  },
  {
    name: "encerrar",
    description: "Encerra a sessão do agente (lead desqualificado, sem interesse ou atendimento concluído).",
    parameters: { type: "object", properties: { motivo: { type: "string" } } },
  },
];

// deno-lint-ignore no-explicit-any
export async function runXJSkill(ctx: XJRunContext, name: string, args: any): Promise<string> {
  const { supabase, agent, session } = ctx;

  switch (name) {
    case "registrar_dados": {
      const patch: Record<string, unknown> = {};
      const slots: Record<string, unknown> = { ...(session.slots ?? {}), ...(args?.dados ?? {}) };
      const rawName = String(args?.contact_name ?? slots.nome_completo ?? slots.nome ?? "").trim();
      if (rawName) {
        patch.contact_name = rawName;
        // Primeiro nome sempre guardado em `nome`; nome completo quando houver sobrenome.
        const parts = rawName.split(/\s+/).filter(Boolean);
        slots.nome = parts[0];
        if (parts.length > 1) slots.nome_completo = rawName;
      }
      patch.slots = slots;
      await updateSession(supabase, session, patch);
      return `Dados registrados: ${Object.keys(args?.dados ?? {}).join(", ") || "nome"}`;
    }

    case "identificar_caso": {
      let caseId: string | null = args?.case_id ?? null;
      let caseName: string | null = args?.case_type ?? null;

      if (caseId) {
        const { data } = await supabase.from("xj_legal_cases").select("*").eq("id", caseId).maybeSingle();
        if (data) {
          ctx.legalCase = data;
          caseName = data.name;
        } else {
          caseId = null;
        }
      }
      if (!caseId && caseName) {
        const { data } = await supabase
          .from("xj_legal_cases")
          .select("*")
          .eq("client_id", String(session.client_id))
          .eq("is_active", true)
          .ilike("name", `%${caseName}%`)
          .limit(1)
          .maybeSingle();
        if (data) {
          caseId = data.id;
          ctx.legalCase = data;
          caseName = data.name;
        }
      }

      await updateSession(supabase, session, {
        case_id: caseId,
        case_type: caseName,
        slots: { ...(session.slots ?? {}), ...(caseName ? { caso_juridico: caseName } : {}) },
        stage: session.stage === "recepcao" || session.stage === "triagem" ? "qualificacao" : session.stage,
      });
      await upsertDeal(supabase, agent, session, { title: session.contact_name || session.phone || "Lead" });

      // Transferência para o agente especialista do caso (subagente), quando existir.
      if (caseId) {
        const specialist = await findSpecialistForCase(supabase, String(session.client_id), caseId);
        if (specialist && specialist.id !== session.agent_id) {
          await updateSession(supabase, session, { agent_id: specialist.id });
          ctx.agent = specialist;
          ctx.agentSwitched = true;
          await logXJEvent(supabase, session, {
            kind: "agent_handoff",
            detail: `Transferido para o agente ${specialist.name} — caso ${caseName ?? ""}`.trim(),
            payload: { agent_id: specialist.id, case_id: caseId },
          }).catch(() => {});
          return `Caso fixado: ${caseName}. O atendimento passou para o especialista ${specialist.name}; continue a qualificação com o roteiro do caso.`;
        }
      }

      return caseId
        ? `Caso fixado: ${caseName}. Siga o roteiro de qualificação.`
        : `Caso anotado como "${caseName ?? "não identificado"}" (sem correspondência na biblioteca).`;
    }

    case "qualificar": {
      const resultado = String(args?.resultado ?? "indefinido");
      await updateSession(supabase, session, {
        qualification: resultado,
        qualification_reason: args?.motivo ?? null,
        score: typeof args?.score === "number" ? args.score : null,
        stage: resultado === "qualificado" ? "negociacao" : resultado === "desqualificado" ? "encerrado" : session.stage,
        is_active: resultado === "desqualificado" ? false : session.is_active,
      });
      await upsertDeal(supabase, agent, session, {
        priority: resultado === "qualificado" ? "high" : "low",
        description: args?.motivo ?? null,
      });
      if (resultado === "desqualificado") {
        await cancelPendingFollowups(supabase, session.id);
        ctx.stop = true;
      }
      return resultado === "qualificado"
        ? "Lead qualificado. Avance para a negociação dos honorários."
        : resultado === "desqualificado"
          ? "Lead desqualificado. Agradeça com cordialidade e encerre."
          : "Qualificação inconclusiva: continue as perguntas do roteiro.";
    }

    case "mover_estagio": {
      const stage = String(args?.estagio) as XJStage;
      await updateSession(supabase, session, { stage });
      await upsertDeal(supabase, agent, session, { description: args?.observacao ?? null });
      return `Estágio atualizado para ${stage}.`;
    }

    case "atualizar_crm": {
      await upsertDeal(supabase, agent, session, {
        title: args?.titulo,
        value: typeof args?.valor === "number" ? args.valor : undefined,
        description: args?.descricao,
        priority: args?.prioridade,
      });
      return "Card do CRM atualizado.";
    }

    case "gerar_contrato": {
      try {
        const contract = await xjGenerateContract(supabase, agent, session, ctx.legalCase, {
          signer_name: String(args?.nome_completo ?? session.contact_name ?? ""),
          signer_document: args?.cpf ?? null,
          value: typeof args?.valor === "number" ? args.valor : null,
        });
        await updateSession(supabase, session, { stage: "assinatura" });
        await upsertDeal(supabase, agent, session, { value: args?.valor ?? undefined });
        return contract.sign_url
          ? `Contrato gerado (${contract.provider}). Envie este link para assinatura: ${contract.sign_url}`
          : `Contrato gerado (${contract.provider}), mas sem link de assinatura. Informe que a equipe enviará em seguida.`;
      } catch (err) {
        return `Falha ao gerar contrato: ${err instanceof Error ? err.message : String(err)}. Informe que a equipe enviará o contrato.`;
      }
    }

    case "consultar_agenda": {
      const slots = await listFreeSlots(supabase, session, Number(args?.dias ?? 5));
      if (!slots.length) return "Nenhum horário livre configurado. Ofereça encaminhar para a equipe.";
      return (
        `Agora: ${formatFullBRT(nowBRT())}. Horários livres (fuso -03:00):\n` +
        slots
          .slice(0, 8)
          .map((s) => `- ${weekdayBRT(s.start)}, ${formatBRT(s.start)} (ISO ${isoBRT(s.start)})`)
          .join("\n")
      );
    }

    case "data_hora": {
      const now = nowBRT();
      const resolved = resolveExpression(args?.expressao, now);
      const formato = String(args?.formato ?? "data_hora").toLowerCase();
      const value = formato === "data"
        ? formatDateBRT(resolved.date)
        : formato === "iso"
        ? isoBRT(resolved.date)
        : formatBRT(resolved.date);
      const days = diffCalendarDaysBRT(resolved.date, now);
      const relative = days === 0 ? "hoje" : days === 1 ? "amanhã" : days === -1 ? "ontem" : days > 0 ? `em ${days} dias` : `há ${Math.abs(days)} dias`;
      const inHours = isWithinBusinessHours((agent as any).business_hours, resolved.date);
      const warn = resolved.matched
        ? ""
        : ` (não entendi a expressão "${resolved.expression}" — usei o momento atual; confirme a data com o lead)`;
      return (
        `Agora em Brasília: ${formatFullBRT(now)}.\n` +
        `Resultado: ${weekdayBRT(resolved.date)}, ${value} — ${relative}. ` +
        `ISO com fuso: ${isoBRT(resolved.date)}. ` +
        `${inHours ? "Dentro" : "Fora"} do horário de atendimento do escritório.${warn}`
      );
    }

    case "agendar": {
      const resolvedStart = resolveExpression(String(args?.inicio ?? ""), nowBRT());
      const start = resolvedStart.date;
      if (!resolvedStart.matched || Number.isNaN(start.getTime())) {
        return "Data inválida: chame data_hora para resolver a data e peça o horário ao lead novamente.";
      }
      const now = nowBRT();
      if (start.getTime() < now.getTime() - 60_000) {
        return `Data no passado (${formatBRT(start)}). Agora é ${formatFullBRT(now)}. Confirme uma data futura com o lead.`;
      }
      if (start.getTime() > now.getTime() + 90 * 86_400_000) {
        return `Data muito distante (${formatBRT(start)}, mais de 90 dias). Confirme a data correta com o lead.`;
      }
      const minutes = Number(args?.duracao_minutos ?? 30);
      const end = new Date(start.getTime() + minutes * 60_000);
      const { data: deal } = await supabase.from("xj_deals").select("id").eq("session_id", session.id).maybeSingle();
      const { error } = await supabase.from("xj_appointments").insert({
        client_id: session.client_id,
        agent_id: agent.id,
        session_id: session.id,
        deal_id: deal?.id ?? null,
        contact_name: session.contact_name,
        contact_phone: session.phone,
        subject: args?.assunto ?? `Atendimento — ${session.case_type ?? "caso jurídico"}`,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        created_by: "x-julia",
      });
      if (error) return `Falha ao agendar: ${error.message}`;
      await updateSession(supabase, session, { stage: "agendamento" });
      await upsertDeal(supabase, agent, session, {});
      return `Agendado para ${formatFullBRT(start)}. Confirme com o lead.`;
    }

    case "encaminhar_humano": {
      await updateSession(supabase, session, {
        stage: "humano",
        is_active: false,
        paused_reason: args?.motivo ?? "encaminhado para humano",
        handoff_at: new Date().toISOString(),
      });
      await cancelPendingFollowups(supabase, session.id);
      await upsertDeal(supabase, agent, session, { priority: "high", description: args?.motivo ?? null });
      if (session.conversation_id) {
        await supabase
          .from("chat_conversations")
          .update({ status: "pending", priority: args?.prioridade ?? "high" })
          .eq("id", session.conversation_id);
      }
      ctx.stop = true;
      return "Atendimento encaminhado para a equipe humana.";
    }

    case "encerrar": {
      await updateSession(supabase, session, {
        stage: "encerrado",
        is_active: false,
        paused_reason: args?.motivo ?? "encerrado pelo agente",
      });
      await cancelPendingFollowups(supabase, session.id);
      await upsertDeal(supabase, agent, session, {});
      ctx.stop = true;
      return "Sessão encerrada.";
    }

    default:
      return `Skill desconhecida: ${name}`;
  }
}

/** Slots livres cruzando xj_availability com xj_appointments. */
// deno-lint-ignore no-explicit-any
async function listFreeSlots(supabase: any, session: any, days: number) {
  const { data: availability } = await supabase
    .from("xj_availability")
    .select("*")
    .eq("client_id", String(session.client_id))
    .eq("is_active", true);
  if (!availability?.length) return [] as Array<{ start: Date; end: Date }>;

  const from = new Date();
  const to = new Date(Date.now() + days * 86_400_000);
  const { data: busy } = await supabase
    .from("xj_appointments")
    .select("starts_at, ends_at, status")
    .eq("client_id", String(session.client_id))
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString());
  const taken = (busy ?? [])
    .filter((b: any) => b.status !== "cancelled")
    .map((b: any) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()]);

  const slots: Array<{ start: Date; end: Date }> = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(from.getTime() + d * 86_400_000);
    const weekday = day.getDay();
    for (const rule of availability.filter((a: any) => Number(a.weekday) === weekday)) {
      const [sh, sm] = String(rule.start_time).split(":").map(Number);
      const [eh, em] = String(rule.end_time).split(":").map(Number);
      const step = Number(rule.slot_minutes ?? 30);
      let cursor = new Date(day);
      cursor.setHours(sh, sm, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(eh, em, 0, 0);
      while (cursor.getTime() + step * 60_000 <= dayEnd.getTime()) {
        const start = new Date(cursor);
        const end = new Date(cursor.getTime() + step * 60_000);
        const overlaps = taken.some(([bs, be]: number[]) => start.getTime() < be && end.getTime() > bs);
        if (!overlaps && start.getTime() > Date.now()) slots.push({ start, end });
        cursor = end;
      }
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}