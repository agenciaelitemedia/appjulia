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

  // Create extension via Api4Com API
  const createExtension = useMutation({
    mutationFn: async (ext: Partial<PhoneExtension>) => {
      // 1. Create on Api4Com
      const { data: apiResult, error: apiError } = await supabase.functions.invoke('api4com-proxy', {
        body: {
          action: 'create_extension',
          codAgent,
          firstName: ext.label || 'Ramal',
          lastName: codAgent,
        },
      });

      if (apiError) throw new Error(apiError.message || 'Erro ao criar ramal na Api4Com');
      if (apiResult?.error) throw new Error(apiResult.error);

      const api4comData = apiResult?.data;
      if (!api4comData?.ramal) {
        throw new Error('Api4Com não retornou dados do ramal');
      }

      // 2. Generate local alias
      const existingCount = extensionsQuery.data?.length || 0;
      const localNumber = `${1000 + existingCount + 1}`;

      // 3. Save in our DB
      const { error } = await supabase
        .from('phone_extensions')
        .insert({
          cod_agent: codAgent,
          extension_number: localNumber,
          label: ext.label || null,
          assigned_member_id: ext.assigned_member_id || null,
          api4com_id: api4comData.id ? String(api4comData.id) : null,
          api4com_ramal: api4comData.ramal,
          api4com_password: api4comData.senha || null,
          is_active: true,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      toast.success('Ramal criado e vinculado na Api4Com');
    },
    onError: (e: Error) => toast.error(`Erro ao criar ramal: ${e.message}`),
  });

  // Update extension
  const updateExtension = useMutation({
    mutationFn: async ({ id, ...ext }: Partial<PhoneExtension> & { id: number }) => {
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
      if (ext?.api4com_id) {
        await supabase.functions.invoke('api4com-proxy', {
          body: { action: 'delete_extension', codAgent, extensionId: ext.api4com_id },
        });
      }
      const { error } = await supabase
        .from('phone_extensions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      toast.success('Ramal removido');
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

  // Call history for agent
  const historyQuery = useQuery({
    queryKey: ['my-call-history', codAgent],
    queryFn: async (): Promise<PhoneCallLog[]> => {
      const { data, error } = await supabase
        .from('phone_call_logs')
        .select('*')
        .eq('cod_agent', codAgent!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as PhoneCallLog[];
    },
    enabled: !!codAgent,
  });

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
    callHistory: historyQuery.data || [],
    callHistoryLoading: historyQuery.isLoading,
    dial,
    getSipCredentials,
  };
}
