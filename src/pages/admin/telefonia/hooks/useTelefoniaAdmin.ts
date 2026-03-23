import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PhonePlan, PhoneUserPlan, PhoneConfig, PhoneCallLog, BillingPeriod } from '../types';
import { BILLING_PERIOD_MONTHS } from '../types';
import { addMonths, format } from 'date-fns';

function calcDueDate(startDate: string, period: BillingPeriod): string {
  const months = BILLING_PERIOD_MONTHS[period];
  return format(addMonths(new Date(startDate), months), 'yyyy-MM-dd');
}

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

  // === User Plans (agents) ===
  const userPlansQuery = useQuery({
    queryKey: ['phone-user-plans'],
    queryFn: async (): Promise<PhoneUserPlan[]> => {
      const { data, error } = await supabase
        .from('phone_user_plans')
        .select('*, phone_extension_plans(name, max_extensions, price_monthly, price_quarterly, price_semiannual, price_annual, extra_extension_price)')
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        plan_name: d.phone_extension_plans?.name,
        max_extensions: d.phone_extension_plans?.max_extensions,
        price_monthly: d.phone_extension_plans?.price_monthly,
        price_quarterly: d.phone_extension_plans?.price_quarterly,
        price_semiannual: d.phone_extension_plans?.price_semiannual,
        price_annual: d.phone_extension_plans?.price_annual,
        extra_extension_price: d.phone_extension_plans?.extra_extension_price,
      }));
    },
  });

  const assignPlan = useMutation({
    mutationFn: async (params: {
      codAgent: string;
      planId: number;
      billingPeriod: BillingPeriod;
      extraExtensions: number;
      clientName: string;
      businessName: string;
    }) => {
      // Deactivate existing plans for this cod_agent
      await supabase
        .from('phone_user_plans')
        .update({ is_active: false } as any)
        .eq('cod_agent', params.codAgent);

      const startDate = format(new Date(), 'yyyy-MM-dd');
      const dueDate = calcDueDate(startDate, params.billingPeriod);

      const { error } = await supabase
        .from('phone_user_plans')
        .insert({
          cod_agent: params.codAgent,
          plan_id: params.planId,
          billing_period: params.billingPeriod,
          extra_extensions: params.extraExtensions,
          start_date: startDate,
          due_date: dueDate,
          client_name: params.clientName,
          business_name: params.businessName,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-user-plans'] });
      toast.success('Telefonia vinculada ao agente');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateUserPlan = useMutation({
    mutationFn: async (params: {
      id: number;
      planId: number;
      billingPeriod: BillingPeriod;
      extraExtensions: number;
      startDate: string;
    }) => {
      const dueDate = calcDueDate(params.startDate, params.billingPeriod);

      const { error } = await supabase
        .from('phone_user_plans')
        .update({
          plan_id: params.planId,
          billing_period: params.billingPeriod,
          extra_extensions: params.extraExtensions,
          start_date: params.startDate,
          due_date: dueDate,
        } as any)
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-user-plans'] });
      toast.success('Telefonia atualizada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // === Config (single global) ===
  const configQuery = useQuery({
    queryKey: ['phone-config-global'],
    queryFn: async (): Promise<PhoneConfig | null> => {
      const { data, error } = await supabase
        .from('phone_config')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PhoneConfig | null;
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
      queryClient.invalidateQueries({ queryKey: ['phone-config-global'] });
      toast.success('Configuração salva');
    },
    onError: (e: Error) => toast.error(e.message),
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
    config: configQuery.data || null,
    configLoading: configQuery.isLoading,
    saveConfig,
  };
}
