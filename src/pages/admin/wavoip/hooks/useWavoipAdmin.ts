import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type WavoipPlan = {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  included_minutes: number;
  max_devices: number;
  device_model: string;
  features: any;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type WavoipUserPlan = {
  id: string;
  user_id: string | null;
  client_id: number | null;
  client_name: string | null;
  business_name: string | null;
  is_active: boolean;
  billing_period: string;
  extra_devices: number;
  start_date: string | null;
  due_date: string | null;
  plan_id: string;
  status: string;
  activated_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  plan?: WavoipPlan | null;
};

export type WavoipOrder = {
  id: string;
  user_id: string;
  plan_id: string | null;
  amount: number;
  status: string;
  payment_provider: string | null;
  payment_id: string | null;
  paid_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
};

export type WavoipDevice = {
  id: string;
  user_id: string | null;
  client_id: number | null;
  user_plan_id: string | null;
  device_token: string;
  device_name: string | null;
  friendly_code: string | null;
  whatsapp_number: string | null;
  whatsapp_jid: string | null;
  status: string;
  connection_status: string;
  connected_at: string | null;
  whatsapp_jids: any;
  device_model: string;
  last_seen_at: string | null;
  provisioned_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
};

export type WavoipCallLog = {
  id: string;
  user_id: string | null;
  device_id: string | null;
  direction: string;
  status: string;
  from_number: string | null;
  to_number: string | null;
  whatsapp_jid: string | null;
  duration_seconds: number;
  end_reason: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export function useWavoipPlans() {
  return useQuery({
    queryKey: ['wavoip', 'plans'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_plans')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WavoipPlan[];
    },
  });
}

export function useUpsertWavoipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Partial<WavoipPlan> & { id?: string }) => {
      const payload = { ...plan };
      if (plan.id) {
        const { error } = await (supabase as any).from('wavoip_plans').update(payload).eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('wavoip_plans').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wavoip', 'plans'] });
      toast.success('Plano salvo');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao salvar plano'),
  });
}

export function useDeleteWavoipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('wavoip_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wavoip', 'plans'] });
      toast.success('Plano excluído');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao excluir plano'),
  });
}

export function useWavoipUserPlans() {
  return useQuery({
    queryKey: ['wavoip', 'user-plans'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_user_plans')
        .select('*, plan:wavoip_plans(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WavoipUserPlan[];
    },
  });
}

export function useActivateWavoipForUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      client_id: number;
      plan_id: string;
      client_name: string;
      business_name?: string | null;
      extra_devices?: number;
      billing_period?: string;
      device_ids?: string[];
    }) => {
      // Deactivate previous plans for this client
      await (supabase as any)
        .from('wavoip_user_plans')
        .update({ is_active: false, status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('client_id', params.client_id)
        .eq('is_active', true);

      const { data: created, error } = await (supabase as any).from('wavoip_user_plans').insert({
        client_id: params.client_id,
        client_name: params.client_name,
        business_name: params.business_name ?? null,
        plan_id: params.plan_id,
        billing_period: params.billing_period ?? 'monthly',
        extra_devices: params.extra_devices ?? 0,
        status: 'active',
        is_active: true,
        start_date: new Date().toISOString().slice(0, 10),
      }).select('id').single();
      if (error) throw error;

      if (params.device_ids && params.device_ids.length > 0) {
        const { error: assignErr } = await (supabase as any).rpc('assign_wavoip_devices_to_plan', {
          p_device_ids: params.device_ids,
          p_user_plan_id: created.id,
          p_client_id: params.client_id,
        });
        if (assignErr) throw assignErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wavoip', 'user-plans'] });
      qc.invalidateQueries({ queryKey: ['wavoip', 'devices'] });
      qc.invalidateQueries({ queryKey: ['wavoip', 'devices', 'free'] });
      toast.success('Wavoip ativado para o cliente');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao ativar'),
  });
}

export function useDeactivateWavoipUserPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('wavoip_user_plans')
        .update({ status: 'cancelled', is_active: false, cancelled_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await (supabase as any).rpc('release_wavoip_devices_from_plan', { p_user_plan_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wavoip', 'user-plans'] });
      qc.invalidateQueries({ queryKey: ['wavoip', 'devices'] });
      qc.invalidateQueries({ queryKey: ['wavoip', 'devices', 'free'] });
      toast.success('Plano desativado');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao desativar'),
  });
}

export function useToggleWavoipUserPlanActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from('wavoip_user_plans')
        .update({
          is_active,
          status: is_active ? 'active' : 'cancelled',
          cancelled_at: is_active ? null : new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      if (!is_active) {
        await (supabase as any).rpc('release_wavoip_devices_from_plan', { p_user_plan_id: id });
      }
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['wavoip', 'user-plans'] });
      qc.invalidateQueries({ queryKey: ['wavoip', 'devices'] });
      qc.invalidateQueries({ queryKey: ['wavoip', 'devices', 'free'] });
      toast.success(v.is_active ? 'Wavoip ativado' : 'Wavoip desativado');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao alterar status'),
  });
}

export function useWavoipOrders() {
  return useQuery({
    queryKey: ['wavoip', 'orders'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WavoipOrder[];
    },
  });
}

export function useWavoipDevices() {
  return useQuery({
    queryKey: ['wavoip', 'devices'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_devices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WavoipDevice[];
    },
  });
}

export function useFreeWavoipDevices() {
  return useQuery({
    queryKey: ['wavoip', 'devices', 'free'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_devices')
        .select('*')
        .eq('status', 'free')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WavoipDevice[];
    },
  });
}

export function useRegisterPoolDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (device_token: string) => {
      const token = device_token.trim();
      if (!token) throw new Error('Token obrigatório');
      const { data: code, error: codeErr } = await (supabase as any).rpc('gen_wavoip_friendly_code');
      if (codeErr) throw codeErr;
      const { error } = await (supabase as any).from('wavoip_devices').insert({
        device_token: token,
        friendly_code: code,
        device_name: `WAPhone_${code}`,
        status: 'free',
        connection_status: 'disconnected',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wavoip', 'devices'] });
      qc.invalidateQueries({ queryKey: ['wavoip', 'devices', 'free'] });
      toast.success('Dispositivo cadastrado no pool');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao cadastrar dispositivo'),
  });
}

export function useDeletePoolDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: row, error: getErr } = await (supabase as any)
        .from('wavoip_devices').select('status').eq('id', id).single();
      if (getErr) throw getErr;
      if (row?.status === 'in_use') throw new Error('Dispositivo em uso — não pode ser removido');
      const { error } = await (supabase as any).from('wavoip_devices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wavoip', 'devices'] });
      qc.invalidateQueries({ queryKey: ['wavoip', 'devices', 'free'] });
      toast.success('Dispositivo removido');
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao remover'),
  });
}

export function useWavoipCallLogs() {
  return useQuery({
    queryKey: ['wavoip', 'call-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_call_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as WavoipCallLog[];
    },
  });
}