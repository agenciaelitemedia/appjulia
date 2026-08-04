import {
  MessageSquarePlus,
  GitBranch,
  Send,
  Tag,
  UserCheck,
  Flag,
  Timer,
  Hourglass,
  UserX,
  MailQuestion,
  Bot,
  BellOff,
  KanbanSquare,
  MoveRight,
  PencilLine,
  Link2,
} from 'lucide-react';
import type { FlowNodeCategory, FlowNodeConfig, FlowNodeKind } from '../types';
import {
  TriggerMessageForm,
  ConditionForm,
  SendTextForm,
  TagForm,
  HandoffForm,
  EndForm,
  TriggerLeadInactiveForm,
  TriggerAgentInactiveForm,
  DelayForm,
  WaitReplyForm,
  JuliaToggleForm,
  FollowupStopForm,
  CrmCreateCardForm,
  CrmMoveCardForm,
  CrmUpdateCardForm,
  CrmLinkConversationForm,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  type NodeFormProps,
} from '../components/inspector/forms';

export interface FlowNodeHandle {
  id: string;
  label: string;
}

export interface FlowNodeDefinition {
  kind: FlowNodeKind;
  category: FlowNodeCategory;
  label: string;
  description: string;
  icon: typeof Send;
  hasInput: boolean;
  outputs: FlowNodeHandle[];
  defaultConfig: FlowNodeConfig;
  /** Resumo legível exibido dentro do nó. */
  summary: (config: FlowNodeConfig) => string;
  /** Retorna mensagens de erro; vazio = nó configurado. */
  validate: (config: FlowNodeConfig) => string[];
  Form: (props: NodeFormProps) => JSX.Element;
}

const OUT = [{ id: 'out', label: 'Saída' }];

const UNIT_LABELS: Record<string, [string, string]> = {
  seconds: ['segundo', 'segundos'],
  minutes: ['minuto', 'minutos'],
  hours: ['hora', 'horas'],
  days: ['dia', 'dias'],
};

function durationText(config: FlowNodeConfig, fallbackUnit = 'minutes'): string {
  const amount = Number(config.amount ?? 0);
  const unit = String(config.unit ?? fallbackUnit);
  const [one, many] = UNIT_LABELS[unit] ?? UNIT_LABELS.minutes;
  return `${amount} ${amount === 1 ? one : many}`;
}

