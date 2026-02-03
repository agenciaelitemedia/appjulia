import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AdvboxNotificationLog, NotificationStatus } from '@/types/advbox';

export interface NotificationLogsFilters {
  status?: NotificationStatus;
  rule_id?: string;
  recipient_phone?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

interface NotificationLogsState {
  logs: AdvboxNotificationLog[];
  total: number;
  isLoading: boolean;
  isResending: boolean;
}

export function useNotificationLogs() {
  const [state, setState] = useState<NotificationLogsState>({
    logs: [],
    total: 0,
    isLoading: false,
    isResending: false,
  });

  const loadLogs = useCallback(async (codAgent: string, filters: NotificationLogsFilters = {}) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.functions.invoke('db-query', {
        body: {
          action: 'advbox_load_notification_logs',
          cod_agent: codAgent,
          filters: {
            status: filters.status,
            rule_id: filters.rule_id,
            recipient_phone: filters.recipient_phone,
            start_date: filters.start_date,
            end_date: filters.end_date,
            page: filters.page || 1,
            limit: filters.limit || 20,
          },
        },
      });

      if (error) throw error;

      setState({
        logs: data.logs || [],
        total: data.total || 0,
        isLoading: false,
        isResending: false,
      });

      return data;
    } catch (error) {
      console.error('Error loading notification logs:', error);
      toast.error('Erro ao carregar logs de notificações');
      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    }
  }, []);

  const resendNotification = useCallback(async (logId: string, codAgent: string) => {
    setState(prev => ({ ...prev, isResending: true }));

    try {
      const { data, error } = await supabase.functions.invoke('advbox-notify', {
        body: {
          cod_agent: codAgent,
          log_id: logId,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Notificação reenviada com sucesso');
      } else {
        toast.error(data.error || 'Falha ao reenviar notificação');
      }

      setState(prev => ({ ...prev, isResending: false }));
      return data;
    } catch (error) {
      console.error('Error resending notification:', error);
      toast.error('Erro ao reenviar notificação');
      setState(prev => ({ ...prev, isResending: false }));
      return null;
    }
  }, []);

  return {
    logs: state.logs,
    total: state.total,
    isLoading: state.isLoading,
    isResending: state.isResending,
    loadLogs,
    resendNotification,
  };
}
