import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PhoneExtension, PhoneCallLog } from '../types';

export function useTelefoniaData(codAgent: string | undefined) {
  const queryClient = useQueryClient();

  // Get agent's plan
  const planQuery = useQuery({
    queryKey: ['my-phone-plan', codAgent],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phone_user_plans')
        .select('*, phone_extension_plans(name, max_extensions, price)')
        .eq('cod_agent', codAgent!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        plan_name: (data as any).phone_extension_plans?.name,
        max_extensions: (data as any).phone_extension_plans?.max_extensions || 0,
      };
    },
    enabled: !!codAgent,
  });

  // Get agent's extensions
  const extensionsQuery = useQuery({
    queryKey: ['my-extensions', codAgent],
    queryFn: async (): Promise<PhoneExtension[]> => {
      const { data, error } = await supabase
        .from('phone_extensions')
        .select('*')
        .eq('cod_agent', codAgent!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PhoneExtension[];
    },
    enabled: !!codAgent,
  });

  // Create extension via Api4Com API (backend handles DB insert + rollback)
  const createExtension = useMutation({
    mutationFn: async (ext: Partial<PhoneExtension> & { email?: string; memberName?: string }) => {
      const { data: apiResult, error: apiError } = await supabase.functions.invoke('api4com-proxy', {
        body: {
          action: 'create_extension',
          codAgent,
          firstName: ext.memberName || ext.label || 'Ramal',
          lastName: codAgent,
          email: ext.email || undefined,
          assignedMemberId: ext.assigned_member_id || null,
          label: ext.label || ext.memberName || null,
        },
      });

      if (apiError) throw new Error(apiError.message || 'Erro ao criar ramal na Api4Com');
      if (apiResult?.error) throw new Error(apiResult.error);
      return apiResult?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      toast.success('Ramal criado e vinculado na Api4Com');
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
      if (!ext?.api4com_id) {
        // Sem vínculo Api4Com, deletar só do banco
        const { error } = await supabase.from('phone_extensions').delete().eq('id', id);
        if (error) throw error;
        return;
      }
      // Backend faz tudo: Api4Com (extensão + usuário) + banco
      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'delete_extension', codAgent, extensionId: ext.api4com_id },
      });
      if (error) throw new Error(error.message || 'Erro ao deletar ramal');
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      toast.success('Ramal removido (Api4Com + banco)');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sync extensions from Api4Com
  const syncExtensions = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'sync_extensions', codAgent },
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
      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'dial', codAgent, extensionId, phone },
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
    const { data, error } = await supabase.functions.invoke('api4com-proxy', {
      body: { action: 'get_sip_credentials', codAgent, extensionId },
    });
    if (error) throw new Error(error.message || 'Erro ao buscar credenciais SIP');
    if (data?.error) throw new Error(data.error);
    return data?.data as { domain: string; username: string; password: string; wsUrl: string };
  };

  // Sync call history from Api4Com CDR (incremental)
  const syncCallHistory = useMutation({
    mutationFn: async (params?: { callId?: string; since?: string }) => {
      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: {
          action: 'sync_call_history',
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
