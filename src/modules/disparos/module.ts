/**
 * Metadados do módulo de Disparos (campanhas de WhatsApp).
 *
 * Módulo isolado: nada fora de src/modules/disparos importa arquivos internos,
 * e todo acesso a recursos da Julia passa por src/modules/disparos/extend.
 */
export const DISPAROS_MODULE = {
  code: 'campaigns_dispatch',
  name: 'Disparos',
  description: 'Campanhas de WhatsApp com limites, rotação de números e anti-bloqueio',
  icon: 'Send',
  route: '/disparos',
  menuGroup: 'AGENTES DA JULIA',
  category: 'agente',
  displayOrder: 34,
} as const;

export const DISPAROS_TABS = [
  { value: 'campanhas', label: 'Campanhas', icon: 'Megaphone' },
  { value: 'templates', label: 'Templates', icon: 'FileText' },
  { value: 'simulacao', label: 'Simulação', icon: 'FlaskConical' },
  { value: 'monitor', label: 'Monitoramento', icon: 'Activity' },
  { value: 'logs', label: 'Logs', icon: 'ScrollText' },
  { value: 'supressao', label: 'Supressão', icon: 'UserX' },
  { value: 'config', label: 'Configurações', icon: 'SlidersHorizontal' },
] as const;

export type DisparosTab = (typeof DISPAROS_TABS)[number]['value'];

/** Rótulos amigáveis de status de campanha. */
export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  preparing: 'Preparando',
  running: 'Em execução',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  failed: 'Falhou',
};

/** Rótulos amigáveis dos motivos de bloqueio das filas. */
export const CHANNEL_REASON_LABEL: Record<string, string> = {
  queue_inactive: 'Fila inativa',
  channel_blocked: 'Canal bloqueado (circuit breaker)',
  marketing_disabled_on_channel: 'Marketing desativado nesta fila',
  outside_channel_window: 'Fora da janela de horário',
  throttled: 'Aguardando intervalo entre mensagens',
  minute_limit: 'Limite por minuto atingido',
  hour_limit: 'Limite por hora atingido',
  day_limit: 'Limite diário atingido',
  unique_recipients_limit: 'Limite de destinatários únicos do dia',
};

export const EXCLUSION_REASON_LABEL: Record<string, string> = {
  invalid_phone: 'Telefone inválido',
  suppressed: 'Na lista de supressão',
  frequency_cap: 'Limite de frequência por contato',
};

/** Rótulos do fluxo de aprovação (campanhas e templates). */
export const APPROVAL_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  pending: 'Aguardando aprovação',
  approved: 'Aprovado',
  rejected: 'Reprovado',
};

/** Fusos disponíveis para o cronograma da campanha. */
export const DISPAROS_TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (BRT, UTC-3)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (UTC-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
  { value: 'America/Belem', label: 'Belém (UTC-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (UTC-3)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
  { value: 'America/New_York', label: 'Nova York (ET)' },
  { value: 'Europe/Lisbon', label: 'Lisboa (WET)' },
  { value: 'UTC', label: 'UTC' },
] as const;

export const HEALTH_LABEL: Record<string, string> = {
  healthy: 'Saudável',
  degraded: 'Instável',
  blocked: 'Bloqueada',
};
