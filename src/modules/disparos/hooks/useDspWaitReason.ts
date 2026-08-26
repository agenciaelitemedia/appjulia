import { useQuery } from '@tanstack/react-query';
import { supabase } from '../extend/db';

export interface DspWaitReason {
  /** Motivo predominante devolvido pelo worker (ex.: outside_channel_window). */
  reason: string;
  /** Quantidade de itens pendentes na fila com esse motivo. */
  pending: number;
}

const REASON_PRIORITY = [
  'outside_channel_window',
  'channel_disconnected',
  'channel_cooldown',
  'rate_limited',
  'block_pause',
];

function extractReasons(lastError: string | null): string[] {
  if (!lastError) return [];
  const idx = lastError.indexOf('{');
  if (idx < 0) return [lastError.split(':')[0]];
  try {
    const map = JSON.parse(lastError.slice(idx)) as Record<string, string>;
    return Object.values(map);
  } catch {
    return [lastError.slice(0, 60)];
  }
}

/**
 * Motivo real pelo qual uma campanha "em execução" não está enviando.
 * Lê apenas dsp_message_queue (last_error já gravado pelo worker).
 */
export function useDspWaitReasons(clientId: string | null) {
  return useQuery<Record<string, DspWaitReason>>({
    queryKey: ['disparos', 'wait-reasons', clientId],
    enabled: !!clientId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dsp_message_queue')
        .select('campaign_id, last_error')
        .eq('client_id', String(clientId))
        .eq('status', 'pending')
        .not('last_error', 'is', null)
        .limit(500);
      if (error) throw error;

      const acc: Record<string, { counts: Record<string, number>; pending: number }> = {};
      for (const row of (data ?? []) as { campaign_id: string; last_error: string | null }[]) {
        if (!row.campaign_id) continue;
        const entry = (acc[row.campaign_id] ??= { counts: {}, pending: 0 });
        entry.pending += 1;
        for (const r of extractReasons(row.last_error)) {
          entry.counts[r] = (entry.counts[r] ?? 0) + 1;
        }
      }

      const out: Record<string, DspWaitReason> = {};
      for (const [campaignId, entry] of Object.entries(acc)) {
        const reasons = Object.keys(entry.counts);
        if (reasons.length === 0) continue;
        const reason =
          REASON_PRIORITY.find((r) => reasons.includes(r)) ??
          reasons.sort((a, b) => entry.counts[b] - entry.counts[a])[0];
        out[campaignId] = { reason, pending: entry.pending };
      }
      return out;
    },
  });
}
