import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CRMPipeline, CRMPipelineFormData } from '../types';

interface UseCRMPipelinesOptions {
  boardId: string | null;
  codAgent: string;
}

export function useCRMPipelines({ boardId, codAgent }: UseCRMPipelinesOptions) {
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<CRMPipeline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all pipelines for the board
  const fetchPipelines = useCallback(async () => {
    if (!boardId || !codAgent) {
      setPipelines([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('crm_pipelines')
        .select('*')
        .eq('board_id', boardId)
        .eq('cod_agent', codAgent)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (queryError) throw queryError;

      setPipelines((data as CRMPipeline[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar pipelines';
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

  // Create a new pipeline
  const createPipeline = useCallback(async (data: CRMPipelineFormData): Promise<CRMPipeline | null> => {
    if (!boardId || !codAgent) return null;

    try {
      // Get the max position
      const maxPosition = pipelines.length > 0 
        ? Math.max(...pipelines.map(p => p.position)) + 1 
        : 0;

      const { data: newPipeline, error: insertError } = await supabase
        .from('crm_pipelines')
        .insert({
          board_id: boardId,
          cod_agent: codAgent,
          name: data.name,
          color: data.color,
          win_probability: data.win_probability || 0,
          position: maxPosition,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const pipeline = newPipeline as CRMPipeline;
      setPipelines(prev => [...prev, pipeline]);

      toast({
        title: 'Etapa criada',
        description: `"${data.name}" foi criada com sucesso.`,
      });

      return pipeline;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar etapa';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [boardId, codAgent, pipelines, toast]);

  // Update a pipeline
  const updatePipeline = useCallback(async (pipelineId: string, data: Partial<CRMPipelineFormData>): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('crm_pipelines')
        .update({
          name: data.name,
          color: data.color,
          win_probability: data.win_probability,
        })
        .eq('id', pipelineId);

      if (updateError) throw updateError;

      setPipelines(prev => prev.map(p => 
        p.id === pipelineId 
          ? { ...p, ...data } 
          : p
      ));

      toast({
        title: 'Etapa atualizada',
        description: 'As alterações foram salvas.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar etapa';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Delete (deactivate) a pipeline
  const deletePipeline = useCallback(async (pipelineId: string): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('crm_pipelines')
        .update({ is_active: false })
        .eq('id', pipelineId);

      if (updateError) throw updateError;

      setPipelines(prev => prev.filter(p => p.id !== pipelineId));

      toast({
        title: 'Etapa removida',
        description: 'A etapa foi removida com sucesso.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover etapa';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Reorder pipelines
  const reorderPipelines = useCallback(async (reorderedPipelines: CRMPipeline[]): Promise<boolean> => {
    try {
      // Update positions locally first (optimistic)
      setPipelines(reorderedPipelines);

      // Update each pipeline's position in the database
      const updates = reorderedPipelines.map((pipeline, index) => 
        supabase
          .from('crm_pipelines')
          .update({ position: index })
          .eq('id', pipeline.id)
      );

      await Promise.all(updates);

      return true;
    } catch (err) {
      // Revert on error
      fetchPipelines();
      const message = err instanceof Error ? err.message : 'Erro ao reordenar etapas';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchPipelines, toast]);

  // Set up realtime subscription
  useEffect(() => {
    if (!boardId || !codAgent) return;

    const channel = supabase
      .channel(`crm-pipelines-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_pipelines',
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          fetchPipelines();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, codAgent, fetchPipelines]);

  // Fetch on board change
  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  return {
    pipelines,
    isLoading,
    error,
    fetchPipelines,
    createPipeline,
    updatePipeline,
    deletePipeline,
    reorderPipelines,
  };
}
