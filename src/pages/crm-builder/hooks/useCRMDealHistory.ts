import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CRMDealHistory, DealHistoryAction } from '../types';

interface UseCRMDealHistoryOptions {
  dealId: string | null;
}

export function useCRMDealHistory({ dealId }: UseCRMDealHistoryOptions) {
  const [history, setHistory] = useState<CRMDealHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!dealId) {
      setHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch history with pipeline names
      const { data, error: queryError } = await supabase
        .from('crm_deal_history')
        .select(`
          *,
          from_pipeline:crm_pipelines!crm_deal_history_from_pipeline_id_fkey(name, color),
          to_pipeline:crm_pipelines!crm_deal_history_to_pipeline_id_fkey(name, color)
        `)
        .eq('deal_id', dealId)
        .order('changed_at', { ascending: false });

      if (queryError) throw queryError;

      // Transform data with joined pipeline names
      const transformed: CRMDealHistory[] = (data || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        deal_id: item.deal_id as string,
        action: item.action as DealHistoryAction,
        from_pipeline_id: item.from_pipeline_id as string | undefined,
        to_pipeline_id: item.to_pipeline_id as string | undefined,
        changed_by: item.changed_by as string | undefined,
        changed_at: item.changed_at as string,
        changes: item.changes as Record<string, unknown>,
        notes: item.notes as string | undefined,
        from_pipeline_name: (item.from_pipeline as { name?: string } | null)?.name,
        to_pipeline_name: (item.to_pipeline as { name?: string } | null)?.name,
        from_pipeline_color: (item.from_pipeline as { color?: string } | null)?.color,
        to_pipeline_color: (item.to_pipeline as { color?: string } | null)?.color,
      }));

      setHistory(transformed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar histórico';
      setError(message);
      console.error('Error fetching deal history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dealId]);

  // Add a note to the deal history
  const addNote = useCallback(async (note: string): Promise<boolean> => {
    if (!dealId || !note.trim()) return false;

    try {
      const { error: insertError } = await supabase
        .from('crm_deal_history')
        .insert({
          deal_id: dealId,
          action: 'note_added',
          notes: note.trim(),
        });

      if (insertError) throw insertError;

      // Refresh history
      await fetchHistory();
      return true;
    } catch (err) {
      console.error('Error adding note:', err);
      return false;
    }
  }, [dealId, fetchHistory]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!dealId) return;

    const channel = supabase
      .channel(`deal-history-${dealId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_deal_history',
          filter: `deal_id=eq.${dealId}`,
        },
        () => {
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, fetchHistory]);

  // Fetch on dealId change
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    isLoading,
    error,
    fetchHistory,
    addNote,
  };
}
