import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CRMDeal, CRMDealFormData, DropResult } from '../types';

interface UseCRMDealsOptions {
  boardId: string | null;
  codAgent: string;
}

export function useCRMDeals({ boardId, codAgent }: UseCRMDealsOptions) {
  const { toast } = useToast();
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all deals for the board
  const fetchDeals = useCallback(async () => {
    if (!boardId || !codAgent) {
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
        .eq('cod_agent', codAgent)
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
  }, [boardId, codAgent, toast]);

  // Get deals by pipeline
  const getDealsByPipeline = useCallback((pipelineId: string) => {
    return deals
      .filter(d => d.pipeline_id === pipelineId)
      .sort((a, b) => a.position - b.position);
  }, [deals]);

  // Create a new deal
  const createDeal = useCallback(async (pipelineId: string, data: CRMDealFormData): Promise<CRMDeal | null> => {
    if (!boardId || !codAgent) return null;

    try {
      // Get the max position in the pipeline
      const pipelineDeals = deals.filter(d => d.pipeline_id === pipelineId);
      const maxPosition = pipelineDeals.length > 0 
        ? Math.max(...pipelineDeals.map(d => d.position)) + 1 
        : 0;

      const { data: newDeal, error: insertError } = await supabase
        .from('crm_deals')
        .insert({
          pipeline_id: pipelineId,
          board_id: boardId,
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
        })
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
  }, [boardId, codAgent, deals, toast]);

  // Update a deal
  const updateDeal = useCallback(async (dealId: string, data: Partial<CRMDealFormData>): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('crm_deals')
        .update({
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
        })
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
      // Optimistic update
      setDeals(prev => {
        const updated = prev.map(d => {
          if (d.id === dealId) {
            return {
              ...d,
              pipeline_id: toPipelineId,
              position: newPosition,
              stage_entered_at: fromPipelineId !== toPipelineId ? new Date().toISOString() : d.stage_entered_at,
            };
          }
          return d;
        });
        return updated;
      });

      // Update in database
      const updateData: Record<string, unknown> = {
        pipeline_id: toPipelineId,
        position: newPosition,
      };

      // Reset stage_entered_at if moving to a different pipeline
      if (fromPipelineId !== toPipelineId) {
        updateData.stage_entered_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('crm_deals')
        .update(updateData)
        .eq('id', dealId);

      if (updateError) throw updateError;

      // Record history if pipeline changed
      if (fromPipelineId !== toPipelineId) {
        await recordHistory(dealId, 'moved', fromPipelineId, toPipelineId);
      }

      return true;
    } catch (err) {
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
    if (!boardId || !codAgent) return;

    const channel = supabase
      .channel(`crm-deals-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_deals',
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          fetchDeals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, codAgent, fetchDeals]);

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
