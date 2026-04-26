import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CRMDeal, CRMDealFormData, DropResult } from '../types';
import type { Json } from '@/integrations/supabase/types';

interface UseCRMDealsOptions {
  boardId: string | null;
  clientId: string;
  codAgent: string;
}

export function useCRMDeals({ boardId, clientId, codAgent }: UseCRMDealsOptions) {
  const { toast } = useToast();
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guarda contra refetch concorrente do realtime durante uma movimentação
  // (evita que eventos postgres_changes sobrescrevam o estado otimista
  // antes de todos os updates terem propagado).
  const isMovingRef = useRef(false);
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all deals for the board
  const fetchDeals = useCallback(async () => {
    if (!boardId || !clientId) {
      setDeals([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('crm_deals')
        .select('*')
        .eq('board_id', boardId)
        .eq('client_id', clientId)
        .neq('status', 'archived')
        .order('position', { ascending: true });

      if (queryError) throw queryError;

      setDeals((data as CRMDeal[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar deals';
      setError(message);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [boardId, clientId, toast]);

  // Get deals by pipeline
  const getDealsByPipeline = useCallback((pipelineId: string) => {
    return deals
      .filter(d => d.pipeline_id === pipelineId)
      .sort((a, b) => a.position - b.position);
  }, [deals]);

  // Create a new deal
  const createDeal = useCallback(async (pipelineId: string, data: CRMDealFormData): Promise<CRMDeal | null> => {
    if (!boardId || !clientId) return null;

    try {
      // Get the max position in the pipeline
      const pipelineDeals = deals.filter(d => d.pipeline_id === pipelineId);
      const maxPosition = pipelineDeals.length > 0 
        ? Math.max(...pipelineDeals.map(d => d.position)) + 1 
        : 0;

      const insertPayload = {
        pipeline_id: pipelineId,
        board_id: boardId,
        client_id: clientId,
        cod_agent: codAgent,
        title: data.title,
        description: data.description || null,
        value: data.value || 0,
        contact_name: data.contact_name || null,
        contact_phone: data.contact_phone || null,
        contact_email: data.contact_email || null,
        priority: data.priority || 'medium',
        expected_close_date: data.expected_close_date || null,
        tags: data.tags || [],
        assigned_to: data.assigned_to || null,
        position: maxPosition,
        custom_fields: JSON.parse(JSON.stringify((data as unknown as Record<string, unknown>).custom_fields || {})) as Json,
      };

      const { data: newDeal, error: insertError } = await supabase
        .from('crm_deals')
        .insert([insertPayload])
        .select()
        .single();

      if (insertError) throw insertError;

      const deal = newDeal as CRMDeal;
      setDeals(prev => [...prev, deal]);

      // Record history
      await recordHistory(deal.id, 'created', null, pipelineId);

      toast({
        title: 'Deal criado',
        description: `"${data.title}" foi criado com sucesso.`,
      });

      return deal;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar deal';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [boardId, clientId, codAgent, deals, toast]);

  // Update a deal
  const updateDeal = useCallback(async (dealId: string, data: Partial<CRMDealFormData>): Promise<boolean> => {
    try {
      const updatePayload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        value: data.value,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        contact_email: data.contact_email,
        priority: data.priority,
        expected_close_date: data.expected_close_date,
        tags: data.tags,
        assigned_to: data.assigned_to,
      };

      // Add custom fields if present
      const dataAsRecord = data as unknown as Record<string, unknown>;
      if (dataAsRecord.custom_fields) {
        updatePayload.custom_fields = dataAsRecord.custom_fields;
      }

      const { error: updateError } = await supabase
        .from('crm_deals')
        .update(updatePayload)
        .eq('id', dealId);

      if (updateError) throw updateError;

      setDeals(prev => prev.map(d => 
        d.id === dealId 
          ? { ...d, ...data } 
          : d
      ));

      // Record history
      await recordHistory(dealId, 'updated', null, null, data);

      toast({
        title: 'Deal atualizado',
        description: 'As alterações foram salvas.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar deal';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Move deal to another pipeline (drag & drop)
  const moveDeal = useCallback(async (result: DropResult): Promise<boolean> => {
    const { dealId, fromPipelineId, toPipelineId, newPosition } = result;

    try {
      isMovingRef.current = true;
      const sameColumn = fromPipelineId === toPipelineId;
      const nowIso = new Date().toISOString();

      // Build the affected lists from the CURRENT deals state and reindex
      // positions sequentially so they stay unique and stable.
      let affected: CRMDeal[] = [];
      setDeals(prev => {
        const moving = prev.find(d => d.id === dealId);
        if (!moving) return prev;

        if (sameColumn) {
          const list = prev
            .filter(d => d.pipeline_id === toPipelineId)
            .sort((a, b) => a.position - b.position);
          const oldIndex = list.findIndex(d => d.id === dealId);
          const targetIndex = Math.max(0, Math.min(newPosition, list.length - 1));
          const without = list.filter(d => d.id !== dealId);
          without.splice(targetIndex, 0, moving);
          const reindexed = without.map((d, i) => ({ ...d, position: i }));
          affected = reindexed;
          const byId = new Map(reindexed.map(d => [d.id, d]));
          return prev.map(d => byId.get(d.id) ?? d);
        }

        // Cross-column move
        const fromList = prev
          .filter(d => d.pipeline_id === fromPipelineId && d.id !== dealId)
          .sort((a, b) => a.position - b.position)
          .map((d, i) => ({ ...d, position: i }));

        const toListBase = prev
          .filter(d => d.pipeline_id === toPipelineId)
          .sort((a, b) => a.position - b.position);

        const insertAt = Math.max(0, Math.min(newPosition, toListBase.length));
        const movedDeal: CRMDeal = {
          ...moving,
          pipeline_id: toPipelineId,
          stage_entered_at: nowIso,
        };
        const toList = [...toListBase];
        toList.splice(insertAt, 0, movedDeal);
        const reindexedTo = toList.map((d, i) => ({ ...d, position: i }));

        affected = [...fromList, ...reindexedTo];
        const byId = new Map(affected.map(d => [d.id, d]));
        return prev.map(d => byId.get(d.id) ?? d);
      });

      if (affected.length === 0) return false;

      // Persist all affected rows in a single round-trip
      const updates = affected.map(d => ({
        id: d.id,
        position: d.position,
        pipeline_id: d.pipeline_id,
        ...(d.id === dealId && !sameColumn ? { stage_entered_at: nowIso } : {}),
      }));

      // Use individual updates wrapped in Promise.all (upsert would require all
      // NOT NULL columns). This stays a single network burst.
      const results = await Promise.all(
        updates.map(u =>
          supabase
            .from('crm_deals')
            .update({
              position: u.position,
              pipeline_id: u.pipeline_id,
              ...(u.stage_entered_at ? { stage_entered_at: u.stage_entered_at } : {}),
            })
            .eq('id', u.id)
        )
      );
      const firstErr = results.find(r => r.error)?.error;
      if (firstErr) throw firstErr;

      // Record history if pipeline changed
      if (!sameColumn) {
        await recordHistory(dealId, 'moved', fromPipelineId, toPipelineId);
      }

      // Libera a guarda apenas depois de uma janela em que os eventos
      // realtime das N escritas já terão chegado e sido descartados.
      setTimeout(() => { isMovingRef.current = false; }, 800);
      return true;
    } catch (err) {
      isMovingRef.current = false;
      // Revert on error
      fetchDeals();
      const message = err instanceof Error ? err.message : 'Erro ao mover deal';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchDeals, toast]);

  // Mark deal as won/lost
  const setDealStatus = useCallback(async (dealId: string, status: 'won' | 'lost'): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('crm_deals')
        .update({ status })
        .eq('id', dealId);

      if (updateError) throw updateError;

      setDeals(prev => prev.map(d => 
        d.id === dealId 
          ? { ...d, status } 
          : d
      ));

      // Record history
      await recordHistory(dealId, status, null, null);

      toast({
        title: status === 'won' ? 'Deal ganho!' : 'Deal perdido',
        description: status === 'won' 
          ? 'Parabéns! O deal foi marcado como ganho.' 
          : 'O deal foi marcado como perdido.',
        variant: status === 'won' ? 'default' : 'destructive',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Archive deal
  const archiveDeal = useCallback(async (dealId: string): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('crm_deals')
        .update({ status: 'archived' })
        .eq('id', dealId);

      if (updateError) throw updateError;

      setDeals(prev => prev.filter(d => d.id !== dealId));

      toast({
        title: 'Deal arquivado',
        description: 'O deal foi arquivado com sucesso.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao arquivar deal';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Record deal history
  const recordHistory = async (
    dealId: string,
    action: string,
    fromPipelineId: string | null,
    toPipelineId: string | null,
    changes?: Record<string, unknown>
  ) => {
    try {
      // Use direct insert with type bypass since types may not be updated yet
      const client = supabase as unknown as { 
        from: (table: string) => { 
          insert: (data: Record<string, unknown>) => { select: () => Promise<{ error: unknown }> } 
        } 
      };
      await client.from('crm_deal_history').insert({
        deal_id: dealId,
        action,
        from_pipeline_id: fromPipelineId,
        to_pipeline_id: toPipelineId,
        changes: changes || {},
        changed_by: codAgent,
      }).select();
    } catch {
      // Silent fail for history - not critical
      console.warn('Failed to record deal history');
    }
  };

  // Set up realtime subscription
  useEffect(() => {
    if (!boardId || !clientId) return;

    const channel = supabase
      .channel(`crm-deals-${clientId}-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_deals',
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          // Ignora eventos enquanto há uma movimentação em andamento
          // (o estado otimista já reflete a verdade que acabou de ser escrita).
          if (isMovingRef.current) return;
          // Debounce para coalescer rajadas de eventos de múltiplos updates.
          if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
          realtimeDebounceRef.current = setTimeout(() => {
            if (!isMovingRef.current) fetchDeals();
          }, 250);
        }
      )
      .subscribe();

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [boardId, clientId, fetchDeals]);

  // Fetch on board change
  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return {
    deals,
    isLoading,
    error,
    fetchDeals,
    getDealsByPipeline,
    createDeal,
    updateDeal,
    moveDeal,
    setDealStatus,
    archiveDeal,
  };
}