export const NODE_DEFINITIONS: Record<FlowNodeKind, FlowNodeDefinition> = {
  trigger_message_received: {
    kind: 'trigger_message_received',
    category: 'trigger',
    label: 'Mensagem recebida',
    description: 'Dispara quando o lead envia uma mensagem',
    icon: MessageSquarePlus,
    hasInput: false,
    outputs: OUT,
    defaultConfig: { queue_id: '', keywords: '', match_mode: 'contains', media_type: 'any', only_business_hours: false },
    summary: (c) => {
      const kw = String(c.keywords ?? '').trim();
      return kw ? `Quando contiver: ${kw}` : 'Qualquer mensagem do lead';
    },
    validate: () => [],
    Form: TriggerMessageForm,
  },

  trigger_lead_inactive: {
    kind: 'trigger_lead_inactive',
    category: 'trigger',
    label: 'Lead sem responder',
    description: 'Dispara quando o lead fica um tempo sem responder',
    icon: UserX,
    hasInput: false,
    outputs: OUT,
    defaultConfig: { queue_id: '', amount: 30, unit: 'minutes', cooldown_minutes: 720 },
    summary: (c) => `Lead sem responder há ${durationText(c)}`,
    validate: (c) => (Number(c.amount ?? 0) > 0 ? [] : ['Informe o tempo de inatividade']),
    Form: TriggerLeadInactiveForm,
  },

  trigger_agent_inactive: {
    kind: 'trigger_agent_inactive',
    category: 'trigger',
    label: 'Atendente sem responder',
    description: 'Dispara quando a equipe demora para responder o lead',
    icon: MailQuestion,
    hasInput: false,
    outputs: OUT,
    defaultConfig: { queue_id: '', amount: 15, unit: 'minutes', cooldown_minutes: 720 },
    summary: (c) => `Equipe sem responder há ${durationText(c)}`,
    validate: (c) => (Number(c.amount ?? 0) > 0 ? [] : ['Informe o tempo de inatividade']),
    Form: TriggerAgentInactiveForm,
  },

  logic_condition: {
    kind: 'logic_condition',
    category: 'logic',
    label: 'Condição',
    description: 'Divide o fluxo em Verdadeiro / Falso',
    icon: GitBranch,
    hasInput: true,
    outputs: [
      { id: 'true', label: 'Verdadeiro' },
      { id: 'false', label: 'Falso' },
    ],
    defaultConfig: { field: '', operator: 'contains', value: '' },
    summary: (c) => {
      const field = CONDITION_FIELDS.find((f) => f.value === c.field)?.label;
      const op = CONDITION_OPERATORS.find((o) => o.value === c.operator)?.label ?? '';
      if (!field) return 'Condição não configurada';
      const value = String(c.value ?? '');
      return `Se ${field} ${op}${value ? ` "${value}"` : ''}`;
    },
    validate: (c) => (c.field ? [] : ['Escolha o campo da condição']),
    Form: ConditionForm,
  },

  logic_delay: {
    kind: 'logic_delay',
    category: 'logic',
    label: 'Aguardar tempo',
    description: 'Pausa o fluxo por um tempo e continua depois',
    icon: Timer,
    hasInput: true,
    outputs: OUT,
    defaultConfig: { amount: 5, unit: 'minutes' },
    summary: (c) => `Aguardar ${durationText(c)}`,
    validate: (c) => (Number(c.amount ?? 0) > 0 ? [] : ['Informe o tempo de espera']),
    Form: DelayForm,
  },

  logic_wait_reply: {
    kind: 'logic_wait_reply',
    category: 'logic',
    label: 'Aguardar resposta',
    description: 'Espera o lead responder, com prazo limite',
    icon: Hourglass,
    hasInput: true,
    outputs: [
      { id: 'replied', label: 'Respondeu' },
      { id: 'timeout', label: 'Sem resposta' },
    ],
    defaultConfig: { amount: 10, unit: 'minutes' },
    summary: (c) => `Esperar resposta por até ${durationText(c)}`,
    validate: (c) => (Number(c.amount ?? 0) > 0 ? [] : ['Informe o prazo de espera']),
    Form: WaitReplyForm,
  },

  chat_send_text: {
    kind: 'chat_send_text',
    category: 'chat',
    label: 'Enviar mensagem',
    description: 'Envia um texto para o lead',
    icon: Send,
    hasInput: true,
    outputs: OUT,
    defaultConfig: { text: '', delay_seconds: 0 },
    summary: (c) => {
      const text = String(c.text ?? '').trim();
      if (!text) return 'Mensagem não definida';
      return text.length > 70 ? `${text.slice(0, 70)}…` : text;
    },
    validate: (c) => (String(c.text ?? '').trim() ? [] : ['Escreva a mensagem a enviar']),
    Form: SendTextForm,
  },

  chat_tag: {
    kind: 'chat_tag',
    category: 'chat',
    label: 'Etiquetar',
    description: 'Adiciona ou remove uma etiqueta',
    icon: Tag,
    hasInput: true,
    outputs: OUT,
    defaultConfig: { action: 'add', tag_id: '', tag_name: '' },
    summary: (c) => {
      const name = String(c.tag_name ?? '');
      if (!name) return 'Etiqueta não escolhida';
      return c.action === 'remove' ? `Remover "${name}"` : `Adicionar "${name}"`;
    },
    validate: (c) => (c.tag_id ? [] : ['Escolha a etiqueta']),
    Form: TagForm,
  },

  chat_handoff: {
    kind: 'chat_handoff',
    category: 'chat',
    label: 'Encaminhar para humano',
    description: 'Transfere o atendimento para a equipe',
    icon: UserCheck,
    hasInput: true,
    outputs: OUT,
    defaultConfig: { queue_id: '', priority: 'normal', disable_julia: true, note: '' },
    summary: (c) => (c.queue_id ? 'Transferir de fila e avisar a equipe' : 'Passar para atendimento humano'),
    validate: () => [],
    Form: HandoffForm,
  },

  julia_toggle: {
    kind: 'julia_toggle',
    category: 'julia',
    label: 'Ativar/desativar Julia',
    description: 'Liga ou pausa a IA e o followup do lead',
    icon: Bot,
    hasInput: true,
    outputs: OUT,
    defaultConfig: { mode: 'on' },
    summary: (c) => (c.mode === 'off' ? 'Desativar Julia e parar followup' : 'Ativar Julia com followup'),
    validate: () => [],
    Form: JuliaToggleForm,
  },

  julia_followup_stop: {
    kind: 'julia_followup_stop',
    category: 'julia',
    label: 'Parar followup',
    description: 'Interrompe o followup mantendo a Julia ativa',
    icon: BellOff,
    hasInput: true,
    outputs: OUT,
    defaultConfig: {},
    summary: () => 'Parar followup do lead',
    validate: () => [],
    Form: FollowupStopForm,
  },

  crm_create_card: {
    kind: 'crm_create_card',
    category: 'crm',
    label: 'Criar card',
    description: 'Cria um card do lead no CRM',
    icon: KanbanSquare,
    hasInput: true,
    outputs: OUT,
    defaultConfig: {
      board_id: '',
      pipeline_id: '',
      title: '',
      description: '',
      value: '',
      priority: 'medium',
      assigned_to: '',
      skip_if_exists: true,
      link_conversation: true,
    },
    summary: (c) => {
      const title = String(c.title ?? '').trim();
      if (!c.board_id) return 'Quadro do CRM não escolhido';
      return title ? `Criar card "${title}"` : 'Criar card com o nome do lead';
    },
    validate: (c) => (c.board_id ? [] : ['Escolha o quadro do CRM']),
    Form: CrmCreateCardForm,
  },

  crm_move_card: {
    kind: 'crm_move_card',
    category: 'crm',
    label: 'Mover card de fase',
    description: 'Move o card do lead para outra fase',
    icon: MoveRight,
    hasInput: true,
    outputs: OUT,
    defaultConfig: { board_id: '', pipeline_id: '' },
    summary: (c) => (c.pipeline_id ? 'Mover card para a fase escolhida' : 'Fase de destino não escolhida'),
    validate: (c) => {
      const errors: string[] = [];
      if (!c.board_id) errors.push('Escolha o quadro do CRM');
      if (!c.pipeline_id) errors.push('Escolha a fase de destino');
      return errors;
    },
    Form: CrmMoveCardForm,
  },

  crm_update_card: {
    kind: 'crm_update_card',
    category: 'crm',
    label: 'Editar card',
    description: 'Atualiza campos do card do lead',
    icon: PencilLine,
    hasInput: true,
    outputs: OUT,
    defaultConfig: {
      board_id: '',
      title: '',
      description: '',
      priority: '',
      status: '',
      value: '',
      assigned_to: '',
    },
    summary: (c) => {
      const changes: string[] = [];
      if (String(c.title ?? '').trim()) changes.push('título');
      if (c.priority) changes.push('prioridade');
      if (c.status) changes.push('situação');
      if (String(c.value ?? '')) changes.push('valor');
      if (String(c.assigned_to ?? '')) changes.push('responsável');
      if (String(c.description ?? '').trim()) changes.push('observação');
      return changes.length ? `Atualizar ${changes.join(', ')}` : 'Nenhum campo escolhido';
    },
    validate: (c) => {
      const hasChange = [c.title, c.priority, c.status, c.value, c.assigned_to, c.description].some(
        (v) => String(v ?? '').trim() !== '',
      );
      return hasChange ? [] : ['Escolha ao menos um campo para atualizar'];
    },
    Form: CrmUpdateCardForm,
  },

  crm_link_conversation: {
    kind: 'crm_link_conversation',
    category: 'crm',
    label: 'Vincular conversa ao card',
    description: 'Liga a conversa atual ao card do lead',
    icon: Link2,
    hasInput: true,
    outputs: OUT,
    defaultConfig: { board_id: '' },
    summary: () => 'Vincular conversa ao card do lead',
    validate: () => [],
    Form: CrmLinkConversationForm,
  },

  flow_end: {
    kind: 'flow_end',
    category: 'data',
    label: 'Encerrar fluxo',
    description: 'Finaliza a execução da automação',
    icon: Flag,
    hasInput: true,
    outputs: [],
    defaultConfig: { reason: '', resolve_conversation: false },
    summary: (c) => {
      const reason = String(c.reason ?? '').trim();
      const base = c.resolve_conversation ? 'Encerrar e resolver conversa' : 'Encerrar fluxo';
      return reason ? `${base} — ${reason}` : base;
    },
    validate: () => [],
    Form: EndForm,
  },
};

export const NODE_LIST = Object.values(NODE_DEFINITIONS);

export function getNodeDefinition(kind: FlowNodeKind | string): FlowNodeDefinition | undefined {
  return NODE_DEFINITIONS[kind as FlowNodeKind];
}