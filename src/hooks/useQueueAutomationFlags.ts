import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QueueAutomationFlags {
  autoTranscribeAudio: boolean;
  autoSummaryOnResolve: boolean;
  autoSummaryOnClose: boolean;
}

const DEFAULT: QueueAutomationFlags = {
  autoTranscribeAudio: false,
  autoSummaryOnResolve: false,
  autoSummaryOnClose: false,
};

/**
 * Lê as flags de automação por fila (`queues.settings`). Junto com
 * `useClientAutomationFlags`, define o gate efetivo para transcrição,
 * resumos etc no frontend.
 */
export function useQueueAutomationFlags(queueId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['queue-automation-flags', queueId],
    enabled: !!queueId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<QueueAutomationFlags> => {
      const { data, error } = await supabase
        .from('queues')
        .select('settings')
        .eq('id', queueId as string)
        .maybeSingle();
      if (error) throw error;
      const s = ((data?.settings ?? {}) as Record<string, unknown>) || {};
      const asBool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';
      return {
        autoTranscribeAudio: asBool(s.auto_transcribe_audio),
        autoSummaryOnResolve: asBool(s.auto_summary_on_resolve),
        autoSummaryOnClose: asBool(s.auto_summary_on_close),
      };
    },
  });

  return {
    flags: query.data ?? DEFAULT,
    isLoading: query.isLoading,
  };
}