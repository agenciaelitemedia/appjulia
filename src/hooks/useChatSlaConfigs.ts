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
  resolution_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_SLA_BY_PRIORITY: Record<string, { first: number; resolution: number }> = {
  urgent: { first: 5, resolution: 60 },
  high: { first: 15, resolution: 240 },
  normal: { first: 30, resolution: 480 },
  low: { first: 120, resolution: 1440 },
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
        resolution_minutes: input.resolution_minutes ?? 240,
        is_active: input.is_active ?? true,
      };
      const { error } = await supabase
        .from('chat_sla_configs')
        .upsert(payload, { onConflict: 'client_id,priority' });
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

export interface SlaEvaluation {
  status: SlaStatus;
  remainingMinutes: number;
  targetMinutes: number;
  label: string;
}

/**
 * Avalia o SLA de uma conversa com base em prioridade, configurações e timestamps.
 * Etapa avaliada: 1ª resposta (se ainda não respondida) ou resolução (se respondida).
 */
export function evaluateSla(
  conversation: {
    status: string;
    priority: string;
    opened_at: string;
    first_response_at: string | null;
    resolved_at: string | null;
    closed_at: string | null;
  },
  configs: ChatSlaConfig[]
): SlaEvaluation {
  // Conversa fechada/resolvida: avalia se cumpriu o SLA de resolução
  const config = configs.find((c) => c.priority === conversation.priority && c.is_active);
  const defaults = DEFAULT_SLA_BY_PRIORITY[conversation.priority] ?? DEFAULT_SLA_BY_PRIORITY.normal;
  const firstTarget = config?.first_response_minutes ?? defaults.first;
  const resolutionTarget = config?.resolution_minutes ?? defaults.resolution;

  if (conversation.status === 'closed' || conversation.status === 'resolved') {
    return { status: 'on_track', remainingMinutes: 0, targetMinutes: resolutionTarget, label: 'Concluída' };
  }

  const opened = parseISO(conversation.opened_at);
  const now = new Date();

  // Etapa 1: aguardando primeira resposta
  if (!conversation.first_response_at) {
    const elapsed = differenceInMinutes(now, opened);
    const remaining = firstTarget - elapsed;
    if (remaining < 0) {
      return { status: 'breached', remainingMinutes: remaining, targetMinutes: firstTarget, label: '1ª resposta atrasada' };
    }
    if (remaining <= firstTarget * 0.25) {
      return { status: 'at_risk', remainingMinutes: remaining, targetMinutes: firstTarget, label: '1ª resposta próxima' };
    }
    return { status: 'on_track', remainingMinutes: remaining, targetMinutes: firstTarget, label: '1ª resposta no prazo' };
  }

  // Etapa 2: respondida, aguardando resolução
  const elapsed = differenceInMinutes(now, opened);
  const remaining = resolutionTarget - elapsed;
  if (remaining < 0) {
    return { status: 'breached', remainingMinutes: remaining, targetMinutes: resolutionTarget, label: 'Resolução atrasada' };
  }
  if (remaining <= resolutionTarget * 0.25) {
    return { status: 'at_risk', remainingMinutes: remaining, targetMinutes: resolutionTarget, label: 'Resolução próxima' };
  }
  return { status: 'on_track', remainingMinutes: remaining, targetMinutes: resolutionTarget, label: 'No prazo' };
}

export function formatRemaining(minutes: number): string {
  const abs = Math.abs(minutes);
  const prefix = minutes < 0 ? '+' : '';
  if (abs < 60) return `${prefix}${abs}min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m ? `${prefix}${h}h${m}m` : `${prefix}${h}h`;
}
