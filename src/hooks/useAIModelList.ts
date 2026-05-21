import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AIFeature, AIProvider } from '@/hooks/useAIModelsConfig';

export interface AIModelListItem {
  id: string;
  feature: AIFeature;
  label: string;
  model: string;
  provider: AIProvider;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface AIModelListInput {
  label: string;
  model: string;
  provider: AIProvider;
  is_default?: boolean;
  sort_order?: number;
}

export function useAIModelList(feature: AIFeature) {
  const queryClient = useQueryClient();
  const key = ['ai-model-list', feature];

  const { data: items = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_ai_model_config_list')
        .select('*')
        .eq('feature', feature)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as AIModelListItem[];
    },
  });

  const createItem = useMutation({
    mutationFn: async (input: AIModelListInput) => {
      const { error } = await supabase
        .from('client_ai_model_config_list')
        .insert({ feature, ...input });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AIModelListInput> & { id: string }) => {
      const { error } = await supabase
        .from('client_ai_model_config_list')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_ai_model_config_list')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { items, isLoading, createItem, updateItem, deleteItem };
}
