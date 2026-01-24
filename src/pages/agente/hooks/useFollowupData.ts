import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { FollowupConfig, FollowupQueueItem, FollowupFiltersState } from '../types';
import { useToast } from '@/hooks/use-toast';

// Fetch total sent messages count (all SEND records, not grouped)
export function useFollowupSentCount(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-sent-count', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return 0;

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let whereClause = `cod_agent IN (${agentPlaceholders})`;

      // Date filters
      if (filters.dateFrom) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Count ALL records with state='SEND' (not grouped by lead)
      const result = await externalDb.raw<{ count: string }[]>({
        query: `
          SELECT COUNT(*)::text as count
          FROM followup_queue
          WHERE ${whereClause}
            AND state = 'SEND'
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];
      return parseInt(flatResult[0]?.count || '0', 10);
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}

// Fetch followup configuration for an agent
export function useFollowupConfig(codAgent: string | null) {
  return useQuery({
    queryKey: ['followup-config', codAgent],
    queryFn: async () => {
      if (!codAgent) return null;
      
      const result = await externalDb.raw<FollowupConfig[]>({
        query: `SELECT * FROM followup_config WHERE cod_agent = $1`,
        params: [codAgent],
      });
      
      return result[0] || null;
    },
    enabled: !!codAgent,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Save followup configuration
export function useSaveFollowupConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: Partial<FollowupConfig> & { cod_agent: string }) => {
      // Check if config exists
      const existing = await externalDb.raw<FollowupConfig[]>({
        query: `SELECT id FROM followup_config WHERE cod_agent = $1`,
        params: [config.cod_agent],
      });

      if (existing.length > 0) {
        // Update existing
        return externalDb.raw({
          query: `
            UPDATE followup_config SET
              step_cadence = $2,
              msg_cadence = $3,
              title_cadence = $4,
              start_hours = $5,
              end_hours = $6,
              auto_message = $7,
              followup_from = $8,
              followup_to = $9,
              updated_at = NOW()
            WHERE cod_agent = $1
            RETURNING *
          `,
          params: [
            config.cod_agent,
            JSON.stringify(config.step_cadence || {}),
            JSON.stringify(config.msg_cadence || {}),
            JSON.stringify(config.title_cadence || {}),
            config.start_hours ?? 9,
            config.end_hours ?? 19,
            config.auto_message ?? true,
            config.followup_from ?? 1,
            config.followup_to ?? 3,
          ],
        });
      } else {
        // Insert new
        return externalDb.raw({
          query: `
            INSERT INTO followup_config (
              cod_agent, step_cadence, msg_cadence, title_cadence,
              start_hours, end_hours, auto_message, followup_from, followup_to
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
          `,
          params: [
            config.cod_agent,
            JSON.stringify(config.step_cadence || {}),
            JSON.stringify(config.msg_cadence || {}),
            JSON.stringify(config.title_cadence || {}),
            config.start_hours ?? 9,
            config.end_hours ?? 19,
            config.auto_message ?? true,
            config.followup_from ?? 1,
            config.followup_to ?? 3,
          ],
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['followup-config', variables.cod_agent] });
      toast({
        title: 'Configuração salva',
        description: 'As configurações do FollowUp foram atualizadas com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}

// Fetch followup queue with filters - grouped by agent + session_id (most recent only)
export function useFollowupQueue(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-queue', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return [];

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let whereClause = `cod_agent IN (${agentPlaceholders})`;

      // Date filters
      if (filters.dateFrom) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // State filter
      if (filters.state && filters.state !== 'all') {
        whereClause += ` AND state = $${params.length + 1}`;
        params.push(filters.state);
      }

      // Use DISTINCT ON to get only the most recent record per agent + session_id
      const result = await externalDb.raw<FollowupQueueItem[]>({
        query: `
          SELECT DISTINCT ON (cod_agent, session_id)
            id, cod_agent, session_id, step_number, send_date,
            state, history, name_client, created_at, hub, chat_memory
          FROM followup_queue
          WHERE ${whereClause}
          ORDER BY cod_agent, session_id, send_date DESC
        `,
        params,
      });

      return result;
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}

// Fetch queue statistics with full filters - grouped by agent + session_id (unique leads)
export function useFollowupQueueStats(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-queue-stats', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return { total: 0, queue: 0, send: 0, stop: 0 };

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let whereClause = `cod_agent IN (${agentPlaceholders})`;

      // Date filters
      if (filters.dateFrom) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // State filter
      if (filters.state && filters.state !== 'all') {
        whereClause += ` AND state = $${params.length + 1}`;
        params.push(filters.state);
      }

      // Use CTE with DISTINCT ON to count unique leads only
      const result = await externalDb.raw<{ state: string; count: string }[]>({
        query: `
          WITH unique_queue AS (
            SELECT DISTINCT ON (cod_agent, session_id)
              cod_agent, session_id, state
            FROM followup_queue
            WHERE ${whereClause}
            ORDER BY cod_agent, session_id, send_date DESC
          )
          SELECT state, COUNT(*)::text as count
          FROM unique_queue
          GROUP BY state
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];

      const stats = {
        total: 0,
        queue: 0,
        send: 0,
        stop: 0,
      };

      flatResult.forEach((row: { state: string; count: string }) => {
        const count = parseInt(row.count, 10);
        stats.total += count;
        if (row.state === 'QUEUE') stats.queue = count;
        else if (row.state === 'SEND') stats.send = count;
        else if (row.state === 'STOP') stats.stop = count;
      });

      return stats;
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}

// Update queue item state
export function useUpdateQueueState() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, state }: { id: number; state: string }) => {
      return externalDb.raw({
        query: `UPDATE followup_queue SET state = $2 WHERE id = $1 RETURNING *`,
        params: [id, state],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-queue'] });
      queryClient.invalidateQueries({ queryKey: ['followup-queue-stats'] });
      toast({
        title: 'Status atualizado',
        description: 'O status do item foi alterado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}

// Delete queue item
export function useDeleteQueueItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      return externalDb.raw({
        query: `DELETE FROM followup_queue WHERE id = $1`,
        params: [id],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-queue'] });
      queryClient.invalidateQueries({ queryKey: ['followup-queue-stats'] });
      toast({
        title: 'Item removido',
        description: 'O item foi removido da fila com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}
