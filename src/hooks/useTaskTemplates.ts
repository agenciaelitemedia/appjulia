import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TaskTemplate {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  points: number;
  category: string | null;
  color: string;
  estimated_hours: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskTemplateInput = Pick<TaskTemplate, 'title' | 'points' | 'color'> &
  Partial<Pick<TaskTemplate, 'description' | 'category' | 'estimated_hours' | 'is_active'>>;

const QUERY_KEY = (clientId: string) => ['task-templates', clientId];

export function useTaskTemplates(clientId: string | undefined) {
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<TaskTemplate[]>({
    queryKey: QUERY_KEY(clientId ?? ''),
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_templates')
        .select('*')
        .eq('client_id', clientId!)
        .order('category', { ascending: true, nullsFirst: false })
        .order('title');
      if (error) throw error;
      return (data ?? []) as TaskTemplate[];
    },
  });

  const activeTemplates = templates.filter((t) => t.is_active);

  const createTemplate = useMutation({
    mutationFn: async (input: TaskTemplateInput) => {
      const { data, error } = await supabase
        .from('task_templates')
        .insert({ ...input, client_id: clientId, is_active: input.is_active ?? true })
        .select()
        .single();
      if (error) throw error;
      return data as TaskTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY(clientId ?? '') }),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TaskTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('task_templates')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as TaskTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY(clientId ?? '') }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('task_templates')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_active }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY(clientId ?? '') });
      const prev = qc.getQueryData<TaskTemplate[]>(QUERY_KEY(clientId ?? ''));
      qc.setQueryData<TaskTemplate[]>(QUERY_KEY(clientId ?? ''), (old = []) =>
        old.map((t) => (t.id === id ? { ...t, is_active } : t))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY(clientId ?? ''), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY(clientId ?? '') }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY(clientId ?? '') }),
  });

  return {
    templates,
    activeTemplates,
    isLoading,
    createTemplate: createTemplate.mutateAsync,
    updateTemplate: updateTemplate.mutateAsync,
    toggleActive: toggleActive.mutateAsync,
    deleteTemplate: deleteTemplate.mutateAsync,
    isCreating: createTemplate.isPending,
    isUpdating: updateTemplate.isPending,
  };
}
