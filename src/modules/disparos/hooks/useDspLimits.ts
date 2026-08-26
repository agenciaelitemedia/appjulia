import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import type { DspChannelLimits } from '../types';

export const DSP_UNOFFICIAL_DEFAULTS = {
  max_per_minute: 4,
  max_per_hour: 60,
  max_per_day: 300,
  max_unique_recipients_per_day: 300,
  min_seconds_between_messages: 12,
  max_seconds_between_messages: 45,
  block_size: 20,
  block_pause_seconds: 300,
  daily_ramp_percent: 20,
  max_consecutive_failures: 5,
  cooldown_after_disconnect_minutes: 60,
  marketing_enabled: true,
  send_window_start: '08:00',
  send_window_end: '20:00',
};

export const DSP_OFFICIAL_DEFAULTS = {
  ...DSP_UNOFFICIAL_DEFAULTS,
  max_per_minute: 20,
  max_per_hour: 600,
  max_per_day: 5000,
  max_unique_recipients_per_day: 5000,
  min_seconds_between_messages: 2,
  max_seconds_between_messages: 6,
  block_size: 100,
  block_pause_seconds: 30,
  daily_ramp_percent: 0,
};

/** Guardrails de UI: espelha as validações do backend antes de salvar. */
export function validateLimits(v: Partial<DspChannelLimits>, unofficial: boolean): string[] {
  const errors: string[] = [];
  if (!(Number(v.max_per_minute) > 0)) errors.push('Limite por minuto deve ser maior que zero.');
  if (!(Number(v.max_per_hour) > 0)) errors.push('Limite por hora deve ser maior que zero.');
  if (!(Number(v.max_per_day) > 0)) errors.push('Limite diário deve ser maior que zero.');
  if (Number(v.max_per_hour) < Number(v.max_per_minute)) errors.push('Limite por hora não pode ser menor que o por minuto.');
  if (Number(v.max_per_day) < Number(v.max_per_hour)) errors.push('Limite diário não pode ser menor que o por hora.');
  if (Number(v.max_seconds_between_messages) < Number(v.min_seconds_between_messages)) {
    errors.push('Intervalo máximo deve ser maior ou igual ao mínimo.');
  }
  if (unofficial) {
    if (!(Number(v.min_seconds_between_messages) >= 5)) errors.push('API não oficial: use no mínimo 5s entre mensagens.');
    if (!(Number(v.block_size) > 0)) errors.push('API não oficial: defina o tamanho do bloco.');
    if (!(Number(v.block_pause_seconds) >= 30)) errors.push('API não oficial: pausa entre blocos de ao menos 30s.');
    if (Number(v.max_per_minute) > 10) errors.push('API não oficial: máximo recomendado é 10 mensagens por minuto.');
    if (Number(v.max_per_day) > 1000) errors.push('API não oficial: máximo recomendado é 1000 mensagens por dia.');
  }
  if (!v.send_window_start || !v.send_window_end) errors.push('Defina a janela de horário permitido.');
  return errors;
}

export function useSaveDspLimits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<DspChannelLimits> & { client_id: string; queue_id: string; provider: string; unofficial: boolean }) => {
      const { unofficial, ...row } = input;
      const errors = validateLimits(row, unofficial);
      if (errors.length > 0) throw new Error(errors.join(' '));

      const { data: existing } = await (supabase as any)
        .from('dsp_channel_limits').select('id').eq('queue_id', row.queue_id).maybeSingle();

      if (existing?.id) {
        const { error } = await (supabase as any)
          .from('dsp_channel_limits').update(row).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('dsp_channel_limits').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disparos', 'channel-limits'] });
      toast.success('Limites salvos');
    },
    onError: (e: any) => toast.error('Não foi possível salvar', { description: e?.message }),
  });
}

/** Libera manualmente o circuit breaker de uma fila. */
export function useClearChannelCooldown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (queueId: string) => {
      const { error } = await (supabase as any).from('dsp_channel_state').update({
        cooldown_until: null,
        cooldown_reason: null,
        consecutive_failures: 0,
        health_status: 'healthy',
      }).eq('queue_id', queueId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disparos', 'channel-states'] });
      toast.success('Fila liberada');
    },
    onError: (e: any) => toast.error('Erro ao liberar fila', { description: e?.message }),
  });
}
