import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Queue {
  id: string;
  client_id: string;
  name: string;
  channel_type: string;
  hub: string | null;
  evo_url: string | null;
  evo_apikey: string | null;
  evo_instance: string | null;
  waba_id: string | null;
  waba_token: string | null;
  waba_number_id: string | null;
  is_active: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  queue_agent_links?: { cod_agent: string; is_primary: boolean }[];
}

export interface QueueFormData {
  name: string;
  channel_type: string;
  hub?: string;
  evo_url?: string;
  evo_apikey?: string;
  evo_instance?: string;
  waba_id?: string;
  waba_token?: string;
  waba_number_id?: string;
  link_agents?: { cod_agent: string; is_primary?: boolean }[];
}

async function invokeQueueManagement(action: string, data: Record<string, unknown>) {
  const { data: result, error } = await supabase.functions.invoke('queue-management', {
    body: { action, data },
  });
  if (error) throw new Error(error.message);
  if (result?.error) throw new Error(result.error);
  return result;
}

export function useQueues(includeDeleted = false) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : null;

  return useQuery({
    queryKey: ['queues', clientId, includeDeleted],
    queryFn: async () => {
      if (!clientId) return [];
      const result = await invokeQueueManagement('list', {
        client_id: clientId,
        include_deleted: includeDeleted,
      });
      return (result.queues || []) as Queue[];
    },
    enabled: !!clientId,
  });
}

export function useQueueMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['queues'] });
    queryClient.invalidateQueries({ queryKey: ['user-agents'] });
  };

  const createQueue = useMutation({
    mutationFn: (formData: QueueFormData) => {
      if (!clientId) throw new Error('Usuário sem client_id vinculado. Faça login novamente.');
      if (!formData.name?.trim()) throw new Error('Nome da fila é obrigatório');
      if (!formData.channel_type) throw new Error('Canal é obrigatório');
      return invokeQueueManagement('create', { ...formData, client_id: clientId });
    },
    onSuccess: () => { toast.success('Fila criada com sucesso'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const updateQueue = useMutation({
    mutationFn: ({ queue_id, ...fields }: { queue_id: string } & Partial<QueueFormData>) =>
      invokeQueueManagement('update', { queue_id, ...fields }),
    onSuccess: () => { toast.success('Fila atualizada'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteQueue = useMutation({
    mutationFn: (params: { queue_id: string; migrate_to_queue_id?: string }) =>
      invokeQueueManagement('delete', params),
    onSuccess: () => { toast.success('Fila removida'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const restoreQueue = useMutation({
    mutationFn: (queue_id: string) =>
      invokeQueueManagement('restore', { queue_id }),
    onSuccess: () => { toast.success('Fila restaurada'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const linkAgent = useMutation({
    mutationFn: (params: { queue_id: string; cod_agent: string; is_primary?: boolean }) =>
      invokeQueueManagement('link_agent', params),
    onSuccess: () => { toast.success('Agente vinculado'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const unlinkAgent = useMutation({
    mutationFn: (params: { queue_id: string; cod_agent: string }) =>
      invokeQueueManagement('unlink_agent', params),
    onSuccess: () => { toast.success('Agente desvinculado'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return { createQueue, updateQueue, deleteQueue, restoreQueue, linkAgent, unlinkAgent };
}
