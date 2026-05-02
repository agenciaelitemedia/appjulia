import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CRMChecklist, CRMChecklistItem } from '../types';

export function useCRMDealTasks(dealId: string | null) {
  const [checklists, setChecklists] = useState<CRMChecklist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const checklistsRef = useRef<CRMChecklist[]>([]);

  const fetch = useCallback(async () => {
    if (!dealId) { setChecklists([]); return; }
    setIsLoading(true);
    try {
      const [{ data: cls }, { data: items }] = await Promise.all([
        supabase
          .from('crm_checklists')
          .select('*')
          .eq('deal_id', dealId)
          .order('position', { ascending: true }),
        supabase
          .from('crm_checklist_items')
          .select('*')
          .eq('deal_id', dealId)
          .order('position', { ascending: true }),
      ]);
      const itemsByChecklist: Record<string, CRMChecklistItem[]> = {};
      for (const item of (items || []) as CRMChecklistItem[]) {
        (itemsByChecklist[item.checklist_id] ??= []).push(item);
      }
      const result = ((cls || []) as CRMChecklist[]).map((cl) => ({
        ...cl,
        items: itemsByChecklist[cl.id] || [],
      }));
      checklistsRef.current = result;
      setChecklists(result);
    } finally {
      setIsLoading(false);
    }
  }, [dealId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Real-time: qualquer mudança nas tabelas atualiza
  useEffect(() => {
    if (!dealId) return;
    const channel = supabase
      .channel(`crm-tasks-${dealId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_checklists',      filter: `deal_id=eq.${dealId}` }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_checklist_items', filter: `deal_id=eq.${dealId}` }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dealId, fetch]);

  const createChecklist = useCallback(async (title: string) => {
    if (!dealId || !title.trim()) return;
    const position = checklistsRef.current.length;
    // Optimistic insert
    const tempId = crypto.randomUUID();
    const optimistic: CRMChecklist = {
      id: tempId, deal_id: dealId, title: title.trim(),
      position, created_at: new Date().toISOString(), items: [],
    };
    setChecklists((prev) => { const next = [...prev, optimistic]; checklistsRef.current = next; return next; });
    const { error } = await supabase.from('crm_checklists').insert({ deal_id: dealId, title: title.trim(), position });
    // Realtime will replace the optimistic entry; if it fails, rollback
    if (error) {
      setChecklists((prev) => { const next = prev.filter((c) => c.id !== tempId); checklistsRef.current = next; return next; });
    }
    fetch();
  }, [dealId, fetch]);

  const deleteChecklist = useCallback(async (checklistId: string) => {
    // Optimistic remove
    setChecklists((prev) => { const next = prev.filter((c) => c.id !== checklistId); checklistsRef.current = next; return next; });
    await supabase.from('crm_checklists').delete().eq('id', checklistId);
    fetch();
  }, [fetch]);

  const addItem = useCallback(async (checklistId: string, title: string) => {
    if (!dealId || !title.trim()) return;
    const cl = checklistsRef.current.find((c) => c.id === checklistId);
    const position = cl?.items?.length ?? 0;
    // Optimistic insert
    const tempId = crypto.randomUUID();
    const optimistic: CRMChecklistItem = {
      id: tempId, checklist_id: checklistId, deal_id: dealId,
      title: title.trim(), is_completed: false, position,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setChecklists((prev) => {
      const next = prev.map((c) =>
        c.id === checklistId ? { ...c, items: [...(c.items || []), optimistic] } : c
      );
      checklistsRef.current = next;
      return next;
    });
    const { error } = await supabase.from('crm_checklist_items').insert({
      checklist_id: checklistId, deal_id: dealId, title: title.trim(), position,
    });
    if (error) {
      setChecklists((prev) => {
        const next = prev.map((c) =>
          c.id === checklistId ? { ...c, items: (c.items || []).filter((i) => i.id !== tempId) } : c
        );
        checklistsRef.current = next;
        return next;
      });
    }
    fetch();
  }, [dealId, fetch]);

  const toggleItem = useCallback(async (itemId: string, completed: boolean) => {
    setChecklists((prev) => {
      const next = prev.map((cl) => ({
        ...cl,
        items: cl.items?.map((item) =>
          item.id === itemId ? { ...item, is_completed: completed } : item
        ),
      }));
      checklistsRef.current = next;
      return next;
    });
    await supabase
      .from('crm_checklist_items')
      .update({ is_completed: completed, updated_at: new Date().toISOString() })
      .eq('id', itemId);
  }, []);

  const deleteItem = useCallback(async (itemId: string) => {
    setChecklists((prev) => {
      const next = prev.map((cl) => ({
        ...cl,
        items: (cl.items || []).filter((i) => i.id !== itemId),
      }));
      checklistsRef.current = next;
      return next;
    });
    await supabase.from('crm_checklist_items').delete().eq('id', itemId);
    fetch();
  }, [fetch]);

  const totalTasks = checklists.reduce((s, cl) => s + (cl.items?.length ?? 0), 0);
  const doneTasks  = checklists.reduce((s, cl) => s + (cl.items?.filter((i) => i.is_completed).length ?? 0), 0);

  return { checklists, isLoading, createChecklist, deleteChecklist, addItem, toggleItem, deleteItem, totalTasks, doneTasks };
}
