import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProviderKeyStatus {
  configured: boolean;
  masked: string | null;
}

// The provider API key (e.g. OpenRouter) is never readable by the frontend.
// We only ask the edge function for a masked status, and write through it.
export function useProviderKey(provider = 'openrouter') {
  const queryClient = useQueryClient();
  const key = ['ai-provider-key', provider];

  const { data: status, isLoading } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ProviderKeyStatus> => {
      const { data, error } = await supabase.functions.invoke(
        `ai-provider-key-set?provider=${encodeURIComponent(provider)}`,
        { method: 'GET' },
      );
      if (error) return { configured: false, masked: null };
      return (data as ProviderKeyStatus) ?? { configured: false, masked: null };
    },
  });

  const setKey = useMutation({
    mutationFn: async (apiKey: string) => {
      const { error } = await supabase.functions.invoke('ai-provider-key-set', {
        method: 'POST',
        body: { provider, api_key: apiKey },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { status: status ?? { configured: false, masked: null }, isLoading, setKey };
}
