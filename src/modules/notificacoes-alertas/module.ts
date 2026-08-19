/**
 * Metadados do módulo Notificações e Alertas.
 *
 * Fonte única de verdade: code de permissão, rota, ícone, menu e catálogo
 * de gatilhos. Nada fora de src/modules/notificacoes-alertas importa arquivos
 * internos deste módulo.
 */
export const ALERTS_MODULE = {
  code: 'notifications_alerts',
  name: 'Notificações e Alertas',
  description: 'Alertas de WhatsApp para as situações do atendimento da Julia',
  icon: 'BellRing',
  route: '/notificacoes-alertas',
  menuGroup: 'AGENTES DA JULIA',
  category: 'agente',
  displayOrder: 32,
} as const;

export const ALERTS_ROUTES = {
  main: '/notificacoes-alertas',
} as const;

export type AlertTriggerKey =
  | 'no_response'
  | 'qualified'
  | 'disqualified'
  | 'contract_in_progress'
  | 'contract_signed'
  | 'flow_error';

export type AlertMode = 'notify' | 'takeover';

export interface AlertTriggerDef {
  key: AlertTriggerKey;
  label: string;
  situacao: string;
  description: string;
  defaultMode: AlertMode;
  /** Gatilho usa etapas do CRM para ser detectado. */
  usesStages?: boolean;
  /** Gatilho usa minutos de silêncio do lead para ser detectado. */
  usesSilenceMinutes?: boolean;
}

const DEFAULT_TEMPLATE = `🔔 *{situacao}*

👤 Lead: {lead_nome}

📱 WhatsApp: {lead_whatsapp}

🗂️ CRM Julia: *{etapa_crm}*

🕒 {data_hora}`;

export const ALERT_DEFAULT_TEMPLATE = DEFAULT_TEMPLATE;

export const ALERT_TRIGGERS: AlertTriggerDef[] = [
  {
    key: 'no_response',
    label: 'Cliente parou de responder',
    situacao: 'Lead parou de responder — recuperação',
    description: 'O lead ficou X minutos sem responder a última mensagem enviada.',
    defaultMode: 'takeover',
    usesSilenceMinutes: true,
  },
  {
    key: 'qualified',
    label: 'Lead qualificado',
    situacao: 'Lead qualificado',
    description: 'O lead avançou para uma etapa de qualificação no CRM.',
    defaultMode: 'takeover',
    usesStages: true,
  },
  {
    key: 'disqualified',
    label: 'Lead desqualificado',
    situacao: 'Lead desqualificado',
    description: 'O lead foi movido para uma etapa de desqualificação no CRM.',
    defaultMode: 'notify',
    usesStages: true,
  },
  {
    key: 'contract_in_progress',
    label: 'Contrato em curso',
    situacao: 'Contrato em curso (aguardando assinatura)',
    description: 'O contrato foi gerado e ainda não foi assinado pelo lead.',
    defaultMode: 'takeover',
  },
  {
    key: 'contract_signed',
    label: 'Contrato assinado',
    situacao: 'Contrato assinado',
    description: 'O lead assinou o contrato.',
    defaultMode: 'takeover',
  },
  {
    key: 'flow_error',
    label: 'Fim de fluxo sem destino',
    situacao: 'Erro de fluxo — atendimento sem destino',
    description: 'O atendimento terminou sem etapa/destino definido.',
    defaultMode: 'notify',
  },
];

export const ALERT_VARIABLES = [
  { key: 'lead_nome', label: 'Nome do lead' },
  { key: 'lead_whatsapp', label: 'WhatsApp do lead' },
  { key: 'data_hora', label: 'Data e hora' },
  { key: 'situacao', label: 'Situação' },
  { key: 'resumo_conversa', label: 'Resumo da conversa' },
  { key: 'caso', label: 'Caso jurídico' },
  { key: 'etapa_crm', label: 'Etapa no CRM da Julia' },
  { key: 'link_chat', label: 'Link do chat' },
] as const;
