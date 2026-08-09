// ============================================
// X-Julia — montagem do prompt (persona + estágio + caso + base + slots)
// ============================================
import type { XJAgent, XJChatMessage, XJLegalCase, XJSession } from "./types.ts";
import { XJ_STAGE_LABELS } from "./types.ts";
import { buildTimeAnchor } from "./datetime.ts";

const BASE_RULES = `Você é uma advogada-recepcionista digital sênior de um escritório de advocacia brasileiro.
Sua missão, em ordem: recepcionar o lead, coletar o nome, registrar canal e origem, fazer a triagem do caso jurídico,
qualificar ou desqualificar com base nos critérios do caso, negociar a contratação, gerar o contrato,
acompanhar até a assinatura e, quando fizer sentido, agendar atendimento ou encaminhar para um humano.

Regras de conduta:
- Escreva em português do Brasil, com frases curtas, tom humano e acolhedor. Nunca diga que é uma IA/robô.
- Faça UMA pergunta por mensagem. Não repita perguntas cujas respostas já estão nos dados coletados.
- Assim que o lead informar o nome, chame registrar_dados gravando em dados: "nome" (apenas o primeiro nome) e, quando houver sobrenome, "nome_completo".
- Assim que o caso jurídico for confirmado, chame identificar_caso — isso grava o campo "caso_juridico" nos dados coletados.
- Nunca prometa resultado, valor de indenização garantido ou prazo processual exato.
- Sempre confirme a hipótese de caso com o lead antes de qualificar.
- Use as ferramentas disponíveis para registrar dados, mover o CRM, gerar contrato, agendar e encaminhar.
- Nunca invente ou deduza data/hora: consulte a âncora temporal deste prompt ou chame a skill data_hora antes de citar qualquer data, prazo ou horário.
- Contrato: NUNCA chame gerar_contrato antes de ter coletado TODOS os campos obrigatórios do contrato (um por mensagem), listado todos eles para conferência e recebido um "sim" explícito do lead.
- NUNCA calcule de cabeça. Qualquer conta (soma de rendas, renda per capita do grupo familiar, divisão, percentual, honorários, parcelamento) deve ser feita pela skill calcular, e só então informe o resultado ao lead.
- Para renda per capita, use calcular com operacao "renda_per_capita", enviando todas as rendas em "rendas" e o total de pessoas em "pessoas".
- Se receber áudio, imagem ou documento, interprete o conteúdo transcrito/descrito e SIGA o fluxo normalmente.
- Sua resposta final é o texto que o lead vai ler no WhatsApp: nada de comentários internos.`;

const STAGE_GUIDE: Record<string, string> = {
  recepcao:
    "Cumprimente, apresente o escritório, colete o primeiro nome do lead e registre canal/origem com registrar_dados. Depois avance para a triagem.",
  triagem:
    "Descubra o que aconteceu e identifique o caso jurídico na biblioteca do escritório. Se houver hipótese vinda de campanha, confirme-a com o lead antes de fixar. Use identificar_caso.",
  qualificacao:
    "Siga o roteiro de perguntas do caso, uma por vez. Ao ter dados suficientes, chame qualificar com o resultado e o motivo.",
  negociacao:
    "Explique de forma simples o serviço e os honorários do caso, trate objeções e busque o aceite para gerar o contrato.",
  contrato:
    "Siga exatamente a lista de campos do contrato definida nas instruções do escritório: peça UM campo por mensagem, na ordem, registre cada resposta com registrar_dados, depois liste TODOS os campos preenchidos para conferência e pergunte se está correto. Só chame gerar_contrato depois de um 'sim' explícito e com todos os campos obrigatórios preenchidos. Nunca preencha um campo por conta própria.",
  assinatura:
    "Acompanhe a assinatura, tire dúvidas e reforce com gentileza. Não recomece a negociação.",
  agendamento:
    "Ofereça horários disponíveis com consultar_agenda e confirme com agendar.",
  humano: "O atendimento está com um humano. Responda apenas se for estritamente necessário e não conduza o fluxo.",
  encerrado: "A sessão foi encerrada. Apenas responda com cordialidade se o lead retornar e reabra o fluxo se houver novo interesse.",
};

