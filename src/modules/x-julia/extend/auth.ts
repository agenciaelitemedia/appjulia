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

export function useXJPermissions(): XJPermissions {
  const { user, hasPermission } = useAuth();
  const privileged = user?.role === 'admin' || isOwnerUser(user);
  const code = X_JULIA_MODULE.code as any;
  return {
    canView: privileged || hasPermission(code, 'view'),
    canCreate: privileged || hasPermission(code, 'create'),
    canEdit: privileged || hasPermission(code, 'edit'),
    canDelete: privileged || hasPermission(code, 'delete'),
  };
}