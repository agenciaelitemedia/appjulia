import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RecordingLinkResponse {
  success: boolean;
  downloadLink?: string;
  expiresAt?: string;
  error?: string;
}

export function useRecordingLink() {
  return useMutation({
    mutationFn: async (recordingId: string): Promise<RecordingLinkResponse> => {
      const { data, error } = await supabase.functions.invoke<RecordingLinkResponse>('video-room', {
        body: {
          action: 'get-recording-link',
          recordingId,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to get recording link');
      }

      return data;
    },
  });
}
