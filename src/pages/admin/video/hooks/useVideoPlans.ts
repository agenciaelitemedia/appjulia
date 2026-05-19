import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VideoPlan } from '@/pages/video/contratar/types';

export function useVideoPlans() {
  return useQuery<VideoPlan[]>({
    queryKey: ['admin-video-plans'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('video_plans')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as VideoPlan[];
    },
  });
}

export function useSaveVideoPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Partial<VideoPlan> & { id?: number }) => {
      if (plan.id) {
        const { error } = await (supabase as any).from('video_plans').update(plan).eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('video_plans').insert(plan);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Plano salvo');
      qc.invalidateQueries({ queryKey: ['admin-video-plans'] });
      qc.invalidateQueries({ queryKey: ['video-plans-active'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}

export function useDeleteVideoPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any).from('video_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plano excluído');
      qc.invalidateQueries({ queryKey: ['admin-video-plans'] });
    },
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}

export function useToggleVideoPlanActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const { error } = await (supabase as any).from('video_plans').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-video-plans'] }),
    onError: (e: any) => toast.error('Falha: ' + (e?.message ?? 'erro')),
  });
}