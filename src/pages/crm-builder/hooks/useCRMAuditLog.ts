import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AuditEntityType = 'board' | 'pipeline' | 'automation' | 'custom_field';
export type AuditAction =
  | 'created'
  | 'updated'
  | 'archived'
  | 'deleted'
  | 'reordered'
  | 'toggled_active';

export interface CRMAuditEntry {
  id: string;
  client_id: string;
  cod_agent: string;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name: string | null;
  action: AuditAction;
  changes: Record<string, unknown>;
  created_at: string;
}

interface UseCRMAuditLogOptions {
  clientId: string;
  enabled?: boolean;
  boardId?: string;
  entityType?: AuditEntityType | 'all';
  action?: AuditAction | 'all';
  limit?: number;
}

/**
 * Read-only access to crm_audit_log scoped by client_id.
 * UI usage gated to canManage (owner/admin) at the component level.
 */
export function useCRMAuditLog({
  clientId,
  enabled = true,
  boardId,
  entityType = 'all',
  action = 'all',
  limit = 200,
}: UseCRMAuditLogOptions) {
  const [entries, setEntries] = useState<CRMAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!enabled || !clientId) {
      setEntries([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const client = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => any;
          };
        };
      };
      let query = client.from('crm_audit_log').select('*').eq('client_id', clientId);
      if (entityType && entityType !== 'all') query = query.eq('entity_type', entityType);
      if (action && action !== 'all') query = query.eq('action', action);
      const { data, error: queryError } = await query
        .order('created_at', { ascending: false })
        .limit(limit);
      if (queryError) throw queryError;
      let rows = (data || []) as CRMAuditEntry[];
      // Optional in-memory boardId scoping (audit log doesn't store board_id directly,
      // but for board entity it's the entity_id; for pipeline/automation/custom_field
      // we keep the board id inside `changes.board_id` when available).
      if (boardId) {
        rows = rows.filter((r) => {
          if (r.entity_type === 'board') return r.entity_id === boardId;
          const bid = (r.changes as { board_id?: string } | null)?.board_id;
          return bid === boardId;
        });
      }
      setEntries(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar auditoria';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, clientId, boardId, entityType, action, limit]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Realtime: refresh on any insert for this client
  useEffect(() => {
    if (!enabled || !clientId) return;
    const channel = supabase
      .channel(`crm-audit-log-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_audit_log',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchEntries();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, clientId, fetchEntries]);

  return { entries, isLoading, error, refetch: fetchEntries };
}

/**
 * Best-effort fire-and-forget audit logger. Silently swallows errors so it never
 * breaks the user-facing mutation.
 */
export async function logCRMAudit(payload: {
  clientId: string;
  codAgent: string;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string | null;
  action: AuditAction;
  changes?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!payload.clientId || !payload.codAgent || !payload.entityId) return;
    const client = supabase as unknown as {
      from: (table: string) => {
        insert: (data: Record<string, unknown>) => Promise<{ error: unknown }>;
      };
    };
    await client.from('crm_audit_log').insert({
      client_id: payload.clientId,
      cod_agent: payload.codAgent,
      entity_type: payload.entityType,
      entity_id: payload.entityId,
      entity_name: payload.entityName ?? null,
      action: payload.action,
      changes: payload.changes ?? {},
    });
  } catch {
    console.warn('[crm_audit_log] failed to record entry');
  }
}

export const ENTITY_LABEL: Record<AuditEntityType, string> = {
  board: 'Board',
  pipeline: 'Etapa',
  automation: 'Automação',
  custom_field: 'Campo',
};

export const ACTION_LABEL: Record<AuditAction, string> = {
  created: 'criou',
  updated: 'editou',
  archived: 'arquivou',
  deleted: 'removeu',
  reordered: 'reordenou',
  toggled_active: 'ativou/desativou',
};
