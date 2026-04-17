// ============================================
// Interpolação de variáveis em mensagens
// {{nome}}, {{primeiro_nome}}, {{protocolo}}, {{atendente}}, {{data}}, {{hora}}
// ============================================

export interface VariableContext {
  contactName?: string | null;
  protocol?: string | null;
  agentName?: string | null;
}

export const AVAILABLE_VARIABLES = [
  { key: 'nome', label: 'Nome do contato', example: 'João da Silva' },
  { key: 'primeiro_nome', label: 'Primeiro nome', example: 'João' },
  { key: 'protocolo', label: 'Protocolo da conversa', example: '#2026-000123' },
  { key: 'atendente', label: 'Seu nome (atendente)', example: 'Maria' },
  { key: 'data', label: 'Data atual', example: new Date().toLocaleDateString('pt-BR') },
  { key: 'hora', label: 'Hora atual', example: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
] as const;

export function interpolateVariables(text: string, ctx: VariableContext): string {
  if (!text) return text;
  const now = new Date();
  const firstName = (ctx.contactName ?? '').trim().split(/\s+/)[0] || '';

  const map: Record<string, string> = {
    nome: ctx.contactName ?? '',
    primeiro_nome: firstName,
    protocolo: ctx.protocol ?? '',
    atendente: ctx.agentName ?? '',
    data: now.toLocaleDateString('pt-BR'),
    hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };

  return text.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (match, key) => {
    const value = map[key.toLowerCase()];
    return value !== undefined ? value : match;
  });
}

/** Remove qualquer variável não substituída (fallback) */
export function stripUnresolvedVariables(text: string): string {
  return text.replace(/\{\{\s*[\w_]+\s*\}\}/g, '').replace(/\s+/g, ' ').trim();
}
