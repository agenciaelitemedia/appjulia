import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { BoardPermissionMode, CRMBoardSettings } from '../types';
import { isOwnerUser, useIsOwner } from '@/lib/auth/isOwner';

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
  mode: BoardPermissionMode;
}

const DEFAULT_PERMISSION_MODE: BoardPermissionMode = 'disabled';

export function getBoardPermissionMode(settings?: CRMBoardSettings | Record<string, unknown> | null): BoardPermissionMode {
  const value = settings?.permission_mode;
  if (value === 'role' || value === 'user') return value;
  return DEFAULT_PERMISSION_MODE;
}

export function isClientOwnerUser(user: unknown): boolean {
  // Delegado ao helper compartilhado (admin | user | colaborador).
  return isOwnerUser(user);
}

/**
 * Owner = admin OR the client owner (user.id === user.client_id).
 * Owners always have full access and can manage permissions.
 */
export function useIsBoardOwner(): boolean {
  return useIsOwner();
}

/**
 * Bypass total das regras — reservado a administradores globais.
 * Donos de cliente (role='user' sem user_id) continuam podendo gerenciar
 * permissões via `useIsBoardOwner`, mas passam pela filtragem normal para
 * que o modo "Perfil"/"Usuário" tenha efeito também sobre eles.
 */
function isFullAccessUser(user: unknown): boolean {
  if (!user) return false;
  const u = user as { role?: string } | null;
  if (u?.role === 'admin') return true;
  return isOwnerUser(user);
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
      const { data, error } = await supabase
        .from('crm_board_permissions')
        .upsert(payload as any, { onConflict: 'board_id,subject_type,subject_id' })
        .select('*')
        .single();
      if (error) {
        toast.error('Erro ao salvar permissão: ' + error.message);
        return false;
      }
      if (data) {
        const saved = data as BoardPermissionRule;
        setRules((prev) => {
          const key = `${saved.subject_type}:${saved.subject_id}`;
          const without = prev.filter((r) => `${r.subject_type}:${r.subject_id}` !== key);
          return [...without, saved];
        });
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
      setRules((prev) => prev.filter((r) => r.id !== id));
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
  const hasFullAccess = isFullAccessUser(user);
  const [rules, setRules] = useState<BoardPermissionRule[] | null>(null);
  const [mode, setMode] = useState<BoardPermissionMode | null>(null);

  const fetchBoardMode = useCallback(async () => {
    if (!boardId) {
      setMode(DEFAULT_PERMISSION_MODE);
      return;
    }
    const { data } = await supabase
      .from('crm_boards')
      .select('settings')
      .eq('id', boardId)
      .maybeSingle();
    setMode(getBoardPermissionMode((data as { settings?: CRMBoardSettings } | null)?.settings));
  }, [boardId]);

  useEffect(() => {
    let cancelled = false;
    if (!boardId) {
      setRules([]);
      setMode(DEFAULT_PERMISSION_MODE);
      return;
    }
    setRules(null);
    setMode(null);
    fetchBoardMode();
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
    const boardChannel = supabase
      .channel(`crm-board-eff-settings-${boardId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'crm_boards', filter: `id=eq.${boardId}` },
        (payload) => {
          const next = payload.new as { settings?: CRMBoardSettings } | null;
          setMode(getBoardPermissionMode(next?.settings));
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      supabase.removeChannel(boardChannel);
    };
  }, [boardId, fetchBoardMode]);

  return useMemo<EffectiveBoardPermission>(() => {
    const loading = rules === null || mode === null;
    const permissionMode = mode ?? DEFAULT_PERMISSION_MODE;
    if (hasFullAccess) {
      return {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canManage: true,
        isOwner,
        loading,
        hasRules: (rules?.length ?? 0) > 0,
        mode: permissionMode,
      };
    }
    if (!user || loading) {
      return {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canManage: false,
        isOwner,
        loading,
        hasRules: false,
        mode: permissionMode,
      };
    }
    if (permissionMode === 'disabled') {
      return {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canManage: isOwner,
        isOwner,
        loading: false,
        hasRules: (rules?.length ?? 0) > 0,
        mode: permissionMode,
      };
    }
    const uid = String(user.id);
    const role = String(user.role || '');
    const activeRules = rules ?? [];
    const matches = activeRules.filter((r) => {
      if (permissionMode === 'user') return r.subject_type === 'user' && r.subject_id === uid;
      // Modo 'role': aceita perfil do usuário OU usuário adicionado explicitamente.
      return (
        (r.subject_type === 'role' && r.subject_id === role) ||
        (r.subject_type === 'user' && r.subject_id === uid)
      );
    });
    const any = (k: keyof BoardPermissionRule) => matches.some((r) => Boolean(r[k]));
    return {
      canView: any('can_view'),
      canCreate: any('can_create'),
      canEdit: any('can_edit'),
      canDelete: any('can_delete'),
      canManage: isOwner,
      isOwner,
      loading: false,
      hasRules: true,
      mode: permissionMode,
    };
  }, [rules, mode, user, isOwner, hasFullAccess]);
}