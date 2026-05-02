import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskCount { total: number; done: number; }

export function useCRMBoardTaskCounts(dealIds: string[]) {
  const [counts, setCounts] = useState<Record<string, TaskCount>>({});

  const fetch = useCallback(async () => {
    if (dealIds.length === 0) { setCounts({}); return; }
    const { data } = await supabase
      .from('crm_checklist_items')
      .select('deal_id, is_completed')
      .in('deal_id', dealIds);

    const map: Record<string, TaskCount> = {};
    for (const row of (data || []) as { deal_id: string; is_completed: boolean }[]) {
      const c = (map[row.deal_id] ??= { total: 0, done: 0 });
      c.total++;
      if (row.is_completed) c.done++;
    }
    setCounts(map);
  }, [dealIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  // Real-time: qualquer INSERT/UPDATE/DELETE em checklist_items refaz a contagem
  useEffect(() => {
    if (dealIds.length === 0) return;
    const channel = supabase
      .channel('crm-board-task-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_checklist_items' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return counts;
}
