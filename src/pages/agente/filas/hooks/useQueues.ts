import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { externalDb } from '@/lib/externalDb';
import { useUserQueueAccess } from '@/hooks/useUserQueueAccess';

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
  phone_number: string | null;
  phone_resolved_at: string | null;
  is_active: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  settings?: Record<string, unknown> | null;
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
  const maxRetries = 3;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: result, error } = await supabase.functions.invoke('queue-management', {
      body: { action, data },
    });
    if (error) {
      const msg = error.message || '';
      const isTransient = /503|temporarily unavailable|SUPABASE_EDGE_RUNTIME_ERROR|Failed to fetch|NetworkError/i.test(msg);
      if (isTransient && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        lastError = error as Error;
        continue;
      }
      throw new Error(msg || 'Edge function error');
    }
    if (result?.error) throw new Error(result.error);
    return result;
  }
  throw lastError || new Error('Falha ao invocar queue-management');
}

// Resolve client_id from the user, falling back to the linked agents (user_agents → agents.client_id).
async function resolveClientId(user: { client_id?: number | string | null; id?: number | string } | null | undefined): Promise<string | null> {
  if (user?.client_id) return String(user.client_id);
  if (!user?.id) return null;
  // 1st fallback: inherit from principal user (users.user_id → users.client_id)
  try {
    const inherited = await externalDb.getEffectiveClientId(Number(user.id));
    if (inherited) return inherited;
  } catch (e) {
    console.warn('[useQueues] getEffectiveClientId failed', e);
  }
  // 2nd fallback (legacy): via user_agents → agents.client_id
  try {
    const userAgents = await externalDb.getUserAgents<{ client_id?: string | number | null }>(Number(user.id));
    const found = userAgents?.find((a) => a?.client_id != null);
    return found?.client_id ? String(found.client_id) : null;
  } catch (e) {
    console.warn('[useQueues] Failed to resolve client_id from user_agents', e);
    return null;
  }
}

export function useQueues(includeDeleted = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['queues', user?.id, user?.client_id, includeDeleted],
    queryFn: async () => {
      const clientId = await resolveClientId(user);
      if (!clientId) return [];
      const result = await invokeQueueManagement('list', {
        client_id: clientId,
        include_deleted: includeDeleted,
      });
      return (result.queues || []) as Queue[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Variante de useQueues filtrada por permissão do usuário logado.
 * - queue_access='all' → retorna tudo
 * - queue_access='specific' → retorna apenas filas em queue_members
 * Usa este hook em telas de operação (chat); useQueues continua p/ admin.
 */
export function useAccessibleQueues(includeDeleted = false) {
  const queries = useQueues(includeDeleted);
  const { data: access, isLoading: accessLoading } = useUserQueueAccess();
  const accessible = useMemo(() => {
    const all = queries.data || [];
    if (!access || access.queue_access === 'all') return all;
    const allowed = new Set(access.queue_ids);
    return all.filter((q) => allowed.has(q.id));
  }, [queries.data, access]);
  return {
    ...queries,
    data: accessible,
    isLoading: queries.isLoading || accessLoading,
    accessMode: access?.queue_access ?? 'all',
  };
}

export function useQueueMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['queues'] });
    queryClient.invalidateQueries({ queryKey: ['user-agents'] });
  };

  const createQueue = useMutation({
    mutationFn: async (formData: QueueFormData) => {
      const clientId = await resolveClientId(user);
      if (!clientId) throw new Error('Não foi possível identificar o cliente. Verifique se há um agente vinculado ao seu usuário.');
      if (!formData.name?.trim()) throw new Error('Nome da fila é obrigatório');
      if (!formData.channel_type) throw new Error('Canal é obrigatório');
      const result = await invokeQueueManagement('create', { ...formData, client_id: clientId });
      // Fire-and-forget: auto-resolve the queue's real WhatsApp phone via provider API.
      // Used by the anti-echo filter in the webhooks. Never blocks the UI.
      const newQueueId = result?.queue?.id || result?.id;
      if (newQueueId) {
        supabase.functions
          .invoke('queue-resolve-phone', { body: { queue_id: newQueueId } })
          .catch((err) => console.warn('[useQueues] queue-resolve-phone failed:', err));
      }
      return result;
    },
    onSuccess: () => { toast.success('Fila criada com sucesso'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const updateQueue = useMutation({
    mutationFn: async ({ queue_id, ...fields }: { queue_id: string } & Partial<QueueFormData>) => {
      const result = await invokeQueueManagement('update', { queue_id, ...fields });
      // Re-resolve when credentials change (token, instance, number id).
      const credentialChanged = ['evo_url', 'evo_apikey', 'evo_instance', 'waba_token', 'waba_number_id']
        .some((k) => k in fields);
      if (credentialChanged) {
        supabase.functions
          .invoke('queue-resolve-phone', { body: { queue_id } })
          .catch((err) => console.warn('[useQueues] queue-resolve-phone failed:', err));
      }
      return result;
    },
    onSuccess: () => { toast.success('Fila atualizada'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteQueue = useMutation({
    mutationFn: (params: { queue_id: string; migrate_to_queue_id?: string; force?: boolean }) =>
      invokeQueueManagement('delete', params),
    onSuccess: () => { toast.success('Fila removida'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const restoreQueue = useMutation({
    mutationFn: (params: string | { queue_id: string; migrate_to_queue_id?: string }) => {
      const payload = typeof params === 'string' ? { queue_id: params } : params;
      return invokeQueueManagement('restore', payload);
    },
    onSuccess: (_data, vars) => {
      const migrated = typeof vars === 'object' && vars.migrate_to_queue_id;
      toast.success(migrated ? 'Dados migrados para a fila destino' : 'Fila restaurada');
      invalidate();
    },
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
