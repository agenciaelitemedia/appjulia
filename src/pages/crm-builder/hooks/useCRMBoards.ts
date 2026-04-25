import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CRMBoard, CRMBoardFormData } from '../types';
import { logCRMAudit } from './useCRMAuditLog';

interface UseCRMBoardsOptions {
  clientId: string;
  codAgent: string;
  canManage?: boolean;
}

export function useCRMBoards({ clientId, codAgent, canManage = true }: UseCRMBoardsOptions) {
  const { toast } = useToast();
  const [boards, setBoards] = useState<CRMBoard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all boards for the agent
  const fetchBoards = useCallback(async () => {
    if (!clientId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('crm_boards')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_archived', false)
        .order('position', { ascending: true });

      if (queryError) throw queryError;

      setBoards((data as CRMBoard[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar boards';
      setError(message);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [clientId, toast]);

  // Create a new board
  const createBoard = useCallback(async (data: CRMBoardFormData): Promise<CRMBoard | null> => {
    if (!clientId || !canManage) return null;

    try {
      // Get the max position
      const maxPosition = boards.length > 0 
        ? Math.max(...boards.map(b => b.position)) + 1 
        : 0;

      const { data: newBoard, error: insertError } = await supabase
        .from('crm_boards')
        .insert({
          client_id: clientId,
          cod_agent: codAgent,
          name: data.name,
          description: data.description || null,
          icon: data.icon,
          color: data.color,
          position: maxPosition,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const board = newBoard as CRMBoard;
      setBoards(prev => [...prev, board]);

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'board',
        entityId: board.id,
        entityName: board.name,
        action: 'created',
        changes: { name: board.name, icon: board.icon, color: board.color },
      });

      toast({
        title: 'Board criado',
        description: `"${data.name}" foi criado com sucesso.`,
      });

      return board;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar board';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [clientId, codAgent, canManage, boards, toast]);

  // Update a board
  const updateBoard = useCallback(async (boardId: string, data: Partial<CRMBoardFormData>): Promise<boolean> => {
    if (!canManage) return false;
    try {
      const { error: updateError } = await supabase
        .from('crm_boards')
        .update({
          name: data.name,
          description: data.description,
          icon: data.icon,
          color: data.color,
        })
        .eq('id', boardId);

      if (updateError) throw updateError;

      setBoards(prev => prev.map(b => 
        b.id === boardId 
          ? { ...b, ...data } 
          : b
      ));

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'board',
        entityId: boardId,
        entityName: data.name ?? boards.find(b => b.id === boardId)?.name ?? null,
        action: 'updated',
        changes: data as Record<string, unknown>,
      });

      toast({
        title: 'Board atualizado',
        description: 'As alterações foram salvas.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar board';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [canManage, clientId, codAgent, boards, toast]);

  // Archive a board
  const archiveBoard = useCallback(async (boardId: string): Promise<boolean> => {
    if (!canManage) return false;
    try {
      const target = boards.find(b => b.id === boardId);
      const { error: updateError } = await supabase
        .from('crm_boards')
        .update({ is_archived: true })
        .eq('id', boardId);

      if (updateError) throw updateError;

      setBoards(prev => prev.filter(b => b.id !== boardId));

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'board',
        entityId: boardId,
        entityName: target?.name ?? null,
        action: 'archived',
      });

      toast({
        title: 'Board arquivado',
        description: 'O board foi arquivado com sucesso.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao arquivar board';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [canManage, clientId, codAgent, boards, toast]);

  // Reorder boards
  const reorderBoards = useCallback(async (reorderedBoards: CRMBoard[]): Promise<boolean> => {
    if (!canManage) return false;
    try {
      // Update positions locally first (optimistic)
      setBoards(reorderedBoards);

      // Update each board's position in the database
      const updates = reorderedBoards.map((board, index) => 
        supabase
          .from('crm_boards')
          .update({ position: index })
          .eq('id', board.id)
      );

      await Promise.all(updates);

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'board',
        entityId: reorderedBoards[0]?.id ?? '00000000-0000-0000-0000-000000000000',
        entityName: null,
        action: 'reordered',
        changes: { order: reorderedBoards.map(b => ({ id: b.id, name: b.name })) },
      });

      return true;
    } catch (err) {
      // Revert on error
      fetchBoards();
      const message = err instanceof Error ? err.message : 'Erro ao reordenar boards';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [canManage, clientId, codAgent, fetchBoards, toast]);

  // Set up realtime subscription
  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel(`crm-boards-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_boards',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          // Refetch on any change
          fetchBoards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, fetchBoards]);

  // Initial fetch
  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  return {
    boards,
    isLoading,
    error,
    fetchBoards,
    createBoard,
    updateBoard,
    archiveBoard,
    reorderBoards,
  };
}
