import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  client_id: string;
  template_id: string | null;
  deal_id: string | null;
  title: string;
  description: string | null;
  points: number;
  category: string | null;
  category_id: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  started_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
}

interface UseTasksOptions {
  clientId: string | undefined;
  dealId?: string;
  assignedTo?: string;
  status?: TaskStatus | TaskStatus[];
  onlyMine?: boolean;
}

const baseKey = (clientId: string) => ['tasks', clientId];
const dealKey = (dealId: string) => ['tasks-deal', dealId];

export function useTasks({ clientId, dealId, assignedTo, status, onlyMine }: UseTasksOptions) {
  const qc = useQueryClient();

  const queryKey = dealId
    ? dealKey(dealId)
    : [...baseKey(clientId ?? ''), { assignedTo, status, onlyMine }];

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey,
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from('tasks')
        .select('*, task_items(count)')
        .eq('client_id', clientId!);
      if (dealId) q = q.eq('deal_id', dealId);
      if (assignedTo) q = q.eq('assigned_to', assignedTo);
      if (status) {
        if (Array.isArray(status)) q = q.in('status', status);
        else q = q.eq('status', status);
      }
      q = q.order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        items_count: Array.isArray(row.task_items) && row.task_items[0]?.count != null
          ? Number(row.task_items[0].count)
          : 0,
      })) as Task[];
    },
  });

  // Realtime: listen for changes on tasks table scoped to this client
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`tasks:${clientId}:${dealId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `client_id=eq.${clientId}` },
        () => {
          qc.invalidateQueries({ queryKey: baseKey(clientId) });
          if (dealId) qc.invalidateQueries({ queryKey: dealKey(dealId) });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, dealId, qc]);

  const createTask = useMutation({
    mutationFn: async (input: Partial<Task> & { title: string; points: number }) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...input, client_id: clientId })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: baseKey(clientId ?? '') });
      if (dealId) qc.invalidateQueries({ queryKey: dealKey(dealId) });
    },
  });

  const createFromTemplates = useMutation({
    mutationFn: async ({
      templateIds,
      targetDealId,
      assignedTo: aTo,
      assignedName,
      dueDate,
    }: {
      templateIds: string[];
      targetDealId: string;
      assignedTo: string;
      assignedName: string;
      dueDate?: string;
    }) => {
      // Fetch template details
      const { data: tpls, error: tErr } = await supabase
        .from('task_templates')
        .select('*')
        .in('id', templateIds);
      if (tErr) throw tErr;

      // Buscar itens dos templates
      const { data: tplItems, error: iErr } = await supabase
        .from('task_template_items')
        .select('*')
        .in('template_id', templateIds)
        .order('position');
      if (iErr) throw iErr;

      const rows = (tpls ?? []).map((tpl) => ({
        client_id: clientId,
        template_id: tpl.id,
        deal_id: targetDealId,
        title: tpl.title,
        description: tpl.description,
        points: tpl.points,
        category: tpl.category,
        category_id: (tpl as any).category_id ?? null,
        assigned_to: aTo,
        assigned_name: assignedName,
        status: 'pending' as TaskStatus,
        due_date: dueDate ?? null,
      }));

      const { data, error } = await supabase.from('tasks').insert(rows).select();
      if (error) throw error;

      // Clonar itens para cada tarefa criada
      const created = (data ?? []) as Task[];
      const itemRows: any[] = [];
      for (const task of created) {
        const tplItemsForTask = (tplItems ?? []).filter((i: any) => i.template_id === task.template_id);
        for (const it of tplItemsForTask) {
          itemRows.push({
            task_id: task.id,
            client_id: clientId,
            template_item_id: it.id,
            title: it.title,
            description: it.description,
            position: it.position,
            status: 'pending',
          });
        }
      }
      if (itemRows.length > 0) {
        const { error: insErr } = await supabase.from('task_items').insert(itemRows);
        if (insErr) throw insErr;
      }

      return (data ?? []) as Task[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: baseKey(clientId ?? '') });
      if (dealId) qc.invalidateQueries({ queryKey: dealKey(dealId) });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status: newStatus, completedBy }: { id: string; status: TaskStatus; completedBy?: string }) => {
      const patch: Partial<Task> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'completed') {
        patch.completed_at = new Date().toISOString();
        patch.completed_by = completedBy ?? null;
      }
      if (newStatus === 'in_progress') {
        patch.started_at = new Date().toISOString();
      }
      if (newStatus === 'cancelled') {
        patch.cancelled_at = new Date().toISOString();
      }
      const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: baseKey(clientId ?? '') });
      if (dealId) qc.invalidateQueries({ queryKey: dealKey(dealId) });
    },
  });

  const reassign = useMutation({
    mutationFn: async ({ id, assignedTo: aTo, assignedName }: { id: string; assignedTo: string; assignedName: string }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ assigned_to: aTo, assigned_name: assignedName, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: baseKey(clientId ?? '') }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: baseKey(clientId ?? '') });
      if (dealId) qc.invalidateQueries({ queryKey: dealKey(dealId) });
    },
  });

  return {
    tasks,
    isLoading,
    createTask: createTask.mutateAsync,
    createFromTemplates: createFromTemplates.mutateAsync,
    updateStatus: updateStatus.mutateAsync,
    reassign: reassign.mutateAsync,
    deleteTask: deleteTask.mutateAsync,
    isCreating: createTask.isPending || createFromTemplates.isPending,
  };
}
