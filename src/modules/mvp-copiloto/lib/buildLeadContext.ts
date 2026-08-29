/**
 * Compilador de contexto: transforma contato + mensagens em um bloco de texto
 * limpo, no formato descrito em docs/integracao-ia-pro-auth.md.
 */

export interface MvpMessage {
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
}

export interface MvpLead {
  contactId: string;
  conversationId: string | null;
  name: string | null;
  phone: string | null;
  channel: string | null;
  queueName: string | null;
  codAgent: string | null;
}

export interface CompiledContext {
  text: string;
  messageCount: number;
  firstAt: string | null;
  lastAt: string | null;
  attachments: string[];
}

const MEDIA_LABELS: Record<string, string> = {
  image: 'imagem',
  video: 'vídeo',
  audio: 'áudio',
  ptt: 'áudio',
  document: 'documento',
  sticker: 'sticker',
  location: 'localização',
  contact: 'contato',
};

function fmt(ts: string | null): string {
  if (!ts) return 'sem data';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'sem data';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function transcription(m: MvpMessage): string | null {
  const meta = (m.metadata || {}) as Record<string, any>;
  const t = meta.transcription ?? meta.transcript ?? meta.audio_transcription;
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}

function author(m: MvpMessage): string {
  if (m.internal_note) return `NOTA INTERNA${m.sender_name ? ` (${m.sender_name})` : ''}`;
  if (!m.from_me) return 'CLIENTE';
  return m.sender_name ? `ATENDENTE (${m.sender_name})` : 'ESCRITÓRIO';
}

function body(m: MvpMessage): string | null {
  const transcribed = transcription(m);
  const text = (m.text || m.caption || '').trim();
  const type = m.type || 'text';

  if (transcribed) return `(áudio transcrito): ${transcribed}`;
  if (text) {
    if (type !== 'text' && MEDIA_LABELS[type]) {
      return `(${MEDIA_LABELS[type]}${m.file_name ? `: ${m.file_name}` : ''}): ${text}`;
    }
    return text;
  }
  if (MEDIA_LABELS[type]) {
    return `[${MEDIA_LABELS[type]} enviado${m.file_name ? `: ${m.file_name}` : ' sem legenda'}]`;
  }
  if (type === 'revoked') return '[mensagem apagada]';
  if (type === 'unsupported') return '[mensagem não suportada pelo WhatsApp]';
  return null;
}

export function buildLeadContext(lead: MvpLead, messages: MvpMessage[]): CompiledContext {
  const ordered = [...messages].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

  const lines: string[] = [];
  const attachments: string[] = [];

  for (const m of ordered) {
    const content = body(m);
    if (!content) continue;
    lines.push(`[${fmt(m.timestamp)}] [${author(m)}]: ${content}`);

    if (m.file_name && !attachments.includes(m.file_name)) {
      attachments.push(m.file_name);
    }
  }

  const header = [
    '=== CONTEXTO DO ATENDIMENTO JURÍDICO ===',
    `CLIENTE: ${lead.name || 'não informado'}`,
    `TELEFONE: ${lead.phone || 'não informado'}`,
    `CANAL: ${lead.channel || 'whatsapp'}`,
    lead.queueName ? `FILA: ${lead.queueName}` : null,
    `TOTAL DE MENSAGENS CONSIDERADAS: ${lines.length}`,
    `PERÍODO: ${fmt(ordered[0]?.timestamp ?? null)} até ${fmt(ordered[ordered.length - 1]?.timestamp ?? null)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const docs = attachments.length
    ? `\n\n=== DOCUMENTOS/ARQUIVOS CITADOS NA CONVERSA ===\n${attachments
        .map((a, i) => `${i + 1}. ${a}`)
        .join('\n')}\n(Observação: os arquivos não foram enviados — apenas os nomes estão disponíveis nesta análise.)`
    : '';

  const text = `${header}\n\n=== HISTÓRICO CRONOLÓGICO DA CONVERSA ===\n${
    lines.length ? lines.join('\n') : '(sem mensagens com conteúdo textual)'
  }${docs}`;

  return {
    text,
    messageCount: lines.length,
    firstAt: ordered[0]?.timestamp ?? null,
    lastAt: ordered[ordered.length - 1]?.timestamp ?? null,
    attachments,
  };
}
