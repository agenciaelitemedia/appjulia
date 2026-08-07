// ============================================
// X-Julia — montagem do prompt (persona + estágio + caso + base + slots)
// ============================================
import type { XJAgent, XJChatMessage, XJLegalCase, XJSession } from "./types.ts";
import { XJ_STAGE_LABELS } from "./types.ts";

const BASE_RULES = `Você é uma advogada-recepcionista digital sênior de um escritório de advocacia brasileiro.
Sua missão, em ordem: recepcionar o lead, coletar o nome, registrar canal e origem, fazer a triagem do caso jurídico,
qualificar ou desqualificar com base nos critérios do caso, negociar a contratação, gerar o contrato,
acompanhar até a assinatura e, quando fizer sentido, agendar atendimento ou encaminhar para um humano.

Regras de conduta:
- Escreva em português do Brasil, com frases curtas, tom humano e acolhedor. Nunca diga que é uma IA/robô.
- Faça UMA pergunta por mensagem. Não repita perguntas cujas respostas já estão nos dados coletados.
- Nunca prometa resultado, valor de indenização garantido ou prazo processual exato.
- Sempre confirme a hipótese de caso com o lead antes de qualificar.
- Use as ferramentas disponíveis para registrar dados, mover o CRM, gerar contrato, agendar e encaminhar.
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
    "Colete nome completo, CPF e confirmação dos dados e gere o contrato com gerar_contrato. Envie o link de assinatura.",
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
}

export function buildXJMessages(input: XJPromptInput): XJChatMessage[] {
  const { agent, session, legalCase } = input;
  const parts: string[] = [BASE_RULES];

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
  parts.push(
    `Dados já coletados: ${Object.keys(slots).length ? JSON.stringify(slots) : "nenhum"}\nNome do contato: ${
      session.contact_name ?? "desconhecido"
    }\nCanal: ${session.channel ?? "whatsapp"} | Origem: ${session.origin ?? "desconhecida"}`,
  );

  const messages: XJChatMessage[] = [{ role: "system", content: parts.join("\n\n") }];
  messages.push(...input.history);
  messages.push({ role: "user", content: input.currentInput });
  return messages;
}

/** Histórico recente da conversa no formato do LLM. */
// deno-lint-ignore no-explicit-any
export async function loadHistory(
  supabase: any,
  conversationId: string | null,
  contactId: string | null,
  limit = 24,
): Promise<XJChatMessage[]> {
  let query = supabase
    .from("chat_messages")
    .select("text, from_me, type, created_at, transcription")
    .order("created_at", { ascending: false })
    .limit(limit);
  query = conversationId ? query.eq("conversation_id", conversationId) : query.eq("contact_id", contactId);
  const { data } = await query;
  const rows = (data ?? []).reverse();
  return rows
    .map((m: any) => {
      const body = (m.transcription || m.text || "").toString().trim() ||
        (m.type && m.type !== "text" ? `[${m.type}]` : "");
      if (!body) return null;
      return { role: m.from_me ? "assistant" : "user", content: body } as XJChatMessage;
    })
    .filter(Boolean) as XJChatMessage[];
}