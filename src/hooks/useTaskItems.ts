import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TaskItemStatus = 'pending' | 'completed' | 'cancelled';

export interface TaskItem {
  id: string;
  task_id: string;
  client_id: string;
  template_item_id: string | null;
  title: string;
  description: string | null;
  position: number;
  is_required: boolean;
  status: TaskItemStatus;
  completed_at: string | null;
  completed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = (taskId: string) => ['task-items', taskId];

export function useTaskItems(taskId: string | undefined, clientId?: string) {
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery<TaskItem[]>({
    queryKey: KEY(taskId ?? ''),
    enabled: !!taskId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_items')
        .select('*')
        .eq('task_id', taskId!)
        .order('position');
      if (error) throw error;
      return (data ?? []) as TaskItem[];
    },
  });

  useEffect(() => {
    if (!taskId) return;
    const ch = supabase
      .channel(`task_items:${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_items', filter: `task_id=eq.${taskId}` },
        () => {
          qc.invalidateQueries({ queryKey: KEY(taskId) });
          if (clientId) qc.invalidateQueries({ queryKey: ['tasks', clientId] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId, clientId, qc]);

  const completeItem = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId?: string }) => {
      const { error } = await supabase.from('task_items').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: userId ?? null,
        cancelled_at: null,
        cancelled_by: null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(taskId ?? '') }),
  });

  const cancelItem = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId?: string }) => {
      const { error } = await supabase.from('task_items').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId ?? null,
        completed_at: null,
        completed_by: null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(taskId ?? '') }),
  });

  const reopenItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_items').update({
        status: 'pending',
        completed_at: null,
        completed_by: null,
        cancelled_at: null,
        cancelled_by: null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(taskId ?? '') }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(taskId ?? '') }),
  });

  return {
    items,
    isLoading,
    completeItem: completeItem.mutateAsync,
    cancelItem: cancelItem.mutateAsync,
    reopenItem: reopenItem.mutateAsync,
    removeItem: removeItem.mutateAsync,
  };
}