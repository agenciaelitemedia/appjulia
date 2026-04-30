import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPhoneProxy } from '@/lib/phoneProxy';
import type { PhoneExtension, PhoneCallLog, ProviderType } from '../types';

export function useTelefoniaData(
  codAgent: string | undefined,
  provider: ProviderType = 'api4com',
  clientId?: number | null,
) {
  const queryClient = useQueryClient();
  const useClient = !!clientId;
  const partitionKey = useClient ? String(clientId) : codAgent;

  // Get agent's plan
  const planQuery = useQuery({
    queryKey: ['my-phone-plan', partitionKey, useClient ? 'client' : 'agent'],
    queryFn: async () => {
      const base = supabase
        .from('phone_user_plans')
        .select('*, phone_extension_plans(name, max_extensions, price, extra_extension_price)')
        .eq('is_active', true);
      const { data, error } = useClient
        ? await base.eq('client_id', clientId!).maybeSingle()
        : await base.eq('cod_agent', codAgent!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const plan = (data as any).phone_extension_plans;
      return {
        ...data,
        plan_name: plan?.name,
        max_extensions: (plan?.max_extensions || 0) + (data.extra_extensions || 0),
        base_extensions: plan?.max_extensions || 0,
        extra_extensions: data.extra_extensions || 0,
        extra_extension_price: plan?.extra_extension_price || 0,
        billing_period: data.billing_period,
        start_date: data.start_date,
        due_date: data.due_date,
      };
    },
    enabled: !!partitionKey,
  });

  // Get agent's extensions
  const extensionsQuery = useQuery({
    queryKey: ['my-extensions', partitionKey, useClient ? 'client' : 'agent'],
    queryFn: async (): Promise<PhoneExtension[]> => {
      const base = supabase
        .from('phone_extensions')
        .select('*')
        .order('created_at', { ascending: false });
      const { data, error } = useClient
        ? await base.eq('client_id', clientId!)
        : await base.eq('cod_agent', codAgent!);
      if (error) throw error;
      return data as unknown as PhoneExtension[];
    },
    enabled: !!partitionKey,
  });

  // Create extension via Api4Com API (backend handles DB insert + rollback)
  const createExtension = useMutation({
    mutationFn: async (ext: Partial<PhoneExtension> & { email?: string; memberName?: string }) => {
      const { data: apiResult, error: apiError } = await supabase.functions.invoke(getPhoneProxy(provider), {
        body: {
          action: 'create_extension',
          clientId,
          codAgent,
          firstName: ext.memberName || ext.label || 'Ramal',
          lastName: codAgent,
          email: ext.email || undefined,
          assignedMemberId: ext.assigned_member_id || null,
          label: ext.label || ext.memberName || null,
        },
      });

      if (apiError) throw new Error(apiError.message || 'Erro ao criar ramal');
      if (apiResult?.error) throw new Error(apiResult.error);
      return apiResult?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      toast.success('Ramal criado e vinculado com sucesso');
    },
    onError: (e: Error) => toast.error(`Erro ao criar ramal: ${e.message}`),
  });

  // Update extension
  const updateExtension = useMutation({
    mutationFn: async ({ id, email, memberName, ...ext }: Partial<PhoneExtension> & { id: number; email?: string; memberName?: string }) => {
      const { error } = await supabase
        .from('phone_extensions')
        .update({ ...ext, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      toast.success('Ramal atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete extension
  const deleteExtension = useMutation({
    mutationFn: async (id: number) => {
      const ext = extensionsQuery.data?.find((e) => e.id === id);
      // Get provider-specific external ID
      const externalId = provider === '3cplus' ? ext?.threecplus_agent_id : ext?.api4com_id;
      if (!externalId) {
        // Sem vínculo com provedor, deletar só do banco
        const { error, count } = await supabase
          .from('phone_extensions')
          .delete({ count: 'exact' })
          .eq('id', id);
        if (error) throw error;
        if (!count) throw new Error('O ramal não foi removido do sistema.');
        return { id, rowsDeleted: count };
      }
      // Backend faz tudo: provedor + banco
      const { data, error } = await supabase.functions.invoke(getPhoneProxy(provider), {
        body: { action: 'delete_extension', clientId, codAgent, extensionId: id },
      });
      if (error) throw new Error(error.message || 'Erro ao deletar ramal');
      if (data?.error) throw new Error(data.error);
      const result = data?.data ?? data;
      const databaseResult = result?.database;
      if (!databaseResult?.success || !databaseResult?.rowsDeleted) {
        throw new Error('O ramal não foi removido do sistema. Atualize a página e tente novamente.');
      }
      return { id, rowsDeleted: databaseResult.rowsDeleted };
    },
    onSuccess: async ({ id }) => {
      queryClient.setQueriesData({ queryKey: ['my-extensions'] }, (old: PhoneExtension[] | undefined) =>
        Array.isArray(old) ? old.filter((extension) => extension.id !== id) : old
      );
      await queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      await queryClient.refetchQueries({ queryKey: ['my-extensions'], type: 'active' });
      toast.success('Ramal removido com sucesso');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sync extensions from Api4Com
  const syncExtensions = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(getPhoneProxy(provider), {
        body: { action: 'sync_extensions', clientId, codAgent },
      });
      if (error) throw new Error(error.message || 'Erro ao sincronizar');
      if (data?.error) throw new Error(data.error);
      return data?.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      toast.success(`Sincronizado: ${result?.synced || 0} ramais de ${result?.total || 0}`);
    },
    onError: (e: Error) => toast.error(`Erro ao sincronizar: ${e.message}`),
  });

  // Call history moved to useCallHistoryQuery for server-side filtering + pagination

  // Dial via REST (using extensionId for proper resolution)
  const dial = useMutation({
    mutationFn: async ({ extensionId, phone }: { extensionId: number; phone: string }) => {
      const { data, error } = await supabase.functions.invoke(getPhoneProxy(provider), {
        body: { action: 'dial', clientId, codAgent, extensionId, phone },
      });
      if (error) throw new Error(error.message || 'Erro ao discar');
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success('Chamada iniciada!'),
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  // Get SIP credentials for an extension
  const getSipCredentials = async (extensionId: number) => {
    const { data, error } = await supabase.functions.invoke(getPhoneProxy(provider), {
      body: { action: 'get_sip_credentials', clientId, codAgent, extensionId },
    });
    if (error) throw new Error(error.message || 'Erro ao buscar credenciais SIP');
    if (data?.error) throw new Error(data.error);
    return data?.data as { domain: string; username: string; password: string; wsUrl: string };
  };

  // Sync call history from Api4Com CDR (incremental)
  const syncCallHistory = useMutation({
    mutationFn: async (params?: { callId?: string; since?: string }) => {
      const { data, error } = await supabase.functions.invoke(getPhoneProxy(provider), {
        body: {
          action: 'sync_call_history',
          clientId,
          codAgent,
          callId: params?.callId,
          since: params?.since,
        },
      });
      if (error) throw new Error(error.message || 'Erro ao sincronizar histórico');
      if (data?.error) throw new Error(data.error);
      return data?.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-call-history'] });
      toast.success(`Histórico sincronizado: ${result?.synced || 0} registros`);
    },
    onError: (e: Error) => toast.error(`Erro ao sincronizar: ${e.message}`),
  });

  const maxExtensions = planQuery.data?.max_extensions || 0;
  const usedExtensions = extensionsQuery.data?.length || 0;
  const canCreateExtension = usedExtensions < maxExtensions;

  return {
    plan: planQuery.data,
    planLoading: planQuery.isLoading,
    extensions: extensionsQuery.data || [],
    extensionsLoading: extensionsQuery.isLoading,
    maxExtensions,
    usedExtensions,
    canCreateExtension,
    createExtension,
    updateExtension,
    deleteExtension,
    syncExtensions,
    dial,
    getSipCredentials,
    
    syncCallHistory,
  };
}
