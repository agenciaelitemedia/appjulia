// ============================================
// Biblioteca de Templates de Automação de Chat
// Regras pré-configuradas para ativar com 1 clique
// ============================================

export interface AutomationTemplate {
  id: string;
  category: 'welcome' | 'after_hours' | 'routing' | 'faq' | 'csat' | 'cleanup';
  emoji: string;
  name: string;
  description: string;
  // Payload pronto para inserir em chat_automation_rules (sem client_id/cod_agent)
  rule: {
    name: string;
    description: string;
    is_active: boolean;
    trigger_type: string;
    trigger_config: Record<string, any>;
    action_type: string;
    action_config: Record<string, any>;
  };
}

export const CATEGORY_LABELS: Record<AutomationTemplate['category'], string> = {
  welcome: 'Boas-vindas',
  after_hours: 'Fora do horário',
  routing: 'Roteamento',
  faq: 'FAQ rápido',
  csat: 'Satisfação',
  cleanup: 'Limpeza',
};

export const CHAT_AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  // ── Boas-vindas ────────────────────────────────────────
  {
    id: 'welcome_basic',
    category: 'welcome',
    emoji: '👋',
    name: 'Mensagem de boas-vindas',
    description: 'Envia uma saudação automática toda vez que uma nova conversa é aberta.',
    rule: {
      name: 'Boas-vindas automáticas',
      description: 'Saudação ao iniciar nova conversa',
      is_active: true,
      trigger_type: 'new_conversation',
      trigger_config: {},
      action_type: 'send_message',
      action_config: {
        text: 'Olá! 👋 Recebemos sua mensagem e em breve um de nossos atendentes vai te responder. Obrigado pelo contato!',
      },
    },
  },
  {
    id: 'welcome_tag_new',
    category: 'welcome',
    emoji: '🆕',
    name: 'Marcar lead como "novo"',
    description: 'Adiciona automaticamente a tag "novo" em toda conversa recém-criada.',
    rule: {
      name: 'Marcar como novo lead',
      description: 'Tagueia conversas recém-abertas',
      is_active: true,
      trigger_type: 'new_conversation',
      trigger_config: {},
      action_type: 'auto_tag',
      action_config: { tag: 'novo' },
    },
  },

  // ── Fora do horário ────────────────────────────────────
  {
    id: 'after_hours_message',
    category: 'after_hours',
    emoji: '🌙',
    name: 'Resposta fora do horário comercial',
    description: 'Envia mensagem informando o horário de atendimento (08h–18h).',
    rule: {
      name: 'Aviso fora do horário',
      description: 'Mensagem automática 18h–08h',
      is_active: true,
      trigger_type: 'outside_hours',
      trigger_config: { start: '08:00', end: '18:00' },
      action_type: 'send_message',
      action_config: {
        text: 'Olá! No momento estamos fora do horário de atendimento (seg-sex, 08h às 18h). Assim que voltarmos, retornaremos seu contato. 🙏',
      },
    },
  },

  // ── Roteamento ─────────────────────────────────────────
  {
    id: 'routing_pricing',
    category: 'routing',
    emoji: '💰',
    name: 'Roteamento por palavra-chave: preço',
    description: 'Marca como prioridade alta quando o cliente fala em preço/valor/orçamento.',
    rule: {
      name: 'Lead quente: orçamento',
      description: 'Prioriza leads que falam em preço',
      is_active: true,
      trigger_type: 'keyword',
      trigger_config: { keywords: ['preço', 'preco', 'valor', 'orçamento', 'orcamento', 'quanto custa'] },
      action_type: 'set_priority',
      action_config: { priority: 'high' },
    },
  },
  {
    id: 'routing_complaint',
    category: 'routing',
    emoji: '⚠️',
    name: 'Roteamento por palavra-chave: reclamação',
    description: 'Marca como urgente quando o cliente menciona reclamação, problema ou cancelar.',
    rule: {
      name: 'Reclamação urgente',
      description: 'Eleva prioridade ao detectar reclamação',
      is_active: true,
      trigger_type: 'keyword',
      trigger_config: { keywords: ['reclamação', 'reclamacao', 'problema', 'cancelar', 'reembolso', 'procon'] },
      action_type: 'set_priority',
      action_config: { priority: 'urgent' },
    },
  },
  {
    id: 'routing_tag_pricing',
    category: 'routing',
    emoji: '🏷️',
    name: 'Tag automática: interessado',
    description: 'Adiciona a tag "interessado" quando o cliente fala em contratar/comprar.',
    rule: {
      name: 'Tag: interessado',
      description: 'Tagueia leads com intenção de compra',
      is_active: true,
      trigger_type: 'keyword',
      trigger_config: { keywords: ['contratar', 'comprar', 'fechar', 'quero', 'aceito'] },
      action_type: 'auto_tag',
      action_config: { tag: 'interessado' },
    },
  },

  // ── FAQ rápido ─────────────────────────────────────────
  {
    id: 'faq_address',
    category: 'faq',
    emoji: '📍',
    name: 'FAQ: endereço',
    description: 'Responde automaticamente perguntas sobre endereço/localização.',
    rule: {
      name: 'FAQ — Endereço',
      description: 'Resposta automática sobre localização',
      is_active: false,
      trigger_type: 'keyword',
      trigger_config: { keywords: ['endereço', 'endereco', 'localização', 'onde fica', 'como chegar'] },
      action_type: 'send_message',
      action_config: {
        text: 'Nosso escritório fica em [SEU ENDEREÇO]. Atendemos com hora marcada — agende pelo WhatsApp ou pelo telefone. 📍',
      },
    },
  },
  {
    id: 'faq_hours',
    category: 'faq',
    emoji: '🕐',
    name: 'FAQ: horário de atendimento',
    description: 'Responde automaticamente perguntas sobre horário.',
    rule: {
      name: 'FAQ — Horário',
      description: 'Resposta automática sobre horário',
      is_active: false,
      trigger_type: 'keyword',
      trigger_config: { keywords: ['horário', 'horario', 'que horas', 'aberto', 'funcionamento'] },
      action_type: 'send_message',
      action_config: {
        text: 'Atendemos de segunda a sexta, das 08h às 18h. 🕐 Sábados, das 09h às 12h. Domingos e feriados: fechado.',
      },
    },
  },

  // ── Limpeza ────────────────────────────────────────────
  {
    id: 'cleanup_inactive_24h',
    category: 'cleanup',
    emoji: '🧹',
    name: 'Encerrar conversas inativas (24h)',
    description: 'Fecha automaticamente conversas sem interação há 24 horas.',
    rule: {
      name: 'Encerrar inativas 24h',
      description: 'Fecha conversas sem atividade',
      is_active: false,
      trigger_type: 'inactivity',
      trigger_config: { minutes: 1440 },
      action_type: 'auto_close',
      action_config: { reason: 'Sem resposta do cliente em 24h' },
    },
  },
  {
    id: 'cleanup_inactive_2h',
    category: 'cleanup',
    emoji: '⏰',
    name: 'Lembrete após 2h sem resposta',
    description: 'Envia mensagem de follow-up quando o cliente fica 2 horas sem responder.',
    rule: {
      name: 'Follow-up 2h',
      description: 'Mensagem de retomada após inatividade',
      is_active: false,
      trigger_type: 'inactivity',
      trigger_config: { minutes: 120 },
      action_type: 'send_message',
      action_config: {
        text: 'Oi! 😊 Notei que você ainda não respondeu — posso te ajudar com mais alguma informação? Estou por aqui!',
      },
    },
  },
];
