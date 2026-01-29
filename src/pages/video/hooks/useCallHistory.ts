import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CallHistoryRecord {
  id: string;
  room_name: string;
  lead_id: number | null;
  cod_agent: string;
  operator_name: string | null;
  contact_name: string | null;
  whatsapp_number: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  created_at: string;
}

interface HistoryResponse {
  success: boolean;
  records: CallHistoryRecord[];
  error?: string;
}

export function useCallHistory(limit = 50) {
  return useQuery({
    queryKey: ['video-call-history', limit],
    queryFn: async (): Promise<CallHistoryRecord[]> => {
      const { data, error } = await supabase.functions.invoke<HistoryResponse>('video-room', {
        body: {
          action: 'history',
          limit,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch history');
      }

      return data.records || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
