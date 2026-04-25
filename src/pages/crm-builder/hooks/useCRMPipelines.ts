import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CRMPipeline, CRMPipelineFormData } from '../types';
import { logCRMAudit } from './useCRMAuditLog';

interface UseCRMPipelinesOptions {
  boardId: string | null;
  clientId: string;
  codAgent: string;
  canManage?: boolean;
}

export function useCRMPipelines({ boardId, clientId, codAgent, canManage = true }: UseCRMPipelinesOptions) {
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<CRMPipeline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all pipelines for the board
  const fetchPipelines = useCallback(async () => {
    if (!boardId || !clientId) {
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
        .eq('client_id', clientId)
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
  }, [boardId, clientId, toast]);

  // Create a new pipeline
  const createPipeline = useCallback(async (data: CRMPipelineFormData): Promise<CRMPipeline | null> => {
    if (!boardId || !clientId || !canManage) return null;

    try {
      // Get the max position
      const maxPosition = pipelines.length > 0 
        ? Math.max(...pipelines.map(p => p.position)) + 1 
        : 0;

      const { data: newPipeline, error: insertError } = await supabase
        .from('crm_pipelines')
        .insert({
          board_id: boardId,
          client_id: clientId,
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

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'pipeline',
        entityId: pipeline.id,
        entityName: pipeline.name,
        action: 'created',
        changes: { board_id: boardId, color: pipeline.color, win_probability: pipeline.win_probability },
      });

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
  }, [boardId, clientId, codAgent, canManage, pipelines, toast]);

  // Update a pipeline
  const updatePipeline = useCallback(async (pipelineId: string, data: Partial<CRMPipelineFormData>): Promise<boolean> => {
    if (!canManage) return false;
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

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'pipeline',
        entityId: pipelineId,
        entityName: data.name ?? pipelines.find(p => p.id === pipelineId)?.name ?? null,
        action: 'updated',
        changes: { ...(data as Record<string, unknown>), board_id: boardId },
      });

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
  }, [canManage, clientId, codAgent, boardId, pipelines, toast]);

  // Delete (deactivate) a pipeline
  const deletePipeline = useCallback(async (pipelineId: string): Promise<boolean> => {
    if (!canManage) return false;
    try {
      const target = pipelines.find(p => p.id === pipelineId);
      const { error: updateError } = await supabase
        .from('crm_pipelines')
        .update({ is_active: false })
        .eq('id', pipelineId);

      if (updateError) throw updateError;

      setPipelines(prev => prev.filter(p => p.id !== pipelineId));

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'pipeline',
        entityId: pipelineId,
        entityName: target?.name ?? null,
        action: 'deleted',
        changes: { board_id: boardId },
      });

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
  }, [canManage, clientId, codAgent, boardId, pipelines, toast]);

  // Reorder pipelines
  const reorderPipelines = useCallback(async (reorderedPipelines: CRMPipeline[]): Promise<boolean> => {
    if (!canManage) return false;
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

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'pipeline',
        entityId: reorderedPipelines[0]?.id ?? '00000000-0000-0000-0000-000000000000',
        entityName: null,
        action: 'reordered',
        changes: {
          board_id: boardId,
          order: reorderedPipelines.map(p => ({ id: p.id, name: p.name })),
        },
      });

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
  }, [canManage, clientId, codAgent, boardId, fetchPipelines, toast]);

  // Set up realtime subscription
  useEffect(() => {
    if (!boardId || !clientId) return;

    const channel = supabase
      .channel(`crm-pipelines-${clientId}-${boardId}`)
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
  }, [boardId, clientId, fetchPipelines]);

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
