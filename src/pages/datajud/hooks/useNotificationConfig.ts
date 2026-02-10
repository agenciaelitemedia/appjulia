import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { NotificationConfig } from '../types';

export function useNotificationConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['datajud', 'notification-config', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('datajud_notification_config')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as NotificationConfig | null;
    },
    enabled: !!user?.id,
  });

  const upsertConfig = useMutation({
    mutationFn: async (config: Partial<Pick<NotificationConfig, 'default_agent_cod' | 'office_phones' | 'is_active'>>) => {
      const { data, error } = await supabase
        .from('datajud_notification_config')
        .upsert({
          user_id: user!.id,
          ...config,
        } as any, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datajud', 'notification-config'] });
      toast.success('Configuração salva');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar', { description: err.message });
    },
  });

  return {
    config: query.data,
    isLoading: query.isLoading,
    upsertConfig,
  };
}
