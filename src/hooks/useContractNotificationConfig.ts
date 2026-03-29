import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContractNotificationConfig {
  id: string;
  cod_agent: string;
  type: 'LEAD_FOLLOWUP' | 'OFFICE_ALERT';
  is_active: boolean;
  stages_count: number;
  delay_interval_minutes: number;
  message_template: string | null;
  target_numbers: string[];
  trigger_event: string;
  target_numbers_config: Array<{ phone: string; trigger: string }>;
  trigger_cadence: Record<string, string>;
  office_repeat_count: number;
  step_cadence: Record<string, string>;
  msg_cadence: Record<string, string | null>;
  title_cadence: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export function useContractNotificationConfigs(codAgent: string | null) {
  return useQuery({
    queryKey: ['contract-notification-configs', codAgent],
    queryFn: async () => {
      if (!codAgent) return [];
      const { data, error } = await supabase
        .from('contract_notification_configs')
        .select('*')
        .eq('cod_agent', codAgent);
      if (error) throw error;
      return (data as unknown) as ContractNotificationConfig[];
    },
    enabled: !!codAgent,
  });
}

export function useUpsertContractNotificationConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<ContractNotificationConfig> & { cod_agent: string; type: string }) => {
      // Check if config exists
      const { data: existing } = await supabase
        .from('contract_notification_configs')
        .select('id')
        .eq('cod_agent', config.cod_agent)
        .eq('type', config.type)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('contract_notification_configs')
          .update({ ...config, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contract_notification_configs')
          .insert(config);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contract-notification-configs', variables.cod_agent] });
      toast.success('Configuração salva com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configuração: ' + error.message);
    },
  });
}

export function useContractNotificationLogs(codAgent: string | null) {
  return useQuery({
    queryKey: ['contract-notification-logs', codAgent],
    queryFn: async () => {
      if (!codAgent) return [];
      const { data, error } = await supabase
        .from('contract_notification_logs')
        .select('*')
        .eq('cod_agent', codAgent)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!codAgent,
  });
}
