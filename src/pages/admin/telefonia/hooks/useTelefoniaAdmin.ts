import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PhonePlan, PhoneUserPlan, PhoneConfig, BillingPeriod } from '../types';
import { BILLING_PERIOD_MONTHS } from '../types';
import { addMonths, format } from 'date-fns';

function calcDueDate(startDate: string, period: BillingPeriod): string {
  const months = BILLING_PERIOD_MONTHS[period];
  return format(addMonths(new Date(startDate), months), 'yyyy-MM-dd');
}

// Resolve cod_agent given a client_id (legacy dual-write support)
async function resolveCodAgentFromClient(clientId: number): Promise<string | null> {
  try {
    const { data: r } = await supabase.functions.invoke('db-query', {
      body: {
        action: 'raw',
        data: {
          query: 'SELECT cod_agent::text AS cod_agent FROM agents WHERE client_id = $1 ORDER BY id ASC LIMIT 1',
          params: [clientId],
        },
      },
    });
    const cod = (r as any)?.data?.[0]?.cod_agent ?? (r as any)?.[0]?.cod_agent;
    return cod ? String(cod) : null;
  } catch (e) {
    console.warn('[resolveCodAgentFromClient] failed:', e);
    return null;
  }
}

// Batch lookup of client names by IDs
async function fetchClientNames(
  ids: number[],
): Promise<Record<number, { name: string; business_name: string | null }>> {
  if (ids.length === 0) return {};
  try {
    const { data: r } = await supabase.functions.invoke('db-query', {
      body: {
        action: 'raw',
        data: {
          query: `SELECT id, name, business_name FROM clients WHERE id = ANY($1::int[])`,
          params: [ids],
        },
      },
    });
    const rows = (r as any)?.data ?? (r as any) ?? [];
    const map: Record<number, { name: string; business_name: string | null }> = {};
    for (const row of rows as any[]) {
      map[Number(row.id)] = { name: row.name, business_name: row.business_name ?? null };
    }
    return map;
  } catch (e) {
    console.warn('[fetchClientNames] failed:', e);
    return {};
  }
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
      const { error } = await supabase.from('phone_extension_plans').insert(plan as any);
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
      const { error } = await supabase.from('phone_extension_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-plans'] });
      toast.success('Plano removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // === User Plans (clients) ===
  const userPlansQuery = useQuery({
    queryKey: ['phone-user-plans'],
    queryFn: async (): Promise<PhoneUserPlan[]> => {
      const { data, error } = await supabase
        .from('phone_user_plans')
        .select(
          '*, phone_extension_plans(name, max_extensions, price_monthly, price_quarterly, price_semiannual, price_annual, extra_extension_price)',
        )
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
      clientId: number;
      planId: number;
      billingPeriod: BillingPeriod;
      extraExtensions: number;
      clientName: string;
      businessName: string;
      codAgent?: string | null;
      recordingEnabled?: boolean;
      transcriptionEnabled?: boolean;
    }) => {
      const clientId = Number(params.clientId);
      // Dual-write: derive cod_agent from client_id for legacy compatibility
      let codAgent: string | null = params.codAgent ?? null;
      if (!codAgent) codAgent = await resolveCodAgentFromClient(clientId);

      // Deactivate existing plans for this client
      await supabase
        .from('phone_user_plans')
        .update({ is_active: false } as any)
        .eq('client_id', clientId);

      const startDate = format(new Date(), 'yyyy-MM-dd');
      const dueDate = calcDueDate(startDate, params.billingPeriod);

      const { error } = await supabase.from('phone_user_plans').insert({
        cod_agent: codAgent ?? null,
        client_id: clientId,
        plan_id: params.planId,
        billing_period: params.billingPeriod,
        extra_extensions: params.extraExtensions,
        start_date: startDate,
        due_date: dueDate,
        client_name: params.clientName,
        business_name: params.businessName,
        recording_enabled: params.recordingEnabled ?? false,
        transcription_enabled: params.transcriptionEnabled ?? false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-user-plans'] });
      toast.success('Telefonia vinculada ao cliente');
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

  const toggleUserPlanActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const { error } = await supabase
        .from('phone_user_plans')
        .update({ is_active: isActive } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['phone-user-plans'] });
      toast.success(vars.isActive ? 'Telefonia ativada' : 'Telefonia desativada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUserPlan = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('phone_user_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-user-plans'] });
      toast.success('Telefonia removida');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // === Config (per client) ===
  const configQuery = useQuery({
    queryKey: ['phone-configs-all'],
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<PhoneConfig[]> => {
      const { data, error } = await supabase
        .from('phone_config')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      const ids = Array.from(
        new Set(rows.map((r) => r.client_id).filter((x): x is number => x != null)),
      );
      const names = await fetchClientNames(ids);
      const providerIds = Array.from(
        new Set(rows.map((r) => r.provider_id).filter((x): x is string => !!x)),
      );
      let providerMap: Record<string, { name: string; provider: string }> = {};
      if (providerIds.length > 0) {
        const { data: provs } = await (supabase as any)
          .from('telephony_providers')
          .select('id,name,provider')
          .in('id', providerIds);
        for (const p of (provs ?? []) as any[]) {
          providerMap[p.id] = { name: p.name, provider: p.provider };
        }
      }
      return rows.map((r) => ({
        ...r,
        client_name:
          r.client_id != null ? names[Number(r.client_id)]?.name ?? null : null,
        business_name:
          r.client_id != null ? names[Number(r.client_id)]?.business_name ?? null : null,
        provider_name: r.provider_id ? providerMap[r.provider_id]?.name ?? null : null,
      })) as unknown as PhoneConfig[];
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
        const clientId: number | null = (config as any).client_id ?? null;
        let codAgent: string | null = (config as any).cod_agent ?? null;
        if (!codAgent && clientId) {
          codAgent = await resolveCodAgentFromClient(Number(clientId));
        }
        const { error } = await supabase
          .from('phone_config')
          .insert({ ...config, client_id: clientId, cod_agent: codAgent ?? null } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-configs-all'] });
      toast.success('Configuração salva');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('phone_config').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-configs-all'] });
      toast.success('Configuração removida');
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
    updateUserPlan,
    toggleUserPlanActive,
    deleteUserPlan,
    configs: configQuery.data || [],
    configsLoading: configQuery.isLoading,
    saveConfig,
    deleteConfig,
  };
}
