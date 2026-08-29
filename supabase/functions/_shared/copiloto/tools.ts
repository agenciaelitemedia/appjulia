/**
 * Núcleo de ferramentas do Copiloto — usado pelo conector MCP (`copiloto-mcp`)
 * e pelo fallback interno (`copiloto-analisar`).
 *
 * Regra inviolável: `client_id` (escritório) NUNCA vem de argumento da tool.
 * Ele chega no contexto, resolvido no servidor a partir do token OAuth.
 */
import { ANALYSIS_COMMAND, buildLeadContext, type CopilotoMessage } from "./context.ts";

export interface CopilotoContext {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  clientId: string;
  userEmail?: string | null;
}

export const COPILOTO_TOOLS = [
  {
    name: "buscar_lead",
    description:
      "Busca leads/contatos do escritório por telefone (dígitos) ou nome. Retorna id do contato, nome, telefone, canal e data da última mensagem.",
    inputSchema: {
      type: "object",
      properties: {
        termo: { type: "string", description: "Telefone (apenas dígitos) ou parte do nome do lead." },
      },
      required: ["termo"],
      additionalProperties: false,
    },
  },
  {
    name: "obter_historico",
    description:
      "Retorna o histórico compilado da conversa de um lead (até 100 mensagens, com transcrições de áudio e nomes de anexos).",
    inputSchema: {
      type: "object",
      properties: {
        contato_id: { type: "string", description: "id do contato retornado por buscar_lead." },
        limite: { type: "number", description: "Quantidade de mensagens (máx. 100)." },
      },
      required: ["contato_id"],
      additionalProperties: false,
    },
  },
  {
    name: "analisar_atendimento",
    description:
      "Retorna o histórico do lead junto com a instrução de análise jurídica: resumo do atendimento, do que se trata o caso, se há caso jurídico válido (com provas que faltam) e outros casos possíveis. Use o texto retornado para produzir a análise.",
    inputSchema: {
      type: "object",
      properties: {
        contato_id: { type: "string", description: "id do contato retornado por buscar_lead." },
      },
      required: ["contato_id"],
      additionalProperties: false,
    },
  },
] as const;

const MESSAGE_LIMIT = 100;

async function fetchContact(ctx: CopilotoContext, contactId: string) {
  const { data, error } = await ctx.supabase
    .from("chat_contacts")
    .select("id, name, phone, channel_type")
    .eq("client_id", ctx.clientId)
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado neste escritório.");
  return data;
}

async function compile(ctx: CopilotoContext, contactId: string, limit = MESSAGE_LIMIT) {
  const contact = await fetchContact(ctx, contactId);

  const { data, error } = await ctx.supabase
    .from("chat_messages")
    .select("id, text, caption, type, from_me, internal_note, sender_name, file_name, timestamp, metadata")
    .eq("client_id", ctx.clientId)
    .eq("contact_id", contactId)
    .order("timestamp", { ascending: false })
    .limit(Math.min(Math.max(limit || MESSAGE_LIMIT, 1), MESSAGE_LIMIT));
  if (error) throw new Error(error.message);

  return buildLeadContext(
    {
      contactId,
      conversationId: null,
      name: contact.name ?? null,
      phone: contact.phone ?? null,
      channel: contact.channel_type ?? null,
    },
    (data || []) as CopilotoMessage[],
  );
}

/** Executa uma tool e devolve texto pronto para o cliente MCP. */
export async function runCopilotoTool(
  ctx: CopilotoContext,
  name: string,
  // deno-lint-ignore no-explicit-any
  args: any,
): Promise<string> {
  switch (name) {
    case "buscar_lead": {
      const termo = String(args?.termo ?? "").trim();
      let query = ctx.supabase
        .from("chat_contacts")
        .select("id, name, phone, channel_type, last_message_at, last_message_text")
        .eq("client_id", ctx.clientId)
        .eq("is_group", false)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(20);

      if (termo) {
        const digits = termo.replace(/\D/g, "");
        query = digits.length >= 4 ? query.ilike("phone", `%${digits}%`) : query.ilike("name", `%${termo}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhum lead encontrado para este termo.";

      return (data as Record<string, unknown>[])
        .map(
          (c) =>
            `- ${c.name || "(sem nome)"} · ${c.phone || "sem telefone"} · canal ${c.channel_type || "whatsapp"} · última mensagem ${
              c.last_message_at || "—"
            }\n  contato_id: ${c.id}`,
        )
        .join("\n");
    }

    case "obter_historico": {
      const compiled = await compile(ctx, String(args?.contato_id ?? ""), Number(args?.limite) || MESSAGE_LIMIT);
      return compiled.text;
    }

    case "analisar_atendimento": {
      const compiled = await compile(ctx, String(args?.contato_id ?? ""));
      return `${ANALYSIS_COMMAND}\n\n${compiled.text}`;
    }

    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}
