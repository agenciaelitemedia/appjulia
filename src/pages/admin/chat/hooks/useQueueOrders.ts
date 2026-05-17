import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface QueueOrder {
  id: string;
  client_id: string;
  customer_name: string;
  customer_document: string;
  customer_email: string;
  customer_whatsapp: string | null;
  plan_id: number;
  plan_name: string;
  billing_period: string;
  extra_queues: number;
  total_amount: number;
  status: string;
  order_nsu: string | null;
  paid_amount: number | null;
  net_amount: number | null;
  paid_at: string | null;
  provisioned_at: string | null;
  provisioning_error: string | null;
  created_at: string;
  user_plan_id: number | null;
  metadata: any;
}

export function useQueueOrders() {
  return useQuery<QueueOrder[]>({
    queryKey: ['queue-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('queue_orders' as never)
        .select('*')
        .order('created_at', { ascending: false }) as any;
      if (error) throw error;
      return (data ?? []) as QueueOrder[];
    },
    refetchInterval: 15 * 1000,
  });
}

export function useRetryQueueProvisioning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('queue-provision', {
        body: { order_id: orderId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success('Provisionamento disparado');
      qc.invalidateQueries({ queryKey: ['queue-orders'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}

export function useCancelQueueOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('queue_orders' as never)
        .update({ status: 'cancelled', updated_at: new Date().toISOString() } as any)
        .eq('id', orderId) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido cancelado');
      qc.invalidateQueries({ queryKey: ['queue-orders'] });
    },
    onError: (e: any) => toast.error('Falha ao cancelar: ' + (e?.message ?? 'erro')),
  });
}

export function useDeleteQueueOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('queue_orders' as never)
        .delete()
        .eq('id', orderId) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido excluído');
      qc.invalidateQueries({ queryKey: ['queue-orders'] });
    },
    onError: (e: any) => toast.error('Falha ao excluir: ' + (e?.message ?? 'erro')),
  });
}

export function useConfirmQueuePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      // Marca como pago manualmente
      const { data: order, error: updErr } = await supabase
        .from('queue_orders' as never)
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', orderId)
        .select('id, total_amount')
        .maybeSingle() as any;
      if (updErr) throw updErr;

      // Dispara provisionamento
      const { data, error } = await supabase.functions.invoke('queue-provision', {
        body: { order_id: orderId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return order;
    },
    onSuccess: () => {
      toast.success('Pagamento confirmado e filas liberadas');
      qc.invalidateQueries({ queryKey: ['queue-orders'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}