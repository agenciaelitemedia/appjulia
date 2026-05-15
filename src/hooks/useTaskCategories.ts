import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskCategory {
  id: string;
  client_id: string;
  name: string;
  color: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = (clientId: string) => ['task-categories', clientId];

const DEFAULT_PRESETS: { name: string; color: string }[] = [
  { name: 'Comercial', color: '#6366f1' },
  { name: 'Suporte', color: '#10b981' },
  { name: 'Financeiro', color: '#f59e0b' },
  { name: 'Jurídico', color: '#ef4444' },
  { name: 'Operacional', color: '#3b82f6' },
  { name: 'Marketing', color: '#8b5cf6' },
];

export function useTaskCategories(clientId: string | undefined) {
  const qc = useQueryClient();

  const { data: categories = [], isLoading } = useQuery<TaskCategory[]>({
    queryKey: KEY(clientId ?? ''),
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_categories')
        .select('*')
        .eq('client_id', clientId!)
        .order('name');
      if (error) throw error;
      return (data ?? []) as TaskCategory[];
    },
  });

  useEffect(() => {
    if (!clientId) return;
    const ch = supabase
      .channel(`task_categories:${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_categories', filter: `client_id=eq.${clientId}` },
        () => qc.invalidateQueries({ queryKey: KEY(clientId) }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [clientId, qc]);

  // Auto-seed presets na primeira carga vazia
  useEffect(() => {
    if (!clientId || isLoading) return;
    if (categories.length > 0) return;
    (async () => {
      try {
        await supabase.from('task_categories').insert(
          DEFAULT_PRESETS.map((p) => ({ client_id: clientId, name: p.name, color: p.color, is_active: true }))
        );
        qc.invalidateQueries({ queryKey: KEY(clientId) });
      } catch {/* noop */}
    })();
  }, [clientId, isLoading, categories.length, qc]);

  const createCategory = useMutation({
    mutationFn: async (input: { name: string; color?: string }) => {
      const { data, error } = await supabase
        .from('task_categories')
        .insert({ client_id: clientId, name: input.name.trim(), color: input.color ?? '#6366f1', is_active: true })
        .select().single();
      if (error) throw error;
      return data as TaskCategory;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(clientId ?? '') }),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TaskCategory> & { id: string }) => {
      const { error } = await supabase.from('task_categories').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(clientId ?? '') }),
  });

  const archiveCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_categories').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(clientId ?? '') }),
  });

  const activeCategories = categories.filter((c) => c.is_active);

  return {
    categories,
    activeCategories,
    isLoading,
    createCategory: createCategory.mutateAsync,
    updateCategory: updateCategory.mutateAsync,
    archiveCategory: archiveCategory.mutateAsync,
  };
}