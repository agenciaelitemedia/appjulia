import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { PhoneExtension, PhoneCallLog } from '../types';

export function useTelefoniaData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Get user's plan
  const planQuery = useQuery({
    queryKey: ['my-phone-plan', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phone_user_plans')
        .select('*, phone_extension_plans(name, max_extensions, price)')
        .eq('user_id', userId!)
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
    enabled: !!userId,
  });

  // Get user's extensions
  const extensionsQuery = useQuery({
    queryKey: ['my-extensions', userId],
    queryFn: async (): Promise<PhoneExtension[]> => {
      const { data, error } = await supabase
        .from('phone_extensions')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PhoneExtension[];
    },
    enabled: !!userId,
  });

  // Create extension
  const createExtension = useMutation({
    mutationFn: async (ext: Partial<PhoneExtension>) => {
      const { error } = await supabase
        .from('phone_extensions')
        .insert({ ...ext, user_id: userId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-extensions'] });
      toast.success('Ramal criado');
    },
    onError: (e: Error) => toast.error(e.message),
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

  // Call history for user
  const historyQuery = useQuery({
    queryKey: ['my-call-history', userId],
    queryFn: async (): Promise<PhoneCallLog[]> => {
      // Get user's extension numbers
      const exts = extensionsQuery.data?.map((e) => e.extension_number) || [];
      if (exts.length === 0) return [];
      
      const { data, error } = await supabase
        .from('phone_call_logs')
        .select('*')
        .in('extension_number', exts)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as PhoneCallLog[];
    },
    enabled: !!userId && (extensionsQuery.data?.length || 0) > 0,
  });

  // Dial
  const dial = useMutation({
    mutationFn: async ({ extension, phone, codAgent }: { extension: string; phone: string; codAgent: string }) => {
      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'dial', codAgent, extension, phone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success('Chamada iniciada!'),
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
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
    callHistory: historyQuery.data || [],
    callHistoryLoading: historyQuery.isLoading,
    dial,
  };
}
