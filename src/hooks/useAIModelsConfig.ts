import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AIFeature = 'chat_assist' | 'copilot_crm' | 'copilot_chat';

export interface AIModelConfig {
  id: string;
  client_id: string;
  feature: AIFeature;
  model: string;
  updated_at: string;
}

export const DEFAULT_MODELS: Record<AIFeature, string> = {
  chat_assist: 'google/gemini-2.5-flash',
  copilot_crm: 'google/gemini-2.5-flash',
  copilot_chat: 'google/gemini-2.5-flash',
};

export function useAIModelsConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const clientId = user?.client_id ? String(user.client_id) : null;

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['ai-model-config', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_ai_model_config')
        .select('*')
        .eq('client_id', clientId!);
      if (error) throw error;
      return (data || []) as AIModelConfig[];
    },
  });

  const upsertModel = useMutation({
    mutationFn: async ({ feature, model }: { feature: AIFeature; model: string }) => {
      const { error } = await supabase
        .from('client_ai_model_config')
        .upsert(
          { client_id: clientId!, feature, model, updated_at: new Date().toISOString() },
          { onConflict: 'client_id,feature' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-model-config', clientId] });
    },
  });

  const getModel = (feature: AIFeature): string => {
    return configs.find((c) => c.feature === feature)?.model ?? DEFAULT_MODELS[feature];
  };

  return { configs, isLoading, upsertModel, getModel };
}
