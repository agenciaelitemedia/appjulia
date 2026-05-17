import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TelephonyOrder {
  id: string;
  client_id: number;
  cod_agent: string | null;
  customer_name: string;
  customer_document: string;
  customer_email: string;
  customer_whatsapp: string | null;
  plan_id: number;
  plan_name: string;
  billing_period: string;
  extra_extensions: number;
  recording_enabled: boolean;
  transcription_enabled: boolean;
  total_amount: number;
  status: string;
  order_nsu: string | null;
  paid_amount: number | null;
  net_amount: number | null;
  paid_at: string | null;
  provisioned_at: string | null;
  provisioning_error: string | null;
  created_at: string;
  provider_id: string | null;
}

export function useTelephonyOrders() {
  return useQuery<TelephonyOrder[]>({
    queryKey: ['telephony-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('telephony_orders' as never)
        .select('*')
        .order('created_at', { ascending: false }) as any;
      if (error) throw error;
      return (data ?? []) as TelephonyOrder[];
    },
    refetchInterval: 15 * 1000,
  });
}

export function useRetryProvisioning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('telephony-provision', {
        body: { order_id: orderId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Provisionamento disparado');
      qc.invalidateQueries({ queryKey: ['telephony-orders'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}

export function useCancelTelephonyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await (supabase as any)
        .from('telephony_orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido cancelado');
      qc.invalidateQueries({ queryKey: ['telephony-orders'] });
    },
    onError: (e: any) => toast.error('Falha ao cancelar: ' + (e?.message ?? 'erro')),
  });
}

export function useDeleteTelephonyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await (supabase as any)
        .from('telephony_orders')
        .delete()
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido excluído');
      qc.invalidateQueries({ queryKey: ['telephony-orders'] });
    },
    onError: (e: any) => toast.error('Falha ao excluir: ' + (e?.message ?? 'erro')),
  });
}

export function useConfirmTelephonyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data: order, error: updErr } = await (supabase as any)
        .from('telephony_orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select('id, total_amount')
        .maybeSingle();
      if (updErr) throw updErr;

      const { data, error } = await supabase.functions.invoke('telephony-provision', {
        body: { order_id: orderId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return order;
    },
    onSuccess: () => {
      toast.success('Pagamento confirmado e ramais liberados');
      qc.invalidateQueries({ queryKey: ['telephony-orders'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}
