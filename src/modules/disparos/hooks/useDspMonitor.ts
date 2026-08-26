import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';
import type { DspChannelLimits, DspChannelState, DspQueueItem } from '../types';

/** Estado de cada fila: contadores da janela, falhas, cooldown/circuit breaker. */
export function useDspChannelStates(clientId: string | null) {
  return useQuery<DspChannelState[]>({
    queryKey: ['disparos', 'channel-states', clientId],
    enabled: !!clientId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dsp_channel_state')
        .select('*')
        .eq('client_id', String(clientId));
      if (error) throw error;
      return (data ?? []) as DspChannelState[];
    },
  });
}

export function useDspChannelLimits(clientId: string | null) {
  return useQuery<DspChannelLimits[]>({
    queryKey: ['disparos', 'channel-limits', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dsp_channel_limits')
        .select('*')
        .eq('client_id', String(clientId));
      if (error) throw error;
      return (data ?? []) as DspChannelLimits[];
    },
  });
}

/** Fila de mensagens pendentes/processando com timers e tentativas. */
export function useDspQueueItems(clientId: string | null, campaignId?: string | null) {
  return useQuery<DspQueueItem[]>({
    queryKey: ['disparos', 'queue-items', clientId, campaignId ?? 'all'],
    enabled: !!clientId,
    refetchInterval: 10_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from('dsp_message_queue')
        .select('*')
        .eq('client_id', String(clientId))
        .order('available_at', { ascending: true, nullsFirst: true })
        .limit(200);
      if (campaignId) q = q.eq('campaign_id', campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DspQueueItem[];
    },
  });
}

export interface QueueStatusCounts {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
  total: number;
}

/** Contagem por status da fila (leitura leve por campanha). */
export function useDspQueueCounts(clientId: string | null, campaignId?: string | null) {
  return useQuery<QueueStatusCounts>({
    queryKey: ['disparos', 'queue-counts', clientId, campaignId ?? 'all'],
    enabled: !!clientId,
    refetchInterval: 10_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from('dsp_message_queue')
        .select('status')
        .eq('client_id', String(clientId))
        .limit(20000);
      if (campaignId) q = q.eq('campaign_id', campaignId);
      const { data, error } = await q;
      if (error) throw error;
      const counts: QueueStatusCounts = { pending: 0, processing: 0, sent: 0, failed: 0, cancelled: 0, total: 0 };
      for (const row of data ?? []) {
        counts.total += 1;
        if (row.status in counts) (counts as any)[row.status] += 1;
      }
      return counts;
    },
  });
}
