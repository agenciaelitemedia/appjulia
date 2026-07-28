import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type PermissionSubjectType = 'user' | 'role';

export interface BoardPermissionRule {
  id: string;
  board_id: string;
  client_id: string;
  subject_type: PermissionSubjectType;
  subject_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EffectiveBoardPermission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManage: boolean;
  isOwner: boolean;
  loading: boolean;
  hasRules: boolean;
}

/**
 * Owner = admin OR the client owner (user.id === user.client_id).
 * Owners always have full access and can manage permissions.
 */
export function useIsBoardOwner(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (user.role === 'admin') return true;
  // Dono do client_id = usuário titular do tenant (tem client_id e não é sub-usuário)
  return !!user.client_id && !(user as any).user_id;
}

/** Fetch all permission rules for a board (owner-scoped in UI). */
export function useBoardPermissions(boardId: string | null) {
  const [rules, setRules] = useState<BoardPermissionRule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    if (!boardId) {
      setRules([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('crm_board_permissions')
      .select('*')
      .eq('board_id', boardId);
    setLoading(false);
    if (error) {
      toast.error('Erro ao carregar permissões: ' + error.message);
      return;
    }
    setRules((data || []) as BoardPermissionRule[]);
  }, [boardId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (!boardId) return;
    const ch = supabase
      .channel(`crm-board-permissions-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_board_permissions', filter: `board_id=eq.${boardId}` },
        () => fetchRules()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [boardId, fetchRules]);

  const upsert = useCallback(
    async (
      input: {
        subject_type: PermissionSubjectType;
        subject_id: string;
        can_view: boolean;
        can_create: boolean;
        can_edit: boolean;
        can_delete: boolean;
      },
      ctx: { clientId: string; createdBy?: string | null }
    ) => {
      if (!boardId) return false;
      const payload = {
        board_id: boardId,
        client_id: ctx.clientId,
        created_by: ctx.createdBy ?? null,
        ...input,
      };
      const { error } = await supabase
        .from('crm_board_permissions')
        .upsert(payload as any, { onConflict: 'board_id,subject_type,subject_id' });
      if (error) {
        toast.error('Erro ao salvar permissão: ' + error.message);
        return false;
      }
      return true;
    },
    [boardId]
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('crm_board_permissions').delete().eq('id', id);
      if (error) {
        toast.error('Erro ao remover permissão: ' + error.message);
        return false;
      }
      return true;
    },
    []
  );

  return { rules, loading, fetchRules, upsert, remove };
}

/**
 * Compute effective permissions for the current user on a board.
 * Rule set:
 * - Owner (admin OR user.id === client_id): full access, always.
 * - If NO rules exist for the board → open (backward compatible).
 * - Otherwise merge user-specific rule OR role rule (OR-ed together).
 *   If neither matches → view-only if any 'view' rule exists globally? No →
 *   we default to NO access when rules exist and none matches this user.
 */
export function useEffectiveBoardPermission(boardId: string | null): EffectiveBoardPermission {
  const { user } = useAuth();
  const isOwner = useIsBoardOwner();
  const [rules, setRules] = useState<BoardPermissionRule[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!boardId) {
      setRules([]);
      return;
    }
    setRules(null);
    supabase
      .from('crm_board_permissions')
      .select('*')
      .eq('board_id', boardId)
      .then(({ data }) => {
        if (!cancelled) setRules((data || []) as BoardPermissionRule[]);
      });
    const ch = supabase
      .channel(`crm-board-eff-perms-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_board_permissions', filter: `board_id=eq.${boardId}` },
        async () => {
          const { data } = await supabase
            .from('crm_board_permissions')
            .select('*')
            .eq('board_id', boardId);
          if (!cancelled) setRules((data || []) as BoardPermissionRule[]);
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [boardId]);

  return useMemo<EffectiveBoardPermission>(() => {
    const loading = rules === null;
    if (isOwner) {
      return {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canManage: true,
        isOwner: true,
        loading,
        hasRules: (rules?.length ?? 0) > 0,
      };
    }
    if (!user || loading) {
      return {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canManage: false,
        isOwner: false,
        loading,
        hasRules: false,
      };
    }
    // No rules configured → open (backward compatible)
    if (rules!.length === 0) {
      return {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canManage: false,
        isOwner: false,
        loading: false,
        hasRules: false,
      };
    }
    const uid = String(user.id);
    const role = String(user.role || '');
    const matches = rules!.filter(
      (r) =>
        (r.subject_type === 'user' && r.subject_id === uid) ||
        (r.subject_type === 'role' && r.subject_id === role)
    );
    const any = (k: keyof BoardPermissionRule) => matches.some((r) => Boolean(r[k]));
    return {
      canView: any('can_view'),
      canCreate: any('can_create'),
      canEdit: any('can_edit'),
      canDelete: any('can_delete'),
      canManage: false,
      isOwner: false,
      loading: false,
      hasRules: true,
    };
  }, [rules, user, isOwner]);
}