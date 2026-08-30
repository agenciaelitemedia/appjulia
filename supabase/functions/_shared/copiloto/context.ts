/**
 * Compilador de contexto do lead (server-side).
 * Espelha src/modules/mvp-copiloto/lib/buildLeadContext.ts — mesma formatação,
 * para que o resultado no conector MCP e no fallback interno sejam idênticos.
 */

export interface CopilotoMessage {
  id: string;
  text: string | null;
  caption: string | null;
  type: string | null;
  from_me: boolean | null;
  internal_note: boolean | null;
  sender_name: string | null;
  file_name: string | null;
  timestamp: string | null;
  metadata: Record<string, unknown> | null;
  /** URL pública do arquivo no bucket chat-media (quando resolvida). */
  media_url?: string | null;
}

export interface CopilotoLead {
  contactId: string;
  conversationId: string | null;
  name: string | null;
  phone: string | null;
  channel: string | null;
  queueName?: string | null;
}

export interface CompiledContext {
  text: string;
  messageCount: number;
  firstAt: string | null;
  lastAt: string | null;
  attachments: string[];
}

const MEDIA_LABELS: Record<string, string> = {
  image: "imagem",
  video: "vídeo",
  audio: "áudio",
  ptt: "áudio",
  document: "documento",
  sticker: "sticker",
  location: "localização",
  contact: "contato",
};

function fmt(ts: string | null): string {
  if (!ts) return "sem data";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "sem data";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function transcription(m: CopilotoMessage): string | null {
  // deno-lint-ignore no-explicit-any
  const meta = (m.metadata || {}) as any;
  const t = meta.transcription ?? meta.transcript ?? meta.audio_transcription;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

function author(m: CopilotoMessage): string {
  if (m.internal_note) return `NOTA INTERNA${m.sender_name ? ` (${m.sender_name})` : ""}`;
  if (!m.from_me) return "CLIENTE";
  return m.sender_name ? `ATENDENTE (${m.sender_name})` : "ESCRITÓRIO";
}

/** Link utilizável = URL http(s) pública (bucket chat-media), não um placeholder criptografado. */
function usableLink(u: string | null | undefined): string | null {
  if (!u) return null;
  if (u.startsWith("waba_media:")) return null;
  if (u.includes(".enc") || u.includes("mmg.whatsapp.net")) return null;
  return /^https?:\/\//i.test(u) ? u : null;
}

function body(m: CopilotoMessage): string | null {
  const transcribed = transcription(m);
  const text = (m.text || m.caption || "").trim();
  const type = m.type || "text";
  const link = usableLink(m.media_url);
  const linkPart = link ? `\nArquivo: ${link}` : "";

  if (transcribed) return `(áudio transcrito): ${transcribed}${linkPart}`;
  if (text) {
    if (type !== "text" && MEDIA_LABELS[type]) {
      return `(${MEDIA_LABELS[type]}${m.file_name ? `: ${m.file_name}` : ""}): ${text}${linkPart}`;
    }
    return text;
  }
  if (MEDIA_LABELS[type]) {
    return `[${MEDIA_LABELS[type]} enviado${m.file_name ? `: ${m.file_name}` : " sem legenda"}]${linkPart}`;
  }
  if (type === "revoked") return "[mensagem apagada]";
  if (type === "unsupported") return "[mensagem não suportada pelo WhatsApp]";
  return null;
}

export function buildLeadContext(lead: CopilotoLead, messages: CopilotoMessage[]): CompiledContext {
  const ordered = [...messages].sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));

  const lines: string[] = [];
  const attachments: string[] = [];

  for (const m of ordered) {
    const content = body(m);
    if (!content) continue;
    lines.push(`[${fmt(m.timestamp)}] [${author(m)}]: ${content}`);
    if (m.file_name && !attachments.includes(m.file_name)) attachments.push(m.file_name);
  }

  const header = [
    "=== CONTEXTO DO ATENDIMENTO JURÍDICO ===",
    `CLIENTE: ${lead.name || "não informado"}`,
    `TELEFONE: ${lead.phone || "não informado"}`,
    `CANAL: ${lead.channel || "whatsapp"}`,
    lead.queueName ? `FILA: ${lead.queueName}` : null,
    `TOTAL DE MENSAGENS CONSIDERADAS: ${lines.length}`,
    `PERÍODO: ${fmt(ordered[0]?.timestamp ?? null)} até ${fmt(ordered[ordered.length - 1]?.timestamp ?? null)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const docs = attachments.length
    ? `\n\n=== DOCUMENTOS/ARQUIVOS CITADOS NA CONVERSA ===\n${attachments
        .map((a, i) => `${i + 1}. ${a}`)
        .join("\n")}\n(Observação: os arquivos não foram enviados — apenas os nomes estão disponíveis nesta análise.)`
    : "";

  const text = `${header}\n\n=== HISTÓRICO CRONOLÓGICO DA CONVERSA ===\n${
    lines.length ? lines.join("\n") : "(sem mensagens com conteúdo textual)"
  }${docs}`;

  return {
    text,
    messageCount: lines.length,
    firstAt: ordered[0]?.timestamp ?? null,
    lastAt: ordered[ordered.length - 1]?.timestamp ?? null,
    attachments,
  };
}

/** Instrução jurídica fixa — a mesma do MVP anterior. */
export const ANALYSIS_COMMAND =
  `COMANDO: Você é um advogado sênior brasileiro analisando o atendimento abaixo, recebido pelo WhatsApp do escritório.

Responda em português do Brasil, em Markdown, exatamente com estas quatro seções:

## 1. Como foi o atendimento
Resumo objetivo da conversa: quem falou, o que foi pedido, qualidade do atendimento, pendências e próximo passo natural.

## 2. Do que se trata o caso
Relato dos fatos relevantes na ordem cronológica, com datas quando houver, e o ramo do direito envolvido.

## 3. Existe caso jurídico válido?
Diga claramente SIM, NÃO ou INCONCLUSIVO, com justificativa: enquadramento legal (leis, artigos, súmulas), risco de prescrição/decadência, provas já existentes e provas que faltam.

## 4. Outros casos jurídicos possíveis
Liste outras teses ou pedidos que o relato permite identificar (mesmo em outros ramos do direito), com uma linha explicando cada um. Se não houver, diga que não foram identificados.

Não invente fatos que não estejam no histórico. Quando algo for suposição, marque como "a confirmar".`;
