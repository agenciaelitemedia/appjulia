// ============================================
// Interpolação de variáveis em mensagens (sintaxe {{...}})
// ============================================

export interface VariableContext {
  contactName?: string | null;
  protocol?: string | null;
  agentName?: string | null;
}

function brtNow(): Date {
  // Hora atual em America/Sao_Paulo
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date()).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  return new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`);
}

function saudacao(): string {
  const h = brtNow().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function fmtTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

export const AVAILABLE_VARIABLES = [
  { key: 'Saudacao_dia_tarde_noite', label: 'Bom dia / Boa tarde / Boa noite', example: saudacao() },
  { key: 'nome', label: 'Nome do contato', example: 'João da Silva' },
  { key: 'primeiro_nome', label: 'Primeiro nome', example: 'João' },
  { key: 'data_hoje', label: 'Data de hoje (dd/MM/yyyy)', example: fmtDate(brtNow()) },
  { key: 'hora_agora', label: 'Hora agora (HH:mm)', example: fmtTime(brtNow()) },
  { key: 'data_hoje+Xd', label: 'Hoje + X dias (ex: data_hoje+3d)', example: 'data_hoje+3d' },
  { key: 'protocolo', label: 'Protocolo da conversa', example: '#2026-000123' },
  { key: 'atendente', label: 'Seu nome (atendente)', example: 'Maria' },
] as const;

export function interpolateVariables(text: string, ctx: VariableContext): string {
  if (!text) return text;
  const now = brtNow();
  const firstName = (ctx.contactName ?? '').trim().split(/\s+/)[0] || '';

  const map: Record<string, string> = {
    saudacao_dia_tarde_noite: saudacao(),
    nome: ctx.contactName ?? '',
    primeiro_nome: firstName,
    protocolo: ctx.protocol ?? '',
    atendente: ctx.agentName ?? '',
    data_hoje: fmtDate(now),
    hora_agora: fmtTime(now),
    // legados
    data: fmtDate(now),
    hora: fmtTime(now),
  };

  // {{data_hoje+Xd}}
  let out = text.replace(/\{\{\s*data_hoje\s*\+\s*(\d+)\s*d\s*\}\}/gi, (_m, n) => {
    const days = parseInt(n, 10);
    if (!Number.isFinite(days)) return _m;
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return fmtDate(d);
  });

  out = out.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (match, key) => {
    const value = map[String(key).toLowerCase()];
    return value !== undefined ? value : match;
  });

  return out;
}

/** Remove qualquer variável não substituída (fallback) */
export function stripUnresolvedVariables(text: string): string {
  return text.replace(/\{\{\s*[\w_]+\s*\}\}/g, '').replace(/\s+/g, ' ').trim();
}
