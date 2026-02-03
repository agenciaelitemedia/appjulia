import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { externalDb } from '@/lib/externalDb';
import { FollowupConfig, FollowupQueueItem, FollowupFiltersState, FollowupDailyMetrics, FollowupPreviousStats } from '../types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPreviousPeriod } from '@/lib/dateUtils';

/**
 * Coerce any value to a plain JS object for JSONB storage.
 * Handles:
 * - Already an object: returns as-is
 * - String (single or double-encoded JSON): parses recursively up to 3 times
 * - Null/undefined: returns defaultValue
 * 
 * This prevents the driver from sending stringified JSON which would be stored
 * as JSONB type "string" instead of "object".
 */
function coerceJsonbObject<T extends Record<string, unknown>>(
  value: unknown,
  defaultValue: T
): T {
  if (value === null || value === undefined) return defaultValue;
  
  // Already an object (and not array)
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  
  // String - try to parse (handles single and double-encoded JSON)
  if (typeof value === 'string') {
    let parsed: unknown = value;
    for (let i = 0; i < 3; i++) {
      if (typeof parsed !== 'string') break;
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return defaultValue;
      }
    }
    if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
      return parsed as T;
    }
  }
  
  return defaultValue;
}

// Fetch total sent messages count from followup_history
// Each record in followup_history represents one sent message
export function useFollowupSentCount(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-sent-count', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return 0;

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let whereClause = `fq.cod_agent IN (${agentPlaceholders})`;

      // Date filters based on followup_history.created_at (actual send time)
      if (filters.dateFrom) {
        whereClause += ` AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause += ` AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Count each followup_history record as 1 sent message
      const result = await externalDb.raw<{ total: string }[]>({
        query: `
          SELECT COUNT(*)::text as total
          FROM followup_history fh
          JOIN followup_queue fq ON fq.id = fh.followup_queue_id
          WHERE ${whereClause}
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];
      return parseInt(flatResult[0]?.total || '0', 10);
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
// IMPORTANT: Uses coerceJsonbObject to ensure objects are passed to driver (not strings)
// Also uses SQL CASE to auto-unwrap if string somehow arrives (belt-and-suspenders)
export function useSaveFollowupConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: Partial<FollowupConfig> & { cod_agent: string }) => {
      // Normalize JSONB fields to plain objects (never stringified)
      const stepCadence = coerceJsonbObject(config.step_cadence, {});
      const msgCadence = coerceJsonbObject(config.msg_cadence, {});
      const titleCadence = coerceJsonbObject(config.title_cadence, {});

      // Check if config exists
      const existing = await externalDb.raw<FollowupConfig[]>({
        query: `SELECT id FROM followup_config WHERE cod_agent = $1`,
        params: [config.cod_agent],
      });

      // SQL with CASE WHEN to auto-unwrap if param arrives as JSONB string
      // This is a safety net in case something upstream sends a string
      const jsonbUnwrap = (paramNum: number) =>
        `CASE WHEN jsonb_typeof($${paramNum}::jsonb) = 'string' THEN ($${paramNum}::jsonb #>> '{}')::jsonb ELSE $${paramNum}::jsonb END`;

      if (existing.length > 0) {
        // Update existing
        return externalDb.raw({
          query: `
            UPDATE followup_config SET
              step_cadence = ${jsonbUnwrap(2)},
              msg_cadence = ${jsonbUnwrap(3)},
              title_cadence = ${jsonbUnwrap(4)},
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
            stepCadence,
            msgCadence,
            titleCadence,
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
            ) VALUES (
              $1, 
              ${jsonbUnwrap(2)}, 
              ${jsonbUnwrap(3)}, 
              ${jsonbUnwrap(4)}, 
              $5, $6, $7, $8, $9
            )
            RETURNING *
          `,
          params: [
            config.cod_agent,
            stepCadence,
            msgCadence,
            titleCadence,
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

// Restart queue item: SEND + NOW() + step_number = 1
export function useRestartQueueItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      return externalDb.raw({
        query: `
          UPDATE followup_queue 
          SET state = 'SEND', 
              send_date = NOW(), 
              step_number = 1 
          WHERE id = $1 
          RETURNING *
        `,
        params: [id],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-queue'] });
      queryClient.invalidateQueries({ queryKey: ['followup-queue-stats'] });
      toast({
        title: 'FollowUp retomado',
        description: 'O lead voltou para a etapa 1 e será processado.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao retomar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}

// Finalize queue item: STOP + step_number = 0
export function useFinalizeQueueItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      return externalDb.raw({
        query: `
          UPDATE followup_queue 
          SET state = 'STOP', 
              step_number = 0 
          WHERE id = $1 
          RETURNING *
        `,
        params: [id],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-queue'] });
      queryClient.invalidateQueries({ queryKey: ['followup-queue-stats'] });
      toast({
        title: 'FollowUp finalizado',
        description: 'O lead foi removido permanentemente da fila.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao finalizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}

// Fetch daily/hourly metrics from followup_history + followup_response
// Uses hourly granularity when dateFrom === dateTo (single day)
export function useFollowupDailyMetrics(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-daily-metrics', filters],
    queryFn: async (): Promise<FollowupDailyMetrics[]> => {
      if (!filters.agentCodes.length) return [];

      // Detect if it's a single day period
      const isSingleDay = filters.dateFrom && filters.dateTo && filters.dateFrom === filters.dateTo;

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      // Build date filter for queries
      let dateFilterFrom = '';
      let dateFilterTo = '';
      if (filters.dateFrom) {
        dateFilterFrom = `$${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        dateFilterTo = `$${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Dynamic expressions based on granularity
      const historyPeriodExpr = isSingleDay
        ? `EXTRACT(HOUR FROM fh.created_at AT TIME ZONE 'America/Sao_Paulo')::int`
        : `(fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date`;
      
      const responsePeriodExpr = isSingleDay
        ? `EXTRACT(HOUR FROM fr.created_at AT TIME ZONE 'America/Sao_Paulo')::int`
        : `(fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date`;

      const historyDateFilter = dateFilterFrom && dateFilterTo
        ? `AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= ${dateFilterFrom} AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= ${dateFilterTo}`
        : '';

      const responseDateFilter = dateFilterFrom && dateFilterTo
        ? `AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= ${dateFilterFrom} AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= ${dateFilterTo}`
        : '';

      const periodAlias = isSingleDay ? 'hour' : 'date';

      // Combined query with CTEs for history and response metrics
      const result = await externalDb.raw<{
        date?: string;
        hour?: number;
        messages_sent: string;
        unique_leads: string;
        responses: string;
      }[]>({
        query: `
          WITH history_metrics AS (
            SELECT 
              ${historyPeriodExpr} as period,
              COUNT(*)::text as messages_sent,
              COUNT(DISTINCT fq.session_id)::text as unique_leads
            FROM followup_history fh
            JOIN followup_queue fq ON fq.id = fh.followup_queue_id
            WHERE fq.cod_agent IN (${agentPlaceholders})
              ${historyDateFilter}
            GROUP BY ${historyPeriodExpr}
          ),
          response_metrics AS (
            SELECT 
              ${responsePeriodExpr} as period,
              COUNT(*)::text as responses
            FROM followup_response fr
            JOIN followup_queue fq ON fq.id = fr.followup_queue_id
            WHERE fq.cod_agent IN (${agentPlaceholders})
              ${responseDateFilter}
            GROUP BY ${responsePeriodExpr}
          )
          SELECT 
            COALESCE(h.period, r.period) as ${periodAlias},
            COALESCE(h.messages_sent, '0') as messages_sent,
            COALESCE(h.unique_leads, '0') as unique_leads,
            COALESCE(r.responses, '0') as responses
          FROM history_metrics h
          FULL OUTER JOIN response_metrics r ON h.period = r.period
          ORDER BY COALESCE(h.period, r.period)
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];

      return flatResult.map((row) => {
        const messagesSent = parseInt(row.messages_sent || '0', 10);
        const uniqueLeads = parseInt(row.unique_leads || '0', 10);
        const responses = parseInt(row.responses || '0', 10);
        
        // Calculate response rate per period
        const responseRate = uniqueLeads > 0 ? (responses / uniqueLeads) * 100 : 0;
        
        // Format label based on granularity
        let label: string;
        let dateValue: string;
        
        if (isSingleDay && row.hour !== undefined) {
          // Hourly label: "08h", "09h", etc.
          label = `${row.hour.toString().padStart(2, '0')}h`;
          dateValue = `${filters.dateFrom}T${row.hour.toString().padStart(2, '0')}:00:00`;
        } else if (row.date) {
          // Daily label: "22/01", "23/01", etc.
          try {
            const parsedDate = parseISO(row.date);
            label = format(parsedDate, 'dd/MM', { locale: ptBR });
          } catch {
            label = row.date;
          }
          dateValue = row.date;
        } else {
          label = 'N/A';
          dateValue = '';
        }

        return {
          date: dateValue,
          label,
          totalRecords: messagesSent,
          messagesSent,
          stopped: responses, // Now uses real responses from followup_response
          uniqueLeads,
          responseRate,
        };
      });
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}

// Fetch queue totals from followup_queue (total leads and waiting leads)
export function useFollowupQueueTotals(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-queue-totals', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return { total: 0, waiting: 0 };

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let dateFilter = '';
      if (filters.dateFrom) {
        dateFilter += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        dateFilter += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Count unique leads by status using DISTINCT ON (most recent record per session)
      const result = await externalDb.raw<{ total: string; waiting: string }[]>({
        query: `
          WITH unique_leads AS (
            SELECT DISTINCT ON (cod_agent, session_id)
              session_id, state
            FROM followup_queue
            WHERE cod_agent IN (${agentPlaceholders})
              ${dateFilter}
            ORDER BY cod_agent, session_id, send_date DESC
          )
          SELECT 
            COUNT(*)::text as total,
            COUNT(*) FILTER (WHERE state = 'SEND')::text as waiting
          FROM unique_leads
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];
      return {
        total: parseInt(flatResult[0]?.total || '0', 10),
        waiting: parseInt(flatResult[0]?.waiting || '0', 10),
      };
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}

// Fetch unified metrics using a single CTE to ensure mutually exclusive rates
// All rates are based on the CURRENT state (most recent record per lead)
// This guarantees: followupRate + returnRate + interventionRate + lossRate = 100%
export function useFollowupReturnRate(filters: FollowupFiltersState) {
  return useQuery({
    queryKey: ['followup-return-rate', filters],
    queryFn: async () => {
      if (!filters.agentCodes.length) return { 
        totalLeads: 0,
        leadsInFollowup: 0, 
        leadsReturned: 0,
        leadsIntervention: 0,
        leadsLost: 0,
        responses: 0, 
        followupRate: 0,
        returnRate: 0,
        interventionRate: 0,
        lossRate: 0 
      };

      const agentPlaceholders = filters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...filters.agentCodes];

      let dateFilter = '';
      let fqDateFilter = ''; // With fq. prefix for leads_with_response CTE
      if (filters.dateFrom) {
        dateFilter += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        fqDateFilter += ` AND (fq.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        dateFilter += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        fqDateFilter += ` AND (fq.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(filters.dateTo);
      }

      // Response date filter uses same params as main filter
      let responseDateFilter = '';
      if (filters.dateFrom) {
        responseDateFilter += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.indexOf(filters.dateFrom) + 1}`;
      }
      if (filters.dateTo) {
        responseDateFilter += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.indexOf(filters.dateTo) + 1}`;
      }

      // Unified query using CTE to get CURRENT state of each lead
      const result = await externalDb.raw<{
        total_leads: string;
        in_followup: string;
        returned: string;
        intervention: string;
        lost: string;
        total_responses: string;
      }[]>({
        query: `
          WITH current_state AS (
            -- Get CURRENT state for each lead (most recent record by send_date)
            SELECT DISTINCT ON (cod_agent, session_id)
              session_id,
              id as queue_id,
              state,
              step_number
            FROM followup_queue
            WHERE cod_agent IN (${agentPlaceholders})
              ${dateFilter}
            ORDER BY cod_agent, session_id, send_date DESC
          ),
          leads_with_response AS (
            -- Identify session_ids that have a response in ANY queue record (not just the most recent)
            SELECT DISTINCT fq.session_id
            FROM followup_queue fq
            INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
            WHERE fq.cod_agent IN (${agentPlaceholders})
              AND fq.session_id IN (SELECT session_id FROM current_state WHERE state = 'STOP')
              ${fqDateFilter}
          )
          SELECT 
            COUNT(*)::text as total_leads,
            
            -- Taxa em FollowUp: leads currently in SEND state
            COUNT(*) FILTER (WHERE state = 'SEND')::text as in_followup,
            
            -- Taxa de Retorno: leads in STOP + step<>0 + has response
            COUNT(*) FILTER (
              WHERE state = 'STOP' 
                AND step_number <> 0 
                AND session_id IN (SELECT session_id FROM leads_with_response)
            )::text as returned,
            
            -- Taxa de Intervenção: leads in STOP + step<>0 + NO response (human intervention)
            COUNT(*) FILTER (
              WHERE state = 'STOP' 
                AND step_number <> 0 
                AND session_id NOT IN (SELECT session_id FROM leads_with_response)
            )::text as intervention,
            
            -- Taxa de Perda: leads in STOP + step=0
            COUNT(*) FILTER (WHERE state = 'STOP' AND step_number = 0)::text as lost,
            
            -- Total responses (COUNT of all response records)
            (SELECT COUNT(*)::text FROM followup_response fr
             JOIN followup_queue fq ON fq.id = fr.followup_queue_id
             WHERE fq.cod_agent IN (${agentPlaceholders})
               ${responseDateFilter}
            ) as total_responses
            
          FROM current_state
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];
      const totalLeads = parseInt(flatResult[0]?.total_leads || '0', 10);
      const inFollowup = parseInt(flatResult[0]?.in_followup || '0', 10);
      const returned = parseInt(flatResult[0]?.returned || '0', 10);
      const intervention = parseInt(flatResult[0]?.intervention || '0', 10);
      const lost = parseInt(flatResult[0]?.lost || '0', 10);
      const responses = parseInt(flatResult[0]?.total_responses || '0', 10);

      return {
        totalLeads,
        leadsInFollowup: inFollowup,
        leadsReturned: returned,
        leadsIntervention: intervention,
        leadsLost: lost,
        responses,
        followupRate: totalLeads > 0 ? (inFollowup / totalLeads) * 100 : 0,
        returnRate: totalLeads > 0 ? (returned / totalLeads) * 100 : 0,
        interventionRate: totalLeads > 0 ? (intervention / totalLeads) * 100 : 0,
        lossRate: totalLeads > 0 ? (lost / totalLeads) * 100 : 0,
      };
    },
    enabled: filters.agentCodes.length > 0,
    staleTime: 1000 * 30,
  });
}

// Hook to fetch previous period stats for comparison
export function useFollowupPreviousPeriodStats(filters: FollowupFiltersState) {
  // Calculate previous period dates
  const previousPeriod = useMemo(() => {
    if (!filters.dateFrom || !filters.dateTo) return null;
    return getPreviousPeriod(filters.dateFrom, filters.dateTo);
  }, [filters.dateFrom, filters.dateTo]);

  const previousFilters: FollowupFiltersState = useMemo(() => ({
    ...filters,
    dateFrom: previousPeriod?.previousDateFrom || '',
    dateTo: previousPeriod?.previousDateTo || '',
  }), [filters, previousPeriod]);

  const enabled = !!previousPeriod && filters.agentCodes.length > 0;

  // Fetch sent count for previous period
  const { data: sentCount = 0, isLoading: isLoadingSent } = useQuery({
    queryKey: ['followup-sent-count-previous', previousFilters],
    queryFn: async () => {
      if (!previousFilters.agentCodes.length || !previousFilters.dateFrom) return 0;

      const agentPlaceholders = previousFilters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...previousFilters.agentCodes];

      let whereClause = `fq.cod_agent IN (${agentPlaceholders})`;

      if (previousFilters.dateFrom) {
        whereClause += ` AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(previousFilters.dateFrom);
      }
      if (previousFilters.dateTo) {
        whereClause += ` AND (fh.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(previousFilters.dateTo);
      }

      const result = await externalDb.raw<{ total: string }[]>({
        query: `
          SELECT COUNT(*)::text as total
          FROM followup_history fh
          JOIN followup_queue fq ON fq.id = fh.followup_queue_id
          WHERE ${whereClause}
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];
      return parseInt(flatResult[0]?.total || '0', 10);
    },
    enabled,
    staleTime: 1000 * 60,
  });

  // Fetch unified metrics for previous period using same CTE logic as useFollowupReturnRate
  const { data: returnData, isLoading: isLoadingReturn } = useQuery({
    queryKey: ['followup-return-rate-previous', previousFilters],
    queryFn: async () => {
      if (!previousFilters.agentCodes.length || !previousFilters.dateFrom) {
        return { 
          totalLeads: 0, 
          leadsInFollowup: 0,
          leadsReturned: 0,
          leadsIntervention: 0,
          leadsLost: 0, 
          responses: 0, 
          followupRate: 0,
          returnRate: 0,
          interventionRate: 0,
          lossRate: 0 
        };
      }

      const agentPlaceholders = previousFilters.agentCodes.map((_, i) => `$${i + 1}`).join(', ');
      const params: (string | number)[] = [...previousFilters.agentCodes];

      let dateFilter = '';
      let fqDateFilter = ''; // With fq. prefix for leads_with_response CTE
      if (previousFilters.dateFrom) {
        dateFilter += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        fqDateFilter += ` AND (fq.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.length + 1}`;
        params.push(previousFilters.dateFrom);
      }
      if (previousFilters.dateTo) {
        dateFilter += ` AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        fqDateFilter += ` AND (fq.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.length + 1}`;
        params.push(previousFilters.dateTo);
      }

      // Response date filter uses same params as main filter
      let responseDateFilter = '';
      if (previousFilters.dateFrom) {
        responseDateFilter += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $${params.indexOf(previousFilters.dateFrom) + 1}`;
      }
      if (previousFilters.dateTo) {
        responseDateFilter += ` AND (fr.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $${params.indexOf(previousFilters.dateTo) + 1}`;
      }

      // Unified query using CTE to get CURRENT state of each lead
      const result = await externalDb.raw<{
        total_leads: string;
        in_followup: string;
        returned: string;
        intervention: string;
        lost: string;
        total_responses: string;
      }[]>({
        query: `
          WITH current_state AS (
            -- Get CURRENT state for each lead (most recent record by send_date)
            SELECT DISTINCT ON (cod_agent, session_id)
              session_id,
              id as queue_id,
              state,
              step_number
            FROM followup_queue
            WHERE cod_agent IN (${agentPlaceholders})
              ${dateFilter}
            ORDER BY cod_agent, session_id, send_date DESC
          ),
          leads_with_response AS (
            -- Identify session_ids that have a response in ANY queue record (not just the most recent)
            SELECT DISTINCT fq.session_id
            FROM followup_queue fq
            INNER JOIN followup_response fr ON fr.followup_queue_id = fq.id
            WHERE fq.cod_agent IN (${agentPlaceholders})
              AND fq.session_id IN (SELECT session_id FROM current_state WHERE state = 'STOP')
              ${fqDateFilter}
          )
          SELECT 
            COUNT(*)::text as total_leads,
            COUNT(*) FILTER (WHERE state = 'SEND')::text as in_followup,
            COUNT(*) FILTER (
              WHERE state = 'STOP' 
                AND step_number <> 0 
                AND session_id IN (SELECT session_id FROM leads_with_response)
            )::text as returned,
            COUNT(*) FILTER (
              WHERE state = 'STOP' 
                AND step_number <> 0 
                AND session_id NOT IN (SELECT session_id FROM leads_with_response)
            )::text as intervention,
            COUNT(*) FILTER (WHERE state = 'STOP' AND step_number = 0)::text as lost,
            (SELECT COUNT(*)::text FROM followup_response fr
             JOIN followup_queue fq ON fq.id = fr.followup_queue_id
             WHERE fq.cod_agent IN (${agentPlaceholders})
               ${responseDateFilter}
            ) as total_responses
          FROM current_state
        `,
        params,
      });

      const flatResult = Array.isArray(result) ? result.flat() : [];
      const totalLeads = parseInt(flatResult[0]?.total_leads || '0', 10);
      const inFollowup = parseInt(flatResult[0]?.in_followup || '0', 10);
      const returned = parseInt(flatResult[0]?.returned || '0', 10);
      const intervention = parseInt(flatResult[0]?.intervention || '0', 10);
      const lost = parseInt(flatResult[0]?.lost || '0', 10);
      const responses = parseInt(flatResult[0]?.total_responses || '0', 10);

      return {
        totalLeads,
        leadsInFollowup: inFollowup,
        leadsReturned: returned,
        leadsIntervention: intervention,
        leadsLost: lost,
        responses,
        followupRate: totalLeads > 0 ? (inFollowup / totalLeads) * 100 : 0,
        returnRate: totalLeads > 0 ? (returned / totalLeads) * 100 : 0,
        interventionRate: totalLeads > 0 ? (intervention / totalLeads) * 100 : 0,
        lossRate: totalLeads > 0 ? (lost / totalLeads) * 100 : 0,
      };
    },
    enabled,
    staleTime: 1000 * 60,
  });

  // Return unified metrics - no need for separate queueTotals query since returnData already has all metrics
  return useMemo((): { previous: FollowupPreviousStats; isLoading: boolean } => {
    return {
      previous: {
        totalSent: sentCount,
        stopped: returnData?.responses || 0,
        responseRate: returnData?.returnRate || 0,
        lossRate: returnData?.lossRate || 0,
        total: returnData?.totalLeads || 0,
        waiting: returnData?.leadsInFollowup || 0,
        followupRate: returnData?.followupRate || 0,
        interventionRate: returnData?.interventionRate || 0,
      },
      isLoading: isLoadingSent || isLoadingReturn,
    };
  }, [sentCount, returnData, isLoadingSent, isLoadingReturn]);
}