export interface XJPromptInput {
  agent: XJAgent;
  session: XJSession;
  legalCase: XJLegalCase | null;
  questions: Array<{ position: number; question: string; slot_key: string | null; is_required: boolean }>;
  knowledge: Array<{ title: string; content: string | null }>;
  ctaExtraPrompt?: string | null;
  caseCatalog: Array<{ id: string; name: string; category: string; summary: string | null }>;
  history: XJChatMessage[];
  currentInput: string;
  historySummary?: string | null;
}

export function buildXJMessages(input: XJPromptInput): XJChatMessage[] {
  const { agent, session, legalCase } = input;
  const parts: string[] = [BASE_RULES];

  parts.push(buildTimeAnchor());

  const role = String((agent as any).role ?? "reception");
  if (role === "specialist") {
    parts.push(
      `Você é o agente ESPECIALISTA no caso já identificado deste atendimento. ` +
        `O caso está definido: NÃO refaça a triagem, não pergunte de novo o que aconteceu ` +
        `nem ofereça outros tipos de caso. Retome a conversa de onde parou, siga o roteiro ` +
        `de qualificação do caso e conduza até a contratação, contrato ou agendamento. ` +
        `Não mencione que houve troca de atendente.`,
    );
  } else {
    parts.push(
      `Você é o agente RECEPCIONISTA: sua função é acolher, coletar o primeiro nome e ` +
        `identificar o caso jurídico. Assim que o caso estiver confirmado, chame ` +
        `identificar_caso — o atendimento pode ser assumido pelo especialista do caso.`,
    );
  }

  if (agent.persona) parts.push(`Persona: ${agent.persona}`);
  if (agent.tone) parts.push(`Tom de voz: ${agent.tone}`);
  if (agent.system_prompt?.trim()) parts.push(`Instruções do escritório:\n${agent.system_prompt.trim()}`);

  const stage = session.stage;
  parts.push(
    `Estágio atual: ${XJ_STAGE_LABELS[stage] ?? stage}\nObjetivo do estágio: ${STAGE_GUIDE[stage] ?? ""}`,
  );
  const stagePrompt = agent.stage_prompts?.[stage];
  if (stagePrompt?.trim()) parts.push(`Instruções extras deste estágio:\n${stagePrompt.trim()}`);
  if (input.ctaExtraPrompt?.trim()) parts.push(`Contexto da campanha:\n${input.ctaExtraPrompt.trim()}`);

  if (legalCase) {
    const caseLines = [`Caso identificado: ${legalCase.name} (${legalCase.category})`];
    if (legalCase.summary) caseLines.push(`Resumo: ${legalCase.summary}`);
    if (legalCase.qualification_criteria) caseLines.push(`Qualifica quando: ${legalCase.qualification_criteria}`);
    if (legalCase.disqualification_criteria)
      caseLines.push(`Desqualifica quando: ${legalCase.disqualification_criteria}`);
    if (Array.isArray(legalCase.required_documents) && legalCase.required_documents.length)
      caseLines.push(`Documentos necessários: ${legalCase.required_documents.join(", ")}`);
    if (legalCase.fee_description) caseLines.push(`Honorários: ${legalCase.fee_description}`);
    parts.push(caseLines.join("\n"));

    if (input.questions.length) {
      parts.push(
        `Roteiro de qualificação (na ordem):\n${input.questions
          .map((q, i) => `${i + 1}. ${q.question}${q.slot_key ? ` [campo: ${q.slot_key}]` : ""}${q.is_required ? "" : " (opcional)"}`)
          .join("\n")}`,
      );
    }
    if (input.knowledge.length) {
      parts.push(
        `Base de conhecimento do caso (use para entender e qualificar, sem citar literalmente):\n${input.knowledge
          .map((k) => `### ${k.title}\n${(k.content ?? "").slice(0, 4000)}`)
          .join("\n\n")}`,
      );
    }
  } else if (input.caseCatalog.length) {
    parts.push(
      `Casos atendidos por este escritório (escolha o id ao chamar identificar_caso):\n${input.caseCatalog
        .map((c) => `- ${c.name} [${c.category}] id=${c.id}${c.summary ? ` — ${c.summary.slice(0, 160)}` : ""}`)
        .join("\n")}`,
    );
  }

  const slots = session.slots ?? {};
  const visibleSlots = Object.fromEntries(
    Object.entries(slots).filter(([k]) => !k.startsWith("__")),
  );
  parts.push(
    `Dados já coletados: ${Object.keys(visibleSlots).length ? JSON.stringify(visibleSlots) : "nenhum"}\nNome do contato: ${
      session.contact_name ?? "desconhecido"
    }\nCanal: ${session.channel ?? "whatsapp"} | Origem: ${session.origin ?? "desconhecida"}`,
  );

  if (input.historySummary?.trim()) {
    parts.push(
      `Resumo do histórico anterior com este lead (conversas mais antigas, use como memória):\n${input.historySummary.trim()}`,
    );
  }
  parts.push(
    `Sobre o histórico: mensagens marcadas como "[Atendente ...]" foram enviadas por um atendente humano do escritório ao lead — considere o que foi combinado, mas não repita. Mensagens "[Nota interna...]" são anotações da equipe, nunca foram vistas pelo lead.`,
  );

  const messages: XJChatMessage[] = [{ role: "system", content: parts.join("\n\n") }];
  messages.push(...input.history);
  messages.push({ role: "user", content: input.currentInput });
  return messages;
}

const MAX_MESSAGE_CHARS = 1200;
const MAX_HISTORY_CHARS = 60_000;

function messageBody(m: any): string {
  const transcription = m.metadata?.transcription;
  const raw = (typeof transcription === "string" ? transcription : "") ||
    (m.text ?? "") ||
    (m.caption ?? "");
  let body = String(raw).trim();
  if (!body && m.type && m.type !== "text") body = `[${m.type}]`;
  if (body.length > MAX_MESSAGE_CHARS) body = `${body.slice(0, MAX_MESSAGE_CHARS)}…`;
  return body;
}

/**
 * Histórico completo do LEAD (todas as conversas do contato), em ordem cronológica.
 * Diferencia agente, atendente humano e notas internas. Mensagens que ficam fora
 * da janela viram um resumo (summary).
 */
// deno-lint-ignore no-explicit-any
export async function loadHistory(
  supabase: any,
  conversationId: string | null,
  contactId: string | null,
  limit = 150,
  since?: string | null,
): Promise<{ messages: XJChatMessage[]; summary: string | null; total: number }> {
  const select = "text, caption, from_me, type, created_at, metadata, internal_note, sender_name, conversation_id";
  let query = supabase
    .from("chat_messages")
    .select(select)
    .order("created_at", { ascending: false })
    .limit(limit);
  // Memória por contato: todas as conversas/tickets do mesmo lead.
  query = contactId ? query.eq("contact_id", contactId) : query.eq("conversation_id", conversationId);
  // Sessão reiniciada: o atendimento recomeça do zero a partir do reinício.
  if (since) query = query.gte("created_at", since);

  const { data, error } = await query;
  if (error) {
    console.warn("[x-julia/prompt] falha ao carregar histórico:", error.message);
    return { messages: [], summary: null, total: 0 };
  }

  const rows = (data ?? []).reverse();
  const messages: XJChatMessage[] = [];
  let chars = 0;

  for (const m of rows) {
    const body = messageBody(m);
    if (!body) continue;

    let role: XJChatMessage["role"] = m.from_me ? "assistant" : "user";
    let content = body;

    if (m.internal_note) {
      role = "user";
      content = `[Nota interna da equipe${m.sender_name ? ` — ${m.sender_name}` : ""}] ${body}`;
    } else if (m.from_me && m.sender_name) {
      // Enviada por atendente humano: contexto, não fala do agente.
      role = "user";
      content = `[Atendente ${m.sender_name}] ${body}`;
    }

    chars += content.length;
    messages.push({ role, content });
  }

  // Garante que o contexto não estoure: descarta as mais antigas se preciso.
  while (chars > MAX_HISTORY_CHARS && messages.length > 20) {
    chars -= (messages.shift()?.content ?? "").length;
  }

  const summary = since ? null : await loadContactSummary(supabase, contactId, rows.length >= limit);
  return { messages, summary, total: rows.length };
}

/** Resumos já gerados para o contato (usado como memória de longo prazo). */
// deno-lint-ignore no-explicit-any
async function loadContactSummary(supabase: any, contactId: string | null, needed: boolean): Promise<string | null> {
  if (!contactId || !needed) return null;
  const { data } = await supabase
    .from("chat_conversation_summaries")
    .select("summary, atendimento, created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(5);
  const items = (data ?? [])
    .map((s: any) => String(s.summary ?? s.atendimento ?? "").trim())
    .filter(Boolean)
    .reverse();
  if (!items.length) return null;
  return items.map((s: string) => `- ${s.slice(0, 1500)}`).join("\n");
}