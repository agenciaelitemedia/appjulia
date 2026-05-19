import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VideoOrder {
  id: string;
  client_id: string;
  customer_name: string;
  customer_email: string;
  customer_whatsapp: string | null;
  plan_id: number;
  plan_name: string;
  billing_period: string;
  extra_minute_packs: number;
  recording_enabled: boolean;
  transcription_enabled: boolean;
  total_amount: number;
  status: string;
  checkout_url: string | null;
  paid_at: string | null;
  provisioned_at: string | null;
  provisioning_error: string | null;
  created_at: string;
}

export function useVideoOrders() {
  return useQuery<VideoOrder[]>({
    queryKey: ['admin-video-orders'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('video_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as VideoOrder[];
    },
    refetchInterval: 15000,
  });
}

export function useConfirmVideoPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error: updErr } = await (supabase as any)
        .from('video_orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', orderId);
      if (updErr) throw updErr;
      const { data, error } = await supabase.functions.invoke('video-provision', { body: { order_id: orderId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success('Pagamento confirmado e plano provisionado');
      qc.invalidateQueries({ queryKey: ['admin-video-orders'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}

export function useRetryVideoProvision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('video-provision', { body: { order_id: orderId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success('Provisionamento disparado');
      qc.invalidateQueries({ queryKey: ['admin-video-orders'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}

export function useCancelVideoOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await (supabase as any)
        .from('video_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido cancelado');
      qc.invalidateQueries({ queryKey: ['admin-video-orders'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}

export function useDeleteVideoOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await (supabase as any).from('video_orders').delete().eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pedido excluído');
      qc.invalidateQueries({ queryKey: ['admin-video-orders'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}