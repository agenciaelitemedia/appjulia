/**
 * extend/auth — identidade, tenant efetivo e permissões do módulo X-Julia.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { isOwnerUser } from '@/lib/auth/isOwner';
import { resolveEffectiveClientId } from '@/lib/resolveEffectiveClientId';
import { X_JULIA_MODULE } from '../module';
import type { XJPermissions } from '../types';

export { isOwnerUser };

export function useXJIdentity() {
  const { user } = useAuth();
  return {
    user,
    userId: user?.id ? String(user.id) : null,
    userName: user?.name ?? user?.email ?? null,
    isAdmin: user?.role === 'admin',
    isOwner: isOwnerUser(user),
  };
}

/** client_id efetivo (herdado do titular quando o usuário é membro de equipe). */
export function useXJClientId() {
  const { user } = useAuth();
  return useQuery<string | null>({
    queryKey: ['x-julia', 'client-id', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const resolved = await resolveEffectiveClientId(user, 'x-julia');
      return resolved ? String(resolved) : null;
    },
  });
}

/**
 * Permissões por item de menu do X-Julia.
 * Admin e dono do escritório sempre têm acesso total.
 */
export function useXJPermissions(moduleCode: string = X_JULIA_MODULE.code): XJPermissions {
  const { user, hasPermission } = useAuth();
  const privileged = user?.role === 'admin' || isOwnerUser(user);
  return {
    canView: privileged || hasPermission(moduleCode as any, 'view'),
    canCreate: privileged || hasPermission(moduleCode as any, 'create'),
    canEdit: privileged || hasPermission(moduleCode as any, 'edit'),
    canDelete: privileged || hasPermission(moduleCode as any, 'delete'),
  };
}