import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PhonePlan, PhoneUserPlan, PhoneConfig, PhoneCallLog } from '../types';

export function useTelefoniaAdmin() {
  const queryClient = useQueryClient();

  // === Plans ===
  const plansQuery = useQuery({
    queryKey: ['phone-plans'],
    queryFn: async (): Promise<PhonePlan[]> => {
      const { data, error } = await supabase
        .from('phone_extension_plans')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PhonePlan[];
    },
  });

  const createPlan = useMutation({
    mutationFn: async (plan: Partial<PhonePlan>) => {
      const { error } = await supabase
        .from('phone_extension_plans')
        .insert(plan as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-plans'] });
      toast.success('Plano criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, ...plan }: Partial<PhonePlan> & { id: number }) => {
      const { error } = await supabase
        .from('phone_extension_plans')
        .update({ ...plan, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-plans'] });
      toast.success('Plano atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('phone_extension_plans')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-plans'] });
      toast.success('Plano removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // === User Plans (now by cod_agent) ===
  const userPlansQuery = useQuery({
    queryKey: ['phone-user-plans'],
    queryFn: async (): Promise<PhoneUserPlan[]> => {
      const { data, error } = await supabase
        .from('phone_user_plans')
        .select('*, phone_extension_plans(name, max_extensions)')
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        plan_name: d.phone_extension_plans?.name,
        max_extensions: d.phone_extension_plans?.max_extensions,
      }));
    },
  });

  const assignPlan = useMutation({
    mutationFn: async ({ codAgent, planId }: { codAgent: string; planId: number }) => {
      // Deactivate existing plans for this cod_agent
      await supabase
        .from('phone_user_plans')
        .update({ is_active: false } as any)
        .eq('cod_agent', codAgent);
      // Assign new plan
      const { error } = await supabase
        .from('phone_user_plans')
        .insert({ cod_agent: codAgent, plan_id: planId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-user-plans'] });
      toast.success('Plano vinculado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // === Config ===
  const configsQuery = useQuery({
    queryKey: ['phone-configs'],
    queryFn: async (): Promise<PhoneConfig[]> => {
      const { data, error } = await supabase
        .from('phone_config')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PhoneConfig[];
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (config: Partial<PhoneConfig> & { id?: number }) => {
      if (config.id) {
        const { error } = await supabase
          .from('phone_config')
          .update({ ...config, updated_at: new Date().toISOString() } as any)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('phone_config')
          .insert(config as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-configs'] });
      toast.success('Configuração salva');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // === Call History ===
  const callHistoryQuery = useQuery({
    queryKey: ['phone-call-history'],
    queryFn: async (): Promise<PhoneCallLog[]> => {
      const { data, error } = await supabase
        .from('phone_call_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as PhoneCallLog[];
    },
  });

  return {
    plans: plansQuery.data || [],
    plansLoading: plansQuery.isLoading,
    createPlan,
    updatePlan,
    deletePlan,
    userPlans: userPlansQuery.data || [],
    userPlansLoading: userPlansQuery.isLoading,
    assignPlan,
    configs: configsQuery.data || [],
    configsLoading: configsQuery.isLoading,
    saveConfig,
    callHistory: callHistoryQuery.data || [],
    callHistoryLoading: callHistoryQuery.isLoading,
  };
}
