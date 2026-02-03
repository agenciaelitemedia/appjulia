import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { AdvboxProcess } from '@/types/advbox';

interface ProcessStats {
  total_processes: number;
  total_clients: number;
  last_cached_at: string | null;
  by_phase: { phase: string; count: number }[];
}

interface UseProcessesCacheReturn {
  processes: AdvboxProcess[];
  stats: ProcessStats | null;
  total: number;
  page: number;
  isLoading: boolean;
  isSyncing: boolean;
  loadProcesses: (codAgent: string, filters?: { page?: number; phase?: string; status?: string; search?: string }) => Promise<void>;
  loadStats: (codAgent: string) => Promise<void>;
  syncProcesses: (codAgent: string) => Promise<{ success: boolean; synced?: number; newMovements?: number }>;
}

export function useProcessesCache(): UseProcessesCacheReturn {
  const { toast } = useToast();
  const [processes, setProcesses] = useState<AdvboxProcess[]>([]);
  const [stats, setStats] = useState<ProcessStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadProcesses = useCallback(async (
    codAgent: string,
    filters?: { page?: number; phase?: string; status?: string; search?: string }
  ) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-sync', {
        body: {
          action: 'get_processes',
          codAgent,
          page: filters?.page || 1,
          limit: 50,
          phase: filters?.phase,
          status: filters?.status,
          search: filters?.search,
        },
      });

      if (error) throw error;

      if (data.success) {
        setProcesses(data.data || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
      } else {
        throw new Error(data.error || 'Erro ao carregar processos');
      }
    } catch (error) {
      console.error('Error loading processes:', error);
      toast({
        title: 'Erro ao carregar processos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadStats = useCallback(async (agentId: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('advbox-sync', {
        body: {
          action: 'get_stats',
          agentId,
        },
      });

      if (error) throw error;

      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  const syncProcesses = useCallback(async (agentId: number) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-sync', {
        body: {
          action: 'sync',
          agentId,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Sincronização concluída',
          description: `${data.processes_synced} processos sincronizados. ${data.new_movements} novas movimentações.`,
        });

        // Reload data
        await Promise.all([
          loadProcesses(agentId),
          loadStats(agentId),
        ]);

        return {
          success: true,
          synced: data.processes_synced,
          newMovements: data.new_movements,
        };
      } else {
        throw new Error(data.error || 'Erro na sincronização');
      }
    } catch (error) {
      console.error('Error syncing processes:', error);
      toast({
        title: 'Erro na sincronização',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadProcesses, loadStats]);

  return {
    processes,
    stats,
    total,
    page,
    isLoading,
    isSyncing,
    loadProcesses,
    loadStats,
    syncProcesses,
  };
}
