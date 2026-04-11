import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface QueueProvider {
  id: string;
  client_id: string;
  provider_type: string;
  name: string;
  evo_url: string | null;
  evo_apikey: string | null;
  meta_app_id: string | null;
  meta_app_secret: string | null;
  waba_business_id: string | null;
  waba_token: string | null;
  instagram_page_id: string | null;
  instagram_user_id: string | null;
  page_access_token: string | null;
  page_name: string | null;
  webchat_config_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProviderFormData = Omit<QueueProvider, 'id' | 'created_at' | 'updated_at'>;

export function useQueueProviders(providerType?: string) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  return useQuery({
    queryKey: ['queue-providers', clientId, providerType],
    queryFn: async () => {
      if (!clientId) return [];
      let query = supabase
        .from('queue_providers')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (providerType) {
        query = query.eq('provider_type', providerType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as QueueProvider[];
    },
    enabled: !!clientId,
  });
}

export function useQueueProviderMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['queue-providers'] });
  };

  const createProvider = useMutation({
    mutationFn: async (data: Omit<ProviderFormData, 'client_id'>) => {
      const { error } = await supabase
        .from('queue_providers')
        .insert({ ...data, client_id: clientId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Provedor criado com sucesso'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProvider = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<ProviderFormData>) => {
      const { error } = await supabase
        .from('queue_providers')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Provedor atualizado'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProvider = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('queue_providers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Provedor removido'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { createProvider, updateProvider, deleteProvider };
}
