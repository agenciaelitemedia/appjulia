import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { isUnofficialQueue, type DspQueueOption } from '../extend/queues';

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['disparos', 'channel-limits'] });
  qc.invalidateQueries({ queryKey: ['disparos', 'channel-states'] });
}

/** Habilita/desabilita uma fila como canal de disparo (opt-in explícito). */
export function useToggleDspChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId, queue, enabled,
    }: { clientId: string; queue: DspQueueOption; enabled: boolean }) => {
      const unofficial = isUnofficialQueue(queue);

      const { data: existing } = await (supabase as any)
        .from('dsp_channel_limits').select('id').eq('queue_id', queue.id).maybeSingle();

      if (existing?.id) {
        const { error } = await (supabase as any)
          .from('dsp_channel_limits').update({ is_enabled: enabled }).eq('id', existing.id);
        if (error) throw error;
        return;
      }

      // Vínculo puro: os limites vêm do padrão seguro do tipo de API (aba Configurações).
      const { error } = await (supabase as any).from('dsp_channel_limits').insert({
        client_id: String(clientId),
        queue_id: queue.id,
        provider: unofficial ? 'uazapi' : 'meta_cloud',
        is_enabled: enabled,
        default_weight: 1,
      });
      if (error) throw error;
    },

    onSuccess: (_d, vars) => {
      invalidate(qc);
      toast.success(vars.enabled ? 'Canal habilitado para disparos' : 'Canal removido dos disparos');
    },
    onError: (e: any) => toast.error('Não foi possível atualizar o canal', { description: e?.message }),
  });
}

/** Peso base de rotação do canal (quando a campanha não define peso próprio). */
export function useSaveDspChannelWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ queueId, weight }: { queueId: string; weight: number }) => {
      const w = Math.max(1, Math.min(100, Math.round(Number(weight) || 1)));
      const { error } = await (supabase as any)
        .from('dsp_channel_limits').update({ default_weight: w }).eq('queue_id', queueId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      toast.success('Peso de rotação salvo');
    },
    onError: (e: any) => toast.error('Erro ao salvar peso', { description: e?.message }),
  });
}

export const CHANNEL_HEALTH_LABEL: Record<string, string> = {
  healthy: 'Saudável',
  degraded: 'Instável',
  blocked: 'Bloqueado',
  disconnected: 'Desconectado',
};
