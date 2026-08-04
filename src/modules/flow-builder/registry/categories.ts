import { Zap, GitBranch, MessageSquare, Bot, Kanban, Database } from 'lucide-react';
import type { FlowNodeCategory } from '../types';

export const CATEGORY_META: Record<
  FlowNodeCategory,
  { label: string; icon: typeof Zap; text: string; bg: string; border: string; dot: string; stroke: string }
> = {
  trigger: {
    label: 'Disparo',
    icon: Zap,
    text: 'text-flow-trigger',
    bg: 'bg-flow-trigger/10',
    border: 'border-flow-trigger/40',
    dot: 'bg-flow-trigger',
    stroke: 'hsl(var(--flow-trigger))',
  },
  logic: {
    label: 'Lógica',
    icon: GitBranch,
    text: 'text-flow-logic',
    bg: 'bg-flow-logic/10',
    border: 'border-flow-logic/40',
    dot: 'bg-flow-logic',
    stroke: 'hsl(var(--flow-logic))',
  },
  chat: {
    label: 'Chat',
    icon: MessageSquare,
    text: 'text-flow-chat',
    bg: 'bg-flow-chat/10',
    border: 'border-flow-chat/40',
    dot: 'bg-flow-chat',
    stroke: 'hsl(var(--flow-chat))',
  },
  julia: {
    label: 'Julia',
    icon: Bot,
    text: 'text-flow-julia',
    bg: 'bg-flow-julia/10',
    border: 'border-flow-julia/40',
    dot: 'bg-flow-julia',
    stroke: 'hsl(var(--flow-julia))',
  },
  crm: {
    label: 'CRM',
    icon: Kanban,
    text: 'text-flow-crm',
    bg: 'bg-flow-crm/10',
    border: 'border-flow-crm/40',
    dot: 'bg-flow-crm',
    stroke: 'hsl(var(--flow-crm))',
  },
  data: {
    label: 'Dados',
    icon: Database,
    text: 'text-flow-data',
    bg: 'bg-flow-data/10',
    border: 'border-flow-data/40',
    dot: 'bg-flow-data',
    stroke: 'hsl(var(--flow-data))',
  },
};

export const CATEGORY_ORDER: FlowNodeCategory[] = ['trigger', 'logic', 'chat', 'julia', 'crm', 'data'];