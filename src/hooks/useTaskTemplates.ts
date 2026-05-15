import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TaskTemplate {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  points: number;
  category: string | null;
  category_id: string | null;
  color: string;
  estimated_hours: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
}

export interface TaskTemplateItemInput {
  id?: string;
  title: string;
  description?: string | null;
  position?: number;
  is_required?: boolean;
}

export type TaskTemplateInput = Pick<TaskTemplate, 'title' | 'points' | 'color'> &
  Partial<Pick<TaskTemplate, 'description' | 'category' | 'category_id' | 'estimated_hours' | 'is_active'>> & {
    items: TaskTemplateItemInput[];
  };

export interface TaskTemplateItem {
  id: string;
  template_id: string;
  client_id: string;
  title: string;
  description: string | null;
  position: number;
  is_required: boolean;
}

const QUERY_KEY = (clientId: string) => ['task-templates', clientId];
const ITEMS_KEY = (templateId: string) => ['task-template-items', templateId];

export function useTaskTemplates(clientId: string | undefined) {
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<TaskTemplate[]>({
    queryKey: QUERY_KEY(clientId ?? ''),
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_templates')
        .select('*, task_template_items(count)')
        .eq('client_id', clientId!)
        .order('category', { ascending: true, nullsFirst: false })
        .order('title');
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        items_count: Array.isArray(t.task_template_items)
          ? (t.task_template_items[0]?.count ?? 0)
          : 0,
      })) as TaskTemplate[];
    },
  });

  const activeTemplates = templates.filter((t) => t.is_active && (t.items_count ?? 0) > 0);

  async function syncItems(templateId: string, items: TaskTemplateItemInput[]) {
    // estratégia simples: apaga tudo e reinsere mantendo posição
    await supabase.from('task_template_items').delete().eq('template_id', templateId);
    if (items.length === 0) return;
    const rows = items.map((it, idx) => ({
      template_id: templateId,
      client_id: clientId,
      title: it.title.trim(),
      description: it.description?.trim() || null,
      position: it.position ?? idx,
      is_required: it.is_required ?? false,
    }));
    const { error } = await supabase.from('task_template_items').insert(rows);
    if (error) throw error;
  }

  const createTemplate = useMutation({
    mutationFn: async (input: TaskTemplateInput) => {
      const { items, ...tplData } = input;
      const { data, error } = await supabase
        .from('task_templates')
        .insert({ ...tplData, client_id: clientId, is_active: tplData.is_active ?? true })
        .select()
        .single();
      if (error) throw error;
      await syncItems(data.id, items);
      return data as TaskTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY(clientId ?? '') }),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, items, ...patch }: Partial<TaskTemplate> & { id: string; items?: TaskTemplateItemInput[] }) => {
      const { data, error } = await supabase
        .from('task_templates')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (items) await syncItems(id, items);
      return data as TaskTemplate;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY(clientId ?? '') });
      qc.invalidateQueries({ queryKey: ITEMS_KEY(vars.id) });
    },
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

export function useTaskTemplateItems(templateId: string | undefined) {
  return useQuery<TaskTemplateItem[]>({
    queryKey: ITEMS_KEY(templateId ?? ''),
    enabled: !!templateId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_template_items')
        .select('*')
        .eq('template_id', templateId!)
        .order('position');
      if (error) throw error;
      return (data ?? []) as TaskTemplateItem[];
    },
  });
}
