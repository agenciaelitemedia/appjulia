import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type QueueBillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface QueuePlan {
  id: number;
  name: string;
  description: string | null;
  max_queues: number;
  extra_queue_price: number;
  price_monthly: number;
  price_quarterly: number;
  price_semiannual: number;
  price_annual: number;
  setup_fee_monthly: number | null;
  setup_fee_quarterly: number | null;
  setup_fee_semiannual: number | null;
  setup_fee_annual: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useQueuePlansAdmin() {
  const queryClient = useQueryClient();

  const plansQuery = useQuery({
    queryKey: ['queue-plans'],
    queryFn: async (): Promise<QueuePlan[]> => {
      const { data, error } = await supabase
        .from('queue_plans' as never)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as QueuePlan[];
    },
  });

  const createPlan = useMutation({
    mutationFn: async (plan: Partial<QueuePlan>) => {
      const { error } = await supabase.from('queue_plans' as never).insert(plan as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-plans'] });
      toast.success('Plano criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, ...plan }: Partial<QueuePlan> & { id: number }) => {
      const { error } = await supabase
        .from('queue_plans' as never)
        .update({ ...plan, updated_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-plans'] });
      toast.success('Plano atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('queue_plans' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-plans'] });
      toast.success('Plano removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    plans: plansQuery.data ?? [],
    plansLoading: plansQuery.isLoading,
    createPlan,
    updatePlan,
    deletePlan,
  };
}