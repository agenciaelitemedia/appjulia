import { MessageSquarePlus, GitBranch, Send, Tag, UserCheck, Flag } from 'lucide-react';
import type { FlowNodeCategory, FlowNodeConfig, FlowNodeKind } from '../types';
import {
  TriggerMessageForm,
  ConditionForm,
  SendTextForm,
  TagForm,
  HandoffForm,
  EndForm,
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