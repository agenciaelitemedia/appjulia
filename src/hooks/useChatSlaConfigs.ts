import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInMinutes, parseISO } from 'date-fns';
import { toast } from 'sonner';

export interface ChatSlaConfig {
  id: string;
  client_id: string;
  cod_agent: string | null;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  first_response_minutes: number;
  nrt_response_minutes: number;
  resolution_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_SLA_BY_PRIORITY: Record<string, { first: number; nrt: number; resolution: number }> = {
  urgent: { first: 15,  nrt: 30,  resolution: 240 },
  high:   { first: 60,  nrt: 120, resolution: 480 },
  normal: { first: 240, nrt: 240, resolution: 4320 },
  low:    { first: 480, nrt: 480, resolution: 14400 },
};

export function useChatSlaConfigs() {
  const { user } = useAuth();
  const clientId = String(user?.id ?? '');
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['chat-sla-configs', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_sla_configs')
        .select('*')
        .eq('client_id', clientId)
        .order('priority');
      if (error) throw error;
      return (data ?? []) as ChatSlaConfig[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<ChatSlaConfig> & { priority: string }) => {
      const payload = {
        client_id: clientId,
        priority: input.priority,
        first_response_minutes: input.first_response_minutes ?? 15,
        nrt_response_minutes: input.nrt_response_minutes ?? 60,
        resolution_minutes: input.resolution_minutes ?? 240,
        is_active: input.is_active ?? true,
      };
      const { error } = await supabase
        .from('chat_sla_configs')
        .upsert(payload as any, { onConflict: 'client_id,priority' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sla-configs', clientId] });
      toast.success('SLA salvo');
    },
    onError: (e: any) => toast.error(`Erro ao salvar SLA: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_sla_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-sla-configs', clientId] }),
  });

  return { configs, isLoading, upsert, remove };
}

export type SlaStatus = 'on_track' | 'at_risk' | 'breached' | 'unknown';
export type SlaType = 'frt' | 'nrt' | 'ttr';

export interface SlaEvaluation {
  status: SlaStatus;
  remainingMinutes: number;
  targetMinutes: number;
  label: string;
  slaType: SlaType;
  slaTypeLabel: string;
}

/**
 * Avalia o SLA ativo de uma conversa.
 * - FRT: aguardando primeira resposta do atendente
 * - NRT: atendente deve responder à última mensagem do cliente
 * - TTR: atendente já respondeu, aguardando resolução
 */
export function evaluateSla(
  conversation: {
    status: string;
    priority: string;
    opened_at: string;
    first_response_at: string | null;
    resolved_at: string | null;
    closed_at: string | null;
    last_customer_message_at?: string | null;
    last_message_from_me?: boolean | null;
  },
  configs: ChatSlaConfig[]
): SlaEvaluation {
  const config = configs.find((c) => c.priority === conversation.priority && c.is_active);
  const defaults = DEFAULT_SLA_BY_PRIORITY[conversation.priority] ?? DEFAULT_SLA_BY_PRIORITY.normal;
  const firstTarget = config?.first_response_minutes ?? defaults.first;
  const nrtTarget = config?.nrt_response_minutes ?? defaults.nrt;
  const resolutionTarget = config?.resolution_minutes ?? defaults.resolution;

  if (conversation.status === 'closed' || conversation.status === 'resolved') {
    return { status: 'on_track', remainingMinutes: 0, targetMinutes: resolutionTarget, label: 'Concluída', slaType: 'ttr', slaTypeLabel: 'Resolução' };
  }

  const now = new Date();

  // FRT: aguardando primeira resposta
  if (!conversation.first_response_at) {
    const opened = parseISO(conversation.opened_at);
    const elapsed = differenceInMinutes(now, opened);
    const remaining = firstTarget - elapsed;
    if (remaining < 0) {
      return { status: 'breached', remainingMinutes: remaining, targetMinutes: firstTarget, label: '1ª resposta atrasada', slaType: 'frt', slaTypeLabel: '1ª Resposta' };
    }
    if (remaining <= firstTarget * 0.25) {
      return { status: 'at_risk', remainingMinutes: remaining, targetMinutes: firstTarget, label: '1ª resposta próxima', slaType: 'frt', slaTypeLabel: '1ª Resposta' };
    }
    return { status: 'on_track', remainingMinutes: remaining, targetMinutes: firstTarget, label: '1ª resposta no prazo', slaType: 'frt', slaTypeLabel: '1ª Resposta' };
  }

  // NRT: última mensagem é do cliente → atendente deve responder
  if (conversation.last_message_from_me === false && conversation.last_customer_message_at) {
    const t0 = parseISO(conversation.last_customer_message_at);
    const elapsed = differenceInMinutes(now, t0);
    const remaining = nrtTarget - elapsed;
    if (remaining < 0) {
      return { status: 'breached', remainingMinutes: remaining, targetMinutes: nrtTarget, label: 'Resposta atrasada', slaType: 'nrt', slaTypeLabel: 'Próx. Resposta' };
    }
    if (remaining <= nrtTarget * 0.25) {
      return { status: 'at_risk', remainingMinutes: remaining, targetMinutes: nrtTarget, label: 'Resposta próxima do prazo', slaType: 'nrt', slaTypeLabel: 'Próx. Resposta' };
    }
    return { status: 'on_track', remainingMinutes: remaining, targetMinutes: nrtTarget, label: 'Resposta no prazo', slaType: 'nrt', slaTypeLabel: 'Próx. Resposta' };
  }

  // TTR: atendente respondeu, aguardando resolução
  const opened = parseISO(conversation.opened_at);
  const elapsed = differenceInMinutes(now, opened);
  const remaining = resolutionTarget - elapsed;
  if (remaining < 0) {
    return { status: 'breached', remainingMinutes: remaining, targetMinutes: resolutionTarget, label: 'Resolução atrasada', slaType: 'ttr', slaTypeLabel: 'Resolução' };
  }
  if (remaining <= resolutionTarget * 0.25) {
    return { status: 'at_risk', remainingMinutes: remaining, targetMinutes: resolutionTarget, label: 'Resolução próxima', slaType: 'ttr', slaTypeLabel: 'Resolução' };
  }
  return { status: 'on_track', remainingMinutes: remaining, targetMinutes: resolutionTarget, label: 'No prazo', slaType: 'ttr', slaTypeLabel: 'Resolução' };
}

export function formatRemaining(minutes: number): string {
  const abs = Math.abs(minutes);
  const prefix = minutes < 0 ? '+' : '';
  if (abs < 60) return `${prefix}${abs}min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m ? `${prefix}${h}h${m}m` : `${prefix}${h}h`;
}
