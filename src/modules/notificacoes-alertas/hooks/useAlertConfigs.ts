import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import type { AlertConfig, AlertConfigInput, AlertLog } from '../types';

const TABLE = 'alert_notification_configs';

function normalize(row: any): AlertConfig {
  return {
    ...row,
    recipients: Array.isArray(row.recipients) ? row.recipients.map(String) : [],
    stage_ids: Array.isArray(row.stage_ids) ? row.stage_ids.map(String) : [],
  } as AlertConfig;
}

export function useAlertConfigs(codAgent: string | null) {
  return useQuery({
    queryKey: ['alerts', 'configs', codAgent],
    enabled: !!codAgent,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('cod_agent', codAgent);
      if (error) throw error;
      return (data ?? []).map(normalize);
    },
  });
}

export function useUpsertAlertConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AlertConfigInput) => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .upsert(input, { onConflict: 'cod_agent,trigger_key' })
        .select()
        .single();
      if (error) throw error;
      return normalize(data);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'configs', vars.cod_agent] });
      toast.success('Alerta salvo');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar alerta', { description: error?.message });
    },
  });
}

export function useAlertLogs(codAgent: string | null) {
  return useQuery({
    queryKey: ['alerts', 'logs', codAgent],
    enabled: !!codAgent,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('alert_notification_logs')
        .select('*')
        .eq('cod_agent', codAgent)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AlertLog[];
    },
  });
}
